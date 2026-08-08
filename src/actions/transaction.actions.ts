"use server";

import { auth } from "@/lib/auth";
import { transactionSchema } from "@/lib/validations";
import * as transactionRepo from "@/repositories/transaction.repository";
import * as budgetRepo from "@/repositories/budget.repository";
import { revalidatePath } from "next/cache";

async function getSessionUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function getTransactionsAction(filters = {}) {
  const userId = await getSessionUserId();
  return transactionRepo.getTransactions(userId, filters);
}

export async function getTransactionByIdAction(id: string) {
  const userId = await getSessionUserId();
  return transactionRepo.getTransactionById(id, userId);
}

export async function createTransactionAction(formData: unknown) {
  const userId = await getSessionUserId();
  const validated = transactionSchema.parse(formData);

  const id = await transactionRepo.createTransaction({
    userId,
    amount: validated.amount,
    type: validated.type,
    categoryId: validated.categoryId,
    subCategoryId: validated.subCategoryId,
    paymentMethod: validated.paymentMethod,
    description: validated.description,
    tags: validated.tags,
    date: validated.date,
    receiptUrl: validated.receiptUrl,
  });

  // Update budget spent amounts
  if (validated.type === "expense") {
    await budgetRepo.updateBudgetSpent(userId);
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");

  return { success: true, id };
}

export async function updateTransactionAction(id: string, formData: unknown) {
  const userId = await getSessionUserId();
  const validated = transactionSchema.parse(formData);

  await transactionRepo.updateTransaction(id, userId, {
    amount: validated.amount,
    type: validated.type,
    categoryId: validated.categoryId,
    subCategoryId: validated.subCategoryId,
    paymentMethod: validated.paymentMethod,
    description: validated.description,
    tags: validated.tags,
    date: validated.date,
    receiptUrl: validated.receiptUrl,
  });

  await budgetRepo.updateBudgetSpent(userId);

  revalidatePath("/dashboard");
  revalidatePath("/transactions");

  return { success: true };
}

export async function deleteTransactionAction(id: string) {
  const userId = await getSessionUserId();
  await transactionRepo.deleteTransaction(id, userId);
  await budgetRepo.updateBudgetSpent(userId);

  revalidatePath("/dashboard");
  revalidatePath("/transactions");

  return { success: true };
}

export async function getRecentTransactionsAction(limit = 10) {
  const userId = await getSessionUserId();
  return transactionRepo.getRecentTransactions(userId, limit);
}

export async function getDashboardStatsAction(startDate?: string, endDate?: string) {
  const userId = await getSessionUserId();
  const start = startDate ? new Date(startDate) : undefined;
  const end = endDate ? new Date(endDate) : undefined;
  return transactionRepo.getTransactionStats(userId, start, end);
}

export async function getCashflowDataAction(startDate: string, endDate: string) {
  const userId = await getSessionUserId();
  return transactionRepo.getCashflowData(userId, new Date(startDate), new Date(endDate));
}

export async function getCategoryBreakdownAction(type: string, startDate?: string, endDate?: string) {
  const userId = await getSessionUserId();
  const start = startDate ? new Date(startDate) : undefined;
  const end = endDate ? new Date(endDate) : undefined;
  return transactionRepo.getCategoryBreakdown(userId, type, start, end);
}

export async function getPaymentMethodBreakdownAction(startDate?: string, endDate?: string) {
  const userId = await getSessionUserId();
  const start = startDate ? new Date(startDate) : undefined;
  const end = endDate ? new Date(endDate) : undefined;
  return transactionRepo.getPaymentMethodBreakdown(userId, start, end);
}

export async function getDashboardCombinedAction() {
  const userId = await getSessionUserId();
  await budgetRepo.updateBudgetSpent(userId);
  const { executeBatch } = await import("@/db/client");

  const now = Math.floor(Date.now() / 1000);
  const future7Days = now + 7 * 86400;

  // Single batch call with 6 parallel queries in 1 HTTP request!
  const results = await executeBatch([
    // 0. Income total
    { sql: "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'income'", params: [userId] },
    // 1. Expense total
    { sql: "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense'", params: [userId] },
    // 2. Recent transactions (limit 8)
    {
      sql: `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = ?
            ORDER BY t.date DESC, t.created_at DESC LIMIT 8`,
      params: [userId],
    },
    // 3. Active budgets
    {
      sql: `SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
            FROM budgets b
            LEFT JOIN categories c ON b.category_id = c.id
            WHERE b.user_id = ? AND b.end_date >= ?
            ORDER BY b.end_date ASC`,
      params: [userId, now],
    },
    // 4. Saving goals
    { sql: "SELECT * FROM saving_goals WHERE user_id = ? ORDER BY is_completed ASC, created_at DESC", params: [userId] },
    // 5. Upcoming bills
    {
      sql: `SELECT rb.*, c.name as category_name, c.icon as category_icon, c.color as category_color
            FROM recurring_bills rb
            LEFT JOIN categories c ON rb.category_id = c.id
            WHERE rb.user_id = ? AND rb.is_active = 1 AND rb.next_due_date <= ?
            ORDER BY rb.next_due_date ASC`,
      params: [userId, future7Days],
    },
    // 6. Expense category breakdown
    {
      sql: `SELECT c.name, c.color, SUM(t.amount) as total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = ? AND t.type = 'expense'
            GROUP BY c.id, c.name, c.color
            ORDER BY total DESC`,
      params: [userId],
    },
  ]);

  const incomeTotal = (results[0].results[0] as any)?.total || 0;
  const expenseTotal = (results[1].results[0] as any)?.total || 0;

  const recentTx = (results[2].results as any[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    amount: row.amount,
    type: row.type,
    categoryId: row.category_id,
    paymentMethod: row.payment_method,
    description: row.description,
    date: new Date(row.date * 1000),
    categoryName: row.category_name || "Tanpa Kategori",
    categoryIcon: row.category_icon || "Circle",
    categoryColor: row.category_color || "#6366f1",
  }));

  const budgets = (results[3].results as any[]).map((row) => ({
    id: row.id,
    name: row.name,
    amount: row.amount,
    spent: row.spent || 0,
    percentage: row.amount > 0 ? ((row.spent || 0) / row.amount) * 100 : 0,
    categoryColor: row.category_color,
  }));

  const savingGoals = (results[4].results as any[]).map((row) => ({
    id: row.id,
    name: row.name,
    targetAmount: row.target_amount,
    currentAmount: row.current_amount || 0,
    percentage: row.target_amount > 0 ? ((row.current_amount || 0) / row.target_amount) * 100 : 0,
    color: row.color || "#10b981",
  }));

  const bills = (results[5].results as any[]).map((row) => {
    const dueDate = row.next_due_date * 1000;
    const daysUntilDue = Math.ceil((dueDate - Date.now()) / (1000 * 60 * 60 * 24));
    return {
      id: row.id,
      name: row.name,
      amount: row.amount,
      nextDueDate: new Date(dueDate),
      daysUntilDue,
      isOverdue: daysUntilDue < 0,
      isDueSoon: daysUntilDue >= 0 && daysUntilDue <= 3,
    };
  });

  const catRows = results[6].results as any[];
  const grandTotal = catRows.reduce((sum, r) => sum + r.total, 0);
  const expenseCategories = catRows.map((r) => ({
    name: r.name,
    value: r.total,
    color: r.color || "#6366f1",
    percentage: grandTotal > 0 ? (r.total / grandTotal) * 100 : 0,
  }));

  return {
    stats: {
      totalIncome: incomeTotal,
      totalExpense: expenseTotal,
      balance: incomeTotal - expenseTotal,
    },
    recentTx,
    budgets,
    savingGoals,
    bills,
    expenseCategories,
  };
}
