"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Filter, Trash2, Edit2, ArrowUpRight, ArrowDownRight, FileSpreadsheet, Download, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate } from "@/utils";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/types";
import {
  getTransactionsAction,
  createTransactionAction,
  updateTransactionAction,
  deleteTransactionAction,
} from "@/actions/transaction.actions";
import { getCategoriesAction } from "@/actions/crud.actions";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Transaction {
  id: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  paymentMethod: PaymentMethod;
  description: string | null;
  date: Date;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  // Form states for create/edit
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense" | "transfer">("expense");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  async function loadData() {
    setLoading(true);
    try {
      const [txRes, catRes] = await Promise.all([
        getTransactionsAction({
          type: filterType !== "all" ? (filterType as any) : undefined,
          search: search || undefined,
        }),
        getCategoriesAction(),
      ]);
      setTransactions(txRes.data as Transaction[]);
      setCategories(catRes as Category[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [filterType]);

  function resetForm() {
    setAmount("");
    setType("expense");
    setCategoryId("");
    setPaymentMethod("cash");
    setDescription("");
    setDate(new Date().toISOString().split("T")[0]);
    setEditingTransaction(null);
  }

  function handleOpenEdit(t: Transaction) {
    setEditingTransaction(t);
    setAmount(String(t.amount));
    setType(t.type);
    setCategoryId(t.categoryId || "");
    setPaymentMethod(t.paymentMethod);
    setDescription(t.description || "");
    setDate(new Date(t.date).toISOString().split("T")[0]);
  }

  async function handleCreate() {
    if (!amount || !categoryId) {
      toast.error("Nominal dan kategori wajib diisi");
      return;
    }

    try {
      await createTransactionAction({
        amount: Number(amount),
        type,
        categoryId,
        paymentMethod,
        description,
        date: new Date(date),
      });

      toast.success("Transaksi berhasil ditambahkan!");
      setOpenCreate(false);
      resetForm();
      loadData();
    } catch {
      toast.error("Gagal menambah transaksi");
    }
  }

  async function handleUpdate() {
    if (!editingTransaction || !amount || !categoryId) {
      toast.error("Nominal dan kategori wajib diisi");
      return;
    }

    try {
      await updateTransactionAction(editingTransaction.id, {
        amount: Number(amount),
        type,
        categoryId,
        paymentMethod,
        description,
        date: new Date(date),
      });

      toast.success("Transaksi berhasil diperbarui!");
      setEditingTransaction(null);
      resetForm();
      loadData();
    } catch {
      toast.error("Gagal memperbarui transaksi");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus transaksi ini?")) return;
    try {
      await deleteTransactionAction(id);
      toast.success("Transaksi dihapus");
      loadData();
    } catch {
      toast.error("Gagal menghapus");
    }
  }

  function exportExcel() {
    const dataToExport = transactions.map((t) => ({
      Tanggal: formatDate(t.date),
      Jenis: t.type === "income" ? "Pemasukan" : t.type === "expense" ? "Pengeluaran" : "Transfer",
      Kategori: t.categoryName,
      Metode: PAYMENT_METHOD_LABELS[t.paymentMethod] || t.paymentMethod,
      Nominal: t.amount,
      Keterangan: t.description || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transaksi");
    XLSX.writeFile(workbook, `Transaksi_DuitKu_${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  const filteredCategories = categories.filter((c) => c.type === type);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daftar Transaksi</h1>
          <p className="text-muted-foreground text-sm">
            Catat, edit, dan kelola seluruh arus keuanganmu
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Excel
          </Button>

          <Dialog open={openCreate} onOpenChange={(open) => { setOpenCreate(open); if (!open) resetForm(); }}>
            <DialogTrigger>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Tambah Transaksi
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Tambah Transaksi Baru</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Jenis Transaksi</Label>
                  <Select value={type} onValueChange={(val) => { if (val) { setType(val as any); setCategoryId(""); } }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Pengeluaran (-)</SelectItem>
                      <SelectItem value="income">Pemasukan (+)</SelectItem>
                      <SelectItem value="transfer">Transfer (⇄)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nominal (Rp)</Label>
                  <Input
                    type="number"
                    placeholder="50000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select value={categoryId} onValueChange={(val) => val && setCategoryId(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Metode Pembayaran</Label>
                  <Select value={paymentMethod} onValueChange={(val) => val && setPaymentMethod(val as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="qris">QRIS</SelectItem>
                      <SelectItem value="dana">Dana</SelectItem>
                      <SelectItem value="ovo">OVO</SelectItem>
                      <SelectItem value="gopay">GoPay</SelectItem>
                      <SelectItem value="shopeepay">ShopeePay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tanggal</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Keterangan</Label>
                  <Input
                    placeholder="Catatan tambahan..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate}>Simpan Transaksi</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dialog Edit Transaksi */}
      <Dialog open={!!editingTransaction} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Transaksi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Jenis Transaksi</Label>
              <Select value={type} onValueChange={(val) => { if (val) { setType(val as any); setCategoryId(""); } }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Pengeluaran (-)</SelectItem>
                  <SelectItem value="income">Pemasukan (+)</SelectItem>
                  <SelectItem value="transfer">Transfer (⇄)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nominal (Rp)</Label>
              <Input
                type="number"
                placeholder="50000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={categoryId} onValueChange={(val) => val && setCategoryId(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Kategori" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Metode Pembayaran</Label>
              <Select value={paymentMethod} onValueChange={(val) => val && setPaymentMethod(val as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="qris">QRIS</SelectItem>
                  <SelectItem value="dana">Dana</SelectItem>
                  <SelectItem value="ovo">OVO</SelectItem>
                  <SelectItem value="gopay">GoPay</SelectItem>
                  <SelectItem value="shopeepay">ShopeePay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Input
                placeholder="Catatan tambahan..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdate}>Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filter & Search Bar */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari transaksi atau keterangan..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadData()}
            />
          </div>
          <Select value={filterType} onValueChange={(val) => val && setFilterType(val)}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Jenis</SelectItem>
              <SelectItem value="income">Pemasukan saja</SelectItem>
              <SelectItem value="expense">Pengeluaran saja</SelectItem>
              <SelectItem value="transfer">Transfer saja</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </Card>

      {/* Transactions Table */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Kategori / Keterangan</TableHead>
              <TableHead>Metode</TableHead>
              <TableHead className="text-right">Nominal</TableHead>
              <TableHead className="w-[80px] text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-28 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                </TableRow>
              ))
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Tidak ada transaksi ditemukan
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(t.date)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: t.categoryColor || "#6366f1" }}
                      />
                      <div>
                        <p className="text-sm font-medium">{t.description || t.categoryName}</p>
                        <p className="text-[11px] text-muted-foreground">{t.categoryName}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[11px]">
                      {PAYMENT_METHOD_LABELS[t.paymentMethod] || t.paymentMethod}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-semibold text-sm ${
                    t.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}>
                    {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleOpenEdit(t)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(t.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
