// ─── API: ดึงและบันทึก Face Descriptors ────────────────────────────────────────
// GET  /api/staff/descriptors?name=xxx → ดึง descriptors สำหรับสแกนหน้า
// POST /api/staff/descriptors          → บันทึก descriptors หลังลงทะเบียนหน้า

import { NextRequest, NextResponse } from 'next/server';
import { adminDb }                   from '@/lib/firebase-admin';
import { getSession }                from '@/lib/session';

// ดึง descriptors (ใช้ตอนสแกนหน้า 1:1)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  if (!name) return NextResponse.json({ error: 'ไม่ระบุชื่อ' }, { status: 400 });

  const snap = await adminDb.collection('staff').where('name', '==', name).limit(1).get();
  if (snap.empty) return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 });

  const data = snap.docs[0].data();
  // ส่งเฉพาะ descriptors (ไม่ส่ง lineId หรือข้อมูลส่วนตัวอื่น)
  return NextResponse.json({ descriptors: data.descriptors || [] });
}

// บันทึก descriptors หลังลงทะเบียนหน้า
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.isLinked) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 });
  }

  const { descriptors } = await request.json();
  if (!descriptors?.length) {
    return NextResponse.json({ error: 'ไม่มีข้อมูลใบหน้า' }, { status: 400 });
  }

  // บันทึก descriptors ลง Firestore (เฉพาะพนักงานของตัวเอง)
  const snap = await adminDb.collection('staff')
    .where('name', '==', session.staffName)
    .limit(1)
    .get();
  if (snap.empty) return NextResponse.json({ error: 'ไม่พบข้อมูลพนักงาน' }, { status: 404 });

  await snap.docs[0].ref.update({ descriptors });
  return NextResponse.json({ success: true });
}
