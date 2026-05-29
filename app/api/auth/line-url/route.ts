// ─── API: สร้าง LINE Login URL ────────────────────────────────────────────────
// Frontend เรียก /api/auth/line-url → ได้ URL → redirect ไป LINE

import { NextResponse } from 'next/server';
import { getLineLoginUrl } from '@/lib/line';

export async function GET() {
  const url = getLineLoginUrl();
  return NextResponse.json({ url });
}
