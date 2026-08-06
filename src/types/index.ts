// ============================================
// Type definitions for DuitKu
// ============================================

export type TransactionType = "income" | "expense" | "transfer";

export type PaymentMethod =
  | "cash"
  | "bank"
  | "qris"
  | "dana"
  | "ovo"
  | "gopay"
  | "shopeepay"
  | "transfer";

export type BudgetPeriod = "weekly" | "monthly" | "yearly";

export type BillFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type CategoryType = "income" | "expense";

export type ThemeMode = "light" | "dark" | "system";

export type AuditAction = "create" | "update" | "delete" | "login" | "logout";

// ============================================
// API / Response types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// Dashboard types
// ============================================

export interface DashboardStats {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  totalSaving: number;
  budgetUsed: number;
  budgetTotal: number;
  cashflowTrend: "up" | "down" | "stable";
  incomeChange: number;
  expenseChange: number;
}

export interface CashflowData {
  date: string;
  income: number;
  expense: number;
}

export interface CategoryBreakdown {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

export interface PaymentMethodBreakdown {
  method: PaymentMethod;
  label: string;
  value: number;
  color: string;
}

// ============================================
// Filter types
// ============================================

export interface TransactionFilters {
  type?: TransactionType;
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  startDate?: string;
  endDate?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  tags?: string[];
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ============================================
// Form types
// ============================================

export interface TransactionFormData {
  amount: number;
  type: TransactionType;
  categoryId: string;
  subCategoryId?: string;
  paymentMethod: PaymentMethod;
  description?: string;
  tags?: string;
  date: Date;
  receiptUrl?: string;
}

export interface CategoryFormData {
  name: string;
  type: CategoryType;
  icon?: string;
  color?: string;
}

export interface BudgetFormData {
  name: string;
  categoryId?: string;
  amount: number;
  period: BudgetPeriod;
  startDate: Date;
  endDate: Date;
}

export interface SavingGoalFormData {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  deadline?: Date;
  icon?: string;
  color?: string;
}

export interface RecurringBillFormData {
  name: string;
  amount: number;
  categoryId?: string;
  frequency: BillFrequency;
  nextDueDate: Date;
}

// ============================================
// Payment method labels
// ============================================

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank: "Bank Transfer",
  qris: "QRIS",
  dana: "Dana",
  ovo: "OVO",
  gopay: "GoPay",
  shopeepay: "ShopeePay",
  transfer: "Transfer",
};

export const PAYMENT_METHOD_COLORS: Record<PaymentMethod, string> = {
  cash: "#10b981",
  bank: "#3b82f6",
  qris: "#8b5cf6",
  dana: "#06b6d4",
  ovo: "#7c3aed",
  gopay: "#22c55e",
  shopeepay: "#f97316",
  transfer: "#6366f1",
};

// ============================================
// Default categories
// ============================================

export const DEFAULT_INCOME_CATEGORIES = [
  { name: "Gaji", icon: "Briefcase", color: "#10b981" },
  { name: "Bonus", icon: "Gift", color: "#f59e0b" },
  { name: "Freelance", icon: "Laptop", color: "#3b82f6" },
  { name: "Bisnis", icon: "Building2", color: "#8b5cf6" },
  { name: "Affiliate", icon: "Link", color: "#ec4899" },
  { name: "Investasi", icon: "TrendingUp", color: "#06b6d4" },
  { name: "Dividen", icon: "PiggyBank", color: "#14b8a6" },
  { name: "Hadiah", icon: "PartyPopper", color: "#f97316" },
  { name: "Cashback", icon: "RotateCcw", color: "#84cc16" },
  { name: "Refund", icon: "Undo2", color: "#64748b" },
  { name: "Lainnya", icon: "MoreHorizontal", color: "#a855f7" },
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Makanan", icon: "UtensilsCrossed", color: "#ef4444" },
  { name: "Minuman", icon: "GlassWater", color: "#f97316" },
  { name: "Ngopi", icon: "Coffee", color: "#92400e" },
  { name: "Belanja", icon: "ShoppingBag", color: "#ec4899" },
  { name: "Transportasi", icon: "Bus", color: "#3b82f6" },
  { name: "BBM", icon: "Fuel", color: "#f59e0b" },
  { name: "Motor", icon: "Bike", color: "#6366f1" },
  { name: "Mobil", icon: "Car", color: "#8b5cf6" },
  { name: "Servis", icon: "Wrench", color: "#64748b" },
  { name: "Pulsa", icon: "Smartphone", color: "#06b6d4" },
  { name: "Internet", icon: "Wifi", color: "#14b8a6" },
  { name: "Listrik", icon: "Zap", color: "#eab308" },
  { name: "Air", icon: "Droplets", color: "#0ea5e9" },
  { name: "Gas", icon: "Flame", color: "#f97316" },
  { name: "BPJS", icon: "Shield", color: "#22c55e" },
  { name: "Asuransi", icon: "ShieldCheck", color: "#10b981" },
  { name: "Kesehatan", icon: "Heart", color: "#ef4444" },
  { name: "Obat", icon: "Pill", color: "#f43f5e" },
  { name: "Rumah", icon: "Home", color: "#8b5cf6" },
  { name: "Kos", icon: "Building", color: "#a855f7" },
  { name: "Sewa", icon: "Key", color: "#7c3aed" },
  { name: "Pendidikan", icon: "GraduationCap", color: "#3b82f6" },
  { name: "Kuliah", icon: "School", color: "#2563eb" },
  { name: "Sekolah", icon: "BookOpen", color: "#1d4ed8" },
  { name: "Anak", icon: "Baby", color: "#ec4899" },
  { name: "Pajak", icon: "Receipt", color: "#64748b" },
  { name: "Sedekah", icon: "HandHeart", color: "#10b981" },
  { name: "Donasi", icon: "HeartHandshake", color: "#14b8a6" },
  { name: "Investasi", icon: "TrendingUp", color: "#06b6d4" },
  { name: "Crypto", icon: "Bitcoin", color: "#f59e0b" },
  { name: "Saham", icon: "BarChart3", color: "#22c55e" },
  { name: "Reksadana", icon: "PieChart", color: "#3b82f6" },
  { name: "Streaming", icon: "Play", color: "#ef4444" },
  { name: "Game", icon: "Gamepad2", color: "#8b5cf6" },
  { name: "Hiburan", icon: "Music", color: "#a855f7" },
  { name: "Liburan", icon: "Palmtree", color: "#f97316" },
  { name: "Cicilan", icon: "CalendarClock", color: "#dc2626" },
  { name: "Kartu Kredit", icon: "CreditCard", color: "#7c3aed" },
  { name: "Lainnya", icon: "MoreHorizontal", color: "#64748b" },
];
