import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek, isThisMonth, isThisYear, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import { id } from "date-fns/locale";

// ============================================
// Currency formatting
// ============================================

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactCurrency(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `Rp${(amount / 1_000_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000_000) {
    return `Rp${(amount / 1_000_000).toFixed(1)}Jt`;
  }
  if (amount >= 1_000) {
    return `Rp${(amount / 1_000).toFixed(0)}Rb`;
  }
  return formatCurrency(amount);
}

export function parseCurrencyInput(value: string): number {
  return Number(value.replace(/[^0-9.-]/g, "")) || 0;
}

// ============================================
// Date formatting
// ============================================

export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  return format(d, "dd MMM yyyy", { locale: id });
}

export function formatDateTime(date: Date | string | number): string {
  const d = new Date(date);
  return format(d, "dd MMM yyyy HH:mm", { locale: id });
}

export function formatRelativeDate(date: Date | string | number): string {
  const d = new Date(date);
  if (isToday(d)) return "Hari ini";
  if (isYesterday(d)) return "Kemarin";
  if (isThisWeek(d)) return formatDistanceToNow(d, { addSuffix: true, locale: id });
  return formatDate(d);
}

export function formatMonthYear(date: Date): string {
  return format(date, "MMMM yyyy", { locale: id });
}

// ============================================
// Date ranges
// ============================================

export function getDateRange(period: string) {
  const now = new Date();
  switch (period) {
    case "today":
      return { start: new Date(now.setHours(0, 0, 0, 0)), end: new Date() };
    case "week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now) };
    case "last7":
      return { start: subDays(now, 7), end: now };
    case "last30":
      return { start: subDays(now, 30), end: now };
    case "last90":
      return { start: subDays(now, 90), end: now };
    case "last6months":
      return { start: subMonths(now, 6), end: now };
    case "last12months":
      return { start: subMonths(now, 12), end: now };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

export { eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfWeek, endOfWeek, format, subDays, subMonths };

// ============================================
// Number formatting
// ============================================

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

// ============================================
// Misc helpers
// ============================================

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseJsonSafe<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
