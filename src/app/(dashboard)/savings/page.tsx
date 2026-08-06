"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, PiggyBank, Target, Trash2, Edit2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/utils";
import {
  getSavingGoalsAction,
  createSavingGoalAction,
  deleteSavingGoalAction,
  addToSavingGoalAction,
} from "@/actions/crud.actions";
import { getDashboardStatsAction } from "@/actions/transaction.actions";
import { EmergencyFundCalculator } from "@/components/savings/emergency-fund-calculator";
import { MoneyInput } from "@/components/ui/money-input";
import { toast } from "sonner";

interface SavingGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: Date | null;
  icon: string;
  color: string;
  isCompleted: boolean;
  percentage: number;
  remaining: number;
}

export default function SavingsPage() {
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const [avgMonthlyExpense, setAvgMonthlyExpense] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [openDeposit, setOpenDeposit] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [goalsData, statsData] = await Promise.all([
        getSavingGoalsAction(),
        getDashboardStatsAction(),
      ]);
      setGoals(goalsData as SavingGoal[]);
      setAvgMonthlyExpense(statsData.totalExpense || 3000000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateGoal() {
    if (!name || !targetAmount) {
      toast.error("Nama dan target jumlah harus diisi");
      return;
    }

    try {
      await createSavingGoalAction({
        name,
        targetAmount: Number(targetAmount),
        currentAmount: Number(currentAmount) || 0,
      });
      toast.success("Target tabungan berhasil dibuat!");
      setOpenCreate(false);
      setName("");
      setTargetAmount("");
      setCurrentAmount("");
      loadData();
    } catch {
      toast.error("Gagal membuat target tabungan");
    }
  }

  async function handleDeposit(id: string) {
    if (!depositAmount || Number(depositAmount) <= 0) {
      toast.error("Masukkan nominal tabungan yang valid");
      return;
    }

    try {
      await addToSavingGoalAction(id, Number(depositAmount));
      toast.success("Tabungan berhasil ditambahkan!");
      setOpenDeposit(null);
      setDepositAmount("");
      loadData();
    } catch {
      toast.error("Gagal menambah tabungan");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus target tabungan ini?")) return;
    try {
      await deleteSavingGoalAction(id);
      toast.success("Target tabungan dihapus");
      loadData();
    } catch {
      toast.error("Gagal menghapus");
    }
  }

  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tabungan & Dana Darurat</h1>
          <p className="text-muted-foreground text-sm">
            Rencanakan dan pantau dana darurat serta target impianmu
          </p>
        </div>

        <Button className="gap-2" onClick={() => setOpenCreate(true)}>
          <Plus className="h-4 w-4" />
          Target Baru
        </Button>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat Target Tabungan Baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nama Target</Label>
                <Input
                  placeholder="Misal: Beli Laptop, Liburan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Target Jumlah</Label>
                <MoneyInput
                  placeholder="10.000.000"
                  value={targetAmount}
                  onValueChange={(val) => setTargetAmount(String(val))}
                />
              </div>
              <div className="space-y-2">
                <Label>Jumlah Awal Terkumpul</Label>
                <MoneyInput
                  placeholder="0"
                  value={currentAmount}
                  onValueChange={(val) => setCurrentAmount(String(val))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateGoal}>Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Emergency Fund Calculator */}
      <EmergencyFundCalculator
        avgMonthlyExpense={avgMonthlyExpense}
        currentSavings={totalSaved}
      />

      {/* Saving Goals Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-indigo-500" />
          Target Tabungan Impian
        </h2>

        {goals.length === 0 ? (
          <Card className="border-dashed p-8 text-center">
            <PiggyBank className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">Belum ada target tabungan</p>
            <p className="text-xs text-muted-foreground mb-4">
              Buat target untuk DP rumah, kendaraan, atau liburan
            </p>
            <Button size="sm" onClick={() => setOpenCreate(true)}>
              <Plus className="h-4 w-4 mr-1" /> Tambah Target
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((goal) => (
              <Card key={goal.id} className="border-border/50 bg-card/80 backdrop-blur-sm relative">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: goal.color || "#10b981" }}
                    >
                      <Target className="h-4 w-4" />
                    </div>
                    {goal.name}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(goal.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold">{formatCurrency(goal.currentAmount)}</span>
                      <span className="text-muted-foreground">dari {formatCurrency(goal.targetAmount)}</span>
                    </div>
                    <Progress value={Math.min(100, goal.percentage)} className="h-2" />
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {Math.round(goal.percentage)}% Terkumpul
                    </span>
                    {goal.isCompleted ? (
                      <span className="text-emerald-500 font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Selesai!
                      </span>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setOpenDeposit(goal.id)}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Nabung
                        </Button>
                        <Dialog
                          open={openDeposit === goal.id}
                          onOpenChange={(open) => setOpenDeposit(open ? goal.id : null)}
                        >
                          <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Setor Tabungan - {goal.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-2">
                            <div className="space-y-2">
                              <Label>Nominal Setoran</Label>
                              <MoneyInput
                                placeholder="500.000"
                                value={depositAmount}
                                onValueChange={(val) => setDepositAmount(String(val))}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={() => handleDeposit(goal.id)}>Setor</Button>
                          </DialogFooter>
                        </DialogContent>
                        </Dialog>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
