// ============================================
// Database client for accessing Cloudflare D1
// via the Hono Worker proxy
// ============================================

const WORKER_API_URL = process.env.WORKER_API_URL || "http://localhost:8787";
const WORKER_API_KEY = process.env.WORKER_API_KEY || "dev-api-key";

interface QueryResult<T = Record<string, unknown>> {
  results: T[];
  meta?: {
    changes: number;
    last_row_id: number;
    duration: number;
  };
}

interface D1Response<T = Record<string, unknown>> {
  success: boolean;
  data?: QueryResult<T>;
  error?: string;
}

export async function executeQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const response = await fetch(`${WORKER_API_URL}/api/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": WORKER_API_KEY,
    },
    body: JSON.stringify({ sql, params }),
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Database query failed: ${error}`);
  }

  const result: D1Response<T> = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || "Unknown database error");
  }

  return result.data!;
}

export async function executeBatch(
  queries: { sql: string; params?: unknown[] }[]
): Promise<void> {
  const response = await fetch(`${WORKER_API_URL}/api/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": WORKER_API_KEY,
    },
    body: JSON.stringify({ queries }),
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Batch query failed: ${error}`);
  }
}

// Helper for single row queries
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const result = await executeQuery<T>(sql, params);
  return result.results[0] || null;
}

// Helper for getting all rows
export async function queryAll<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await executeQuery<T>(sql, params);
  return result.results;
}

// Helper for counting
export async function queryCount(
  sql: string,
  params: unknown[] = []
): Promise<number> {
  const result = await executeQuery<{ count: number }>(sql, params);
  return result.results[0]?.count || 0;
}
