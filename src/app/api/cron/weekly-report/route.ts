import { NextRequest, NextResponse } from "next/server";
import { queryAll } from "@/db/client";
import { bot } from "@/server/telegram/bot";
import * as XLSX from "xlsx";
import { formatCurrency, formatDate } from "@/utils";
import { InputFile } from "grammy";

export async function GET(req: NextRequest) {
  // Authorization check for Vercel Cron
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all verified telegram users
    const users = await queryAll<{ user_id: string; telegram_chat_id: string }>(
      "SELECT user_id, telegram_chat_id FROM telegram_users WHERE is_verified = 1"
    );

    const now = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = now - 7 * 86400;

    for (const u of users) {
      const txs = await queryAll<{
        date: number;
        type: string;
        amount: number;
        description: string;
      }>(
        "SELECT date, type, amount, description FROM transactions WHERE user_id = ? AND date >= ? ORDER BY date DESC",
        [u.user_id, sevenDaysAgo]
      );

      if (txs.length === 0) continue;

      let totalIncome = 0;
      let totalExpense = 0;

      const dataToExport = txs.map((t) => {
        if (t.type === "income") totalIncome += t.amount;
        if (t.type === "expense") totalExpense += t.amount;

        return {
          Tanggal: formatDate(new Date(t.date * 1000)),
          Jenis: t.type === "income" ? "Pemasukan" : "Pengeluaran",
          Nominal: t.amount,
          Keterangan: t.description || "-",
        };
      });

      // Add empty separator row
      dataToExport.push({
        Tanggal: "",
        Jenis: "",
        Nominal: "",
        Keterangan: "",
      } as any);

      // Add Summary Total Rows
      dataToExport.push({
        Tanggal: "TOTAL PEMASUKAN",
        Jenis: "Pemasukan",
        Nominal: totalIncome,
        Keterangan: "Total Pemasukan Minggu Ini",
      } as any);

      dataToExport.push({
        Tanggal: "TOTAL PENGELUARAN",
        Jenis: "Pengeluaran",
        Nominal: totalExpense,
        Keterangan: "Total Pengeluaran Minggu Ini",
      } as any);

      dataToExport.push({
        Tanggal: "NET CASHFLOW (SALDO BERSIH)",
        Jenis: totalIncome - totalExpense >= 0 ? "Surplus" : "Defisit",
        Nominal: totalIncome - totalExpense,
        Keterangan: "Selisih Pemasukan - Pengeluaran",
      } as any);

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Mingguan");

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      await bot.api.sendDocument(
        u.telegram_chat_id,
        new InputFile(buffer, `Laporan_Mingguan_DuitKu_${new Date().toISOString().split("T")[0]}.xlsx`),
        { caption: "📊 *Laporan Keuangan Mingguan Otomatis DuitKu*", parse_mode: "Markdown" }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Weekly cron report error:", error);
    return NextResponse.json({ error: "Cron execution failed" }, { status: 500 });
  }
}
