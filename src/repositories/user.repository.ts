"use server";

import { executeQuery, queryOne } from "@/db/client";
import { generateId } from "@/utils";
import { hash, compare } from "bcryptjs";

interface UserRow {
  id: string;
  name: string;
  email: string;
  password: string | null;
  image: string | null;
  created_at: number;
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
}) {
  const id = generateId();
  const now = Math.floor(Date.now() / 1000);
  const hashedPassword = await hash(data.password, 12);

  await executeQuery(
    `INSERT INTO users (id, name, email, password, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.name, data.email, hashedPassword, now, now]
  );

  // Create default settings
  await executeQuery(
    `INSERT INTO settings (id, user_id, currency, language, theme, notify_budget, notify_bills, notify_large_expense, large_expense_threshold, created_at)
     VALUES (?, ?, 'IDR', 'id', 'system', 1, 1, 1, 500000, ?)`,
    [generateId(), id, now]
  );

  return id;
}

export async function getUserByEmail(email: string) {
  const row = await queryOne<UserRow>(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );

  return row ? mapUserRow(row) : null;
}

export async function getUserById(id: string) {
  const row = await queryOne<UserRow>(
    "SELECT * FROM users WHERE id = ?",
    [id]
  );

  return row ? mapUserRow(row) : null;
}

export async function updateUser(id: string, data: Partial<{
  name: string;
  email: string;
  image: string;
}>) {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) { updates.push("name = ?"); params.push(data.name); }
  if (data.email !== undefined) { updates.push("email = ?"); params.push(data.email); }
  if (data.image !== undefined) { updates.push("image = ?"); params.push(data.image); }

  updates.push("updated_at = ?");
  params.push(Math.floor(Date.now() / 1000));
  params.push(id);

  await executeQuery(
    `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
    params
  );
}

export async function changePassword(id: string, currentPassword: string, newPassword: string) {
  const user = await queryOne<{ password: string }>(
    "SELECT password FROM users WHERE id = ?",
    [id]
  );

  if (!user?.password) {
    throw new Error("User not found or no password set");
  }

  const isValid = await compare(currentPassword, user.password);
  if (!isValid) {
    throw new Error("Password saat ini salah");
  }

  const hashedPassword = await hash(newPassword, 12);

  await executeQuery(
    "UPDATE users SET password = ?, updated_at = ? WHERE id = ?",
    [hashedPassword, Math.floor(Date.now() / 1000), id]
  );
}

export async function getUserSettings(userId: string) {
  const row = await queryOne<{
    id: string;
    user_id: string;
    currency: string;
    language: string;
    theme: string;
    notify_budget: number;
    notify_bills: number;
    notify_large_expense: number;
    large_expense_threshold: number;
  }>("SELECT * FROM settings WHERE user_id = ?", [userId]);

  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    currency: row.currency,
    language: row.language,
    theme: row.theme,
    notifyBudget: Boolean(row.notify_budget),
    notifyBills: Boolean(row.notify_bills),
    notifyLargeExpense: Boolean(row.notify_large_expense),
    largeExpenseThreshold: row.large_expense_threshold,
  };
}

export async function updateUserSettings(userId: string, data: Partial<{
  currency: string;
  language: string;
  theme: string;
  notifyBudget: boolean;
  notifyBills: boolean;
  notifyLargeExpense: boolean;
  largeExpenseThreshold: number;
}>) {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.currency !== undefined) { updates.push("currency = ?"); params.push(data.currency); }
  if (data.language !== undefined) { updates.push("language = ?"); params.push(data.language); }
  if (data.theme !== undefined) { updates.push("theme = ?"); params.push(data.theme); }
  if (data.notifyBudget !== undefined) { updates.push("notify_budget = ?"); params.push(data.notifyBudget ? 1 : 0); }
  if (data.notifyBills !== undefined) { updates.push("notify_bills = ?"); params.push(data.notifyBills ? 1 : 0); }
  if (data.notifyLargeExpense !== undefined) { updates.push("notify_large_expense = ?"); params.push(data.notifyLargeExpense ? 1 : 0); }
  if (data.largeExpenseThreshold !== undefined) { updates.push("large_expense_threshold = ?"); params.push(data.largeExpenseThreshold); }

  if (updates.length === 0) return;

  params.push(userId);

  await executeQuery(
    `UPDATE settings SET ${updates.join(", ")} WHERE user_id = ?`,
    params
  );
}

function mapUserRow(row: UserRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    hasPassword: !!row.password,
    createdAt: new Date(row.created_at * 1000),
  };
}
