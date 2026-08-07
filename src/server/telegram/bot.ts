import { Bot } from "grammy";
import { queryOne, executeQuery } from "@/db/client";
import { findCategoryByName } from "@/repositories/category.repository";
import {
  createTransaction,
  getTransactionStats,
  getTransactions,
  getCategoryBreakdown,
} from "@/repositories/transaction.repository";
import { getActiveBudgets } from "@/repositories/budget.repository";
import { getSavingGoals } from "@/repositories/saving.repository";
import { formatCurrency, formatDate, formatMonthYear, getDateRange } from "@/utils";

const token = process.env.TELEGRAM_BOT_TOKEN || "DEFAULT_TOKEN";
export const bot = new Bot(token);

bot.catch((err) => {
  console.error("Grammy error handled:", err.error);
});

export async function registerBotCommands() {
  try {
    await bot.api.setMyCommands([
      { command: "saldo", description: "Cek total saldo & ringkasan" },
      { command: "today", description: "Transaksi hari ini" },
      { command: "month", description: "Transaksi bulan ini" },
      { command: "year", description: "Ringkasan tahun ini" },
      { command: "budget", description: "Status budget kamu" },
      { command: "statistik", description: "Statistik pengeluaran" },
      { command: "report", description: "Laporan ringkas" },
      { command: "danadarurat", description: "Status dana darurat" },
      { command: "help", description: "Daftar perintah bot" },
      { command: "start", description: "Mulai bot" },
    ]);
  } catch (err) {
    console.error("Failed to set bot commands:", err);
  }
}

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
    "/report - Laporan ringkas\n" +
    "/danadarurat - Status dana darurat\n\n" +
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
    `🟢 Total Pemasukan: *${formatCurrency(stats.totalIncome)}*\n` +
    `🔴 Total Pengeluaran: *${formatCurrency(stats.totalExpense)}*\n` +
    `-----------------------------------\n` +
    `💵 Total Saldo: *${formatCurrency(stats.balance)}*`,
    { parse_mode: "Markdown" }
  );
});

// Command: /today
bot.command("today", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const userId = await getUserIdByChatId(chatId);
  if (!userId) return ctx.reply("⚠️ Silakan hubungkan akun DuitKu di web terlebih dahulu.");

  const { start, end } = getDateRange("today");
  const stats = await getTransactionStats(userId, start, end);
  const { data: txs } = await getTransactions(userId, { startDate: start.toISOString(), endDate: end.toISOString(), pageSize: 20 });

  let text = `📅 *Transaksi Hari Ini* (${formatDate(new Date())}):\n\n` +
    `🟢 Pemasukan: *${formatCurrency(stats.totalIncome)}*\n` +
    `🔴 Pengeluaran: *${formatCurrency(stats.totalExpense)}*\n` +
    `-----------------------------------\n` +
    `💰 Selisih: *${formatCurrency(stats.balance)}*\n\n`;

  if (txs.length === 0) {
    text += "ℹ️ Belum ada transaksi yang dicatat hari ini.";
  } else {
    text += `📝 *Daftar Transaksi (${txs.length})*:\n`;
    for (const t of txs) {
      const icon = t.type === "income" ? "🟢" : "🔴";
      const desc = t.description ? ` - ${t.description}` : "";
      text += `${icon} *${formatCurrency(t.amount)}* (${t.categoryName})${desc}\n`;
    }
  }

  await ctx.reply(text, { parse_mode: "Markdown" });
});

