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
