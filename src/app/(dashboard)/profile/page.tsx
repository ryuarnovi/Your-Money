"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Lock, KeyRound } from "lucide-react";
import { getInitials } from "@/utils";
import { changePasswordAction, updateProfileAction } from "@/actions/auth.actions";
import { toast } from "sonner";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [name, setName] = useState(session?.user?.name || "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  async function handleUpdateProfile() {
    setUpdatingProfile(true);
    try {
      const res = await updateProfileAction({ name });
      if (res.success) {
        toast.success("Profil berhasil diperbarui!");
        await update();
      } else {
        toast.error("Gagal memperbarui profil");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setUpdatingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword !== confirmPassword) {
      toast.error("Password baru dan konfirmasi tidak cocok");
      return;
    }

    setUpdatingPassword(true);
    try {
      const res = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (res.success) {
        toast.success("Password berhasil diubah!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(res.error || "Gagal mengubah password");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setUpdatingPassword(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profil Pengguna</h1>
        <p className="text-muted-foreground text-sm">
          Kelola informasi profil dan kata sandi akunmu
        </p>
      </div>

      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-indigo-500" />
            <CardTitle className="text-base font-semibold">Informasi Pribadi</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={session?.user?.image || ""} />
              <AvatarFallback className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-lg font-bold">
                {getInitials(session?.user?.name || "U")}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-lg">{session?.user?.name}</p>
              <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nama Lengkap</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={session?.user?.email || ""}
              disabled
              className="bg-muted"
            />
          </div>

          <Button onClick={handleUpdateProfile} disabled={updatingProfile}>
            {updatingProfile ? "Menyimpan..." : "Simpan Profil"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-indigo-500" />
            <CardTitle className="text-base font-semibold">Ubah Password</CardTitle>
          </div>
          <CardDescription>
            Pastikan password barumu kuat dan aman
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPass">Password Saat Ini</Label>
            <Input
              id="currentPass"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPass">Password Baru</Label>
            <Input
              id="newPass"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPass">Konfirmasi Password Baru</Label>
            <Input
              id="confirmPass"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <Button onClick={handleChangePassword} disabled={updatingPassword}>
            {updatingPassword ? "Mengubah..." : "Ubah Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
