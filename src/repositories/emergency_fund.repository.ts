"use server";

import { executeQuery, queryOne, queryAll } from "@/db/client";
import { generateId } from "@/utils";

export interface EmergencyFundData {
  id: string;
  userId: string;
  monthlyExpense: number;
  targetMonths: number;
  targetAmount: number;
  currentAmount: number;
  status: "single" | "married" | "married_kids";
  createdAt: Date;
  updatedAt: Date;
  progressPercent: number;
  remainingAmount: number;
  automatedMonthlyExpense: number;
  dataMonthsCount: number;
  estimatedMonthsRemaining: number | null;
  avgMonthlyDeposit: number;
  isSurging: boolean;
  surgePercentage: number;
  recommendedNewTarget: number;
}

export interface DepositHistoryItem {
  id: string;
  fundId: string;
  amount: number;
  note: string | null;
  date: Date;
  createdAt: Date;
}

export interface MonthlyExpenseChartItem {
  month: string; // e.g. "Jan 2026"
  expense: number;
}

export interface ContributionChartItem {
  date: string;
  amount: number;
  cumulative: number;
  note?: string;
}

async function ensureTablesExist() {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS emergency_funds (
      id text PRIMARY KEY NOT NULL,
      user_id text UNIQUE NOT NULL,
      monthly_expense real NOT NULL,
      target_months integer DEFAULT 6 NOT NULL,
      target_amount real NOT NULL,
      current_amount real DEFAULT 0,
      status text DEFAULT 'single' NOT NULL,
      created_at integer,
      updated_at integer,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await executeQuery(`
    CREATE TABLE IF NOT EXISTS emergency_fund_histories (
      id text PRIMARY KEY NOT NULL,
      fund_id text NOT NULL,
      amount real NOT NULL,
      note text,
      date integer NOT NULL,
      created_at integer,
      FOREIGN KEY (fund_id) REFERENCES emergency_funds(id) ON DELETE CASCADE
    );
  `);
}

/**
 * Calculates automated monthly expense based on historical transaction expenses:
 * - 1 month data  -> 1 month total
 * - 2 months data -> average of 2 months
 * - 3-5 months    -> average of last 3 months
 * - >= 6 months   -> average of last 6 months
 */
export async function calculateAutomatedMonthlyExpense(userId: string) {
  const rows = await queryAll<{ month: string; total: number }>(
    `SELECT strftime('%Y-%m', date, 'unixepoch') as month, SUM(amount) as total
     FROM transactions
     WHERE user_id = ? AND (type IN ('expense', 'transfer') OR category_id IN (SELECT id FROM categories WHERE type = 'expense'))
     GROUP BY month
     ORDER BY month DESC
     LIMIT 6`,
    [userId]
  );

  if (rows.length === 0) {
    return { automatedExpense: 0, count: 0, monthlyTotals: [] };
  }

  let relevantRows = rows;
  if (rows.length >= 6) {
    relevantRows = rows.slice(0, 6);
  } else if (rows.length >= 3) {
    relevantRows = rows.slice(0, 3);
  }

  const sum = relevantRows.reduce((acc, r) => acc + r.total, 0);
  const automatedExpense = Math.round(sum / relevantRows.length);

  return {
    automatedExpense,
    count: rows.length,
    monthlyTotals: rows.slice().reverse(), // ascending order for chart
  };
}

export async function getEmergencyFund(userId: string): Promise<{
  fund: EmergencyFundData | null;
  histories: DepositHistoryItem[];
  monthlyExpenseChart: MonthlyExpenseChartItem[];
  contributionChart: ContributionChartItem[];
}> {
  await ensureTablesExist();

  const { automatedExpense, count: dataMonthsCount, monthlyTotals } =
    await calculateAutomatedMonthlyExpense(userId);

  const row = await queryOne<{
    id: string;
    user_id: string;
    monthly_expense: number;
    target_months: number;
    target_amount: number;
    current_amount: number;
    status: string;
    created_at: number;
    updated_at: number;
  }>("SELECT * FROM emergency_funds WHERE user_id = ?", [userId]);

  // Transform monthlyTotals for Bar Chart
  const monthlyExpenseChart: MonthlyExpenseChartItem[] = monthlyTotals.map((m) => {
    const [year, month] = m.month.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return {
      month: date.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
      expense: m.total,
    };
  });

  if (!row) {
    return {
      fund: null,
      histories: [],
      monthlyExpenseChart,
      contributionChart: [],
    };
  }

  const historiesRaw = await queryAll<{
    id: string;
    fund_id: string;
    amount: number;
    note: string | null;
    date: number;
    created_at: number;
  }>(
    "SELECT * FROM emergency_fund_histories WHERE fund_id = ? ORDER BY date ASC",
    [row.id]
  );

  const histories: DepositHistoryItem[] = historiesRaw.map((h) => ({
    id: h.id,
    fundId: h.fund_id,
    amount: h.amount,
    note: h.note,
    date: new Date(h.date * 1000),
    createdAt: new Date(h.created_at * 1000),
  }));

  // Build contribution & progress cumulative chart items
  let cumulative = 0;
  const contributionChart: ContributionChartItem[] = histories.map((h) => {
    cumulative += h.amount;
    return {
      date: h.date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      amount: h.amount,
      cumulative,
      note: h.note || undefined,
    };
  });

  // Calculate average monthly deposit
  let avgMonthlyDeposit = 0;
  if (histories.length > 0) {
    const dates = histories.map((h) => h.date.getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const monthDiff = Math.max(
      1,
      Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24 * 30.44))
    );
    const totalDeposited = histories.reduce((sum, h) => sum + h.amount, 0);
    avgMonthlyDeposit = Math.round(totalDeposited / monthDiff);
  }

  const currentAmount = row.current_amount || 0;
  const targetAmount = row.target_amount || 0;
  const remainingAmount = Math.max(0, targetAmount - currentAmount);

  let estimatedMonthsRemaining: number | null = null;
  if (remainingAmount === 0) {
    estimatedMonthsRemaining = 0;
  } else if (avgMonthlyDeposit > 0) {
    estimatedMonthsRemaining = Math.ceil(remainingAmount / avgMonthlyDeposit);
  }

  // Check surge (>= 10% increase from saved monthly_expense)
  const savedExpense = row.monthly_expense || 0;
  let isSurging = false;
  let surgePercentage = 0;
  let recommendedNewTarget = targetAmount;

  if (savedExpense > 0 && automatedExpense > savedExpense) {
    surgePercentage = Math.round(
      ((automatedExpense - savedExpense) / savedExpense) * 100
    );
    if (surgePercentage >= 10) {
      isSurging = true;
      recommendedNewTarget = automatedExpense * row.target_months;
    }
  }

  const progressPercent =
    targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;

  const activeExpense = automatedExpense > 0 ? automatedExpense : (row ? row.monthly_expense : 0);

  const fund: EmergencyFundData = {
    id: row.id,
    userId: row.user_id,
    monthlyExpense: activeExpense,
    targetMonths: row.target_months,
    targetAmount: activeExpense > 0 ? activeExpense * row.target_months : row.target_amount,
    currentAmount,
    status: (row.status as any) || "single",
    createdAt: new Date(row.created_at * 1000),
    updatedAt: new Date(row.updated_at * 1000),
    progressPercent,
    remainingAmount,
    automatedMonthlyExpense: activeExpense,
    dataMonthsCount,
    estimatedMonthsRemaining,
    avgMonthlyDeposit,
    isSurging,
    surgePercentage,
    recommendedNewTarget,
  };

  return {
    fund,
    histories,
    monthlyExpenseChart,
    contributionChart,
  };
}

