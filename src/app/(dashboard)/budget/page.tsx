"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Target, Trash2, AlertCircle } from "lucide-react";
import { formatCurrency, formatCompactCurrency } from "@/utils";
import {
  getBudgetsAction,
  createBudgetAction,
  deleteBudgetAction,
  getCategoriesAction,
} from "@/actions/crud.actions";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Budget {
  id: string;
  name: string;
  amount: number;
  spent: number;
  period: string;
  categoryName?: string;
  categoryColor?: string;
  percentage: number;
  remaining: number;
}

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [period, setPeriod] = useState("monthly");

  async function loadData() {
    setLoading(true);
    try {
      const [bRes, cRes] = await Promise.all([
        getBudgetsAction(),
        getCategoriesAction("expense"),
      ]);
      setBudgets(bRes as Budget[]);
      setCategories(cRes as Category[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreate() {
    if (!name || !amount) {
      toast.error("Nama dan nominal budget wajib diisi");
      return;
    }

    const now = new Date();
    let startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    let endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    if (period === "weekly") {
      const day = now.getDay();
      const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.setDate(diffToMon));
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === "yearly") {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    }

    const selectedCatId = categoryId === "all_categories" ? undefined : (categoryId || undefined);

    try {
      await createBudgetAction({
        name,
        amount: Number(amount),
        categoryId: selectedCatId,
        period,
        startDate,
        endDate,
      });

      toast.success("Budget berhasil dibuat!");
      setOpenCreate(false);
      setName("");
      setAmount("");
      setCategoryId("");
      loadData();
    } catch {
      toast.error("Gagal membuat budget");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus budget ini?")) return;
    try {
      await deleteBudgetAction(id);
      toast.success("Budget dihapus");
      loadData();
    } catch {
      toast.error("Gagal menghapus");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <h1 className="text-2xl font-bold tracking-tight">Manajemen Budget</h1>
          <p className="text-muted-foreground text-sm">
            Kendalikan batas pengeluaran untuk setiap kategori
          </p>
        </div>

        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Budget Baru
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat Budget Baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nama Budget</Label>
                <Input
                  placeholder="Misal: Belanja Bulanan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Batas Pengeluaran (Rp)</Label>
                <Input
                  type="number"
                  placeholder="2000000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Kategori Spesifik (Opsional)</Label>
                <Select value={categoryId} onValueChange={(val) => val && setCategoryId(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Pengeluaran">
                      {categoryId === "all_categories" || !categoryId
                        ? "Semua Kategori Pengeluaran"
                        : categories.find((c) => c.id === categoryId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_categories">Semua Kategori Pengeluaran</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Periode</Label>
                <Select value={period} onValueChange={(val) => val && setPeriod(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Mingguan</SelectItem>
                    <SelectItem value="monthly">Bulanan</SelectItem>
                    <SelectItem value="yearly">Tahunan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate}>Simpan Budget</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Budget Cards */}
      {budgets.length === 0 ? (
        <Card className="border-dashed p-8 text-center">
          <Target className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">Belum ada budget aktif</p>
          <p className="text-xs text-muted-foreground mb-4">
            Buat budget agar tidak overspending bulan ini
          </p>
          <Button size="sm" onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Buat Budget
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((b) => {
            const isExceeded = b.spent > b.amount;
            const isWarning = b.percentage >= 80 && !isExceeded;

            return (
              <Card key={b.id} className="border-border/50 bg-card/80 backdrop-blur-sm relative">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: b.categoryColor || "#6366f1" }}
                    />
                    {b.name}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(b.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold">{formatCurrency(b.spent)}</span>
                      <span className="text-muted-foreground">dari {formatCurrency(b.amount)}</span>
                    </div>
                    <Progress
                      value={Math.min(100, b.percentage)}
                      className="h-2.5"
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    {isExceeded ? (
                      <span className="text-destructive font-semibold flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" /> Overbudget {formatCompactCurrency(b.spent - b.amount)}
                      </span>
                    ) : isWarning ? (
                      <span className="text-amber-500 font-semibold">
                        Hampir Habis ({Math.round(b.percentage)}%)
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Sisa: {formatCurrency(b.remaining)}
                      </span>
                    )}

                    <span className="capitalize text-muted-foreground font-medium">
                      {b.period === "monthly" ? "Bulanan" : b.period}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
