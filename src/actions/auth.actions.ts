"use server";

import { signIn, signOut } from "@/lib/auth";
import { loginSchema, registerSchema, changePasswordSchema, settingsSchema } from "@/lib/validations";
import * as userRepo from "@/repositories/user.repository";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function loginAction(formData: unknown) {
  const validated = loginSchema.parse(formData);

  try {
    await signIn("credentials", {
      email: validated.email,
      password: validated.password,
      redirect: false,
    });

    return { success: true };
  } catch {
    return { success: false, error: "Email atau password salah" };
  }
}

export async function registerAction(formData: unknown) {
  const validated = registerSchema.parse(formData);

  const existingUser = await userRepo.getUserByEmail(validated.email);
  if (existingUser) {
    return { success: false, error: "Email sudah terdaftar" };
  }

  try {
    await userRepo.createUser({
      name: validated.name,
      email: validated.email,
      password: validated.password,
    });

    await signIn("credentials", {
      email: validated.email,
      password: validated.password,
      redirect: false,
    });

    return { success: true };
  } catch {
    return { success: false, error: "Gagal mendaftar. Coba lagi." };
  }
}

export async function logoutAction() {
  await signOut({ redirect: false });
  return { success: true };
}

export async function googleLoginAction() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function changePasswordAction(formData: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const validated = changePasswordSchema.parse(formData);

  try {
    await userRepo.changePassword(
      session.user.id,
      validated.currentPassword,
      validated.newPassword
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal mengubah password",
    };
  }
}

export async function updateProfileAction(data: { name?: string; image?: string }) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  await userRepo.updateUser(session.user.id, data);

  revalidatePath("/profile");
  revalidatePath("/settings");

  return { success: true };
}

export async function getSettingsAction() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return userRepo.getUserSettings(session.user.id);
}

export async function updateSettingsAction(formData: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const validated = settingsSchema.parse(formData);

  await userRepo.updateUserSettings(session.user.id, validated);

  revalidatePath("/settings");

  return { success: true };
}
