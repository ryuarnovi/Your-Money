"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileSpreadsheet, FileText, Printer, Download, Lock, Trash2, CheckCircle2, ShieldCheck, Layers } from "lucide-react";
import { formatCurrency, formatDate } from "@/utils";
import { getTransactionsAction, getDashboardStatsAction } from "@/actions/transaction.actions";
import { closeMonthAndAuditAction, getMonthlyAuditsAction } from "@/actions/monthly_audit.actions";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface MonthlyAuditItem {
  id: string;
  yearMonth: string;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  totalAssetAtClose: number;
  categoryBreakdownJson: string | null;
  txCountPurged: number;
  closedAt: Date;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [audits, setAudits] = useState<MonthlyAuditItem[]>([]);
  const [openCloseMonthModal, setOpenCloseMonthModal] = useState(false);
  const [closingInProcess, setClosingInProcess] = useState(false);

  async function loadAudits() {
    try {
      const res = await getMonthlyAuditsAction();
      setAudits(res as any);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadAudits();
  }, []);

  async function exportExcel() {
    setLoading(true);
    try {
      const res = await getTransactionsAction();
      const txs = res.data;

      const dataToExport = txs.map((t: any) => ({
        Tanggal: formatDate(t.date),
        Jenis: t.type === "income" ? "Pemasukan" : t.type === "expense" ? "Pengeluaran" : "Transfer",
        Kategori: t.categoryName,
        Nominal: t.amount,
        Keterangan: t.description || "-",
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Keuangan");
      XLSX.writeFile(workbook, `Laporan_Keuangan_DuitKu_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Laporan Excel berhasil didownload!");
    } catch {
      toast.error("Gagal membuat laporan Excel");
    } finally {
      setLoading(false);
    }
  }

  async function exportPDF() {
    setLoading(true);
    try {
      const [res, stats] = await Promise.all([
        getTransactionsAction(),
        getDashboardStatsAction(),
      ]);
      const txs = res.data;

      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("Laporan Keuangan DuitKu", 14, 22);

      doc.setFontSize(10);
      doc.text(`Tanggal Cetak: ${formatDate(new Date())}`, 14, 30);
      doc.text(`Total Pemasukan: ${formatCurrency(stats.totalIncome)}`, 14, 36);
      doc.text(`Total Pengeluaran: ${formatCurrency(stats.totalExpense)}`, 14, 42);
      doc.text(`Saldo: ${formatCurrency(stats.balance)}`, 14, 48);

      const tableRows = txs.map((t: any) => [
        formatDate(t.date),
        t.type === "income" ? "Pemasukan" : t.type === "expense" ? "Pengeluaran" : "Transfer",
        t.categoryName,
        formatCurrency(t.amount),
        t.description || "-",
      ]);

      autoTable(doc, {
        head: [["Tanggal", "Jenis", "Kategori", "Nominal", "Keterangan"]],
        body: tableRows,
        startY: 55,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [99, 102, 241] },
      });

      doc.save(`Laporan_Keuangan_DuitKu_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Laporan PDF berhasil didownload!");
    } catch {
      toast.error("Gagal membuat laporan PDF");
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  async function handleCloseMonth() {
    setClosingInProcess(true);
    try {
      // 1. Download Excel first for safety!
      await exportExcel();

      // 2. Perform monthly audit and purge
      const res = await closeMonthAndAuditAction();
      toast.success(`Audit Bulan ${res.yearMonth} berhasil disimpan & ${res.txCountPurged} transaksi lama telah dibersihkan!`);
      setOpenCloseMonthModal(false);
      await loadAudits();
    } catch (err) {
      console.error(err);
      toast.error("Gagal melakukan penutupan audit bulan.");
    } finally {
      setClosingInProcess(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Laporan & Audit Keuangan</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ekspor laporan transaksi dan lakukan penutupan audit bulanan secara permanen
          </p>
        </div>

        <Button
          onClick={() => setOpenCloseMonthModal(true)}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
        >
          <Lock className="h-4 w-4" />
          <span>Tutup Bulan & Audit</span>
        </Button>
      </div>

      {/* Export Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-2">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg font-bold">Laporan Excel (.xlsx)</CardTitle>
            <CardDescription>
              Format spreadsheet lengkap cocok untuk dianalisis di Excel atau Google Sheets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportExcel} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Download className="h-4 w-4" /> Download Excel
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-2">
              <FileText className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg font-bold">Laporan PDF (.pdf)</CardTitle>
            <CardDescription>
              Dokumen PDF siap cetak dengan ringkasan pemasukan, pengeluaran & tabel transaksi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportPDF} disabled={loading} className="w-full bg-rose-600 hover:bg-rose-700 text-white gap-2">
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-2">
              <Printer className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg font-bold">Cetak Langsung</CardTitle>
            <CardDescription>
              Cetak ringkasan laporan keuangan secara instan via printer terhubung
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handlePrint} variant="outline" className="w-full gap-2">
              <Printer className="h-4 w-4" /> Cetak Laporan
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Audit History Section */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="py-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Riwayat Audit Akhir Bulanan
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Ringkasan audit hasil akhir bulan yang tersimpan permanen setelah transaksi lama dibersihkan
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-4 pt-0">
          {audits.length === 0 ? (
            <div className="text-center py-8">
              <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-muted-foreground">Belum ada riwayat audit bulanan</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Lakukan Penutupan Bulan untuk menyimpan hasil audit akhir secara permanen.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {audits.map((audit) => {
                const breakdown = audit.categoryBreakdownJson
                  ? JSON.parse(audit.categoryBreakdownJson)
                  : [];

                return (
                  <div
                    key={audit.id}
                    className="p-4 rounded-xl border border-border/50 bg-accent/20 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-sm px-2.5 py-0.5 bg-indigo-500/10 text-indigo-600 border-indigo-500/30">
                          {audit.yearMonth}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Diaudit pada {formatDate(audit.closedAt)}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 w-fit">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Audit Tersimpan Permanen ({audit.txCountPurged} rincian transaksi dibersihkan)
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase font-medium">Pemasukan</p>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(audit.totalIncome)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase font-medium">Pengeluaran</p>
                        <p className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(audit.totalExpense)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase font-medium">Cashflow Net</p>
                        <p className="font-bold text-foreground">{formatCurrency(audit.netCashflow)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase font-medium">Total Asset Akun</p>
                        <p className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(audit.totalAssetAtClose)}</p>
                      </div>
                    </div>

                    {breakdown.length > 0 && (
                      <div className="pt-2 border-t border-border/30">
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5" />
                          Ringkasan Kategori Pengeluaran Audit:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {breakdown.map((item: any) => (
                            <span key={item.name} className="text-xs bg-secondary/80 px-2 py-1 rounded-md">
                              {item.name}: <strong>{formatCurrency(item.total)}</strong> ({item.percentage}%)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Modal for Closing Month */}
      <Dialog open={openCloseMonthModal} onOpenChange={setOpenCloseMonthModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-indigo-500" />
              Tutup Bulan & Simpan Audit
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm space-y-2">
              <p>Proses ini akan melakukan hal berikut:</p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-foreground/90">
                <li>Mengunduh Laporan Excel (.xlsx) bulan ini secara otomatis.</li>
                <li>Menyimpan **Hasil Audit Bulanan Permanen** (Total Pemasukan, Pengeluaran, Asset, dan Ringkasan Kategori).</li>
                <li>**Menghapus rincian transaksi bulan lalu secara permanen** dari database agar tetap ringan dan aman.</li>
                <li>Saldo akun/dompet Anda tetap aman 100% dan tidak berubah.</li>
              </ul>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setOpenCloseMonthModal(false)} disabled={closingInProcess}>
              Batal
            </Button>
            <Button
              onClick={handleCloseMonth}
              disabled={closingInProcess}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
              {closingInProcess ? "Memproses Audit..." : "Setujui & Tutup Bulan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