// Command: /month
bot.command("month", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const userId = await getUserIdByChatId(chatId);
  if (!userId) return ctx.reply("⚠️ Silakan hubungkan akun DuitKu di web terlebih dahulu.");

  const { start, end } = getDateRange("month");
  const stats = await getTransactionStats(userId, start, end);
  const { data: txs } = await getTransactions(userId, { startDate: start.toISOString(), endDate: end.toISOString(), pageSize: 10 });

  let text = `📅 *Transaksi Bulan Ini* (${formatMonthYear(new Date())}):\n\n` +
    `🟢 Total Pemasukan: *${formatCurrency(stats.totalIncome)}*\n` +
    `🔴 Total Pengeluaran: *${formatCurrency(stats.totalExpense)}*\n` +
    `-----------------------------------\n` +
    `💰 Cashflow Net: *${formatCurrency(stats.balance)}*\n\n`;

  if (txs.length === 0) {
    text += "ℹ️ Belum ada transaksi bulan ini.";
  } else {
    text += `📝 *10 Transaksi Terakhir Bulan Ini*:\n`;
    for (const t of txs) {
      const icon = t.type === "income" ? "🟢" : "🔴";
      const desc = t.description ? ` - ${t.description}` : "";
      const dateStr = formatDate(t.date);
      text += `${icon} *${formatCurrency(t.amount)}* (${t.categoryName})${desc} _[${dateStr}]_\n`;
    }
  }

  await ctx.reply(text, { parse_mode: "Markdown" });
});

// Command: /year
bot.command("year", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const userId = await getUserIdByChatId(chatId);
  if (!userId) return ctx.reply("⚠️ Silakan hubungkan akun DuitKu di web terlebih dahulu.");

  const { start, end } = getDateRange("year");
  const stats = await getTransactionStats(userId, start, end);
  const currentYear = new Date().getFullYear();

  await ctx.reply(
    `🗓️ *Ringkasan Tahun ${currentYear}*:\n\n` +
    `🟢 Total Pemasukan: *${formatCurrency(stats.totalIncome)}*\n` +
    `🔴 Total Pengeluaran: *${formatCurrency(stats.totalExpense)}*\n` +
    `-----------------------------------\n` +
    `💰 Total Net/Surplus: *${formatCurrency(stats.balance)}*`,
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
    const status = b.spent > b.amount ? "⚠️" : "✅";
    text += `${status} *${b.name}*: ${formatCurrency(b.spent)} / ${formatCurrency(b.amount)} (${pct}%)\n`;
  }
  await ctx.reply(text, { parse_mode: "Markdown" });
});

// Command: /statistik
bot.command("statistik", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const userId = await getUserIdByChatId(chatId);
  if (!userId) return ctx.reply("⚠️ Silakan hubungkan akun DuitKu di web terlebih dahulu.");

  const { start, end } = getDateRange("month");
  const expenseBreakdown = await getCategoryBreakdown(userId, "expense", start, end);
  const incomeBreakdown = await getCategoryBreakdown(userId, "income", start, end);

  let text = `📊 *Statistik Keuangan Bulan Ini* (${formatMonthYear(new Date())}):\n\n`;

  if (expenseBreakdown.length > 0) {
    text += "🔴 *Pengeluaran per Kategori*:\n";
    for (const c of expenseBreakdown) {
      text += `• *${c.name}*: ${formatCurrency(c.value)} (${c.percentage.toFixed(1)}%)\n`;
    }
    text += "\n";
  } else {
    text += "🔴 *Pengeluaran per Kategori*: Belum ada data\n\n";
  }

  if (incomeBreakdown.length > 0) {
    text += "🟢 *Pemasukan per Kategori*:\n";
    for (const c of incomeBreakdown) {
      text += `• *${c.name}*: ${formatCurrency(c.value)} (${c.percentage.toFixed(1)}%)\n`;
    }
  } else {
    text += "🟢 *Pemasukan per Kategori*: Belum ada data";
  }

  await ctx.reply(text, { parse_mode: "Markdown" });
});

