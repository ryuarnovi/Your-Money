import { executeQuery, queryAll, queryOne } from "@/db/client";
import { generateId } from "@/utils";
import { getWalletStats } from "@/repositories/wallet.repository";

export interface MonthlyAuditRecord {
  id: string;
  userId: string;
  yearMonth: string;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  totalAssetAtClose: number;
  categoryBreakdownJson: string | null;
  txCountPurged: number;
  closedAt: Date;
}

export async function ensureMonthlyAuditTable() {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS monthly_audits (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      year_month TEXT NOT NULL,
      total_income REAL NOT NULL DEFAULT 0,
      total_expense REAL NOT NULL DEFAULT 0,
      net_cashflow REAL NOT NULL DEFAULT 0,
      total_asset_at_close REAL NOT NULL DEFAULT 0,
      category_breakdown_json TEXT,
      tx_count_purged INTEGER NOT NULL DEFAULT 0,
      closed_at INTEGER NOT NULL
    );
  `);
}

export async function closeMonthAndAudit(userId: string, targetYearMonth?: string) {
  await ensureMonthlyAuditTable();

  let ym = targetYearMonth;
  if (!ym) {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prevMonth.getFullYear();
    const month = String(prevMonth.getMonth() + 1).padStart(2, "0");
    ym = `${year}-${month}`;
  }

  // 1. Fetch all transactions for targetYearMonth
  const txRows = await queryAll<{
    id: string;
    type: string;
    amount: number;
    category_name: string | null;
  }>(
    `SELECT t.id, t.type, t.amount, c.name as category_name
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE t.user_id = ? AND strftime('%Y-%m', t.date, 'unixepoch', 'localtime') = ?`,
    [userId, ym]
  );

  let totalIncome = 0;
  let totalExpense = 0;
  const categoryMap = new Map<string, number>();

  for (const t of txRows) {
    if (t.type === "income") {
      totalIncome += t.amount;
    } else if (t.type === "expense") {
      totalExpense += t.amount;
      const catName = t.category_name || "Tanpa Kategori";
      categoryMap.set(catName, (categoryMap.get(catName) || 0) + t.amount);
    }
  }

  const netCashflow = totalIncome - totalExpense;

  // Category breakdown list
  const categoryBreakdown = Array.from(categoryMap.entries()).map(([name, total]) => ({
    name,
    total,
    percentage: totalExpense > 0 ? Math.round((total / totalExpense) * 100) : 0,
  })).sort((a, b) => b.total - a.total);

  // 2. Fetch current wallet assets at close
  const walletStats = await getWalletStats(userId).catch(() => ({ totalOverall: 0 }));
  const totalAssetAtClose = walletStats.totalOverall || 0;

  // 3. Save or update monthly audit record
  const existingAudit = await queryOne<{ id: string }>(
    "SELECT id FROM monthly_audits WHERE user_id = ? AND year_month = ?",
    [userId, ym]
  );

  const id = existingAudit ? existingAudit.id : generateId();
  const nowTs = Math.floor(Date.now() / 1000);
  const jsonBreakdown = JSON.stringify(categoryBreakdown);
  const txCountPurged = txRows.length;

  if (existingAudit) {
    await executeQuery(
      `UPDATE monthly_audits
       SET total_income = ?, total_expense = ?, net_cashflow = ?, total_asset_at_close = ?, category_breakdown_json = ?, tx_count_purged = ?, closed_at = ?
       WHERE id = ?`,
      [totalIncome, totalExpense, netCashflow, totalAssetAtClose, jsonBreakdown, txCountPurged, nowTs, id]
    );
  } else {
    await executeQuery(
      `INSERT INTO monthly_audits (id, user_id, year_month, total_income, total_expense, net_cashflow, total_asset_at_close, category_breakdown_json, tx_count_purged, closed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, ym, totalIncome, totalExpense, netCashflow, totalAssetAtClose, jsonBreakdown, txCountPurged, nowTs]
    );
  }

  // 4. PERMANENTLY DELETE detailed transaction rows for targetYearMonth!
  if (txCountPurged > 0) {
    await executeQuery(
      `DELETE FROM transactions WHERE user_id = ? AND strftime('%Y-%m', date, 'unixepoch', 'localtime') = ?`,
      [userId, ym]
    );
  }

  return {
    success: true,
    yearMonth: ym,
    totalIncome,
    totalExpense,
    netCashflow,
    totalAssetAtClose,
    txCountPurged,
    categoryBreakdown,
  };
}

export async function getMonthlyAudits(userId: string): Promise<MonthlyAuditRecord[]> {
  await ensureMonthlyAuditTable();
  const rows = await queryAll<{
    id: string;
    user_id: string;
    year_month: string;
    total_income: number;
    total_expense: number;
    net_cashflow: number;
    total_asset_at_close: number;
    category_breakdown_json: string | null;
    tx_count_purged: number;
    closed_at: number;
  }>(
    "SELECT * FROM monthly_audits WHERE user_id = ? ORDER BY year_month DESC, closed_at DESC",
    [userId]
  );

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    yearMonth: r.year_month,
    totalIncome: Number(r.total_income || 0),
    totalExpense: Number(r.total_expense || 0),
    netCashflow: Number(r.net_cashflow || 0),
    totalAssetAtClose: Number(r.total_asset_at_close || 0),
    categoryBreakdownJson: r.category_breakdown_json,
    txCountPurged: Number(r.tx_count_purged || 0),
    closedAt: new Date(r.closed_at * 1000),
  }));
}
