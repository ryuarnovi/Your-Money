"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus,
  ArrowRightLeft,
  Building2,
  Banknote,
  Smartphone,
  Wallet,
  Trash2,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Pencil,
} from "lucide-react";
import { formatCurrency, formatDate, formatNumberWithDots, parseCurrencyInput } from "@/utils";
import {
  getWalletsAction,
  getWalletStatsAction,
  createWalletAction,
  updateWalletAction,
  deleteWalletAction,
  transferBetweenWalletsAction,
  getWalletTransfersAction,
} from "@/actions/wallet.actions";
import { toast } from "sonner";

interface WalletItem {
  id: string;
  name: string;
  type: "cash" | "bank" | "emoney";
  accountNumber?: string | null;
  initialBalance: number;
  currentBalance: number;
  color: string;
  icon: string;
  isDefault: boolean;
}

interface WalletStats {
  totalCash: number;
  totalBank: number;
  totalEmoney: number;
  totalOverall: number;
  cashCount: number;
  bankCount: number;
  emoneyCount: number;
}

interface WalletTransfer {
  id: string;
  fromWalletName: string;
  toWalletName: string;
  amount: number;
  fee: number;
  description?: string | null;
  date: Date;
}

export default function AccountsPage() {
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [transfers, setTransfers] = useState<WalletTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Wallet Form
  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"cash" | "bank" | "emoney">("bank");
  const [accountNumber, setAccountNumber] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [color, setColor] = useState("#3b82f6");

  // Transfer Form
  const [openTransfer, setOpenTransfer] = useState(false);
  const [fromWalletId, setFromWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferFee, setTransferFee] = useState("");
  const [transferDesc, setTransferDesc] = useState("");
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [wRes, sRes, tRes] = await Promise.all([
        getWalletsAction(),
        getWalletStatsAction(),
        getWalletTransfersAction(),
      ]);
      setWallets(wRes as WalletItem[]);
      setStats(sRes as WalletStats);
      setTransfers(tRes as WalletTransfer[]);
    } catch (err) {
      console.error("Failed to load accounts data:", err);
      toast.error("Gagal memuat data akun keuangan");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateWallet() {
    if (!name.trim()) {
      toast.error("Nama akun wajib diisi");
      return;
    }

    try {
      await createWalletAction({
        name,
        type,
        accountNumber: accountNumber.trim() || undefined,
        initialBalance: parseCurrencyInput(initialBalance),
        color,
      });

      toast.success(`Akun "${name}" berhasil dibuat!`);
      setOpenCreate(false);
      setName("");
      setAccountNumber("");
      setInitialBalance("");
      loadData();
    } catch {
      toast.error("Gagal membuat akun baru");
    }
  }

  // Edit Wallet Form
  const [openEdit, setOpenEdit] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"cash" | "bank" | "emoney">("bank");
  const [editAccountNumber, setEditAccountNumber] = useState("");
  const [editBalance, setEditBalance] = useState("");
  const [editColor, setEditColor] = useState("#3b82f6");

  function handleStartEdit(w: WalletItem) {
    setEditingId(w.id);
    setEditName(w.name);
    setEditType(w.type);
    setEditAccountNumber(w.accountNumber || "");
    setEditBalance(formatNumberWithDots(w.currentBalance));
    setEditColor(w.color || "#3b82f6");
    setOpenEdit(true);
  }

  async function handleUpdateWallet() {
    if (!editName.trim()) {
      toast.error("Nama akun wajib diisi");
      return;
    }

    try {
      const editingWallet = wallets.find((w) => w.id === editingId);
      const desiredCurrentBalance = parseCurrencyInput(editBalance);
      const netOffset = editingWallet ? editingWallet.currentBalance - editingWallet.initialBalance : 0;
      const newInitialBalance = desiredCurrentBalance - netOffset;

      await updateWalletAction(editingId, {
        name: editName,
        type: editType,
        accountNumber: editAccountNumber.trim() || undefined,
        initialBalance: newInitialBalance,
        color: editColor,
      });

      toast.success(`Akun "${editName}" berhasil diperbarui!`);
      setOpenEdit(false);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Gagal memperbarui akun");
    }
  }

  async function handleDeleteWallet(id: string, name: string) {
    if (!confirm(`Hapus akun "${name}"?`)) return;
    try {
      await deleteWalletAction(id);
      toast.success(`Akun "${name}" berhasil dihapus`);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Gagal menghapus akun");
    }
  }

  async function handleTransfer() {
    if (!fromWalletId || !toWalletId) {
      toast.error("Pilih akun asal dan akun tujuan");
      return;
    }
    if (fromWalletId === toWalletId) {
      toast.error("Akun asal dan tujuan tidak boleh sama");
      return;
    }
    const amt = parseCurrencyInput(transferAmount);
    if (!amt || amt <= 0) {
      toast.error("Nominal transfer harus lebih besar dari 0");
      return;
    }

    setSubmittingTransfer(true);
    try {
      await transferBetweenWalletsAction({
        fromWalletId,
        toWalletId,
        amount: amt,
        fee: parseCurrencyInput(transferFee),
        description: transferDesc.trim() || undefined,
        date: new Date(),
      });

      toast.success("Transfer antar akun berhasil!");
      setOpenTransfer(false);
      setFromWalletId("");
      setToWalletId("");
      setTransferAmount("");
      setTransferFee("");
      setTransferDesc("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal melakukan transfer");
    } finally {
      setSubmittingTransfer(false);
    }
  }

  const typeMap = {
    cash: { label: "Kas Tunai", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", icon: Banknote },
    bank: { label: "Bank Transfer", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", icon: Building2 },
    emoney: { label: "E-Money", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20", icon: Smartphone },
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
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
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dompet & Rekening</h1>
          <p className="text-muted-foreground text-sm">
            Kelola alokasi dana di Rekening Bank, Uang Tunai (Cash), dan E-Wallet
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Transfer Button & Modal */}
          <Dialog open={openTransfer} onOpenChange={setOpenTransfer}>
            <DialogTrigger>
              <Button variant="outline" className="gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Transfer Antar Akun
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transfer Antar Akun / Dompet</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Akun Asal (Sumber)</Label>
                  <Select value={fromWalletId} onValueChange={(val) => val && setFromWalletId(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih akun asal">
                        {(() => {
                          const w = wallets.find((item) => item.id === fromWalletId);
                          return w ? `${w.name} (${formatCurrency(w.currentBalance)})` : "Pilih akun asal";
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {wallets.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name} ({formatCurrency(w.currentBalance)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Akun Tujuan (Penerima)</Label>
                  <Select value={toWalletId} onValueChange={(val) => val && setToWalletId(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih akun tujuan">
                        {(() => {
                          const w = wallets.find((item) => item.id === toWalletId);
                          return w ? `${w.name} (${formatCurrency(w.currentBalance)})` : "Pilih akun tujuan";
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {wallets
                        .filter((w) => w.id !== fromWalletId)
                        .map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name} ({formatCurrency(w.currentBalance)})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nominal Transfer (Rp)</Label>
                  <Input
                    type="text"
                    placeholder="100.000"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(formatNumberWithDots(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Biaya Admin (Opsional)</Label>
                  <Input
                    type="text"
                    placeholder="2.500"
                    value={transferFee}
                    onChange={(e) => setTransferFee(formatNumberWithDots(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Keterangan / Catatan</Label>
                  <Input
                    placeholder="Tarik tunai ATM / Topup GoPay"
                    value={transferDesc}
                    onChange={(e) => setTransferDesc(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleTransfer} disabled={submittingTransfer}>
                  {submittingTransfer ? "Memproses..." : "Kirim Transfer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add Wallet Modal */}
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Tambah Akun
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Akun Keuangan</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Nama Akun / Dompet</Label>
                  <Input
                    placeholder="Misal: BCA Tabungan / GoPay Utama / Kas Saku"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipe Akun</Label>
                  <Select value={type} onValueChange={(val: any) => setType(val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">Bank Transfer (BCA, Mandiri, BRI, dll)</SelectItem>
                      <SelectItem value="cash">Kas Tunai (Physical Cash)</SelectItem>
                      <SelectItem value="emoney">E-Money (GoPay, OVO, DANA, QRIS, dll)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nomor Rekening / No. HP (Opsional)</Label>
                  <Input
                    placeholder="8820492819"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Saldo Awal (Rp)</Label>
                  <Input
                    type="text"
                    placeholder="1.000.000"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(formatNumberWithDots(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Warna Identifikasi</Label>
                  <div className="flex gap-2">
                    {["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center"
                        style={{ backgroundColor: c, borderColor: color === c ? "#ffffff" : "transparent" }}
                        onClick={() => setColor(c)}
                      >
                        {color === c && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateWallet}>Simpan Akun</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Bank Total */}
        <Card className="border-blue-500/20 bg-blue-500/5 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Total Saldo Bank
              </p>
              <h3 className="text-xl font-bold mt-1">{formatCurrency(stats?.totalBank || 0)}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{stats?.bankCount || 0} akun bank aktif</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Cash Total */}
        <Card className="border-emerald-500/20 bg-emerald-500/5 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Total Uang Tunai
              </p>
              <h3 className="text-xl font-bold mt-1">{formatCurrency(stats?.totalCash || 0)}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{stats?.cashCount || 0} akun kas tunai</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* E-Money Total */}
        <Card className="border-purple-500/20 bg-purple-500/5 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                Total E-Money
              </p>
              <h3 className="text-xl font-bold mt-1">{formatCurrency(stats?.totalEmoney || 0)}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{stats?.emoneyCount || 0} e-wallet terhubung</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Overall */}
        <Card className="border-indigo-500/20 bg-indigo-500/5 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Total Saldo Gabungan
              </p>
              <h3 className="text-xl font-bold mt-1">{formatCurrency(stats?.totalOverall || 0)}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Semua dompet & rekening</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid of Wallets */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Daftar Akun Keuangan</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {wallets.map((w) => {
            const tInfo = typeMap[w.type] || typeMap.bank;
            const Icon = tInfo.icon;

            return (
              <Card key={w.id} className="border-border/50 bg-card/80 backdrop-blur-sm relative overflow-hidden">
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: w.color || "#3b82f6" }}
                />
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: w.color || "#3b82f6" }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">{w.name}</CardTitle>
                      {w.accountNumber && (
                        <p className="text-xs text-muted-foreground font-mono">{w.accountNumber}</p>
                      )}
                    </div>
                  </div>

                  <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-medium ${tInfo.color}`}>
                    {tInfo.label}
                  </Badge>
                </CardHeader>

                <CardContent className="pt-2 space-y-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Saldo Saat Ini</span>
                    <h4 className="text-xl font-bold tracking-tight text-foreground">
                      {formatCurrency(w.currentBalance)}
                    </h4>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
                    <span>Saldo Awal: {formatCurrency(w.initialBalance)}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                        onClick={() => handleStartEdit(w)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteWallet(w.id, w.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Edit Wallet Dialog */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Akun Keuangan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama Akun / Dompet</Label>
              <Input
                placeholder="Misal: BCA Tabungan"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipe Akun</Label>
              <Select value={editType} onValueChange={(val: any) => val && setEditType(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank Transfer (BCA, Mandiri, BRI, dll)</SelectItem>
                  <SelectItem value="cash">Kas Tunai (Physical Cash)</SelectItem>
                  <SelectItem value="emoney">E-Money (GoPay, OVO, DANA, QRIS, dll)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nomor Rekening / No. HP (Opsional)</Label>
              <Input
                placeholder="8820492819"
                value={editAccountNumber}
                onChange={(e) => setEditAccountNumber(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Saldo Saat Ini (Rp)</Label>
              <Input
                type="text"
                placeholder="1.000.000"
                value={editBalance}
                onChange={(e) => setEditBalance(formatNumberWithDots(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Warna Identifikasi</Label>
              <div className="flex gap-2">
                {["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center"
                    style={{ backgroundColor: c, borderColor: editColor === c ? "#ffffff" : "transparent" }}
                    onClick={() => setEditColor(c)}
                  >
                    {editColor === c && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateWallet}>Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer History Table */}
      {transfers.length > 0 && (
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-primary" />
              Riwayat Transfer Antar Akun
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Akun Asal</TableHead>
                  <TableHead>Akun Tujuan</TableHead>
                  <TableHead>Nominal</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(t.date)}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{t.fromWalletName}</TableCell>
                    <TableCell className="font-medium text-sm text-emerald-600 dark:text-emerald-400">
                      ➔ {t.toWalletName}
                    </TableCell>
                    <TableCell className="font-semibold text-sm">{formatCurrency(t.amount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.fee > 0 ? formatCurrency(t.fee) : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {t.description || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
