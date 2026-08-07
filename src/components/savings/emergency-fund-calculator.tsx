"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ShieldAlert, ShieldCheck, Sparkles, Plus, AlertTriangle, CheckCircle2, Clock, Calculator, ArrowUpRight } from "lucide-react";
import { formatCurrency, formatCompactCurrency, formatDate } from "@/utils";
import { MoneyInput } from "@/components/ui/money-input";
import { saveEmergencyFundTargetAction, addEmergencyFundDepositAction } from "@/actions/emergency_fund.actions";
import type { EmergencyFundData } from "@/repositories/emergency_fund.repository";
import { toast } from "sonner";

interface EmergencyFundCalculatorProps {
  fundData: EmergencyFundData | null;
  onRefresh?: () => void;
}

export function EmergencyFundCalculator({
  fundData,
  onRefresh,
}: EmergencyFundCalculatorProps) {
  const [status, setStatus] = useState<"single" | "married" | "married_kids">(
    fundData?.status || "single"
  );
  const [targetMonths, setTargetMonths] = useState<number>(
    fundData?.targetMonths || 6
  );
  const [saving, setSaving] = useState(false);
  const [dismissSurgeAlert, setDismissSurgeAlert] = useState(false);

  // Modal Deposit states
  const [openDeposit, setOpenDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [depositDate, setDepositDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [depositNote, setDepositNote] = useState<string>("");
  const [submittingDeposit, setSubmittingDeposit] = useState(false);

  useEffect(() => {
    if (fundData) {
      setStatus(fundData.status);
      setTargetMonths(fundData.targetMonths);
    }
  }, [fundData]);

  const automatedExpense = fundData?.automatedMonthlyExpense || 3000000;
  const currentSaved = fundData?.currentAmount || 0;

  // Calculation of Target Dana Darurat = Rata-rata Pengeluaran × Target Bulan
  const calculatedTargetAmount = automatedExpense * targetMonths;
  const progressPercent =
    calculatedTargetAmount > 0
      ? Math.min(100, Math.round((currentSaved / calculatedTargetAmount) * 100))
      : 0;
  const remainingAmount = Math.max(0, calculatedTargetAmount - currentSaved);

  // Recommendations per status
  const recommendationsMap = {
    single: { min: 3, ideal: 6, label: "Lajang", recText: "Minimum 3 bulan, Ideal 6 bulan" },
    married: { min: 6, ideal: 9, label: "Menikah", recText: "Minimum 6 bulan, Ideal 9 bulan" },
    married_kids: { min: 9, ideal: 12, label: "Menikah + Anak", recText: "Minimum 9 bulan, Ideal 12 bulan" },
  };

  const currentRec = recommendationsMap[status];

  async function handleSaveTarget() {
    if (calculatedTargetAmount < currentSaved) {
      toast.error(
        `Target dana darurat (${formatCurrency(calculatedTargetAmount)}) tidak boleh lebih kecil dari dana yang sudah terkumpul (${formatCurrency(currentSaved)}).`
      );
      return;
    }

    setSaving(true);
    try {
      await saveEmergencyFundTargetAction({
        targetMonths,
        status,
        customMonthlyExpense: automatedExpense,
      });
      toast.success("Target Dana Darurat berhasil disimpan!");
      onRefresh?.();
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan target");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddDeposit() {
    const numAmount = Number(depositAmount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Nominal setoran harus lebih besar dari Rp 0");
      return;
    }

    setSubmittingDeposit(true);
    try {
      await addEmergencyFundDepositAction({
        amount: numAmount,
        note: depositNote,
        date: depositDate,
      });
      toast.success("Dana Darurat berhasil ditambahkan!");
      setOpenDeposit(false);
      setDepositAmount("");
      setDepositNote("");
      onRefresh?.();
    } catch (err: any) {
      toast.error(err?.message || "Gagal menambah dana darurat");
    } finally {
      setSubmittingDeposit(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Smart Update Banner (Triggered when monthly expenses surge >= 10%) */}
      {fundData?.isSurging && !dismissSurgeAlert && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 mt-0.5">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm flex items-center gap-2">
                Peringatan Kenaikan Pengeluaran Bulanan ({fundData.surgePercentage}%)
              </h4>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                Pengeluaran rata-rata kamu meningkat sebesar <strong>{fundData.surgePercentage}%</strong>. Kami menyarankan menaikkan target dana darurat dari{" "}
                <span className="line-through">{formatCurrency(fundData.targetAmount)}</span> menjadi{" "}
                <span className="font-bold text-amber-900 dark:text-amber-100">{formatCurrency(fundData.recommendedNewTarget)}</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-8"
              onClick={async () => {
                await saveEmergencyFundTargetAction({
                  targetMonths,
                  status,
                  customMonthlyExpense: fundData.automatedMonthlyExpense,
                });
                toast.success("Target Dana Darurat diperbarui mengikuti kenaikan pengeluaran!");
                onRefresh?.();
              }}
            >
              Update Target
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 border-amber-500/30 hover:bg-amber-500/10"
              onClick={() => setDismissSurgeAlert(true)}
            >
              Nanti Saja
            </Button>
          </div>
        </div>
      )}

      {/* Main Smart Calculator Card */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent rounded-bl-full pointer-events-none" />
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold tracking-tight">
                  Smart Emergency Fund Calculator
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Hitung dan pantau kebutuhan dana darurat berdasarkan histori pengeluaran otomatis
                </CardDescription>
              </div>
            </div>

            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
              onClick={() => setOpenDeposit(true)}
            >
              <Plus className="h-4 w-4" />
              Tambah Dana
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-accent/30 border border-border/40">
            {/* 1. Automated Expense */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Estimasi Pengeluaran / Bulan</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full">
                  Otomatis
                </span>
              </Label>
              <div className="text-lg font-bold tracking-tight text-foreground p-2 rounded-lg bg-background/80 border border-border/50 flex items-center justify-between">
                <span>{formatCurrency(automatedExpense)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {fundData?.dataMonthsCount === 0
                  ? "Belum ada data transaksi pengeluaran"
                  : fundData?.dataMonthsCount === 1
                  ? "Berdasarkan pengeluaran 1 bulan ini"
                  : fundData?.dataMonthsCount === 2
                  ? "Rata-rata 2 bulan terakhir"
                  : fundData?.dataMonthsCount && fundData.dataMonthsCount < 6
                  ? `Rata-rata 3 bulan terakhir (${fundData.dataMonthsCount} bln)`
                  : "Rata-rata 6 bulan terakhir"}
              </p>
            </div>

            {/* 2. Status Tanggungan */}
            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-xs font-semibold text-muted-foreground">
                Status Tanggungan
              </Label>
              <Select
                value={status}
                onValueChange={(val) => {
                  if (val) {
                    const newStatus = val as "single" | "married" | "married_kids";
                    setStatus(newStatus);
                    const rec = recommendationsMap[newStatus].ideal;
                    setTargetMonths(rec);
                  }
                }}
              >
                <SelectTrigger id="status" className="w-full h-10 bg-background/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single (Lajang)</SelectItem>
                  <SelectItem value="married">Menikah</SelectItem>
                  <SelectItem value="married_kids">Menikah + Anak</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                💡 Rekomendasi {currentRec.label}: {currentRec.recText}
              </p>
            </div>

            {/* 3. Target Months Buttons & Save */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Pilih Target Bulan
              </Label>
              <div className="grid grid-cols-4 gap-1.5">
                {([3, 6, 9, 12] as const).map((m) => {
                  const isSelected = m === targetMonths;
                  const isIdeal = m === currentRec.ideal;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTargetMonths(m)}
                      className={`h-10 text-xs font-bold rounded-lg border transition-all flex flex-col items-center justify-center relative ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/30"
                          : "border-border/50 bg-background/80 hover:bg-emerald-500/5 hover:border-emerald-500/40"
                      }`}
                    >
                      <span>{m} Bln</span>
                      {isIdeal && (
                        <span className="text-[8px] leading-none text-emerald-500 font-normal">Ideal</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs font-semibold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                  onClick={handleSaveTarget}
                  disabled={saving}
                >
                  {saving ? "Menyimpan..." : "Simpan Target ke Database"}
                </Button>
              </div>
            </div>
          </div>

          {/* Progress Card Section */}
          <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-bold text-foreground">
                    Target Dana Darurat ({targetMonths} Bulan): {formatCurrency(calculatedTargetAmount)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Perhitungan: {formatCurrency(automatedExpense)} / bln × {targetMonths} bulan
                </p>
              </div>
              <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                {progressPercent}% Terkumpul
              </span>
            </div>

            <Progress value={progressPercent} className="h-3 bg-secondary" />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1 border-t border-border/40">
              <div>
                <span className="text-muted-foreground block text-[11px]">Dana Terkumpul</span>
                <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(currentSaved)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Sisa Kurang</span>
                <span className="font-bold text-sm text-foreground">
                  {formatCurrency(remainingAmount)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Rata-rata Setor / Bln</span>
                <span className="font-semibold text-sm text-foreground">
                  {fundData?.avgMonthlyDeposit ? formatCurrency(fundData.avgMonthlyDeposit) : "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Estimasi Selesai</span>
                <span className="font-semibold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {remainingAmount === 0
                    ? "Target Selesai! 🎉"
                    : fundData?.estimatedMonthsRemaining !== null && fundData?.estimatedMonthsRemaining !== undefined
                    ? `${fundData.estimatedMonthsRemaining} Bulan lagi`
                    : "Mulai menabung untuk estimasi"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Tambah Dana */}
      <Dialog open={openDeposit} onOpenChange={setOpenDeposit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-emerald-500" />
              Setor Tabungan Dana Darurat
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tambahkan setoran untuk menambah akumulasi dana daruratmu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="depositAmount" className="text-xs">Nominal Setoran</Label>
              <MoneyInput
                id="depositAmount"
                placeholder="Nominal contoh: 500.000"
                value={depositAmount}
                onValueChange={(val) => setDepositAmount(String(val))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="depositDate" className="text-xs">Tanggal</Label>
              <Input
                id="depositDate"
                type="date"
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="depositNote" className="text-xs">Catatan (Opsional)</Label>
              <Input
                id="depositNote"
                placeholder="Misal: Tabungan sisa gaji, bonus"
                value={depositNote}
                onChange={(e) => setDepositNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenDeposit(false)}
            >
              Batal
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleAddDeposit}
              disabled={submittingDeposit}
            >
              {submittingDeposit ? "Menyimpan..." : "Simpan Setoran"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
