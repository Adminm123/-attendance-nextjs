// ─── API: ดึงข้อมูลพนักงานของตัวเอง (ใช้ lineId จาก session) ──────────────────
// GET /api/staff/me → ส่งคืน { staff } สำหรับ user ที่ login อยู่
// ใช้ lineId แทน name เพื่อหลีกเลี่ยงปัญหา encoding

import { NextResponse }  from 'next/server';
import { adminDb }       from '@/lib/firebase-admin';
import { getSession }    from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session?.isLinked || !session.lineId) {
    return NextResponse.json({ staff: null }, { status: 401 });
  }

  const snap = await adminDb.collection('staff')
    .where('lineId', '==', session.lineId)
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json({ staff: null }, { status: 404 });
  }

  const doc  = snap.docs[0];
  const data = doc.data();

  return NextResponse.json({
    staff: {
      id:             doc.id,
      name:           data.name,
      nickname:       data.nickname,
      lineId:         data.lineId,
      mainBranchId:   data.mainBranchId,
      status:         data.status,
      descriptors:    (data.descriptors || []).map((d: any) => d.v ?? d),
      hasDescriptors: (data.descriptors?.length ?? 0) > 0,
    },
  });
}
