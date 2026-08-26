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
import { Plus, Search, Filter, Trash2, Edit2, ArrowUpRight, ArrowDownRight, FileSpreadsheet, Download, RefreshCw, Layers, AlertTriangle } from "lucide-react";
import { formatCurrency, formatDate } from "@/utils";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/types";
import {
  getTransactionsAction,
  createTransactionAction,
  updateTransactionAction,
  deleteTransactionAction,
  detectDuplicateTransactionsAction,
  mergeDuplicateTransactionsAction,
} from "@/actions/transaction.actions";
import { getCategoriesAction } from "@/actions/crud.actions";
import { getWalletsAction } from "@/actions/wallet.actions";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MoneyInput } from "@/components/ui/money-input";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Wallet {
  id: string;
  name: string;
  type: "cash" | "bank" | "emoney";
  currentBalance: number;
  isDefault?: boolean;
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

interface DuplicateGroup {
  key: string;
  transactions: Transaction[];
  type: "exact" | "possible";
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  // Duplicate Modal states
  const [openDuplicatesModal, setOpenDuplicatesModal] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [scanningDuplicates, setScanningDuplicates] = useState(false);

  // Duplicate Warning Modal states
  const [openWarningModal, setOpenWarningModal] = useState(false);
  const [existingDuplicate, setExistingDuplicate] = useState<Transaction | null>(null);

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
      const [txRes, catRes, walRes] = await Promise.all([
        getTransactionsAction({
          type: filterType !== "all" ? (filterType as any) : undefined,
          search: search || undefined,
        }),
        getCategoriesAction(),
        getWalletsAction(),
      ]);
      setTransactions(txRes.data as Transaction[]);
      setCategories(catRes as Category[]);
      const loadedWallets = (walRes as Wallet[]) || [];
      setWallets(loadedWallets);

      if (loadedWallets.length > 0 && !selectedWalletId) {
        const def = loadedWallets.find((w) => w.isDefault) || loadedWallets[0];
        setSelectedWalletId(def.id);
        setPaymentMethod(def.type as PaymentMethod);
      }
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
    if (wallets.length > 0) {
      const def = wallets.find((w) => w.isDefault) || wallets[0];
      setSelectedWalletId(def.id);
      setPaymentMethod(def.type as PaymentMethod);
    } else {
      setPaymentMethod("cash");
      setSelectedWalletId("");
    }
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

    const tDesc = (t.description || "").toLowerCase();
    const matchedW = wallets.find(
      (w) => tDesc.includes(w.name.toLowerCase()) || w.type === t.paymentMethod
    );
    if (matchedW) {
      setSelectedWalletId(matchedW.id);
    }
  }

  async function handleCreate(force = false) {
    if (!amount || (type !== "transfer" && !categoryId)) {
      toast.error("Nominal dan kategori wajib diisi");
      return;
    }

    try {
      const chosenWallet = wallets.find((w) => w.id === selectedWalletId);
      let finalDescription = description.trim();
      if (chosenWallet && !finalDescription.toLowerCase().includes(chosenWallet.name.toLowerCase())) {
        finalDescription = finalDescription ? `${finalDescription} (${chosenWallet.name})` : chosenWallet.name;
      }
      const finalPaymentMethod = chosenWallet ? (chosenWallet.type as PaymentMethod) : paymentMethod;

      const res = await createTransactionAction(
        {
          amount: Number(amount),
          type,
          categoryId: categoryId || undefined,
          paymentMethod: finalPaymentMethod,
          description: finalDescription,
          date: new Date(date),
        },
        { force }
      );

      if ((res as any).isDuplicate) {
        setExistingDuplicate((res as any).existing);
        setOpenWarningModal(true);
        return;
      }

      toast.success("Transaksi berhasil ditambahkan!");
      setOpenCreate(false);
      setOpenWarningModal(false);
      resetForm();
      loadData();
    } catch {
      toast.error("Gagal menambah transaksi");
    }
  }

  async function handleScanDuplicates() {
    setScanningDuplicates(true);
    try {
      const res = await detectDuplicateTransactionsAction();
      setDuplicateGroups(res as any);
      setOpenDuplicatesModal(true);
    } catch {
      toast.error("Gagal memindai duplikat");
    } finally {
      setScanningDuplicates(false);
    }
  }

  async function handleMergeDuplicates(masterId: string, dupIds: string[]) {
    try {
      await mergeDuplicateTransactionsAction(masterId, dupIds);
      toast.success("Transaksi duplikat berhasil digabungkan!");
      handleScanDuplicates();
      loadData();
    } catch {
      toast.error("Gagal menggabungkan duplikat");
    }
  }

  async function handleUpdate() {
    if (!editingTransaction || !amount || !categoryId) {
      toast.error("Nominal dan kategori wajib diisi");
      return;
    }

    try {
      const chosenWallet = wallets.find((w) => w.id === selectedWalletId);
      let finalDescription = description.trim();
      if (chosenWallet && !finalDescription.toLowerCase().includes(chosenWallet.name.toLowerCase())) {
        finalDescription = finalDescription ? `${finalDescription} (${chosenWallet.name})` : chosenWallet.name;
      }
      const finalPaymentMethod = chosenWallet ? (chosenWallet.type as PaymentMethod) : paymentMethod;

      await updateTransactionAction(editingTransaction.id, {
        amount: Number(amount),
        type,
        categoryId,
        paymentMethod: finalPaymentMethod,
        description: finalDescription,
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleScanDuplicates}
            disabled={scanningDuplicates}
            className="gap-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
          >
            <Layers className="h-4 w-4" />
            {scanningDuplicates ? "Memindai..." : "Deteksi Duplikat"}
          </Button>

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
                      <SelectItem value="expense">🔴 Pengeluaran (Expense)</SelectItem>
                      <SelectItem value="income">🟢 Pemasukan (Income)</SelectItem>
                      <SelectItem value="transfer">⇄ Transfer Antar Rekening</SelectItem>
                      <SelectItem value="allocation">🔒 Alokasi Tabungan / Goal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nominal Transaksi</Label>
                  <MoneyInput
                    placeholder="50.000"
                    value={amount}
                    onValueChange={(val) => setAmount(String(val))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <SearchableSelect
                    options={filteredCategories.map((c) => ({
                      value: c.id,
                      label: c.name,
                      color: (c as any).color,
                    }))}
                    value={categoryId}
                    onValueChange={setCategoryId}
                    placeholder="Cari & Pilih Kategori"
                    searchPlaceholder="Ketik untuk mencari..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Rekening / Dompet Asal</Label>
                  <Select
                    value={selectedWalletId}
                    onValueChange={(val) => {
                      if (val) {
                        setSelectedWalletId(val);
                        const w = wallets.find((item) => item.id === val);
                        if (w) setPaymentMethod(w.type as PaymentMethod);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Rekening / Dompet" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallets.length === 0 ? (
                        <SelectItem value="cash">💵 Cash (Default)</SelectItem>
                      ) : (
                        wallets.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            <div className="flex items-center justify-between w-full gap-2">
                              <span>
                                {w.type === "cash" ? "💵" : w.type === "bank" ? "🏦" : "📱"} {w.name}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono font-medium">
                                ({formatCurrency(w.currentBalance)})
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
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
                <Button onClick={() => handleCreate()}>Simpan Transaksi</Button>
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
              <Label>Nominal Transaksi</Label>
              <MoneyInput
                placeholder="50.000"
                value={amount}
                onValueChange={(val) => setAmount(String(val))}
              />
            </div>

            <div className="space-y-2">
              <Label>Kategori</Label>
              <SearchableSelect
                options={filteredCategories.map((c) => ({
                  value: c.id,
                  label: c.name,
                  color: (c as any).color,
                }))}
                value={categoryId}
                onValueChange={setCategoryId}
                placeholder="Cari & Pilih Kategori"
                searchPlaceholder="Ketik untuk mencari..."
              />
            </div>

            <div className="space-y-2">
              <Label>Rekening / Dompet Asal</Label>
              <Select
                value={selectedWalletId}
                onValueChange={(val) => {
                  if (val) {
                    setSelectedWalletId(val);
                    const w = wallets.find((item) => item.id === val);
                    if (w) setPaymentMethod(w.type as PaymentMethod);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Rekening / Dompet" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.length === 0 ? (
                    <SelectItem value="cash">💵 Cash (Default)</SelectItem>
                  ) : (
                    wallets.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>
                            {w.type === "cash" ? "💵" : w.type === "bank" ? "🏦" : "📱"} {w.name}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono font-medium">
                            ({formatCurrency(w.currentBalance)})
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
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

      {/* Pre-insert Warning Modal */}
      <Dialog open={openWarningModal} onOpenChange={setOpenWarningModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="h-5 w-5" /> Transaksi Serupa Sudah Ada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p className="text-muted-foreground">
              Sistem menemukan transaksi dengan nominal dan tanggal yang sama sudah tercatat sebelumnya:
            </p>
            {existingDuplicate && (
              <div className="p-3 rounded-lg bg-muted/60 space-y-1 text-xs">
                <p>• <strong>Tanggal:</strong> {formatDate(existingDuplicate.date)}</p>
                <p>• <strong>Nominal:</strong> {formatCurrency(existingDuplicate.amount)}</p>
                <p>• <strong>Tipe:</strong> {existingDuplicate.type}</p>
                <p>• <strong>Keterangan:</strong> {existingDuplicate.description || "-"}</p>
              </div>
            )}
            <p className="font-medium text-xs">Apakah Anda yakin ingin tetap menyimpan transaksi ini?</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpenWarningModal(false)}>
              Batalkan
            </Button>
            <Button variant="default" onClick={() => handleCreate(true)}>
              Tetap Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detect Duplicates Modal */}
      <Dialog open={openDuplicatesModal} onOpenChange={setOpenDuplicatesModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-amber-500" /> Hasil Pemindaian Transaksi Duplikat
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {duplicateGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm font-medium">Tidak Ditemukan Transaksi Duplikat 🎉</p>
                <p className="text-xs mt-1">Seluruh data transaksi Anda rapi dan bebas dari penggandaan.</p>
              </div>
            ) : (
              duplicateGroups.map((group) => {
                const master = group.transactions[0];
                const dupIds = group.transactions.slice(1).map((t) => t.id);

                return (
                  <Card key={group.key} className="p-4 border-amber-500/20 bg-amber-500/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={group.type === "exact" ? "destructive" : "secondary"}>
                          {group.type === "exact" ? "Duplikat Persis" : "Kemungkinan Duplikat"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(master.date)} • {formatCurrency(master.amount)}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                        onClick={() => handleMergeDuplicates(master.id, dupIds)}
                      >
                        Merge ({group.transactions.length - 1} Duplikat)
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {group.transactions.map((tx, idx) => (
                        <div
                          key={tx.id}
                          className={`p-2.5 rounded text-xs flex items-center justify-between ${
                            idx === 0 ? "bg-background border font-medium" : "bg-card/70 border border-dashed"
                          }`}
                        >
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase mr-2 font-semibold">
                              {idx === 0 ? "Master" : `Duplikat #${idx}`}
                            </span>
                            <span>{tx.description || tx.categoryName || "Tanpa Keterangan"}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold">{formatCurrency(tx.amount)}</span>
                            {idx > 0 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDelete(tx.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
