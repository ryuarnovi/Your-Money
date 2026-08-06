"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ShieldAlert, ShieldCheck, Calculator, Sparkles, TrendingUp, Cpu } from "lucide-react";
import { formatCurrency, formatCompactCurrency } from "@/utils";
import { MoneyInput } from "@/components/ui/money-input";

interface EmergencyFundProps {
  avgMonthlyExpense: number;
  currentSavings?: number;
}

export function EmergencyFundCalculator({
  avgMonthlyExpense,
  currentSavings = 0,
}: EmergencyFundProps) {
  const [monthlyExpense, setMonthlyExpense] = useState<number>(avgMonthlyExpense || 0);
  const [maritalStatus, setMaritalStatus] = useState<"single" | "married" | "married_kids">("single");
  const [savedAmount, setSavedAmount] = useState<number>(currentSavings);

  useEffect(() => {
    if (avgMonthlyExpense > 0) {
      setMonthlyExpense(avgMonthlyExpense);
    }
  }, [avgMonthlyExpense]);

  useEffect(() => {
    setSavedAmount(currentSavings);
  }, [currentSavings]);

  // Recommended months multiplier based on status
  const recommendedMonths = maritalStatus === "single" ? 6 : maritalStatus === "married" ? 9 : 12;
  const [selectedMonths, setSelectedMonths] = useState<number>(6);

  // Auto set active selected target when status changes
  const activeMonths = selectedMonths || recommendedMonths;

  const targets = {
    3: monthlyExpense * 3,
    6: monthlyExpense * 6,
    9: monthlyExpense * 9,
    12: monthlyExpense * 12,
  };

  const targetSelected = monthlyExpense * activeMonths;
  const progressPercent = Math.min(100, Math.round((savedAmount / targetSelected) * 100));
  const remainingSelected = Math.max(0, targetSelected - savedAmount);

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent rounded-bl-full" />
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold">Kalkulator Dana Darurat</CardTitle>
            <CardDescription>
              Hitung kecukupan dana darurat berdasarkan pengeluaran bulananmu
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Form Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="monthlyExpense" className="text-xs">
              Estimasi Pengeluaran / Bulan
            </Label>
            <MoneyInput
              id="monthlyExpense"
              value={monthlyExpense}
              onValueChange={setMonthlyExpense}
            />
            {avgMonthlyExpense > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Rata-rata saat ini: <span className="font-medium text-foreground">{formatCompactCurrency(avgMonthlyExpense)}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="maritalStatus" className="text-xs">
              Status Tanggungan
            </Label>
            <Select
              value={maritalStatus}
              onValueChange={(val) => {
                if (val) {
                  setMaritalStatus(val as any);
                  const rec = val === "single" ? 6 : val === "married" ? 9 : 12;
                  setSelectedMonths(rec);
                }
              }}
            >
              <SelectTrigger id="maritalStatus" className="w-full h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Lajang (Rekomendasi 6 Bln)</SelectItem>
                <SelectItem value="married">Menikah (Rekomendasi 9 Bln)</SelectItem>
                <SelectItem value="married_kids">Menikah + Anak (Rekomendasi 12 Bln)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="savedAmount" className="text-xs">
              Dana Darurat Terkumpul
            </Label>
            <MoneyInput
              id="savedAmount"
              value={savedAmount}
              onValueChange={setSavedAmount}
            />
          </div>
        </div>

        {/* Progress Bar for Selected Target */}
        <div className="p-4 rounded-xl bg-accent/40 border border-border/50 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-semibold">
                Target Dana Darurat ({activeMonths} Bulan): {formatCurrency(targetSelected)}
              </span>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {progressPercent}% Terkumpul
            </span>
          </div>

          <Progress value={progressPercent} className="h-2.5 bg-secondary" />

          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Terkumpul: {formatCurrency(savedAmount)}</span>
            <span>Sisa Kurang: {formatCurrency(remainingSelected)}</span>
          </div>
        </div>

        {/* Breakdown 3, 6, 9, 12 Months */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {([3, 6, 9, 12] as const).map((months) => {
            const isSelected = months === activeMonths;
            const isRecommended = months === recommendedMonths;
            const targetVal = targets[months];
            const isAchieved = savedAmount >= targetVal;

            return (
              <div
                key={months}
                onClick={() => setSelectedMonths(months)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/10 shadow-md ring-2 ring-emerald-500/30"
                    : "border-border/40 bg-card/40 hover:border-emerald-500/40 hover:bg-emerald-500/5"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {months} Bulan
                  </span>
                  {isRecommended && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium px-1.5 py-0.5 rounded-full">
                      Rekomendasi
                    </span>
                  )}
                </div>
                <p className="text-base font-bold tracking-tight">
                  {formatCompactCurrency(targetVal)}
                </p>
                <div className="mt-2 flex items-center gap-1 text-[11px]">
                  {isAchieved ? (
                    <span className="text-emerald-500 font-medium flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Terpenuhi
                    </span>
                  ) : (
                    <span className="text-amber-500 font-medium flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" /> Kurang {formatCompactCurrency(targetVal - savedAmount)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
