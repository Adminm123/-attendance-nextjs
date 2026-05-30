// ─── API: ดึงและบันทึก Face Descriptors ────────────────────────────────────────
// GET  /api/staff/descriptors?name=xxx → ดึง descriptors สำหรับสแกนหน้า
// POST /api/staff/descriptors          → บันทึก descriptors หลังลงทะเบียนหน้า

import { NextRequest, NextResponse } from 'next/server';
import { adminDb }                   from '@/lib/firebase-admin';
import { getSession }                from '@/lib/session';

// ─── helpers (inline เพื่อหลีกเลี่ยงปัญหา import) ─────────────────────────────
function toFirestore(descs: any[]): string {
  // เก็บเป็น JSON string ธรรมดา — ไม่มีทางเป็น nested array ได้
  const plain = descs.map(d =>
    Array.isArray(d) ? d.map(Number)
    : d?.v            ? (d.v as number[]).map(Number)
    : typeof d === 'string' ? d.split(',').map(Number)
    : []
  );
  return JSON.stringify(plain);
}

function fromFirestore(raw: any): number[][] {
  try {
    if (typeof raw === 'string') return JSON.parse(raw) as number[][];
    if (!Array.isArray(raw) || raw.length === 0) return [];
    if (typeof raw[0] === 'number') {
      const out: number[][] = [];
      for (let i = 0; i + 128 <= raw.length; i += 128) out.push(raw.slice(i, i + 128));
      return out;
    }
    if (typeof raw[0] === 'string') return raw.map((s: string) => s.split(',').map(Number));
    if (raw[0]?.v) return raw.map((d: any) => d.v as number[]);
    return raw as number[][];
  } catch { return []; }
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  if (!name) return NextResponse.json({ error: 'ไม่ระบุชื่อ' }, { status: 400 });

  const snap = await adminDb.collection('staff').where('name', '==', name).limit(1).get();
  if (snap.empty) return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 });

  const data = snap.docs[0].data();
  return NextResponse.json({ descriptors: fromFirestore(data.descriptors) });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.isLinked) {
      return NextResponse.json({ error: 'กรุณาผูก LINE ก่อน' }, { status: 401 });
    }

    const body = await request.json();
    const descriptors: any[] = body.descriptors;
    if (!Array.isArray(descriptors) || descriptors.length === 0) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลใบหน้า' }, { status: 400 });
    }

    const snap = await adminDb.collection('staff')
      .where('lineId', '==', session.lineId)
      .limit(1)
      .get();
    if (snap.empty) {
      return NextResponse.json({ error: `ไม่พบพนักงาน (lineId: ${session.lineId})` }, { status: 404 });
    }

    const value = toFirestore(descriptors);
    // value คือ string เช่น "[[0.12,0.34,...],[...],...]"
    console.log('[descriptors v5] typeof value:', typeof value, 'chars:', value.length);
    await snap.docs[0].ref.update({ descriptors: value });
    return NextResponse.json({ success: true });

  } catch (e: any) {
    console.error('[descriptors v5 ERROR]', e);
    return NextResponse.json({ error: e.message || 'เกิดข้อผิดพลาดภายใน' }, { status: 500 });
  }
}
