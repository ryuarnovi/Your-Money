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
    "/saldo - Cek total saldo & rincian dompet\n" +
    "/dompet - Saldo Kas, Bank, & E-Money\n" +
    "/today - Transaksi hari ini\n" +
    "/month - Transaksi bulan ini\n" +
    "/year - Ringkasan tahun ini\n" +
    "/budget - Status budget kamu\n" +
    "/statistik - Statistik pengeluaran\n" +
    "/report - Laporan ringkas\n" +
    "/danadarurat - Status dana darurat\n\n" +
    "💡 *Cara Catat Cepat*:\n" +
    "• `+500000 Gaji bank` (Pemasukan ke Bank)\n" +
    "• `-25000 Makan cash` (Pengeluaran Tunai)\n" +
    "• `-15000 Kopi gopay` (Pengeluaran E-Wallet)\n" +
    "• `-250000 Listrik bca` (Pengeluaran Bank)",
    { parse_mode: "Markdown" }
  );
});

// Command: /saldo
bot.command("saldo", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const userId = await getUserIdByChatId(chatId);
  if (!userId) return ctx.reply("⚠️ Silakan hubungkan akun DuitKu di web terlebih dahulu.");

  const { getWalletStats } = await import("@/repositories/wallet.repository");
  const stats = await getWalletStats(userId);

  await ctx.reply(
    "💰 *Ringkasan Saldo DuitKu*:\n\n" +
    `🏦 Total Bank: *${formatCurrency(stats.totalBank)}*\n` +
    `💵 Total Kas Tunai: *${formatCurrency(stats.totalCash)}*\n` +
    `📱 Total E-Money: *${formatCurrency(stats.totalEmoney)}*\n` +
    `-----------------------------------\n` +
    `💰 *Total Saldo Gabungan*: *${formatCurrency(stats.totalOverall)}*`,
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

  const { getEmergencyFund } = await import("@/repositories/emergency_fund.repository");
  const { fund } = await getEmergencyFund(userId);

  const avgExpense = fund?.automatedMonthlyExpense || 3000000;
  const currentSaved = fund?.currentAmount || 0;
  const targetMonths = fund?.targetMonths || 6;
  const targetAmount = fund?.targetAmount || avgExpense * targetMonths;

  const t3 = avgExpense * 3;
  const t6 = avgExpense * 6;
  const t9 = avgExpense * 9;
  const t12 = avgExpense * 12;

  let text = "🛡️ *Smart Emergency Fund Calculator*:\n\n" +
    `• Est. Pengeluaran / Bulan: *${formatCurrency(avgExpense)}*\n` +
    `• Target Aktif (${targetMonths} Bln): *${formatCurrency(targetAmount)}*\n` +
    `• Dana Terkumpul: *${formatCurrency(currentSaved)}* (${fund?.progressPercent || 0}%)\n` +
    `• Sisa Kurang: *${formatCurrency(fund?.remainingAmount || Math.max(0, targetAmount - currentSaved))}*\n\n` +
    `📌 *Breakdown Target*:\n` +
    `• *3 Bulan*: ${formatCurrency(t3)} ${currentSaved >= t3 ? "✅ (Aman)" : `(Kurang ${formatCurrency(t3 - currentSaved)})`}\n` +
    `• *6 Bulan (Lajang)*: ${formatCurrency(t6)} ${currentSaved >= t6 ? "✅ (Aman)" : `(Kurang ${formatCurrency(t6 - currentSaved)})`}\n` +
    `• *9 Bulan (Menikah)*: ${formatCurrency(t9)} ${currentSaved >= t9 ? "✅ (Aman)" : `(Kurang ${formatCurrency(t9 - currentSaved)})`}\n` +
    `• *12 Bulan (Menikah+Anak)*: ${formatCurrency(t12)} ${currentSaved >= t12 ? "✅ (Aman)" : `(Kurang ${formatCurrency(t12 - currentSaved)})`}`;

  if (fund?.isSurging) {
    text += `\n\n⚠️ *Perhatian*: Pengeluaran kamu meningkat ${fund.surgePercentage}%. Rekomendasi target baru: *${formatCurrency(fund.recommendedNewTarget)}*.`;
  }

  await ctx.reply(text, { parse_mode: "Markdown" });
});

