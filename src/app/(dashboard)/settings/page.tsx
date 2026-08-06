"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Bell, Shield, Moon, Save } from "lucide-react";
import { getSettingsAction, updateSettingsAction } from "@/actions/auth.actions";
import { toast } from "sonner";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [currency, setCurrency] = useState("IDR");
  const [theme, setTheme] = useState("system");
  const [notifyBudget, setNotifyBudget] = useState(true);
  const [notifyBills, setNotifyBills] = useState(true);
  const [notifyLargeExpense, setNotifyLargeExpense] = useState(true);
  const [largeExpenseThreshold, setLargeExpenseThreshold] = useState("500000");

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const s = await getSettingsAction();
        if (s) {
          setCurrency(s.currency);
          setTheme(s.theme);
          setNotifyBudget(s.notifyBudget);
          setNotifyBills(s.notifyBills);
          setNotifyLargeExpense(s.notifyLargeExpense);
          setLargeExpenseThreshold(String(s.largeExpenseThreshold));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettingsAction({
        currency,
        theme: theme as any,
        notifyBudget,
        notifyBills,
        notifyLargeExpense,
        largeExpenseThreshold: Number(largeExpenseThreshold),
      });
      toast.success("Pengaturan berhasil disimpan!");
    } catch {
      toast.error("Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan Aplikasi</h1>
        <p className="text-muted-foreground text-sm">
          Atur preferensi mata uang, notifikasi Telegram, dan ambang batas peringatan
        </p>
      </div>

      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-indigo-500" />
            <CardTitle className="text-base font-semibold">Mata Uang & Format</CardTitle>
          </div>
          <CardDescription>
            Pilih mata uang utama yang digunakan dalam aplikasi
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Mata Uang Utamamu</Label>
            <Select value={currency} onValueChange={(val) => val && setCurrency(val)}>
              <SelectTrigger className="w-full md:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IDR">🇮🇩 Rupiah Indonesia (IDR - Rp)</SelectItem>
                <SelectItem value="USD">🇺🇸 US Dollar (USD - $)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-indigo-500" />
            <CardTitle className="text-base font-semibold">Notifikasi & Peringatan Telegram</CardTitle>
          </div>
          <CardDescription>
            Peringatan otomatis yang dikirimkan melalui Telegram Bot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Peringatan Budget Hampir Habis</Label>
              <p className="text-xs text-muted-foreground">Kirim notifikasi saat penggunaan budget mencapai 80%</p>
            </div>
            <Switch checked={notifyBudget} onCheckedChange={setNotifyBudget} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Pengingat Tagihan Jatuh Tempo</Label>
              <p className="text-xs text-muted-foreground">Kirim notifikasi 1 hari sebelum tagihan rutin jatuh tempo</p>
            </div>
            <Switch checked={notifyBills} onCheckedChange={setNotifyBills} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Notifikasi Pengeluaran Besar</Label>
              <p className="text-xs text-muted-foreground">Kirim notifikasi saat pengeluaran melebihi batas nominal</p>
            </div>
            <Switch checked={notifyLargeExpense} onCheckedChange={setNotifyLargeExpense} />
          </div>

          {notifyLargeExpense && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <Label htmlFor="threshold">Batas Nominal Pengeluaran Besar (Rp)</Label>
              <Input
                id="threshold"
                type="number"
                value={largeExpenseThreshold}
                onChange={(e) => setLargeExpenseThreshold(e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </div>
    </div>
  );
}