// Command: /report
bot.command("report", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const userId = await getUserIdByChatId(chatId);
  if (!userId) return ctx.reply("⚠️ Silakan hubungkan akun DuitKu di web terlebih dahulu.");

  const { start, end } = getDateRange("month");
  const stats = await getTransactionStats(userId, start, end);
  const budgets = await getActiveBudgets(userId);
  const savings = await getSavingGoals(userId);

  let text = `📑 *Laporan Ringkas Keuangan (${formatMonthYear(new Date())})*\n\n`;

  text += `💵 *Ringkasan Cashflow*:\n` +
    `• Pemasukan: *${formatCurrency(stats.totalIncome)}*\n` +
    `• Pengeluaran: *${formatCurrency(stats.totalExpense)}*\n` +
    `• Net Cashflow: *${formatCurrency(stats.balance)}*\n\n`;

  text += `📊 *Status Budget (${budgets.length})*:\n`;
  if (budgets.length === 0) {
    text += `• Belum ada budget aktif\n\n`;
  } else {
    for (const b of budgets.slice(0, 5)) {
      const status = b.spent > b.amount ? "⚠️ Melebihi" : "✅ Aman";
      text += `• *${b.name}*: ${formatCurrency(b.spent)} / ${formatCurrency(b.amount)} (${Math.round(b.percentage)}%) ${status}\n`;
    }
    text += "\n";
  }

  text += `🎯 *Target Tabungan (${savings.length})*:\n`;
  if (savings.length === 0) {
    text += `• Belum ada target tabungan\n`;
  } else {
    for (const s of savings.slice(0, 5)) {
      const pct = Math.round(s.percentage);
      text += `• *${s.name}*: ${formatCurrency(s.currentAmount)} / ${formatCurrency(s.targetAmount)} (${pct}%)\n`;
    }
  }

  await ctx.reply(text, { parse_mode: "Markdown" });
});

// Command: /danadarurat
bot.command("danadarurat", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const userId = await getUserIdByChatId(chatId);
  if (!userId) return ctx.reply("⚠️ Silakan hubungkan akun DuitKu di web terlebih dahulu.");

  const stats = await getTransactionStats(userId);
  const savings = await queryOne<{ total: number }>(
    "SELECT COALESCE(SUM(current_amount), 0) as total FROM saving_goals WHERE user_id = ?",
    [userId]
  );

  const avgExpense = stats.totalExpense || 3000000;
  const currentSaved = savings?.total || 0;

  const t3 = avgExpense * 3;
  const t6 = avgExpense * 6;
  const t9 = avgExpense * 9;
  const t12 = avgExpense * 12;

  await ctx.reply(
    "🛡️ *Kalkulasi & Status Dana Darurat*:\n\n" +
    `• Rata-rata Pengeluaran: *${formatCurrency(avgExpense)}/bln*\n` +
    `• Dana Terkumpul: *${formatCurrency(currentSaved)}*\n\n` +
    `📌 *Target Berdasarkan Bulan*:\n` +
    `• *3 Bulan*: ${formatCurrency(t3)} ${currentSaved >= t3 ? "✅ (Aman)" : `(Kurang ${formatCurrency(t3 - currentSaved)})`}\n` +
    `• *6 Bulan (Lajang)*: ${formatCurrency(t6)} ${currentSaved >= t6 ? "✅ (Aman)" : `(Kurang ${formatCurrency(t6 - currentSaved)})`}\n` +
    `• *9 Bulan (Menikah)*: ${formatCurrency(t9)} ${currentSaved >= t9 ? "✅ (Aman)" : `(Kurang ${formatCurrency(t9 - currentSaved)})`}\n` +
    `• *12 Bulan (Menikah+Anak)*: ${formatCurrency(t12)} ${currentSaved >= t12 ? "✅ (Aman)" : `(Kurang ${formatCurrency(t12 - currentSaved)})`}`,
    { parse_mode: "Markdown" }
  );
});

