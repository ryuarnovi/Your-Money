import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "DuitKu — Personal Money Management",
    template: "%s | DuitKu",
  },
  description:
    "Kelola keuangan pribadi dengan mudah. Catat pemasukan, pengeluaran, budget, dan tabungan dalam satu aplikasi.",
  keywords: [
    "money management",
    "keuangan pribadi",
    "budget tracker",
    "expense tracker",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className={`${inter.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
