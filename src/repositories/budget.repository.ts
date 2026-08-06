"use server";

import { executeQuery, queryOne, queryAll } from "@/db/client";
import { generateId } from "@/utils";

interface BudgetRow {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  amount: number;
  spent: number;
  period: string;
  start_date: number;
  end_date: number;
  created_at: number;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
}

export async function getBudgets(userId: string) {
  const rows = await queryAll<BudgetRow>(
    `SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM budgets b
     LEFT JOIN categories c ON b.category_id = c.id
     WHERE b.user_id = ?
     ORDER BY b.created_at DESC`,
    [userId]
  );

  return rows.map(mapBudgetRow);
}

export async function getBudgetById(id: string, userId: string) {
  const row = await queryOne<BudgetRow>(
    `SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM budgets b
     LEFT JOIN categories c ON b.category_id = c.id
     WHERE b.id = ? AND b.user_id = ?`,
    [id, userId]
  );

  return row ? mapBudgetRow(row) : null;
}

export async function createBudget(data: {
  userId: string;
  name: string;
  categoryId?: string;
  amount: number;
  period: string;
  startDate: Date;
  endDate: Date;
}) {
  const id = generateId();
  const now = Math.floor(Date.now() / 1000);

  await executeQuery(
    `INSERT INTO budgets (id, user_id, category_id, name, amount, spent, period, start_date, end_date, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    [
      id, data.userId, data.categoryId || null, data.name, data.amount,
      data.period,
      Math.floor(data.startDate.getTime() / 1000),
      Math.floor(data.endDate.getTime() / 1000),
      now,
    ]
  );

  return id;
}

export async function updateBudget(id: string, userId: string, data: Partial<{
  name: string;
  categoryId: string;
  amount: number;
  spent: number;
  period: string;
  startDate: Date;
  endDate: Date;
}>) {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) { updates.push("name = ?"); params.push(data.name); }
  if (data.categoryId !== undefined) { updates.push("category_id = ?"); params.push(data.categoryId); }
  if (data.amount !== undefined) { updates.push("amount = ?"); params.push(data.amount); }
  if (data.spent !== undefined) { updates.push("spent = ?"); params.push(data.spent); }
  if (data.period !== undefined) { updates.push("period = ?"); params.push(data.period); }
  if (data.startDate !== undefined) { updates.push("start_date = ?"); params.push(Math.floor(data.startDate.getTime() / 1000)); }
  if (data.endDate !== undefined) { updates.push("end_date = ?"); params.push(Math.floor(data.endDate.getTime() / 1000)); }

  if (updates.length === 0) return;

  params.push(id, userId);

  await executeQuery(
    `UPDATE budgets SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`,
    params
  );
}

export async function deleteBudget(id: string, userId: string) {
  await executeQuery(
    "DELETE FROM budgets WHERE id = ? AND user_id = ?",
    [id, userId]
  );
}

export async function updateBudgetSpent(userId: string) {
  // Recalculate spent for all active budgets
  const now = Math.floor(Date.now() / 1000);

  await executeQuery(
    `UPDATE budgets SET spent = (
       SELECT COALESCE(SUM(t.amount), 0)
       FROM transactions t
       WHERE t.user_id = budgets.user_id
         AND t.type = 'expense'
         AND (budgets.category_id IS NULL OR t.category_id = budgets.category_id)
         AND t.date >= budgets.start_date
         AND t.date <= budgets.end_date
     ) WHERE user_id = ? AND end_date >= ?`,
    [userId, now]
  );
}

export async function getActiveBudgets(userId: string) {
  const now = Math.floor(Date.now() / 1000);

  const rows = await queryAll<BudgetRow>(
    `SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM budgets b
     LEFT JOIN categories c ON b.category_id = c.id
     WHERE b.user_id = ? AND b.end_date >= ?
     ORDER BY b.end_date ASC`,
    [userId, now]
  );

  return rows.map(mapBudgetRow);
}

function mapBudgetRow(row: BudgetRow) {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    name: row.name,
    amount: row.amount,
    spent: row.spent || 0,
    period: row.period,
    startDate: new Date(row.start_date * 1000),
    endDate: new Date(row.end_date * 1000),
    createdAt: new Date(row.created_at * 1000),
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
    categoryColor: row.category_color,
    percentage: row.amount > 0 ? ((row.spent || 0) / row.amount) * 100 : 0,
    remaining: row.amount - (row.spent || 0),
  };
}
