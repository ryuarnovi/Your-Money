import { NextRequest, NextResponse } from "next/server";
import { queryAll } from "@/db/client";
import { bot } from "@/server/telegram/bot";
import * as XLSX from "xlsx";
import { formatCurrency, formatDate } from "@/utils";
import { InputFile } from "grammy";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await queryAll<{ user_id: string; telegram_chat_id: string }>(
      "SELECT user_id, telegram_chat_id FROM telegram_users WHERE is_verified = 1"
    );

    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 86400;

    for (const u of users) {
      const txs = await queryAll<{
        date: number;
        type: string;
        amount: number;
        description: string;
      }>(
        "SELECT date, type, amount, description FROM transactions WHERE user_id = ? AND date >= ? ORDER BY date DESC",
        [u.user_id, thirtyDaysAgo]
      );

      if (txs.length === 0) continue;

      const dataToExport = txs.map((t) => ({
        Tanggal: formatDate(new Date(t.date * 1000)),
        Jenis: t.type === "income" ? "Pemasukan" : "Pengeluaran",
        Nominal: t.amount,
        Keterangan: t.description || "-",
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Bulanan");

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      await bot.api.sendDocument(
        u.telegram_chat_id,
        new InputFile(buffer, `Laporan_Bulanan_DuitKu_${new Date().toISOString().split("T")[0]}.xlsx`),
        { caption: "📅 *Laporan Keuangan Bulanan Otomatis DuitKu*", parse_mode: "Markdown" }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Monthly cron report error:", error);
    return NextResponse.json({ error: "Cron execution failed" }, { status: 500 });
  }
}
