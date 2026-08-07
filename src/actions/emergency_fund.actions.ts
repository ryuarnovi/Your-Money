"use server";

import { auth } from "@/lib/auth";
import * as repo from "@/repositories/emergency_fund.repository";
import { revalidatePath } from "next/cache";

async function getSessionUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function getEmergencyFundAction() {
  const userId = await getSessionUserId();
  return repo.getEmergencyFund(userId);
}

export async function saveEmergencyFundTargetAction(data: {
  targetMonths: number;
  status: "single" | "married" | "married_kids";
  customMonthlyExpense?: number;
}) {
  const userId = await getSessionUserId();
  const id = await repo.saveEmergencyFundTarget({
    userId,
    targetMonths: data.targetMonths,
    status: data.status,
    customMonthlyExpense: data.customMonthlyExpense,
  });

  revalidatePath("/savings");
  revalidatePath("/dashboard");

  return { success: true, id };
}

export async function addEmergencyFundDepositAction(data: {
  amount: number;
  note?: string;
  date: string | Date;
}) {
  const userId = await getSessionUserId();
  const dateObj = typeof data.date === "string" ? new Date(data.date) : data.date;

  const id = await repo.addEmergencyFundDeposit({
    userId,
    amount: Number(data.amount),
    note: data.note,
    date: dateObj,
  });

  revalidatePath("/savings");
  revalidatePath("/dashboard");

  return { success: true, id };
}

export async function calculateAutomatedMonthlyExpenseAction() {
  const userId = await getSessionUserId();
  return repo.calculateAutomatedMonthlyExpense(userId);
}
