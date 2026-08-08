"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CalendarClock, Trash2, CheckCircle, AlertTriangle } from "lucide-react";
import { formatCurrency, formatDate, formatNumberWithDots, parseCurrencyInput } from "@/utils";
import {
  getRecurringBillsAction,
  createRecurringBillAction,
  deleteRecurringBillAction,
  getCategoriesAction,
} from "@/actions/crud.actions";
import { createTransactionAction } from "@/actions/transaction.actions";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
}

interface RecurringBill {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  nextDueDate: Date;
  daysUntilDue: number;
  isOverdue: boolean;
  isDueSoon: boolean;
  categoryId?: string;
  categoryName?: string;
}

export default function BillsPage() {
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [nextDueDate, setNextDueDate] = useState(new Date().toISOString().split("T")[0]);

  async function loadData() {
    setLoading(true);
    try {
      const [bRes, cRes] = await Promise.all([
        getRecurringBillsAction(),
        getCategoriesAction("expense"),
      ]);
      setBills(bRes as RecurringBill[]);
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
    if (!name || !amount || !nextDueDate) {
      toast.error("Nama, nominal, dan tanggal jatuh tempo wajib diisi");
      return;
    }

    try {
      await createRecurringBillAction({
        name,
        amount: parseCurrencyInput(amount),
        categoryId: categoryId || undefined,
        frequency,
        nextDueDate: new Date(nextDueDate),
      });

      toast.success("Tagihan berhasil dibuat!");
      setOpenCreate(false);
      setName("");
      setAmount("");
      setCategoryId("");
      loadData();
    } catch {
      toast.error("Gagal membuat tagihan");
    }
  }

  async function handlePayBill(bill: RecurringBill) {
    if (!confirm(`Bayar tagihan "${bill.name}" sebesar ${formatCurrency(bill.amount)}?`)) return;

    try {
      // Auto create transaction record
      await createTransactionAction({
        amount: bill.amount,
        type: "expense",
        categoryId: bill.categoryId || categories[0]?.id || "",
        paymentMethod: "bank",
        description: `Pembayaran Tagihan: ${bill.name}`,
        date: new Date(),
      });

      toast.success("Tagihan berhasil dibayar & dicatat!");
      loadData();
    } catch {
      toast.error("Gagal memproses pembayaran");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus tagihan rutin ini?")) return;
    try {
      await deleteRecurringBillAction(id);
      toast.success("Tagihan dihapus");
      loadData();
    } catch {
      toast.error("Gagal menghapus");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tagihan Rutin</h1>
          <p className="text-muted-foreground text-sm">
            Pantau tanggal jatuh tempo listrik, internet, kos, dan langganan
          </p>
        </div>

        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Tagihan Baru
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat Tagihan Rutin Baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nama Tagihan</Label>
                <Input
                  placeholder="Misal: Tagihan Wi-Fi Indihome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Nominal (Rp)</Label>
                <Input
                  type="text"
                  placeholder="350.000"
                  value={amount}
                  onChange={(e) => setAmount(formatNumberWithDots(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select value={categoryId} onValueChange={(val) => val && setCategoryId(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Kategori">
                      {categories.find((c) => c.id === categoryId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Frekuensi</Label>
                <Select value={frequency} onValueChange={(val) => val && setFrequency(val)}>
                  <SelectTrigger>
                    <SelectValue>
                      {frequency === "weekly" ? "Mingguan" : frequency === "yearly" ? "Tahunan" : "Bulanan"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Mingguan</SelectItem>
                    <SelectItem value="monthly">Bulanan</SelectItem>
                    <SelectItem value="yearly">Tahunan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tanggal Jatuh Tempo Berikutnya</Label>
                <Input
                  type="date"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate}>Simpan Tagihan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bills Cards */}
      {bills.length === 0 ? (
        <Card className="border-dashed p-8 text-center">
          <CalendarClock className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">Belum ada tagihan rutin</p>
          <p className="text-xs text-muted-foreground mb-4">
            Catat tagihan rutin agar dapat pengingat dari Telegram bot
          </p>
          <Button size="sm" onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Tambah Tagihan
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bills.map((b) => (
            <Card key={b.id} className="border-border/50 bg-card/80 backdrop-blur-sm relative">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-base">{b.name}</span>
                    {b.categoryName && (
                      <Badge variant="secondary" className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        {b.categoryName}
                      </Badge>
                    )}
                    {b.isOverdue ? (
                      <Badge variant="destructive" className="text-[10px]">
                        Terlambat ({Math.abs(b.daysUntilDue)} Hari)
                      </Badge>
                    ) : b.isDueSoon ? (
                      <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600">
                        {b.daysUntilDue === 0 ? "Jatuh Tempo Hari Ini" : `${b.daysUntilDue} Hari Lagi`}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        {b.frequency === "monthly" ? "Bulanan" : b.frequency}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Jatuh tempo: <span className="font-medium text-foreground">{formatDate(b.nextDueDate)}</span>
                  </p>
                  <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
                    {formatCurrency(b.amount)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handlePayBill(b)}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Bayar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(b.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