// Command: /dompet or /rekening
bot.command(["dompet", "rekening"], async (ctx) => {
  const chatId = String(ctx.chat.id);
  const userId = await getUserIdByChatId(chatId);
  if (!userId) return ctx.reply("⚠️ Silakan hubungkan akun DuitKu di web terlebih dahulu.");

  const { getWallets, getWalletStats } = await import("@/repositories/wallet.repository");
  const wallets = await getWallets(userId);
  const stats = await getWalletStats(userId);

  let text = "💳 *Status Saldo Dompet & Rekening*:\n\n";
  text += `🏦 Total Bank: *${formatCurrency(stats.totalBank)}*\n`;
  text += `💵 Total Kas Tunai: *${formatCurrency(stats.totalCash)}*\n`;
  text += `📱 Total E-Money: *${formatCurrency(stats.totalEmoney)}*\n`;
  text += `💰 *Total Saldo Gabungan*: *${formatCurrency(stats.totalOverall)}*\n\n`;

  text += "📋 *Rincian Akun*:\n";
  for (const w of wallets) {
    const badge = w.type === "cash" ? "💵 Kas" : w.type === "bank" ? "🏦 Bank" : "📱 E-Money";
    text += `• *${w.name}* (${badge}): ${formatCurrency(w.currentBalance)}\n`;
  }

  await ctx.reply(text, { parse_mode: "Markdown" });
});

