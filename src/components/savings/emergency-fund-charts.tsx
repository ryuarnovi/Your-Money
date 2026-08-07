"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCompactCurrency, formatCurrency } from "@/utils";
import type { MonthlyExpenseChartItem, ContributionChartItem } from "@/repositories/emergency_fund.repository";
import { TrendingUp, Coins, BarChart3 } from "lucide-react";

interface EmergencyFundChartsProps {
  monthlyExpenses: MonthlyExpenseChartItem[];
  contributions: ContributionChartItem[];
  targetAmount: number;
}

export function EmergencyFundCharts({
  monthlyExpenses,
  contributions,
  targetAmount,
}: EmergencyFundChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. Line Chart: Progress Dana Darurat */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Progress Akumulasi</CardTitle>
              <CardDescription className="text-xs">Pertumbuhan dana darurat</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          {contributions.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-xs">
              Belum ada riwayat setoran
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={contributions} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCompactCurrency(v)}
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.75rem",
                    fontSize: "11px",
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value || 0)), "Akumulasi"]}
                />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  name="Terkumpul"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#10b981" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 2. Area Chart: Penambahan Dana */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-500">
              <Coins className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Penambahan Dana</CardTitle>
              <CardDescription className="text-xs">Riwayat nominal setoran</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          {contributions.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-xs">
              Belum ada riwayat setoran
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={contributions} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="depositGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCompactCurrency(v)}
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.75rem",
                    fontSize: "11px",
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value || 0)), "Nominal Setor"]}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  name="Setoran"
                  stroke="#14b8a6"
                  fill="url(#depositGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 3. Bar Chart: Pengeluaran Bulanan */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Pengeluaran Bulanan</CardTitle>
              <CardDescription className="text-xs">Histori pengeluaran 6 bln terakhir</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          {monthlyExpenses.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-xs">
              Belum ada transaksi pengeluaran
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={monthlyExpenses} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCompactCurrency(v)}
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.75rem",
                    fontSize: "11px",
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value || 0)), "Total Pengeluaran"]}
                />
                <Bar dataKey="expense" name="Pengeluaran" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
