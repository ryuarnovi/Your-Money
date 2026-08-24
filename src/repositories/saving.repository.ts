"use server";

import { executeQuery, queryOne, queryAll } from "@/db/client";
import { generateId } from "@/utils";

interface SavingGoalRow {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: number | null;
  icon: string;
  color: string;
  is_completed: number;
  created_at: number;
}

export async function getSavingGoals(userId: string) {
  const rows = await queryAll<SavingGoalRow>(
    `SELECT * FROM saving_goals WHERE user_id = ? ORDER BY is_completed ASC, created_at DESC`,
    [userId]
  );

  return rows.map(mapSavingGoalRow);
}

export async function getSavingGoalById(id: string, userId: string) {
  const row = await queryOne<SavingGoalRow>(
    "SELECT * FROM saving_goals WHERE id = ? AND user_id = ?",
    [id, userId]
  );

  return row ? mapSavingGoalRow(row) : null;
}

export async function createSavingGoal(data: {
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount?: number;
  deadline?: Date;
  icon?: string;
  color?: string;
}) {
  const id = generateId();
  const now = Math.floor(Date.now() / 1000);

  await executeQuery(
    `INSERT INTO saving_goals (id, user_id, name, target_amount, current_amount, deadline, icon, color, is_completed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      id, data.userId, data.name, data.targetAmount,
      data.currentAmount || 0,
      data.deadline ? Math.floor(data.deadline.getTime() / 1000) : null,
      data.icon || "PiggyBank", data.color || "#10b981",
      now,
    ]
  );

  return id;
}

export async function updateSavingGoal(id: string, userId: string, data: Partial<{
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: Date | null;
  icon: string;
  color: string;
  isCompleted: boolean;
}>) {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) { updates.push("name = ?"); params.push(data.name); }
  if (data.targetAmount !== undefined) { updates.push("target_amount = ?"); params.push(data.targetAmount); }
  if (data.currentAmount !== undefined) { updates.push("current_amount = ?"); params.push(data.currentAmount); }
  if (data.deadline !== undefined) { updates.push("deadline = ?"); params.push(data.deadline ? Math.floor(data.deadline.getTime() / 1000) : null); }
  if (data.icon !== undefined) { updates.push("icon = ?"); params.push(data.icon); }
  if (data.color !== undefined) { updates.push("color = ?"); params.push(data.color); }
  if (data.isCompleted !== undefined) { updates.push("is_completed = ?"); params.push(data.isCompleted ? 1 : 0); }

  if (updates.length === 0) return;

  params.push(id, userId);

  await executeQuery(
    `UPDATE saving_goals SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`,
    params
  );
}

export async function addToSavingGoal(id: string, userId: string, amount: number) {
  await executeQuery(
    `UPDATE saving_goals SET current_amount = current_amount + ?,
     is_completed = CASE WHEN current_amount + ? >= target_amount THEN 1 ELSE 0 END
     WHERE id = ? AND user_id = ?`,
    [amount, amount, id, userId]
  );
}

export async function spendFromSavingGoal(
  id: string,
  userId: string,
  amount: number,
  paymentMethod: string = "bank",
  description?: string
) {
  const goal = await getSavingGoalById(id, userId);
  if (!goal) throw new Error("Target tabungan tidak ditemukan.");

  const newAmount = Math.max(0, goal.currentAmount - amount);
  await executeQuery(
    "UPDATE saving_goals SET current_amount = ? WHERE id = ? AND user_id = ?",
    [newAmount, id, userId]
  );

  const { createTransaction } = await import("./transaction.repository");
  const { getCategories } = await import("./category.repository");
  const categories = await getCategories(userId, "expense");
  const cat = categories.find((c) => c.name.toLowerCase().includes("kuliah") || c.name.toLowerCase().includes("pendidikan")) || categories[0];

  await createTransaction({
    userId,
    amount,
    type: "expense",
    categoryId: cat?.id,
    paymentMethod,
    description: description || `Pembayaran dari Tabungan (${goal.name})`,
    date: new Date(),
  });

  return newAmount;
}

export async function deleteSavingGoal(id: string, userId: string) {
  await executeQuery(
    "DELETE FROM saving_goals WHERE id = ? AND user_id = ?",
    [id, userId]
  );
}

function mapSavingGoalRow(row: SavingGoalRow) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    targetAmount: row.target_amount,
    currentAmount: row.current_amount || 0,
    deadline: row.deadline ? new Date(row.deadline * 1000) : null,
    icon: row.icon || "PiggyBank",
    color: row.color || "#10b981",
    isCompleted: Boolean(row.is_completed),
    createdAt: new Date(row.created_at * 1000),
    percentage: row.target_amount > 0 ? ((row.current_amount || 0) / row.target_amount) * 100 : 0,
    remaining: row.target_amount - (row.current_amount || 0),
  };
}
