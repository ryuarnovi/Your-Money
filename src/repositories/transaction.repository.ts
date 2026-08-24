"use server";

import { executeQuery, queryOne, queryAll, queryCount } from "@/db/client";
import type { TransactionFilters } from "@/types";
import { generateId } from "@/utils";

interface TransactionRow {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  category_id: string | null;
  sub_category_id: string | null;
  payment_method: string;
  description: string | null;
  tags: string | null;
  receipt_url: string | null;
  date: number;
  created_at: number;
  updated_at: number;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  sub_category_name?: string;
}

export async function getTransactions(userId: string, filters: TransactionFilters = {}) {
  const conditions: string[] = ["t.user_id = ?"];
  const params: unknown[] = [userId];

  if (filters.type) {
    conditions.push("t.type = ?");
    params.push(filters.type);
  }

  if (filters.categoryId) {
    conditions.push("t.category_id = ?");
    params.push(filters.categoryId);
  }

  if (filters.paymentMethod) {
    conditions.push("t.payment_method = ?");
    params.push(filters.paymentMethod);
  }

  if (filters.startDate) {
    conditions.push("t.date >= ?");
    params.push(new Date(filters.startDate).getTime() / 1000);
  }

  if (filters.endDate) {
    conditions.push("t.date <= ?");
    params.push(new Date(filters.endDate).getTime() / 1000);
  }

  if (filters.search) {
    conditions.push("(t.description LIKE ? OR c.name LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.minAmount) {
    conditions.push("t.amount >= ?");
    params.push(filters.minAmount);
  }

  if (filters.maxAmount) {
    conditions.push("t.amount <= ?");
    params.push(filters.maxAmount);
  }

  const where = conditions.join(" AND ");
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  const offset = (page - 1) * pageSize;
  const sortBy = filters.sortBy || "date";
  const sortOrder = filters.sortOrder || "desc";

  const countResult = await queryCount(
    `SELECT COUNT(*) as count FROM transactions t LEFT JOIN categories c ON t.category_id = c.id WHERE ${where}`,
    params
  );

  const rows = await queryAll<TransactionRow>(
    `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color, sc.name as sub_category_name
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id
     WHERE ${where}
     ORDER BY t.${sortBy} ${sortOrder}
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    data: rows.map(mapTransactionRow),
    total: countResult,
    page,
    pageSize,
    totalPages: Math.ceil(countResult / pageSize),
  };
}

export async function getTransactionById(id: string, userId: string) {
  const row = await queryOne<TransactionRow>(
    `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color, sc.name as sub_category_name
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id
     WHERE t.id = ? AND t.user_id = ?`,
    [id, userId]
  );

  return row ? mapTransactionRow(row) : null;
}

export async function createTransaction(data: {
  userId: string;
  amount: number;
  type: string;
  categoryId?: string;
  subCategoryId?: string;
  paymentMethod: string;
  description?: string;
  tags?: string;
  receiptUrl?: string;
  date: Date;
}) {
  const id = generateId();
  const now = Math.floor(Date.now() / 1000);
  const dateTs = Math.floor(data.date.getTime() / 1000);

  await executeQuery(
    `INSERT INTO transactions (id, user_id, amount, type, category_id, sub_category_id, payment_method, description, tags, receipt_url, date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, data.userId, data.amount, data.type,
      data.categoryId || null, data.subCategoryId || null,
      data.paymentMethod, data.description || null,
      data.tags || null, data.receiptUrl || null,
      dateTs, now, now,
    ]
  );

  return id;
}

export async function updateTransaction(
  id: string,
  userId: string,
  data: Partial<{
    amount: number;
    type: string;
    categoryId: string;
    subCategoryId: string;
    paymentMethod: string;
    description: string;
    tags: string;
    receiptUrl: string;
    date: Date;
  }>
) {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.amount !== undefined) { updates.push("amount = ?"); params.push(data.amount); }
  if (data.type !== undefined) { updates.push("type = ?"); params.push(data.type); }
  if (data.categoryId !== undefined) { updates.push("category_id = ?"); params.push(data.categoryId); }
  if (data.subCategoryId !== undefined) { updates.push("sub_category_id = ?"); params.push(data.subCategoryId); }
  if (data.paymentMethod !== undefined) { updates.push("payment_method = ?"); params.push(data.paymentMethod); }
  if (data.description !== undefined) { updates.push("description = ?"); params.push(data.description); }
  if (data.tags !== undefined) { updates.push("tags = ?"); params.push(data.tags); }
  if (data.receiptUrl !== undefined) { updates.push("receipt_url = ?"); params.push(data.receiptUrl); }
  if (data.date !== undefined) { updates.push("date = ?"); params.push(Math.floor(data.date.getTime() / 1000)); }

  updates.push("updated_at = ?");
  params.push(Math.floor(Date.now() / 1000));
  params.push(id, userId);

  await executeQuery(
    `UPDATE transactions SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`,
    params
  );
}

export async function deleteTransaction(id: string, userId: string) {
  await executeQuery(
    "DELETE FROM transactions WHERE id = ? AND user_id = ?",
    [id, userId]
  );
}

