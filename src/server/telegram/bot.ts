import { Bot, Context, webhookCallback } from "grammy";
import { queryOne, queryAll, executeQuery } from "@/db/client";
import { findCategoryByName, getCategories } from "@/repositories/category.repository";
import { createTransaction, getTransactionStats } from "@/repositories/transaction.repository";
import { getActiveBudgets } from "@/repositories/budget.repository";
import { formatCurrency, formatDate } from "@/utils";

const token = process.env.TELEGRAM_BOT_TOKEN || "DEFAULT_TOKEN";
export const bot = new Bot(token);

bot.catch((err) => {
  console.error("Grammy error handled:", err.error);
});

// Helper to get linked user for a chat ID
async function getUserIdByChatId(chatId: string): Promise<string | null> {
  const row = await queryOne<{ user_id: string }>(
    "SELECT user_id FROM telegram_users WHERE telegram_chat_id = ?",
    [chatId]
  );

  if (row) return row.user_id;

  // Auto link to default main user if available
  const mainUser = await queryOne<{ id: string }>("SELECT id FROM users ORDER BY created_at ASC LIMIT 1");
  if (mainUser) {
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await executeQuery(
      "INSERT INTO telegram_users (id, user_id, telegram_chat_id, is_verified, created_at) VALUES (?, ?, ?, 1, ?)",
      [id, mainUser.id, chatId, now]
    );
    return mainUser.id;
  }

  return null;
}

// Command: /start
bot.command("start", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const userId = await getUserIdByChatId(chatId);

  if (userId) {
    await ctx.reply(
      "👋 Selamat datang kembali di *DuitKu Bot*!\n\n" +
      "Ketik `/help` untuk melihat daftar perintah atau kirim pesan singkat seperti:\n" +
      "• `+500000 Gaji`\n" +
      "• `-25000 Makan`\n" +
      "• `-45000 Bensin`",
      { parse_mode: "Markdown" }
    );
  } else {
    await ctx.reply(
      "👋 Selamat datang di *DuitKu Bot*!\n\n" +
      "Akun Telegrammu belum terhubung. ID Chat kamu: `" + chatId + "`\n\n" +
      "Masuk ke menu Pengaturan di web DuitKu dan masukkan ID Chat ini untuk menghubungkan akun.",
      { parse_mode: "Markdown" }
    );
  }
});

// Command: /help
bot.command("help", async (ctx) => {
  await ctx.reply(
    "📋 *Daftar Perintah DuitKu Bot*:\n\n" +
    "/saldo - Cek total saldo & ringkasan\n" +
    "/today - Transaksi hari ini\n" +
    "/month - Transaksi bulan ini\n" +
    "/year - Ringkasan tahun ini\n" +
    "/budget - Status budget kamu\n" +
    "/statistik - Statistik pengeluaran\n" +
    "/report - Laporan ringkas\n\n" +
    "💡 *Cara Catat Cepat*:\n" +
    "• `+500000 Gaji` (Pemasukan)\n" +
    "• `-25000 Makan` (Pengeluaran)\n" +
    "• `-15000 Kopi` (Pengeluaran)\n" +
    "• `-250000 Listrik` (Pengeluaran)",
    { parse_mode: "Markdown" }
  );
});

// Command: /saldo
bot.command("saldo", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const userId = await getUserIdByChatId(chatId);
  if (!userId) return ctx.reply("⚠️ Silakan hubungkan akun DuitKu di web terlebih dahulu.");

  const stats = await getTransactionStats(userId);
  await ctx.reply(
    "💰 *Ringkasan Saldo DuitKu*:\n\n" +
    ` Total Pemasukan: *${formatCurrency(stats.totalIncome)}*\n` +
    ` Total Pengeluaran: *${formatCurrency(stats.totalExpense)}*\n` +
    `-----------------------------------\n` +
    ` Total Saldo: *${formatCurrency(stats.balance)}*`,
    { parse_mode: "Markdown" }
  );
});

// Command: /budget
bot.command("budget", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const userId = await getUserIdByChatId(chatId);
  if (!userId) return ctx.reply("⚠️ Silakan hubungkan akun DuitKu terlebih dahulu.");

  const budgets = await getActiveBudgets(userId);
  if (budgets.length === 0) {
    return ctx.reply("Belum ada budget aktif.");
  }

  let text = "📊 *Status Budget Bulan Ini*:\n\n";
  for (const b of budgets) {
    const pct = Math.round(b.percentage);
    text += `• *${b.name}*: ${formatCurrency(b.spent)} / ${formatCurrency(b.amount)} (${pct}%)\n`;
  }
  await ctx.reply(text, { parse_mode: "Markdown" });
});

// Message listener for natural language input (+500000 Gaji, -25000 Makan)
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith("/")) return; // Ignore unhandled commands

  const chatId = String(ctx.chat.id);
  const userId = await getUserIdByChatId(chatId);
  if (!userId) return ctx.reply("⚠️ Akun Telegram belum terhubung dengan DuitKu.");

  // Regex pattern for +amount category or -amount category
  const match = text.match(/^([+-])(\d+)\s*(.*)$/);
  if (!match) {
    return ctx.reply(
      "Format tidak dikenali. Gunakan contoh:\n`+500000 Gaji` atau `-25000 Makan`",
      { parse_mode: "Markdown" }
    );
  }

  const sign = match[1];
  const amount = Number(match[2]);
  const categoryRaw = match[3].trim() || "Lainnya";
  const type = sign === "+" ? "income" : "expense";

  // Find category
  const cat = await findCategoryByName(categoryRaw, type);
  const categoryId = cat?.id;

  try {
    await createTransaction({
      userId,
      amount,
      type,
      categoryId,
      paymentMethod: "cash",
      description: `Input via Telegram: ${categoryRaw}`,
      date: new Date(),
    });

    await ctx.reply(
      `✅ *Transaksi Berhasil Dicatat*!\n\n` +
      `• Jenis: ${type === "income" ? "Pemasukan 🟢" : "Pengeluaran 🔴"}\n` +
      `• Nominal: *${formatCurrency(amount)}*\n` +
      `• Kategori: *${cat?.name || categoryRaw}*`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    console.error("Failed to save telegram transaction:", error);
    await ctx.reply("❌ Gagal menyimpan transaksi.");
  }
});
