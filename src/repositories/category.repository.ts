"use server";

import { executeQuery, queryOne, queryAll } from "@/db/client";
import { generateId } from "@/utils";
import { DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES } from "@/types";

interface CategoryRow {
  id: string;
  user_id: string | null;
  name: string;
  type: string;
  icon: string;
  color: string;
  is_default: number;
  created_at: number;
}

interface SubCategoryRow {
  id: string;
  category_id: string;
  name: string;
  is_default: number;
  created_at: number;
}

export async function getCategories(userId: string, type?: string) {
  const conditions = ["(user_id = ? OR user_id IS NULL)"];
  const params: unknown[] = [userId];

  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }

  const rows = await queryAll<CategoryRow>(
    `SELECT * FROM categories WHERE ${conditions.join(" AND ")} ORDER BY is_default DESC, name ASC`,
    params
  );

  return rows.map(mapCategoryRow);
}

export async function getCategoryById(id: string) {
  const row = await queryOne<CategoryRow>(
    "SELECT * FROM categories WHERE id = ?",
    [id]
  );
  return row ? mapCategoryRow(row) : null;
}

export async function createCategory(data: {
  userId: string;
  name: string;
  type: string;
  icon?: string;
  color?: string;
}) {
  const id = generateId();
  const now = Math.floor(Date.now() / 1000);

  await executeQuery(
    `INSERT INTO categories (id, user_id, name, type, icon, color, is_default, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, data.userId, data.name, data.type, data.icon || "Circle", data.color || "#6366f1", now]
  );

  return id;
}

export async function updateCategory(id: string, data: Partial<{
  name: string;
  icon: string;
  color: string;
}>) {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) { updates.push("name = ?"); params.push(data.name); }
  if (data.icon !== undefined) { updates.push("icon = ?"); params.push(data.icon); }
  if (data.color !== undefined) { updates.push("color = ?"); params.push(data.color); }

  if (updates.length === 0) return;

  params.push(id);

  await executeQuery(
    `UPDATE categories SET ${updates.join(", ")} WHERE id = ? AND is_default = 0`,
    params
  );
}

export async function deleteCategory(id: string) {
  await executeQuery(
    "DELETE FROM categories WHERE id = ? AND is_default = 0",
    [id]
  );
}

export async function getSubCategories(categoryId: string) {
  const rows = await queryAll<SubCategoryRow>(
    "SELECT * FROM sub_categories WHERE category_id = ? ORDER BY name ASC",
    [categoryId]
  );

  return rows.map(mapSubCategoryRow);
}

export async function createSubCategory(data: {
  categoryId: string;
  name: string;
}) {
  const id = generateId();
  const now = Math.floor(Date.now() / 1000);

  await executeQuery(
    `INSERT INTO sub_categories (id, category_id, name, is_default, created_at)
     VALUES (?, ?, ?, 0, ?)`,
    [id, data.categoryId, data.name, now]
  );

  return id;
}

export async function deleteSubCategory(id: string) {
  await executeQuery(
    "DELETE FROM sub_categories WHERE id = ? AND is_default = 0",
    [id]
  );
}

export async function seedDefaultCategories() {
  const existing = await queryAll<{ count: number }>(
    "SELECT COUNT(*) as count FROM categories WHERE is_default = 1"
  );

  if (existing[0]?.count > 0) return;

  const now = Math.floor(Date.now() / 1000);

  for (const cat of DEFAULT_INCOME_CATEGORIES) {
    const id = generateId();
    await executeQuery(
      `INSERT INTO categories (id, user_id, name, type, icon, color, is_default, created_at)
       VALUES (?, NULL, ?, 'income', ?, ?, 1, ?)`,
      [id, cat.name, cat.icon, cat.color, now]
    );
  }

  for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
    const id = generateId();
    await executeQuery(
      `INSERT INTO categories (id, user_id, name, type, icon, color, is_default, created_at)
       VALUES (?, NULL, ?, 'expense', ?, ?, 1, ?)`,
      [id, cat.name, cat.icon, cat.color, now]
    );
  }
}

const SMART_KEYWORD_MAP: Record<string, string[]> = {
  "Makanan": ["makan", "minum", "kopi", "kafe", "resto", "nasi", "bakso", "sate", "snack", "jajanan", "gofood", "grabfood", "shopeefood", "warung", "martabak", "ayam", "mie"],
  "Transportasi": ["bensin", "bbm", "pertalite", "pertamax", "parkir", "tol", "gojek", "grab", "angkot", "ojek", "trans", "bus", "servis", "bengkel", "ban", "steam", "cuci", "tambal"],
  "Pendidikan": ["sks", "semester", "kuliah", "kampus", "sekolah", "spp", "buku", "kursus", "les", "ukt", "wisuda"],
  "Tagihan": ["listrik", "pln", "air", "pdam", "wifi", "indihome", "biznet", "pulsa", "kuota", "kontrakan", "kos", "bpjs", "pajak"],
  "Hiburan": ["rokok", "vape", "nonton", "bioskop", "game", "steam", "spotify", "netflix", "jalan-jalan", "hiburan", "liburan", "topup"],
  "Kesehatan": ["obat", "dokter", "apotek", "rs", "rumah sakit", "vitamin", "skincare", "salon", "pijat"],
  "Belanja": ["baju", "celana", "sepatu", "pakaian", "belanja", "tokopedia", "shopee", "lazada", "mall", "fashion", "jam"],
  "Gaji": ["gaji", "salary", "upah", "honor", "paycheck"],
  "Uang Saku": ["saku", "uang saku", "transfer masuk", "hadiah", "bonus", "cashback", "dikasih"],
};

export async function findCategoryByName(name: string, type?: string) {
  const clean = name.toLowerCase().trim();

  // 1. Direct or partial DB match
  const conditions = ["LOWER(name) LIKE LOWER(?)"];
  const params: unknown[] = [`%${clean}%`];

  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }

  const cat = await queryOne<CategoryRow>(
    `SELECT * FROM categories WHERE ${conditions.join(" AND ")} LIMIT 1`,
    params
  );

  if (cat) return mapCategoryRow(cat);

  // 2. Smart Keyword Synonym Mapping
  for (const [targetCatName, keywords] of Object.entries(SMART_KEYWORD_MAP)) {
    for (const kw of keywords) {
      if (clean.includes(kw) || kw.includes(clean)) {
        const matchConds = ["LOWER(name) LIKE LOWER(?)"];
        const matchParams: unknown[] = [`%${targetCatName.toLowerCase()}%`];
        if (type) {
          matchConds.push("type = ?");
          matchParams.push(type);
        }
        const mapped = await queryOne<CategoryRow>(
          `SELECT * FROM categories WHERE ${matchConds.join(" AND ")} LIMIT 1`,
          matchParams
        );
        if (mapped) return mapCategoryRow(mapped);
      }
    }
  }

  // 3. Fallback to 'Lainnya' category
  const fallbackConds = ["(LOWER(name) LIKE '%lain%' OR LOWER(name) LIKE '%umum%')"];
  const fallbackParams: unknown[] = [];
  if (type) {
    fallbackConds.push("type = ?");
    fallbackParams.push(type);
  }

  const fallback = await queryOne<CategoryRow>(
    `SELECT * FROM categories WHERE ${fallbackConds.join(" AND ")} LIMIT 1`,
    fallbackParams
  );

  if (fallback) return mapCategoryRow(fallback);

  // 4. Ultimate fallback: return first category of that type
  const firstConds: string[] = [];
  const firstParams: unknown[] = [];
  if (type) {
    firstConds.push("type = ?");
    firstParams.push(type);
  }
  const whereClause = firstConds.length > 0 ? `WHERE ${firstConds.join(" AND ")}` : "";
  const first = await queryOne<CategoryRow>(
    `SELECT * FROM categories ${whereClause} ORDER BY is_default DESC LIMIT 1`,
    firstParams
  );

  return first ? mapCategoryRow(first) : null;
}

function mapCategoryRow(row: CategoryRow) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type as "income" | "expense",
    icon: row.icon || "Circle",
    color: row.color || "#6366f1",
    isDefault: Boolean(row.is_default),
    createdAt: new Date(row.created_at * 1000),
  };
}

function mapSubCategoryRow(row: SubCategoryRow) {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    isDefault: Boolean(row.is_default),
    createdAt: new Date(row.created_at * 1000),
  };
}
