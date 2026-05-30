// ─── API: ดึงและบันทึก Face Descriptors ────────────────────────────────────────
// GET  /api/staff/descriptors?name=xxx → ดึง descriptors สำหรับสแกนหน้า
// POST /api/staff/descriptors          → บันทึก descriptors หลังลงทะเบียนหน้า

import { NextRequest, NextResponse }              from 'next/server';
import { adminDb }                                from '@/lib/firebase-admin';
import { getSession }                             from '@/lib/session';
import { serializeDescriptors, parseDescriptors } from '@/lib/descriptors';

// ดึง descriptors (ใช้ตอนสแกนหน้า 1:1)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  if (!name) return NextResponse.json({ error: 'ไม่ระบุชื่อ' }, { status: 400 });

  const snap = await adminDb.collection('staff').where('name', '==', name).limit(1).get();
  if (snap.empty) return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 });

  const data = snap.docs[0].data();
  const descriptors = parseDescriptors(data.descriptors);
  return NextResponse.json({ descriptors });
}

// บันทึก descriptors หลังลงทะเบียนหน้า
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.isLinked) {
      return NextResponse.json({ error: 'กรุณาผูก LINE ก่อน (session ไม่มี isLinked)' }, { status: 401 });
    }
    if (!session.staffName) {
      return NextResponse.json({ error: 'ไม่พบชื่อพนักงานใน session' }, { status: 401 });
    }

    const { descriptors } = await request.json();
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

    const serialized = serializeDescriptors(descriptors);
    console.log('[descriptors POST v4] type:', typeof serialized, 'count:', descriptors.length);
    await snap.docs[0].ref.update({ descriptors: serialized });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[POST /api/staff/descriptors]', e);
    return NextResponse.json({ error: e.message || 'เกิดข้อผิดพลาดภายใน' }, { status: 500 });
  }
}
