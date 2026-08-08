// ============================================
// DuitKu Optional Seed Script for Example Data
// ============================================

import { executeQuery, queryOne } from "./client";
import { hash } from "bcryptjs";
import { seedDefaultCategories } from "@/repositories/category.repository";

export async function seedDemoData() {
  console.log("🌱 Seeding default categories and demo user...");

  // 1. Seed default income & expense categories
  await seedDefaultCategories();

  // 2. Check if a demo user already exists
  const existingUser = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE email = ?",
    ["admin@example.com"]
  );

  if (!existingUser) {
    const userId = crypto.randomUUID();
    const hashedPassword = await hash("admin123", 10);
    const now = Math.floor(Date.now() / 1000);

    // Create Demo User
    await executeQuery(
      `INSERT INTO users (id, name, email, password, role, created_at, updated_at)
       VALUES (?, 'Pengguna Demo', 'admin@example.com', ?, 'admin', ?, ?)`,
      [userId, hashedPassword, now, now]
    );

    // Create Default User Settings
    await executeQuery(
      `INSERT INTO settings (id, user_id, currency, language, theme, notify_bills, notify_budget_exceeded, notify_large_expense, large_expense_threshold, created_at)
       VALUES (?, ?, 'IDR', 'id', 'dark', 1, 1, 1, 500000, ?)`,
      [crypto.randomUUID(), userId, now]
    );

    console.log("✅ Demo user created: admin@example.com / admin123");
  } else {
    console.log("ℹ️ Demo user admin@example.com already exists.");
  }
}
