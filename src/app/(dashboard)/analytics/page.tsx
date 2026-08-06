"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { formatCurrency, formatCompactCurrency } from "@/utils";
import { CashflowChart } from "@/components/charts/cashflow-chart";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";
import { PaymentDonutChart } from "@/components/charts/payment-donut-chart";
import { getCategoryBreakdownAction, getDashboardStatsAction } from "@/actions/transaction.actions";

interface CategoryData {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("month");
  const [incomeCategories, setIncomeCategories] = useState<CategoryData[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<CategoryData[]>([]);
  const [stats, setStats] = useState<{ totalIncome: number; totalExpense: number; balance: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      try {
        const [inc, exp, st] = await Promise.all([
          getCategoryBreakdownAction("income"),
          getCategoryBreakdownAction("expense"),
          getDashboardStatsAction(),
        ]);
        setIncomeCategories(inc as CategoryData[]);
        setExpenseCategories(exp as CategoryData[]);
        setStats(st);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, [period]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analisis Keuangan</h1>
          <p className="text-muted-foreground text-sm">
            Visualisasi mendalam pola pengeluaran & sumber pemasukanmu
          </p>
        </div>

        <Select value={period} onValueChange={(val) => val && setPeriod(val)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Bulan ini</SelectItem>
            <SelectItem value="year">Tahun ini</SelectItem>
            <SelectItem value="last30">30 Hari Terakhir</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cashflow Line/Area Chart */}
      <CashflowChart period={period} />

      {/* Income & Expense Breakdown Pie Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CategoryPieChart data={expenseCategories} title="Pengeluaran per Kategori" />
        <CategoryPieChart data={incomeCategories} title="Pemasukan per Kategori" />
      </div>

      {/* Payment Method Donut Chart */}
      <PaymentDonutChart />
    </div>
  );
}
