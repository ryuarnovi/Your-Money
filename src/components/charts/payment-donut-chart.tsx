"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { getPaymentMethodBreakdownAction } from "@/actions/transaction.actions";
import { formatCurrency } from "@/utils";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_COLORS, type PaymentMethod } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

export function PaymentDonutChart() {
  const [data, setData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const raw = await getPaymentMethodBreakdownAction();
        const mapped = raw.map((item) => ({
          name: PAYMENT_METHOD_LABELS[item.payment_method as PaymentMethod] || item.payment_method,
          value: item.total,
          color: PAYMENT_METHOD_COLORS[item.payment_method as PaymentMethod] || "#6366f1",
        }));
        setData(mapped);
      } catch (error) {
        console.error("Failed to load payment data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Metode Pembayaran</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            Belum ada data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.75rem",
                  fontSize: "12px",
                }}
                formatter={(value: any) => [formatCurrency(Number(value || 0))]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "11px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
