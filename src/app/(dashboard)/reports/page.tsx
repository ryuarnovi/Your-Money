"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, FileText, Printer, Download, Sparkles } from "lucide-react";
import { formatCurrency, formatDate } from "@/utils";
import { getTransactionsAction, getDashboardStatsAction } from "@/actions/transaction.actions";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ReportsPage() {
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Generate Laporan</h1>
        <p className="text-muted-foreground text-sm">
          Ekspor laporan transaksi dalam format Excel, PDF, CSV, atau cetak langsung
        </p>
      </div>

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
    </div>
  );
}
