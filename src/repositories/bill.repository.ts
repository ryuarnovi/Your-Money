"use server";

import { executeQuery, queryOne, queryAll } from "@/db/client";
import { generateId } from "@/utils";

interface RecurringBillRow {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  category_id: string | null;
  frequency: string;
  next_due_date: number;
  last_paid_date: number | null;
  is_active: number;
  created_at: number;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
}

export async function getRecurringBills(userId: string) {
  const rows = await queryAll<RecurringBillRow>(
    `SELECT rb.*, c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM recurring_bills rb
     LEFT JOIN categories c ON rb.category_id = c.id
     WHERE rb.user_id = ?
     ORDER BY rb.next_due_date ASC`,
    [userId]
  );

  return rows.map(mapRecurringBillRow);
}

export async function getRecurringBillById(id: string, userId: string) {
  const row = await queryOne<RecurringBillRow>(
    `SELECT rb.*, c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM recurring_bills rb
     LEFT JOIN categories c ON rb.category_id = c.id
     WHERE rb.id = ? AND rb.user_id = ?`,
    [id, userId]
  );

  return row ? mapRecurringBillRow(row) : null;
}

export async function createRecurringBill(data: {
  userId: string;
  name: string;
  amount: number;
  categoryId?: string;
  frequency: string;
  nextDueDate: Date;
}) {
  const id = generateId();
  const now = Math.floor(Date.now() / 1000);

  await executeQuery(
    `INSERT INTO recurring_bills (id, user_id, name, amount, category_id, frequency, next_due_date, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      id, data.userId, data.name, data.amount,
      data.categoryId || null, data.frequency,
      Math.floor(data.nextDueDate.getTime() / 1000), now,
    ]
  );

  return id;
}

export async function updateRecurringBill(id: string, userId: string, data: Partial<{
  name: string;
  amount: number;
  categoryId: string;
  frequency: string;
  nextDueDate: Date;
  lastPaidDate: Date;
  isActive: boolean;
}>) {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) { updates.push("name = ?"); params.push(data.name); }
  if (data.amount !== undefined) { updates.push("amount = ?"); params.push(data.amount); }
  if (data.categoryId !== undefined) { updates.push("category_id = ?"); params.push(data.categoryId); }
  if (data.frequency !== undefined) { updates.push("frequency = ?"); params.push(data.frequency); }
  if (data.nextDueDate !== undefined) { updates.push("next_due_date = ?"); params.push(Math.floor(data.nextDueDate.getTime() / 1000)); }
  if (data.lastPaidDate !== undefined) { updates.push("last_paid_date = ?"); params.push(Math.floor(data.lastPaidDate.getTime() / 1000)); }
  if (data.isActive !== undefined) { updates.push("is_active = ?"); params.push(data.isActive ? 1 : 0); }

  if (updates.length === 0) return;

  params.push(id, userId);

  await executeQuery(
    `UPDATE recurring_bills SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`,
    params
  );
}

export async function deleteRecurringBill(id: string, userId: string) {
  await executeQuery(
    "DELETE FROM recurring_bills WHERE id = ? AND user_id = ?",
    [id, userId]
  );
}

export async function getUpcomingBills(userId: string, days = 7) {
  const now = Math.floor(Date.now() / 1000);
  const futureDate = now + days * 86400;

  const rows = await queryAll<RecurringBillRow>(
    `SELECT rb.*, c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM recurring_bills rb
     LEFT JOIN categories c ON rb.category_id = c.id
     WHERE rb.user_id = ? AND rb.is_active = 1 AND rb.next_due_date <= ?
     ORDER BY rb.next_due_date ASC`,
    [userId, futureDate]
  );

  return rows.map(mapRecurringBillRow);
}

function mapRecurringBillRow(row: RecurringBillRow) {
  const now = Date.now();
  const dueDate = row.next_due_date * 1000;
  const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    amount: row.amount,
    categoryId: row.category_id,
    frequency: row.frequency,
    nextDueDate: new Date(dueDate),
    lastPaidDate: row.last_paid_date ? new Date(row.last_paid_date * 1000) : null,
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at * 1000),
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
    categoryColor: row.category_color,
    daysUntilDue,
    isOverdue: daysUntilDue < 0,
    isDueSoon: daysUntilDue >= 0 && daysUntilDue <= 3,
  };
}