// Message listener for natural language input (+500000 Gaji, -25000 Makan bank, alokasi 1450000 Dana Kuliah)
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith("/")) return; // Ignore unhandled commands

  const chatId = String(ctx.chat.id);
  const userId = await getUserIdByChatId(chatId);
  if (!userId) return ctx.reply("⚠️ Akun Telegram belum terhubung dengan DuitKu.");

  // Check 1: Spend/Pay from Saving Goal command (e.g., 'pakai tabungan 1.450.000 Dana Kuliah' or 'bayar tabungan 1.450.000 Dana Kuliah')
  const spendGoalMatch = text.match(/^(pakai tabungan|bayar tabungan|cairkan tabungan|pakai goal)\s+([0-9.,\s]+)\s+(.*)$/i);
  if (spendGoalMatch) {
    const rawAmt = Number(spendGoalMatch[2].replace(/[^0-9]/g, ""));
    const goalSearch = spendGoalMatch[3].trim().toLowerCase();

    if (!rawAmt || isNaN(rawAmt)) {
      return ctx.reply("⚠️ Nominal pembayaran tidak valid.");
    }

    const { queryAll, executeQuery } = await import("@/db/client");
    const { generateId } = await import("@/utils");
    const goals = await queryAll<{ id: string; name: string; current_amount: number; target_amount: number }>(
      "SELECT id, name, current_amount, target_amount FROM saving_goals WHERE user_id = ?",
      [userId]
    );

    const matchedGoal = goals.find((g) => g.name.toLowerCase().includes(goalSearch) || goalSearch.includes(g.name.toLowerCase()));
    if (!matchedGoal) {
      return ctx.reply(`⚠️ Target tabungan "${goalSearch}" tidak ditemukan.`);
    }

    const newGoalAmt = Math.max(0, (matchedGoal.current_amount || 0) - rawAmt);
    await executeQuery(
      "UPDATE saving_goals SET current_amount = ? WHERE id = ? AND user_id = ?",
      [newGoalAmt, matchedGoal.id, userId]
    );

    // Create real EXPENSE transaction for this spending from savings!
    const cat = await findCategoryByName("Kuliah", "expense") || await findCategoryByName("Pendidikan", "expense");
    await createTransaction({
      userId,
      amount: rawAmt,
      type: "expense",
      categoryId: cat?.id,
      paymentMethod: "bank",
      description: `Pembayaran dari Tabungan (${matchedGoal.name})`,
      date: new Date(),
    });

    return ctx.reply(
      `💸 *Pembayaran dari Tabungan Berhasil*!\n\n` +
      `• Target Goal: *${matchedGoal.name}*\n` +
      `• Nominal Dibayarkan: *${formatCurrency(rawAmt)}*\n` +
      `• Sisa Tabungan Goal: *${formatCurrency(newGoalAmt)}*\n` +
      `• Status: *Tercatat sebagai Pengeluaran Real (Expense) & Mengurangi Saldo Rekening*`,
      { parse_mode: "Markdown" }
    );
  }

  // Check 2: Allocation / Tabungan command (e.g., 'alokasi 1.450.000 Dana Kuliah' OR 'alokasi Bank Jateng 1.450.000 tabungan Kuliah' OR 'alokasi campus 1.450.000 tabungan kuliah')
  const isAllocCmd = text.match(/^(alokasi|tabungan|simpan|goal)\b/i);
  if (isAllocCmd) {
    // Extract the amount string
    const amtMatch = text.match(/([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{4,})/);
    if (!amtMatch) {
      return ctx.reply("⚠️ Format nominal alokasi tidak valid. Contoh:\n`alokasi Bank Jateng 1.450.000 tabungan Kuliah`", { parse_mode: "Markdown" });
    }

    const rawAmtStr = amtMatch[0];
    const rawAmt = Number(rawAmtStr.replace(/[^0-9]/g, ""));
    const amtIndex = text.indexOf(rawAmtStr);

    const beforeAmt = text.substring(isAllocCmd[0].length, amtIndex).trim(); // Wallet source if specified (e.g. 'Bank Jateng', 'campus')
    const afterAmt = text.substring(amtIndex + rawAmtStr.length).trim(); // Goal search string (e.g. 'tabungan Kuliah' or 'Dana Kuliah')

    // Clean goal name: strip leading 'tabungan', 'ke', 'untuk', 'goal'
    let goalSearch = afterAmt.replace(/^(tabungan|ke|untuk|goal)\s+/i, "").trim().toLowerCase();
    if (!goalSearch) {
      goalSearch = afterAmt.trim().toLowerCase();
    }

    if (!rawAmt || isNaN(rawAmt)) {
      return ctx.reply("⚠️ Nominal alokasi tidak valid.");
    }

    const { queryAll, executeQuery } = await import("@/db/client");
    const { getWallets } = await import("@/repositories/wallet.repository");
    const { generateId } = await import("@/utils");

    const userWallets = await getWallets(userId).catch(() => []);
    let walletSourceDisplayName = "Rekening Utama";
    if (beforeAmt) {
      const matchedWallet = userWallets.find(
        (w) => w.name.toLowerCase().includes(beforeAmt.toLowerCase()) || beforeAmt.toLowerCase().includes(w.name.toLowerCase())
      );
      if (matchedWallet) {
        walletSourceDisplayName = matchedWallet.name;
      } else {
        walletSourceDisplayName = beforeAmt;
      }
    }

    const goals = await queryAll<{ id: string; name: string; current_amount: number; target_amount: number }>(
      "SELECT id, name, current_amount, target_amount FROM saving_goals WHERE user_id = ?",
      [userId]
    );

    let matchedGoal = goals.find((g) => g.name.toLowerCase().includes(goalSearch) || goalSearch.includes(g.name.toLowerCase()));
    if (!matchedGoal && (goalSearch.includes("kampus") || goalSearch.includes("kuliah") || goalSearch.includes("pay"))) {
      matchedGoal = goals.find((g) => g.name.toLowerCase().includes("kuliah"));
    }

    // Auto-create saving goal if not found!
    if (!matchedGoal) {
      const cleanName = goalSearch
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      const newGoalId = generateId();
      const now = Math.floor(Date.now() / 1000);
      await executeQuery(
        `INSERT INTO saving_goals (id, user_id, name, target_amount, current_amount, icon, color, is_completed, created_at)
         VALUES (?, ?, ?, ?, ?, 'PiggyBank', '#3b82f6', 0, ?)`,
        [newGoalId, userId, cleanName, rawAmt, rawAmt, now]
      );

      return ctx.reply(
        `✨ *Target Tabungan Baru Dibuat Otomatis*!\n\n` +
        `• Target Goal: *${cleanName}*\n` +
        `• Akun Asal: *${walletSourceDisplayName}*\n` +
        `• Dialokasikan Pertama: *${formatCurrency(rawAmt)}*\n` +
        `• Total Terkumpul: *${formatCurrency(rawAmt)}*\n\n` +
        `💡 *Catatan*: Uang ini berada di *${walletSourceDisplayName}* & *TIDAK dihitung sebagai Pengeluaran*.`,
        { parse_mode: "Markdown" }
      );
    }

    if (matchedGoal) {
      const newAmt = (matchedGoal.current_amount || 0) + rawAmt;
      await executeQuery(
        "UPDATE saving_goals SET current_amount = ? WHERE id = ? AND user_id = ?",
        [newAmt, matchedGoal.id, userId]
      );

      return ctx.reply(
        `🔒 *Alokasi Tabungan Berhasil*!\n\n` +
        `• Target Goal: *${matchedGoal.name}*\n` +
        `• Akun Asal: *${walletSourceDisplayName}*\n` +
        `• Nominal Dialokasikan: *${formatCurrency(rawAmt)}*\n` +
        `• Total Terkumpul: *${formatCurrency(newAmt)}* / ${formatCurrency(matchedGoal.target_amount)}\n\n` +
        `💡 *Catatan*: Uang tetap berada di *${walletSourceDisplayName}* & *TIDAK dihitung sebagai Pengeluaran (Expense)*.`,
        { parse_mode: "Markdown" }
      );
    }
  }

  // Regex pattern for +amount category or -amount category (supports dots/commas e.g. -40.000 transport)
  const match = text.match(/^([+-])([0-9.,\s]+?)\s+(.*)$/);
  if (!match) {
    return ctx.reply(
      "Format tidak dikenali. Gunakan contoh:\n`+500.000 Gaji bank` atau `-40.000 Transport gopay`",
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
  const type = sign === "+" ? "income" : "expense";

  // Fetch user wallets to match wallet names dynamically (e.g. 'Bank Jateng', 'GoPay', 'Cash')
  const { getWallets } = await import("@/repositories/wallet.repository");
  const userWallets = await getWallets(userId).catch(() => []);

  let detectedMethod = "cash";
  let methodDisplayName = "CASH";
  let cleanDesc = fullDesc;

  // Pass 1: Try matching user's wallet name in fullDesc (e.g., 'Bank Jateng', 'GoPay')
  let walletMatched = false;
  for (const w of userWallets) {
    const wNameLower = w.name.toLowerCase();
    const fullDescLower = fullDesc.toLowerCase();
    if (fullDescLower.includes(wNameLower)) {
      detectedMethod = w.type;
      methodDisplayName = `${w.type.toUpperCase()} (${w.name})`;
      const regex = new RegExp(w.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      cleanDesc = fullDesc.replace(regex, "").trim();
      walletMatched = true;
      break;
    }
  }

  // Pass 2: If no direct wallet name match, check known keyword mapping
  if (!walletMatched) {
    const keywordMap: { keywords: string[]; method: string; display: string }[] = [
      { keywords: ["bank jateng", "bank bca", "bank mandiri", "bank bri", "bank bni", "bank cimb", "bank danamon", "bank permata", "bank mega", "bank syariah", "bank jatim", "bank jabar", "bank dki", "seabank", "blu bca", "jenius"], method: "bank", display: "BANK" },
      { keywords: ["e-money", "emoney", "e wallet", "ewallet", "uang elektronik"], method: "emoney", display: "E-MONEY" },
      { keywords: ["kas tunai", "uang tunai", "physical cash"], method: "cash", display: "CASH" },
      { keywords: ["bank", "transfer", "bca", "mandiri", "bri", "bni", "cimb", "danamon", "permata", "mega", "bsi", "blu", "jenius", "neo"], method: "bank", display: "BANK" },
      { keywords: ["gopay", "ovo", "dana", "shopeepay", "qris", "linkaja"], method: "emoney", display: "E-MONEY" },
      { keywords: ["cash", "tunai", "saku"], method: "cash", display: "CASH" },
    ];

    const fullDescLower = fullDesc.toLowerCase();
    for (const item of keywordMap) {
      for (const kw of item.keywords) {
        if (fullDescLower.includes(kw)) {
          detectedMethod = item.method;
          methodDisplayName = item.display;
          const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
          cleanDesc = fullDesc.replace(regex, "").trim();
          walletMatched = true;
          break;
        }
      }
      if (walletMatched) break;
    }
  }

  // Fallback cleanDesc if empty
  if (!cleanDesc) {
    cleanDesc = fullDesc;
  }

  // Clean category search string (e.g. 'gaji' or 'makan')
  const cleanCategorySearch = cleanDesc.replace(/\(.*?\)/g, "").trim() || cleanDesc;

  // Find category
  const cat = await findCategoryByName(cleanCategorySearch, type);
  const categoryId = cat?.id;

  try {
    await createTransaction({
      userId,
      amount,
      type,
      categoryId,
      paymentMethod: detectedMethod,
      description: cleanDesc,
      date: new Date(),
    });

    await ctx.reply(
      `✅ *Transaksi Berhasil Dicatat*!\n\n` +
      `• Jenis: ${type === "income" ? "Pemasukan 🟢" : "Pengeluaran 🔴"}\n` +
      `• Nominal: *${formatCurrency(amount)}*\n` +
      `• Akun / Metode: *${methodDisplayName}*\n` +
      `• Kategori: *${cat?.name || cleanCategorySearch}*\n` +
      `• Keterangan: _${cleanDesc}_`,
      { parse_mode: "Markdown" }
    );

    if (type === "expense") {
      await checkAndSendExpenseAlert(userId, amount, cleanDesc);
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
