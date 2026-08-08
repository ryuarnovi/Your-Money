"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  Target,
  CalendarClock,
  Plus,
  ArrowLeftRight,
  Landmark,
  Building2,
  Banknote,
  Smartphone,
} from "lucide-react";
import { formatCurrency, formatCompactCurrency, formatRelativeDate, formatDate } from "@/utils";
import { getRecentTransactionsAction, getDashboardStatsAction, getCategoryBreakdownAction } from "@/actions/transaction.actions";
import { getActiveBudgetsAction, getSavingGoalsAction, getUpcomingBillsAction } from "@/actions/crud.actions";
import { CashflowChart } from "@/components/charts/cashflow-chart";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";
import { PaymentDonutChart } from "@/components/charts/payment-donut-chart";
import Link from "next/link";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

interface Transaction {
  id: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  description: string | null;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  date: Date;
  paymentMethod: string;
}

interface BudgetItem {
  id: string;
  name: string;
  amount: number;
  spent: number;
  percentage: number;
  categoryColor?: string;
}

interface SavingGoalItem {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  percentage: number;
  color: string;
}

interface BillItem {
  id: string;
  name: string;
  amount: number;
  nextDueDate: Date;
  daysUntilDue: number;
  isOverdue: boolean;
  isDueSoon: boolean;
}

interface CategoryItem {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

export default function DashboardPage() {
  const [period, setPeriod] = useState("month");
  const [stats, setStats] = useState<{ totalIncome: number; totalExpense: number; balance: number } | null>(null);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [goals, setGoals] = useState<SavingGoalItem[]>([]);
  const [bills, setBills] = useState<BillItem[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [walletStats, setWalletStats] = useState<{ totalCash: number; totalBank: number; totalEmoney: number; totalOverall: number } | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const { getDashboardCombinedAction } = await import("@/actions/transaction.actions");
        const combined = await getDashboardCombinedAction();

        setStats(combined.stats);
        setWalletStats((combined as any).walletStats || null);
        setRecentTx(combined.recentTx as Transaction[]);
        setBudgets(combined.budgets as BudgetItem[]);
        setGoals(combined.savingGoals as SavingGoalItem[]);
        setBills(combined.bills as BillItem[]);
        setExpenseCategories(combined.expenseCategories as CategoryItem[]);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [period]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const totalSaving = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const budgetUsed = budgets.reduce((sum, b) => sum + b.spent, 0);
  const budgetTotal = budgets.reduce((sum, b) => sum + b.amount, 0);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Ringkasan keuanganmu hari ini
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(val) => val && setPeriod(val)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hari ini</SelectItem>
              <SelectItem value="week">Minggu ini</SelectItem>
              <SelectItem value="month">Bulan ini</SelectItem>
              <SelectItem value="year">Tahun ini</SelectItem>
            </SelectContent>
          </Select>
          <Link href="/transactions?action=create">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Transaksi Baru</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={item}>
          <Card className="relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full" />
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Wallet className="h-4 w-4 text-blue-500" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Total Saldo</span>
              </div>
              <p className="text-lg md:text-2xl font-bold tracking-tight">
                {formatCompactCurrency(stats?.balance || 0)}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full" />
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Pemasukan</span>
              </div>
              <p className="text-lg md:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatCompactCurrency(stats?.totalIncome || 0)}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-rose-500/10 to-transparent rounded-bl-full" />
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-rose-500/10">
                  <ArrowDownRight className="h-4 w-4 text-rose-500" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Pengeluaran</span>
              </div>
              <p className="text-lg md:text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                {formatCompactCurrency(stats?.totalExpense || 0)}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-violet-500/10 to-transparent rounded-bl-full" />
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <PiggyBank className="h-4 w-4 text-violet-500" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Tabungan</span>
              </div>
              <p className="text-lg md:text-2xl font-bold tracking-tight">
                {formatCompactCurrency(totalSaving)}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Dompet & Bank Breakdown Widget */}
      {walletStats && (
        <motion.div variants={item}>
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Landmark className="w-4 h-4 text-primary" />
                Alokasi Saldo Akun (Kas, Bank, & E-Money)
              </CardTitle>
              <Link href="/accounts">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  Kelola Akun ➔
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pb-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase">Bank</p>
                      <p className="text-sm font-bold text-foreground">{formatCurrency(walletStats.totalBank)}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Banknote className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase">Kas Tunai (Cash)</p>
                      <p className="text-sm font-bold text-foreground">{formatCurrency(walletStats.totalCash)}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase">E-Money / Wallet</p>
                      <p className="text-sm font-bold text-foreground">{formatCurrency(walletStats.totalEmoney)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div variants={item} className="lg:col-span-2">
          <CashflowChart period={period} />
        </motion.div>
        <motion.div variants={item}>
          <CategoryPieChart data={expenseCategories} title="Pengeluaran per Kategori" />
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Transactions */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold">Transaksi Terakhir</CardTitle>
              <Link href="/transactions">
                <Button variant="ghost" size="sm">
                  Lihat Semua
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {recentTx.length === 0 ? (
                <EmptyState
                  icon={ArrowLeftRight}
                  title="Belum ada transaksi"
                  description="Mulai catat pemasukan dan pengeluaranmu"
                />
              ) : (
                <div className="space-y-1">
                  {recentTx.map((tx) => (
                    <Link
                      key={tx.id}
                      href={`/transactions/${tx.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors group"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${tx.categoryColor}15` }}
                      >
                        {tx.type === "income" ? (
                          <TrendingUp className="w-4 h-4" style={{ color: tx.categoryColor }} />
                        ) : (
                          <TrendingDown className="w-4 h-4" style={{ color: tx.categoryColor }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {tx.description || tx.categoryName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tx.categoryName} · {formatRelativeDate(tx.date)}
                        </p>
                      </div>
                      <p
                        className={`text-sm font-semibold tabular-nums ${
                          tx.type === "income"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {formatCurrency(tx.amount)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Budget & Bills */}
        <motion.div variants={item} className="space-y-4">
          {/* Budget Status */}
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Target className="h-4 w-4" />
                Budget
              </CardTitle>
              <Link href="/budget">
                <Button variant="ghost" size="sm">Lihat</Button>
              </Link>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {budgets.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="Belum ada budget"
                  description="Atur batas pengeluaran"
                  compact
                />
              ) : (
                budgets.slice(0, 3).map((budget) => (
                  <div key={budget.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{budget.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {formatCompactCurrency(budget.spent)} / {formatCompactCurrency(budget.amount)}
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(budget.percentage, 100)}%`,
                          backgroundColor:
                            budget.percentage > 90
                              ? "#ef4444"
                              : budget.percentage > 70
                              ? "#f59e0b"
                              : "#10b981",
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Upcoming Bills */}
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Tagihan
              </CardTitle>
              <Link href="/bills">
                <Button variant="ghost" size="sm">Lihat</Button>
              </Link>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {bills.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  title="Tidak ada tagihan"
                  description="Belum ada tagihan mendatang"
                  compact
                />
              ) : (
                bills.slice(0, 4).map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{bill.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(bill.nextDueDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(bill.amount)}</p>
                      {bill.isOverdue ? (
                        <Badge variant="destructive" className="text-[10px]">Terlambat</Badge>
                      ) : bill.isDueSoon ? (
                        <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600">Segera</Badge>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  compact,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-4" : "py-8"}`}>
      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-2">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/70">{description}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-60 mt-2" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-6">
              <Skeleton className="h-4 w-20 mb-3" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/50">
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
