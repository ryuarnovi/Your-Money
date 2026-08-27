"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Percent,
  Calendar,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Sparkles,
} from "lucide-react";
import { formatCurrency, formatCompactCurrency } from "@/utils";
import { CashflowChart } from "@/components/charts/cashflow-chart";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";
import { PaymentDonutChart } from "@/components/charts/payment-donut-chart";
import { getAnalyticsDataAction } from "@/actions/transaction.actions";

interface CategoryData {
  name: string;
  value: number;
  color: string;
  percentage: number;
  count?: number;
}

interface AnalyticsData {
  incomeTotal: number;
  expenseTotal: number;
  prevMonthExpense: number;
  netCashflow: number;
  savingsRate: number;
  dailyAverage: number;
  avgPerTx: number;
  expenseTxCount: number;
  momExpenseChange: number;
  expenseCategories: CategoryData[];
  incomeCategories: CategoryData[];
}

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

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      try {
        const res = await getAnalyticsDataAction(period);
        setData(res);
      } catch (err) {
        console.error("Failed to load analytics data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, [period]);

  if (loading) {
    return <AnalyticsSkeleton />;
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Analisis Keuangan</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visualisasi mendalam pola pengeluaran, rasio tabungan, dan tren keuangan
          </p>
        </div>

        <Select value={period} onValueChange={(val) => val && setPeriod(val)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Bulan ini</SelectItem>
            <SelectItem value="last30">30 Hari Terakhir</SelectItem>
            <SelectItem value="year">Tahun ini</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Advanced Analytics Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Savings Rate */}
        <motion.div variants={item}>
          <Card className="border-emerald-500/20 bg-emerald-500/5 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Percent className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Rasio Tabungan
                </span>
              </div>
              <p className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {data ? `${Math.round(data.savingsRate)}%` : "0%"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {data && data.savingsRate >= 20 ? "Tingkat tabungan sangat baik" : "Alokasikan lebih banyak ke tabungan"}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Daily Average Expense */}
        <motion.div variants={item}>
          <Card className="border-blue-500/20 bg-blue-500/5 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                  <Calendar className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Rata-rata Harian
                </span>
              </div>
              <p className="text-xl font-bold tracking-tight text-foreground">
                {data ? formatCurrency(data.dailyAverage) : "Rp 0"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Pengeluaran per hari dalam periode ini
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Average per Transaction */}
        <motion.div variants={item}>
          <Card className="border-purple-500/20 bg-purple-500/5 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-500">
                  <CreditCard className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Rata-rata Transaksi
                </span>
              </div>
              <p className="text-xl font-bold tracking-tight text-foreground">
                {data ? formatCurrency(data.avgPerTx) : "Rp 0"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {data?.expenseTxCount || 0} transaksi pengeluaran tercatat
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Month-over-Month Comparison */}
        <motion.div variants={item}>
          <Card className="border-indigo-500/20 bg-indigo-500/5 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Tren Bulan Lalu
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <p className="text-xl font-bold tracking-tight text-foreground">
                  {data ? `${Math.abs(Math.round(data.momExpenseChange))}%` : "0%"}
                </p>
                {data && data.momExpenseChange !== 0 && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0.5 flex items-center ${
                      data.momExpenseChange < 0
                        ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                        : "border-rose-500/30 text-rose-600 bg-rose-500/10"
                    }`}
                  >
                    {data.momExpenseChange < 0 ? (
                      <>
                        <ArrowDownRight className="h-3 w-3 mr-0.5" />
                        Lebih Hemat
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="h-3 w-3 mr-0.5" />
                        Meningkat
                      </>
                    )}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Dibanding pengeluaran bulan lalu
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Cashflow Line/Area Chart */}
      <motion.div variants={item}>
        <CashflowChart period={period} />
      </motion.div>

      {/* Income & Expense Breakdown Pie Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={item}>
          <CategoryPieChart data={data?.expenseCategories || []} title="Pengeluaran per Kategori" />
        </motion.div>
        <motion.div variants={item}>
          <CategoryPieChart data={data?.incomeCategories || []} title="Pemasukan per Kategori" />
        </motion.div>
      </div>

      {/* Top Expense Categories Ranking Table */}
      <motion.div variants={item}>
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="py-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Peringkat Kategori Pengeluaran Terbesar
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 pt-0">
            {!data || data.expenseCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Belum ada data pengeluaran pada periode ini.
              </p>
            ) : (
              <div className="space-y-3">
                {data.expenseCategories.map((cat, idx) => (
                  <div key={cat.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-bold text-muted-foreground w-4 font-mono">
                          #{idx + 1}
                        </span>
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="font-medium truncate">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted-foreground font-mono">
                          {cat.count ? `${cat.count} tx` : ""}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(cat.value)}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono w-12 text-right">
                          {Math.round(cat.percentage)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(cat.percentage, 100)}%`,
                          backgroundColor: cat.color || "#6366f1",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Payment Method Donut Chart */}
      <motion.div variants={item}>
        <PaymentDonutChart />
      </motion.div>
    </motion.div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
