/**
 * Supabase persistence layer.
 * Falls back to no-op when SUPABASE_URL / SUPABASE_SERVICE_KEY are not set,
 * so the game keeps working with in-memory state (local dev without DB).
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL         ?? '';
const key = process.env.SUPABASE_SERVICE_KEY ?? '';

export const db = url && key ? createClient(url, key) : null;

// ── Single room ──────────────────────────────────────────────────────────────

export async function dbLoad(roomId: string): Promise<any | null> {
  if (!db) return null;
  try {
    const { data } = await db
      .from('rooms')
      .select('data')
      .eq('id', roomId)
      .maybeSingle();
    return data?.data ?? null;
  } catch { return null; }
}

export async function dbSave(id: string, name: string, data: any): Promise<void> {
  if (!db) return;
  try {
    await db.from('rooms').upsert({ id, name, data, updated_at: new Date().toISOString() });
  } catch {}
}

// ── All rooms ─────────────────────────────────────────────────────────────────

export async function dbLoadAll(): Promise<any[]> {
  if (!db) return [];
  try {
    const { data } = await db.from('rooms').select('data');
    return (data ?? []).map((r: any) => r.data).filter(Boolean);
  } catch { return []; }
}

export async function dbSaveAll(rows: Array<{ id: string; name: string; data: any }>): Promise<void> {
  if (!db) return;
  try {
    await db.from('rooms').upsert(
      rows.map(r => ({ ...r, updated_at: new Date().toISOString() }))
    );
  } catch {}
}
