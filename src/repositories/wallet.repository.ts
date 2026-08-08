"use server";

import { executeQuery, queryOne, queryAll } from "@/db/client";
import { generateId } from "@/utils";

export interface WalletData {
  id: string;
  userId: string;
  name: string;
  type: "cash" | "bank" | "emoney";
  accountNumber: string | null;
  initialBalance: number;
  currentBalance: number;
  color: string;
  icon: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletStats {
  totalCash: number;
  totalBank: number;
  totalEmoney: number;
  totalOverall: number;
  cashCount: number;
  bankCount: number;
  emoneyCount: number;
}

export interface WalletTransferItem {
  id: string;
  userId: string;
  fromWalletId: string;
  fromWalletName: string;
  toWalletId: string;
  toWalletName: string;
  amount: number;
  fee: number;
  description: string | null;
  date: Date;
  createdAt: Date;
}

interface RawWallet {
  id: string;
  user_id: string;
  name: string;
  type: string;
  account_number: string | null;
  initial_balance: number;
  color: string | null;
  icon: string | null;
  is_default: number;
  created_at: number;
  updated_at: number;
}

const TYPE_PAYMENT_METHODS: Record<string, string[]> = {
  cash: ["cash"],
  bank: ["bank", "transfer"],
  emoney: ["qris", "dana", "ovo", "gopay", "shopeepay"],
};

export async function getWallets(userId: string): Promise<WalletData[]> {
  const rows = await queryAll<RawWallet>(
    `SELECT * FROM wallets WHERE user_id = ? ORDER BY is_default DESC, created_at ASC`,
    [userId]
  );

  // If user has no wallets yet, seed default default wallets (Cash, Bank BCA, GoPay)
  if (rows.length === 0) {
    await seedDefaultWallets(userId);
    return getWallets(userId);
  }

  // Get transaction totals per payment_method
  const txSums = await queryAll<{ payment_method: string; type: string; total: number }>(
    `SELECT payment_method, type, COALESCE(SUM(amount), 0) as total
     FROM transactions
     WHERE user_id = ?
     GROUP BY payment_method, type`,
    [userId]
  );

  // Get transfers out / in per wallet
  const transferOuts = await queryAll<{ from_wallet_id: string; total: number }>(
    `SELECT from_wallet_id, COALESCE(SUM(amount + fee), 0) as total
     FROM wallet_transfers
     WHERE user_id = ?
     GROUP BY from_wallet_id`,
    [userId]
  );

  const transferIns = await queryAll<{ to_wallet_id: string; total: number }>(
    `SELECT to_wallet_id, COALESCE(SUM(amount), 0) as total
     FROM wallet_transfers
     WHERE user_id = ?
     GROUP BY to_wallet_id`,
    [userId]
  );

  const transferOutMap = new Map(transferOuts.map((t) => [t.from_wallet_id, t.total]));
  const transferInMap = new Map(transferIns.map((t) => [t.to_wallet_id, t.total]));

  // Calculate wallet current balance
  // Group wallets by type to distribute generic payment_method transactions if needed
  const walletsByType: Record<string, RawWallet[]> = { cash: [], bank: [], emoney: [] };
  rows.forEach((w) => {
    if (!walletsByType[w.type]) walletsByType[w.type] = [];
    walletsByType[w.type].push(w);
  });

  return rows.map((w) => {
    let income = 0;
    let expense = 0;

    const matchedMethods = TYPE_PAYMENT_METHODS[w.type] || [];
    const sameTypeWallets = walletsByType[w.type] || [];
    const isFirstOfType = sameTypeWallets.length > 0 && sameTypeWallets[0].id === w.id;

    txSums.forEach((tx) => {
      const pm = (tx.payment_method || "").toLowerCase();
      const wName = w.name.toLowerCase();

      // Check direct name match (e.g. "gopay" or "bca")
      const matchesName = pm.includes(wName) || wName.includes(pm);
      const matchesType = matchedMethods.includes(pm);

      if (matchesName || (matchesType && isFirstOfType)) {
        if (tx.type === "income") income += tx.total;
        if (tx.type === "expense") expense += tx.total;
      }
    });

    const outAmt = transferOutMap.get(w.id) || 0;
    const inAmt = transferInMap.get(w.id) || 0;

    const currentBalance = (w.initial_balance || 0) + income - expense - outAmt + inAmt;

    return {
      id: w.id,
      userId: w.user_id,
      name: w.name,
      type: w.type as "cash" | "bank" | "emoney",
      accountNumber: w.account_number,
      initialBalance: w.initial_balance || 0,
      currentBalance,
      color: w.color || "#3b82f6",
      icon: w.icon || "Wallet",
      isDefault: Boolean(w.is_default),
      createdAt: new Date(w.created_at * 1000),
      updatedAt: new Date(w.updated_at * 1000),
    };
  });
}

export async function getWalletStats(userId: string): Promise<WalletStats> {
  const wallets = await getWallets(userId);

  let totalCash = 0;
  let totalBank = 0;
  let totalEmoney = 0;
  let cashCount = 0;
  let bankCount = 0;
  let emoneyCount = 0;

  wallets.forEach((w) => {
    if (w.type === "cash") {
      totalCash += w.currentBalance;
      cashCount++;
    } else if (w.type === "bank") {
      totalBank += w.currentBalance;
      bankCount++;
    } else if (w.type === "emoney") {
      totalEmoney += w.currentBalance;
      emoneyCount++;
    }
  });

  return {
    totalCash,
    totalBank,
    totalEmoney,
    totalOverall: totalCash + totalBank + totalEmoney,
    cashCount,
    bankCount,
    emoneyCount,
  };
}

export async function createWallet(data: {
  userId: string;
  name: string;
  type: "cash" | "bank" | "emoney";
  accountNumber?: string;
  initialBalance: number;
  color?: string;
  icon?: string;
  isDefault?: boolean;
}) {
  const id = generateId();
  const now = Math.floor(Date.now() / 1000);

  if (data.isDefault) {
    await executeQuery("UPDATE wallets SET is_default = 0 WHERE user_id = ?", [data.userId]);
  }

  await executeQuery(
    `INSERT INTO wallets (id, user_id, name, type, account_number, initial_balance, color, icon, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.userId,
      data.name,
      data.type,
      data.accountNumber || null,
      data.initialBalance || 0,
      data.color || "#3b82f6",
      data.icon || "Wallet",
      data.isDefault ? 1 : 0,
      now,
      now,
    ]
  );

  return id;
}

export async function updateWallet(
  id: string,
  userId: string,
  data: Partial<{
    name: string;
    type: "cash" | "bank" | "emoney";
    accountNumber: string;
    initialBalance: number;
    color: string;
    icon: string;
    isDefault: boolean;
  }>
) {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.isDefault) {
    await executeQuery("UPDATE wallets SET is_default = 0 WHERE user_id = ?", [userId]);
  }

  if (data.name !== undefined) { updates.push("name = ?"); params.push(data.name); }
  if (data.type !== undefined) { updates.push("type = ?"); params.push(data.type); }
  if (data.accountNumber !== undefined) { updates.push("account_number = ?"); params.push(data.accountNumber); }
  if (data.initialBalance !== undefined) { updates.push("initial_balance = ?"); params.push(data.initialBalance); }
  if (data.color !== undefined) { updates.push("color = ?"); params.push(data.color); }
  if (data.icon !== undefined) { updates.push("icon = ?"); params.push(data.icon); }
  if (data.isDefault !== undefined) { updates.push("is_default = ?"); params.push(data.isDefault ? 1 : 0); }

  updates.push("updated_at = ?");
  params.push(Math.floor(Date.now() / 1000));

  if (updates.length === 1) return;

  params.push(id, userId);

  await executeQuery(
    `UPDATE wallets SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`,
    params
  );
}

export async function deleteWallet(id: string, userId: string) {
  await executeQuery("DELETE FROM wallets WHERE id = ? AND user_id = ?", [id, userId]);
}

export async function transferBetweenWallets(data: {
  userId: string;
  fromWalletId: string;
  toWalletId: string;
  amount: number;
  fee?: number;
  description?: string;
  date: Date;
}) {
  if (data.fromWalletId === data.toWalletId) {
    throw new Error("Akun asal dan akun tujuan tidak boleh sama.");
  }
  if (data.amount <= 0) {
    throw new Error("Nominal transfer harus lebih besar dari 0.");
  }

  const id = generateId();
  const now = Math.floor(Date.now() / 1000);
  const dateTs = Math.floor(data.date.getTime() / 1000);
  const fee = data.fee || 0;

  // 1. Record transfer in wallet_transfers
  await executeQuery(
    `INSERT INTO wallet_transfers (id, user_id, from_wallet_id, to_wallet_id, amount, fee, description, date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.userId,
      data.fromWalletId,
      data.toWalletId,
      data.amount,
      fee,
      data.description || null,
      dateTs,
      now,
    ]
  );

  // 2. Fetch wallet names for transaction log description
  const fromW = await queryOne<{ name: string }>("SELECT name FROM wallets WHERE id = ?", [data.fromWalletId]);
  const toW = await queryOne<{ name: string }>("SELECT name FROM wallets WHERE id = ?", [data.toWalletId]);

  const fromName = fromW?.name || "Akun Asal";
  const toName = toW?.name || "Akun Tujuan";

  // 3. Record transaction log for clarity in transaction history
  const txId = generateId();
  const desc = data.description
    ? `Transfer ${fromName} ke ${toName}: ${data.description}`
    : `Transfer ${fromName} ke ${toName}`;

  await executeQuery(
    `INSERT INTO transactions (id, user_id, amount, type, payment_method, description, date, created_at)
     VALUES (?, ?, ?, 'transfer', 'transfer', ?, ?, ?)`,
    [txId, data.userId, data.amount, desc, dateTs, now]
  );

  return id;
}

export async function getWalletTransfers(userId: string): Promise<WalletTransferItem[]> {
  const rows = await queryAll<{
    id: string;
    user_id: string;
    from_wallet_id: string;
    from_wallet_name: string;
    to_wallet_id: string;
    to_wallet_name: string;
    amount: number;
    fee: number;
    description: string | null;
    date: number;
    created_at: number;
  }>(
    `SELECT wt.*, w1.name as from_wallet_name, w2.name as to_wallet_name
     FROM wallet_transfers wt
     LEFT JOIN wallets w1 ON wt.from_wallet_id = w1.id
     LEFT JOIN wallets w2 ON wt.to_wallet_id = w2.id
     WHERE wt.user_id = ?
     ORDER BY wt.date DESC, wt.created_at DESC
     LIMIT 20`,
    [userId]
  );

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    fromWalletId: r.from_wallet_id,
    fromWalletName: r.from_wallet_name || "Akun Asal",
    toWalletId: r.to_wallet_id,
    toWalletName: r.to_wallet_name || "Akun Tujuan",
    amount: r.amount,
    fee: r.fee || 0,
    description: r.description,
    date: new Date(r.date * 1000),
    createdAt: new Date(r.created_at * 1000),
  }));
}

async function seedDefaultWallets(userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const defaults = [
    { id: generateId(), name: "Uang Tunai (Cash)", type: "cash", icon: "Banknote", color: "#10b981", isDefault: 1 },
    { id: generateId(), name: "Bank BCA", type: "bank", icon: "Building2", color: "#3b82f6", isDefault: 0 },
    { id: generateId(), name: "GoPay / DANA", type: "emoney", icon: "Smartphone", color: "#8b5cf6", isDefault: 0 },
  ];

  for (const d of defaults) {
    await executeQuery(
      `INSERT INTO wallets (id, user_id, name, type, initial_balance, color, icon, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [d.id, userId, d.name, d.type, d.color, d.icon, d.isDefault, now, now]
    );
  }
}
