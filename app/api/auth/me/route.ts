// ─── API: ดึงข้อมูล user ปัจจุบัน ────────────────────────────────────────────
// Frontend เรียก /api/auth/me เพื่อรู้ว่า login เป็นใครอยู่
// ใช้ใน Client Component ที่ต้องการรู้ session

import { NextResponse } from 'next/server';
import { getSession }   from '@/lib/session';

export async function GET() {
  const session = await getSession();
  // ถ้าไม่มี session → { user: null }
  // ถ้ามี session   → { user: { lineId, staffName, ... } }
  return NextResponse.json({ user: session });
}
