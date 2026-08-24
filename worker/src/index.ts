import { Hono } from "hono";

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Result<T = unknown> {
  results: T[];
  meta: Record<string, unknown>;
}

export type Bindings = {
  DB: D1Database;
  WORKER_API_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Authentication Middleware
app.use("*", async (c, next) => {
  if (c.req.path === "/health") return next();

  const apiKey = c.req.header("x-api-key");
  const expectedKey = c.env.WORKER_API_KEY || "dev-api-key";

  if (apiKey !== expectedKey) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  await next();
});

// Health check
app.get("/health", (c) => c.text("OK"));

// Execute single SQL query
app.post("/api/query", async (c) => {
  try {
    const { sql, params = [] } = await c.req.json<{ sql: string; params: unknown[] }>();

    const stmt = c.env.DB.prepare(sql).bind(...params);
    const result = await stmt.all();

    return c.json({
      success: true,
      data: {
        results: result.results,
        meta: result.meta,
      },
    });
  } catch (error) {
    console.error("D1 Worker Query Error:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Database error",
      },
      500
    );
  }
});

// Execute batch SQL queries
app.post("/api/batch", async (c) => {
  try {
    const { queries } = await c.req.json<{
      queries: { sql: string; params?: unknown[] }[];
    }>();

    const stmts = queries.map((q) => c.env.DB.prepare(q.sql).bind(...(q.params || [])));
    const results = await c.env.DB.batch(stmts);

    return c.json({
      success: true,
      data: results.map((r: any) => ({
        results: r.results,
        meta: r.meta,
      })),
    });
  } catch (error) {
    console.error("D1 Worker Batch Error:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Batch database error",
      },
      500
    );
  }
});

// ============================================
// CLOUDFLARE CRON TRIGGER HANDLER
// ============================================

interface ScheduledEvent {
  cron: string;
  type: string;
  scheduledTime: number;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    console.log(`Cron triggered: ${event.cron}`);

    const botToken = env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.warn("TELEGRAM_BOT_TOKEN not configured in Worker");
      return;
    }

    try {
      // Get all verified Telegram users directly from D1
      const { results: users } = await env.DB.prepare(
        "SELECT user_id, telegram_chat_id FROM telegram_users WHERE is_verified = 1"
      ).all<{ user_id: string; telegram_chat_id: string }>();

      const isWeekly = event.cron === "0 13 * * SUN"; // Sunday 20:00 WIB (13:00 UTC)
      const now = Math.floor(Date.now() / 1000);
      const timeWindow = isWeekly ? 7 * 86400 : 30 * 86400;

      for (const u of users) {
        const { results: txs } = await env.DB.prepare(
          "SELECT date, type, amount, description FROM transactions WHERE user_id = ? AND date >= ? ORDER BY date DESC"
        ).bind(u.user_id, now - timeWindow).all<{
          date: number;
          type: string;
          amount: number;
          description: string | null;
        }>();

        if (txs.length === 0) continue;

        let summaryText = isWeekly ? "📊 *Laporan Mingguan DuitKu*\n\n" : "📅 *Laporan Bulanan DuitKu*\n\n";
        let totalIncome = 0;
        let totalExpense = 0;

        for (const t of txs) {
          if (t.type === "income") totalIncome += t.amount;
          if (t.type === "expense") totalExpense += t.amount;
        }

        summaryText += `🟢 Total Pemasukan: Rp${totalIncome.toLocaleString("id-ID")}\n`;
        summaryText += `🔴 Total Pengeluaran: Rp${totalExpense.toLocaleString("id-ID")}\n`;
        summaryText += `💰 Selisih: Rp${(totalIncome - totalExpense).toLocaleString("id-ID")}\n`;
        summaryText += `\nTotal ${txs.length} transaksi tercatat.`;

        // Send summary text via Telegram API
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: u.telegram_chat_id,
            text: summaryText,
            parse_mode: "Markdown",
          }),
        });

        // Generate and send CSV file document automatically with summary totals
        const csvLines = ["Tanggal,Jenis,Nominal,Keterangan"];
        let periodIncome = 0;
        let periodExpense = 0;

        for (const t of txs) {
          if (t.type === "income") periodIncome += t.amount;
          if (t.type === "expense") periodExpense += t.amount;

          const dateStr = new Date(t.date * 1000).toISOString().split("T")[0];
          const typeStr = t.type === "income" ? "Pemasukan" : "Pengeluaran";
          const desc = `"${(t.description || "-").replace(/"/g, '""')}"`;
          csvLines.push(`${dateStr},${typeStr},${t.amount},${desc}`);
        }

        // Append empty line and totals summary
        csvLines.push("");
        csvLines.push(`TOTAL PEMASUKAN,Pemasukan,${periodIncome},"Total Pemasukan Periode Ini"`);
        csvLines.push(`TOTAL PENGELUARAN,Pengeluaran,${periodExpense},"Total Pengeluaran Periode Ini"`);
        csvLines.push(`NET CASHFLOW,${periodIncome - periodExpense >= 0 ? "Surplus" : "Defisit"},${periodIncome - periodExpense},"Selisih Pemasukan - Pengeluaran"`);

        const csvContent = csvLines.join("\n");
        const dateToday = new Date().toISOString().split("T")[0];
        const reportTitle = isWeekly ? "Mingguan" : "Bulanan";

        const formData = new FormData();
        formData.append("chat_id", u.telegram_chat_id);
        formData.append("caption", `📎 *File CSV Laporan ${reportTitle} DuitKu*`);
        formData.append("parse_mode", "Markdown");
        formData.append(
          "document",
          new Blob([csvContent], { type: "text/csv" }),
          `Laporan_${reportTitle}_DuitKu_${dateToday}.csv`
        );

        await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
          method: "POST",
          body: formData,
        });
      }
    } catch (err) {
      console.error("Cloudflare Cron error:", err);
    }
  },
};
