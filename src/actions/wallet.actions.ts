"use server";

import { auth } from "@/lib/auth";
import * as walletRepo from "@/repositories/wallet.repository";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function getSessionUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

const walletSchema = z.object({
  name: z.string().min(1, "Nama akun wajib diisi"),
  type: z.enum(["cash", "bank", "emoney"]),
  accountNumber: z.string().optional(),
  initialBalance: z.number().optional(),
  targetBalance: z.number().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const transferSchema = z.object({
  fromWalletId: z.string().min(1, "Pilih akun asal"),
  toWalletId: z.string().min(1, "Pilih akun tujuan"),
  amount: z.number().gt(0, "Nominal transfer harus lebih besar dari 0"),
  fee: z.number().min(0).optional(),
  description: z.string().optional(),
  date: z.date(),
});

export async function getWalletsAction() {
  const userId = await getSessionUserId();
  return walletRepo.getWallets(userId);
}

export async function getWalletStatsAction() {
  const userId = await getSessionUserId();
  return walletRepo.getWalletStats(userId);
}

export async function createWalletAction(formData: unknown) {
  const userId = await getSessionUserId();
  const validated = walletSchema.parse(formData);

  const id = await walletRepo.createWallet({
    userId,
    name: validated.name,
    type: validated.type,
    accountNumber: validated.accountNumber,
    initialBalance: validated.initialBalance || 0,
    color: validated.color,
    icon: validated.icon,
    isDefault: validated.isDefault,
  });

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");

  return { success: true, id };
}

export async function updateWalletAction(id: string, formData: unknown) {
  const userId = await getSessionUserId();
  const validated = walletSchema.partial().parse(formData);

  await walletRepo.updateWallet(id, userId, validated);

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");

  return { success: true };
}

export async function deleteWalletAction(id: string) {
  const userId = await getSessionUserId();
  await walletRepo.deleteWallet(id, userId);

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");

  return { success: true };
}

export async function transferBetweenWalletsAction(formData: unknown) {
  const userId = await getSessionUserId();
  const validated = transferSchema.parse(formData);

  const id = await walletRepo.transferBetweenWallets({
    userId,
    fromWalletId: validated.fromWalletId,
    toWalletId: validated.toWalletId,
    amount: validated.amount,
    fee: validated.fee,
    description: validated.description,
    date: validated.date,
  });

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");

  return { success: true, id };
}

export async function getWalletTransfersAction() {
  const userId = await getSessionUserId();
  return walletRepo.getWalletTransfers(userId);
}