export async function saveEmergencyFundTarget(data: {
  userId: string;
  targetMonths: number;
  status: "single" | "married" | "married_kids";
  customMonthlyExpense?: number;
}) {
  await ensureTablesExist();

  const { automatedExpense } = await calculateAutomatedMonthlyExpense(data.userId);
  const monthlyExpense =
    data.customMonthlyExpense && data.customMonthlyExpense > 0
      ? data.customMonthlyExpense
      : automatedExpense;

  const targetAmount = monthlyExpense * data.targetMonths;

  const existing = await queryOne<{ id: string; current_amount: number }>(
    "SELECT id, current_amount FROM emergency_funds WHERE user_id = ?",
    [data.userId]
  );

  if (existing) {
    if (targetAmount < existing.current_amount) {
      throw new Error(
        `Target dana darurat (${targetAmount.toLocaleString("id-ID")}) tidak boleh lebih kecil dari dana yang sudah terkumpul (${existing.current_amount.toLocaleString("id-ID")}).`
      );
    }

    const now = Math.floor(Date.now() / 1000);
    await executeQuery(
      `UPDATE emergency_funds
       SET monthly_expense = ?, target_months = ?, target_amount = ?, status = ?, updated_at = ?
       WHERE user_id = ?`,
      [monthlyExpense, data.targetMonths, targetAmount, data.status, now, data.userId]
    );
    return existing.id;
  } else {
    const id = generateId();
    const now = Math.floor(Date.now() / 1000);
    await executeQuery(
      `INSERT INTO emergency_funds (id, user_id, monthly_expense, target_months, target_amount, current_amount, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [id, data.userId, monthlyExpense, data.targetMonths, targetAmount, data.status, now, now]
    );
    return id;
  }
}

export async function addEmergencyFundDeposit(data: {
  userId: string;
  amount: number;
  note?: string;
  date: Date;
}) {
  await ensureTablesExist();

  if (data.amount <= 0) {
    throw new Error("Nominal setoran harus lebih besar dari 0.");
  }

  let fund = await queryOne<{ id: string; current_amount: number; monthly_expense: number; target_months: number }>(
    "SELECT id, current_amount, monthly_expense, target_months FROM emergency_funds WHERE user_id = ?",
    [data.userId]
  );

  if (!fund) {
    // Auto initialize default emergency fund if none exists yet
    const { automatedExpense } = await calculateAutomatedMonthlyExpense(data.userId);
    const monthlyExpense = automatedExpense;
    const targetMonths = 6;
    const targetAmount = monthlyExpense * targetMonths;
    const fundId = generateId();
    const now = Math.floor(Date.now() / 1000);

    await executeQuery(
      `INSERT INTO emergency_funds (id, user_id, monthly_expense, target_months, target_amount, current_amount, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, 'single', ?, ?)`,
      [fundId, data.userId, monthlyExpense, targetMonths, targetAmount, now, now]
    );

    fund = { id: fundId, current_amount: 0, monthly_expense: monthlyExpense, target_months: targetMonths };
  }

  const historyId = generateId();
  const dateTs = Math.floor(data.date.getTime() / 1000);
  const now = Math.floor(Date.now() / 1000);

  // Execute batch: insert history log & update current_amount in emergency_funds
  await executeQuery(
    `INSERT INTO emergency_fund_histories (id, fund_id, amount, note, date, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [historyId, fund.id, data.amount, data.note || null, dateTs, now]
  );

  await executeQuery(
    `UPDATE emergency_funds
     SET current_amount = current_amount + ?, updated_at = ?
     WHERE id = ?`,
    [data.amount, now, fund.id]
  );

  return historyId;
}