export async function getTransactionStats(userId: string, startDate?: Date, endDate?: Date) {
  const conditions = ["user_id = ?"];
  const params: unknown[] = [userId];

  if (startDate) {
    conditions.push("date >= ?");
    params.push(Math.floor(startDate.getTime() / 1000));
  }

  if (endDate) {
    conditions.push("date <= ?");
    params.push(Math.floor(endDate.getTime() / 1000));
  }

  const where = conditions.join(" AND ");

  const income = await queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE ${where} AND type = 'income'`,
    params
  );

  const expense = await queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE ${where} AND type = 'expense'`,
    params
  );

  return {
    totalIncome: income?.total || 0,
    totalExpense: expense?.total || 0,
    balance: (income?.total || 0) - (expense?.total || 0),
  };
}

export async function detectLegacyTransfers(userId: string) {
  const rows = await queryAll<TransactionRow>(
    `SELECT t.*, c.name as category_name
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE t.user_id = ? AND t.type IN ('expense', 'income')
     AND (t.description LIKE '%transfer%' OR t.description LIKE '%tf %' OR t.description LIKE '%tarik tunai%' OR t.description LIKE '%topup%')
     ORDER BY t.date DESC`,
    [userId]
  );

  return rows.map(mapTransactionRow);
}

export async function convertLegacyTransferToRealTransfer(
  txId: string,
  userId: string,
  fromWalletId: string,
  toWalletId: string
) {
  const tx = await queryOne<TransactionRow>(
    `SELECT * FROM transactions WHERE id = ? AND user_id = ?`,
    [txId, userId]
  );
  if (!tx) throw new Error("Transaksi tidak ditemukan.");

  // Delete old expense/income transaction
  await executeQuery("DELETE FROM transactions WHERE id = ? AND user_id = ?", [txId, userId]);

  // Insert into wallet_transfers
  const id = generateId();
  const now = Math.floor(Date.now() / 1000);
  await executeQuery(
    `INSERT INTO wallet_transfers (id, user_id, from_wallet_id, to_wallet_id, amount, fee, description, date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, fromWalletId, toWalletId, tx.amount, 0, tx.description || "Transfer Konversi", tx.date, now]
  );

  return id;
}

export async function getCashflowData(userId: string, startDate: Date, endDate: Date) {
  const rows = await queryAll<{ date: string; type: string; total: number }>(
    `SELECT date(date, 'unixepoch') as date, type, SUM(amount) as total
     FROM transactions
     WHERE user_id = ? AND type IN ('income', 'expense') AND date >= ? AND date <= ?
     GROUP BY date(date, 'unixepoch'), type
     ORDER BY date ASC`,
    [userId, Math.floor(startDate.getTime() / 1000), Math.floor(endDate.getTime() / 1000)]
  );

  return rows;
}

export async function getCategoryBreakdown(userId: string, type: string, startDate?: Date, endDate?: Date) {
  const conditions = ["t.user_id = ?", "t.type = ?"];
  const params: unknown[] = [userId, type];

  if (startDate) {
    conditions.push("t.date >= ?");
    params.push(Math.floor(startDate.getTime() / 1000));
  }

  if (endDate) {
    conditions.push("t.date <= ?");
    params.push(Math.floor(endDate.getTime() / 1000));
  }

  const rows = await queryAll<{ name: string; color: string; total: number }>(
    `SELECT c.name, c.color, SUM(t.amount) as total
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE ${conditions.join(" AND ")}
     GROUP BY c.id, c.name, c.color
     ORDER BY total DESC`,
    params
  );

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  return rows.map((row) => ({
    name: row.name,
    value: row.total,
    color: row.color || "#6366f1",
    percentage: grandTotal > 0 ? (row.total / grandTotal) * 100 : 0,
  }));
}

export async function getPaymentMethodBreakdown(userId: string, startDate?: Date, endDate?: Date) {
  const conditions = ["user_id = ?"];
  const params: unknown[] = [userId];

  if (startDate) {
    conditions.push("date >= ?");
    params.push(Math.floor(startDate.getTime() / 1000));
  }

  if (endDate) {
    conditions.push("date <= ?");
    params.push(Math.floor(endDate.getTime() / 1000));
  }

  return await queryAll<{ payment_method: string; total: number; count: number }>(
    `SELECT payment_method, SUM(amount) as total, COUNT(*) as count
     FROM transactions
     WHERE ${conditions.join(" AND ")}
     GROUP BY payment_method
     ORDER BY total DESC`,
    params
  );
}

export async function getRecentTransactions(userId: string, limit = 10) {
  const rows = await queryAll<TransactionRow>(
    `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE t.user_id = ?
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT ?`,
    [userId, limit]
  );

  return rows.map(mapTransactionRow);
}

function mapTransactionRow(row: TransactionRow) {
  return {
    id: row.id,
    userId: row.user_id,
    amount: row.amount,
    type: row.type as "income" | "expense" | "transfer",
    categoryId: row.category_id,
    subCategoryId: row.sub_category_id,
    paymentMethod: row.payment_method,
    description: row.description,
    tags: row.tags,
    receiptUrl: row.receipt_url,
    date: new Date(row.date * 1000),
    createdAt: new Date(row.created_at * 1000),
    updatedAt: new Date(row.updated_at * 1000),
    categoryName: row.category_name || "Tanpa Kategori",
    categoryIcon: row.category_icon || "Circle",
    categoryColor: row.category_color || "#6366f1",
    subCategoryName: row.sub_category_name,
  };
}
