"use server";

import { auth } from "@/lib/auth";
import { budgetSchema, savingGoalSchema, recurringBillSchema, categorySchema } from "@/lib/validations";
import * as budgetRepo from "@/repositories/budget.repository";
import * as savingRepo from "@/repositories/saving.repository";
import * as billRepo from "@/repositories/bill.repository";
import * as categoryRepo from "@/repositories/category.repository";
import { revalidatePath } from "next/cache";

async function getSessionUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

// ============================================
// Budget Actions
// ============================================

export async function getBudgetsAction() {
  const userId = await getSessionUserId();
  return budgetRepo.getBudgets(userId);
}

export async function getActiveBudgetsAction() {
  const userId = await getSessionUserId();
  return budgetRepo.getActiveBudgets(userId);
}

export async function createBudgetAction(formData: unknown) {
  const userId = await getSessionUserId();
  const validated = budgetSchema.parse(formData);

  const id = await budgetRepo.createBudget({
    userId,
    name: validated.name,
    categoryId: validated.categoryId,
    amount: validated.amount,
    period: validated.period,
    startDate: validated.startDate,
    endDate: validated.endDate,
  });

  await budgetRepo.updateBudgetSpent(userId);

  revalidatePath("/budget");
  revalidatePath("/dashboard");

  return { success: true, id };
}

export async function updateBudgetAction(id: string, formData: unknown) {
  const userId = await getSessionUserId();
  const validated = budgetSchema.parse(formData);

  await budgetRepo.updateBudget(id, userId, {
    name: validated.name,
    categoryId: validated.categoryId,
    amount: validated.amount,
    period: validated.period,
    startDate: validated.startDate,
    endDate: validated.endDate,
  });

  revalidatePath("/budget");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function deleteBudgetAction(id: string) {
  const userId = await getSessionUserId();
  await budgetRepo.deleteBudget(id, userId);

  revalidatePath("/budget");
  revalidatePath("/dashboard");

  return { success: true };
}

// ============================================
// Saving Goal Actions
// ============================================

export async function getSavingGoalsAction() {
  const userId = await getSessionUserId();
  return savingRepo.getSavingGoals(userId);
}

export async function createSavingGoalAction(formData: unknown) {
  const userId = await getSessionUserId();
  const validated = savingGoalSchema.parse(formData);

  const id = await savingRepo.createSavingGoal({
    userId,
    name: validated.name,
    targetAmount: validated.targetAmount,
    currentAmount: validated.currentAmount,
    deadline: validated.deadline,
    icon: validated.icon,
    color: validated.color,
  });

  revalidatePath("/savings");
  revalidatePath("/dashboard");

  return { success: true, id };
}

export async function updateSavingGoalAction(id: string, formData: unknown) {
  const userId = await getSessionUserId();
  const validated = savingGoalSchema.parse(formData);

  await savingRepo.updateSavingGoal(id, userId, {
    name: validated.name,
    targetAmount: validated.targetAmount,
    currentAmount: validated.currentAmount,
    deadline: validated.deadline,
    icon: validated.icon,
    color: validated.color,
  });

  revalidatePath("/savings");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function addToSavingGoalAction(id: string, amount: number) {
  const userId = await getSessionUserId();
  await savingRepo.addToSavingGoal(id, userId, amount);

  revalidatePath("/savings");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function spendFromSavingGoalAction(id: string, amount: number, paymentMethod = "bank", description?: string) {
  const userId = await getSessionUserId();
  await savingRepo.spendFromSavingGoal(id, userId, amount, paymentMethod, description);

  revalidatePath("/savings");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/accounts");

  return { success: true };
}

export async function deleteSavingGoalAction(id: string) {
  const userId = await getSessionUserId();
  await savingRepo.deleteSavingGoal(id, userId);

  revalidatePath("/savings");
  revalidatePath("/dashboard");

  return { success: true };
}

// ============================================
// Recurring Bill Actions
// ============================================

export async function getRecurringBillsAction() {
  const userId = await getSessionUserId();
  return billRepo.getRecurringBills(userId);
}

export async function getUpcomingBillsAction(days = 7) {
  const userId = await getSessionUserId();
  return billRepo.getUpcomingBills(userId, days);
}

export async function createRecurringBillAction(formData: unknown) {
  const userId = await getSessionUserId();
  const validated = recurringBillSchema.parse(formData);

  const id = await billRepo.createRecurringBill({
    userId,
    name: validated.name,
    amount: validated.amount,
    categoryId: validated.categoryId,
    frequency: validated.frequency,
    nextDueDate: validated.nextDueDate,
  });

  revalidatePath("/bills");
  revalidatePath("/dashboard");

  return { success: true, id };
}

export async function updateRecurringBillAction(id: string, formData: unknown) {
  const userId = await getSessionUserId();
  const validated = recurringBillSchema.parse(formData);

  await billRepo.updateRecurringBill(id, userId, {
    name: validated.name,
    amount: validated.amount,
    categoryId: validated.categoryId,
    frequency: validated.frequency,
    nextDueDate: validated.nextDueDate,
  });

  revalidatePath("/bills");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function deleteRecurringBillAction(id: string) {
  const userId = await getSessionUserId();
  await billRepo.deleteRecurringBill(id, userId);

  revalidatePath("/bills");
  revalidatePath("/dashboard");

  return { success: true };
}

// ============================================
// Category Actions
// ============================================

export async function getCategoriesAction(type?: string) {
  const userId = await getSessionUserId();
  return categoryRepo.getCategories(userId, type);
}

export async function createCategoryAction(formData: unknown) {
  const userId = await getSessionUserId();
  const validated = categorySchema.parse(formData);

  const id = await categoryRepo.createCategory({
    userId,
    name: validated.name,
    type: validated.type,
    icon: validated.icon,
    color: validated.color,
  });

  revalidatePath("/categories");

  return { success: true, id };
}

export async function updateCategoryAction(id: string, formData: unknown) {
  const validated = categorySchema.parse(formData);

  await categoryRepo.updateCategory(id, {
    name: validated.name,
    icon: validated.icon,
    color: validated.color,
  });

  revalidatePath("/categories");

  return { success: true };
}

export async function deleteCategoryAction(id: string) {
  await categoryRepo.deleteCategory(id);

  revalidatePath("/categories");

  return { success: true };
}
