import { z } from "zod";

// ============================================
// Transaction schemas
// ============================================

export const transactionSchema = z.object({
  amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
  type: z.enum(["income", "expense", "transfer"], {
    required_error: "Pilih jenis transaksi",
  }),
  categoryId: z.string().min(1, "Pilih kategori"),
  subCategoryId: z.string().optional(),
  paymentMethod: z.enum(
    ["cash", "bank", "qris", "dana", "ovo", "gopay", "shopeepay", "transfer"],
    { required_error: "Pilih metode pembayaran" }
  ),
  description: z.string().optional(),
  tags: z.string().optional(),
  date: z.coerce.date({ required_error: "Pilih tanggal" }),
  receiptUrl: z.string().optional(),
});

export type TransactionSchema = z.infer<typeof transactionSchema>;

// ============================================
// Category schemas
// ============================================

export const categorySchema = z.object({
  name: z.string().min(1, "Nama kategori wajib diisi").max(50),
  type: z.enum(["income", "expense"], {
    required_error: "Pilih jenis kategori",
  }),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export type CategorySchema = z.infer<typeof categorySchema>;

// ============================================
// Budget schemas
// ============================================

export const budgetSchema = z.object({
  name: z.string().min(1, "Nama budget wajib diisi").max(100),
  categoryId: z.string().optional(),
  amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
  period: z.enum(["weekly", "monthly", "yearly"], {
    required_error: "Pilih periode",
  }),
  startDate: z.coerce.date({ required_error: "Pilih tanggal mulai" }),
  endDate: z.coerce.date({ required_error: "Pilih tanggal selesai" }),
});

export type BudgetSchema = z.infer<typeof budgetSchema>;

// ============================================
// Saving Goal schemas
// ============================================

export const savingGoalSchema = z.object({
  name: z.string().min(1, "Nama target wajib diisi").max(100),
  targetAmount: z.coerce.number().positive("Target harus lebih dari 0"),
  currentAmount: z.coerce.number().min(0).optional(),
  deadline: z.coerce.date().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export type SavingGoalSchema = z.infer<typeof savingGoalSchema>;

// ============================================
// Recurring Bill schemas
// ============================================

export const recurringBillSchema = z.object({
  name: z.string().min(1, "Nama tagihan wajib diisi").max(100),
  amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
  categoryId: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"], {
    required_error: "Pilih frekuensi",
  }),
  nextDueDate: z.coerce.date({ required_error: "Pilih tanggal jatuh tempo" }),
});

export type RecurringBillSchema = z.infer<typeof recurringBillSchema>;

// ============================================
// Auth schemas
// ============================================

export const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export type LoginSchema = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z.string().min(2, "Nama minimal 2 karakter"),
    email: z.string().email("Email tidak valid"),
    password: z.string().min(6, "Password minimal 6 karakter"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password tidak cocok",
    path: ["confirmPassword"],
  });

export type RegisterSchema = z.infer<typeof registerSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
    newPassword: z.string().min(6, "Password baru minimal 6 karakter"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Password tidak cocok",
    path: ["confirmPassword"],
  });

export type ChangePasswordSchema = z.infer<typeof changePasswordSchema>;

// ============================================
// Settings schemas
// ============================================

export const settingsSchema = z.object({
  currency: z.string().default("IDR"),
  language: z.string().default("id"),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  notifyBudget: z.boolean().default(true),
  notifyBills: z.boolean().default(true),
  notifyLargeExpense: z.boolean().default(true),
  largeExpenseThreshold: z.coerce.number().min(0).default(500000),
});

export type SettingsSchema = z.infer<typeof settingsSchema>;
