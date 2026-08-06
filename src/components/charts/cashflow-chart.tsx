"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getCashflowDataAction } from "@/actions/transaction.actions";
import { getDateRange, formatCompactCurrency } from "@/utils";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface CashflowEntry {
  date: string;
  income: number;
  expense: number;
}

export function CashflowChart({ period }: { period: string }) {
  const [data, setData] = useState<CashflowEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const range = getDateRange(period);
        const raw = await getCashflowDataAction(
          range.start.toISOString(),
          range.end.toISOString()
        );

        // Group by date
        const grouped: Record<string, { income: number; expense: number }> = {};
        for (const row of raw) {
          if (!grouped[row.date]) {
            grouped[row.date] = { income: 0, expense: 0 };
          }
          if (row.type === "income") {
            grouped[row.date].income += row.total;
          } else if (row.type === "expense") {
            grouped[row.date].expense += row.total;
          }
        }

        const chartData = Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, values]) => ({
            date: format(new Date(date), "dd MMM", { locale: id }),
            income: values.income,
            expense: values.expense,
          }));

        setData(chartData);
      } catch (error) {
        console.error("Failed to load cashflow:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [period]);

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Arus Kas</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            Belum ada data untuk periode ini
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis
                dataKey="date"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <YAxis
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCompactCurrency(v)}
                className="fill-muted-foreground"
                width={65}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.75rem",
                  fontSize: "12px",
                }}
                formatter={(value: any) => [formatCompactCurrency(Number(value || 0))]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              />
              <Area
                type="monotone"
                dataKey="income"
                name="Pemasukan"
                stroke="#10b981"
                fill="url(#incomeGrad)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="expense"
                name="Pengeluaran"
                stroke="#ef4444"
                fill="url(#expenseGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