// Message listener for natural language input (+500000 Gaji, -25000 Makan)
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith("/")) return; // Ignore unhandled commands

  const chatId = String(ctx.chat.id);
  const userId = await getUserIdByChatId(chatId);
  if (!userId) return ctx.reply("⚠️ Akun Telegram belum terhubung dengan DuitKu.");

  // Regex pattern for +amount category or -amount category (supports dots/commas e.g. -40.000 transport)
  const match = text.match(/^([+-])([0-9.,\s]+?)\s+(.*)$/);
  if (!match) {
    return ctx.reply(
      "Format tidak dikenali. Gunakan contoh:\n`+500.000 Gaji` atau `-40.000 Transport`",
      { parse_mode: "Markdown" }
    );
  }

  const sign = match[1];
  const rawAmountStr = match[2].replace(/[^0-9]/g, "");
  const amount = Number(rawAmountStr);

  if (!amount || isNaN(amount)) {
    return ctx.reply("⚠️ Nominal angka tidak valid.");
  }

  const fullDesc = match[3].trim();
  // Clean category search string (e.g. 'transport(pengeluaran)' -> 'transport')
  const cleanCategorySearch = fullDesc.replace(/\(.*?\)/g, "").trim() || fullDesc;
  const type = sign === "+" ? "income" : "expense";

  // Find category
  const cat = await findCategoryByName(cleanCategorySearch, type);
  const categoryId = cat?.id;

  try {
    await createTransaction({
      userId,
      amount,
      type,
      categoryId,
      paymentMethod: "cash",
      description: fullDesc,
      date: new Date(),
    });

    await ctx.reply(
      `✅ *Transaksi Berhasil Dicatat*!\n\n` +
      `• Jenis: ${type === "income" ? "Pemasukan 🟢" : "Pengeluaran 🔴"}\n` +
      `• Nominal: *${formatCurrency(amount)}*\n` +
      `• Kategori: *${cat?.name || cleanCategorySearch}*\n` +
      `• Keterangan: _${fullDesc}_`,
      { parse_mode: "Markdown" }
    );

    if (type === "expense") {
      await checkAndSendExpenseAlert(userId, amount, fullDesc);
    }
  } catch (error) {
    console.error("Failed to save telegram transaction:", error);
    await ctx.reply("❌ Gagal menyimpan transaksi.");
  }
});

export async function checkAndSendExpenseAlert(userId: string, expenseAmount: number, description?: string) {
  try {
    const tgUser = await queryOne<{ telegram_chat_id: string }>(
      "SELECT telegram_chat_id FROM telegram_users WHERE user_id = ? AND is_verified = 1",
      [userId]
    );
    if (!tgUser) return;

    const settings = await queryOne<{ large_expense_threshold: number; notify_large_expense: number }>(
      "SELECT large_expense_threshold, notify_large_expense FROM settings WHERE user_id = ?",
      [userId]
    );

    const threshold = settings?.large_expense_threshold || 500000;
    const notify = settings?.notify_large_expense !== 0;

    // Calculate current month vs previous month expenses
    const now = new Date();
    const startThisMonth = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
    const startPrevMonth = Math.floor(new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime() / 1000);

    const thisMonthRow = await queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ?",
      [userId, startThisMonth]
    );
    const prevMonthRow = await queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date < ?",
      [userId, startPrevMonth, startThisMonth]
    );

    const thisMonthTotal = thisMonthRow?.total || 0;
    const prevMonthTotal = prevMonthRow?.total || 0;

    // Alert 1: Large expense threshold alert
    if (notify && expenseAmount >= threshold) {
      await bot.api.sendMessage(
        tgUser.telegram_chat_id,
        `⚠️ *Peringatan Pengeluaran Besar!*\n\n` +
        `Kamu baru saja mencatat pengeluaran sebesar *${formatCurrency(expenseAmount)}* (${description || "-"}).\n` +
        `Nominal ini melebihi batas alert (${formatCurrency(threshold)}).`,
        { parse_mode: "Markdown" }
      );
    }

    // Alert 2: Expense surge alert when 2nd month exceeds 1st month baseline!
    if (prevMonthTotal > 0 && thisMonthTotal > prevMonthTotal && (thisMonthTotal - expenseAmount) <= prevMonthTotal) {
      await bot.api.sendMessage(
        tgUser.telegram_chat_id,
        `🚨 *Peringatan Lonjakan Pengeluaran Bulanan!*\n\n` +
        `Pengeluaran bulan ini (*${formatCurrency(thisMonthTotal)}*) baru saja *MELEBIHI* pengeluaran bulan lalu (*${formatCurrency(prevMonthTotal)}*).\n\n` +
        `💡 *Dampak*: Target ideal Dana Darurat kamu disesuaikan mengikuti lonjakan ini di web DuitKu. Harap perhatikan penggunaan budget!`,
        { parse_mode: "Markdown" }
      );
    }
  } catch (err) {
    console.error("Failed to send expense alert:", err);
  }
}
