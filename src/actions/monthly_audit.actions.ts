"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import * as repo from "@/repositories/monthly_audit.repository";

async function getSessionUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function closeMonthAndAuditAction(targetYearMonth?: string) {
  const userId = await getSessionUserId();
  const res = await repo.closeMonthAndAudit(userId, targetYearMonth);
  revalidatePath("/reports");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return res;
}

export async function getMonthlyAuditsAction() {
  const userId = await getSessionUserId();
  return repo.getMonthlyAudits(userId);
}
