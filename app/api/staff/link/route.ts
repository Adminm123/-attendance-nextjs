// ─── API: ผูก LINE ID กับพนักงาน ─────────────────────────────────────────────
// เรียกหลังจากพนักงานสแกนหน้าผ่านในหน้า /link
// อัพเดท Firestore: lineId = LINE User ID จาก session, status = 'Active'

import { NextRequest, NextResponse } from 'next/server';
import { adminDb }                   from '@/lib/firebase-admin';
import { getSession, setSession }    from '@/lib/session';

export async function POST(request: NextRequest) {
  // ต้อง login LINE แล้ว (มี session) แต่ยังไม่ผูก (isLinked = false)
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'ไม่พบ session กรุณา Login LINE ใหม่' }, { status: 401 });
  }
  if (session.isLinked) {
    return NextResponse.json({ error: 'ผูกบัญชีไปแล้ว' }, { status: 400 });
  }

  const { staffName } = await request.json();
  if (!staffName) {
    return NextResponse.json({ error: 'ไม่ระบุชื่อพนักงาน' }, { status: 400 });
  }

  // ─── ตรวจสอบว่า LINE ID นี้ยังไม่ผูกกับใครอยู่ ──────────────────────────────
  const existingSnap = await adminDb.collection('staff')
    .where('lineId', '==', session.lineId)
    .get();
  if (!existingSnap.empty) {
    return NextResponse.json({ error: 'LINE ID นี้ผูกกับพนักงานคนอื่นแล้ว' }, { status: 409 });
  }

  // ─── หา document ของพนักงานที่เลือก ──────────────────────────────────────────
  const staffSnap = await adminDb.collection('staff')
    .where('name',   '==', staffName)
    .where('status', '==', 'Pending')  // ต้องเป็น Pending เท่านั้น (ยังไม่มีเจ้าของ)
    .limit(1)
    .get();

  if (staffSnap.empty) {
    return NextResponse.json({ error: 'ไม่พบพนักงานหรือถูกผูกแล้ว' }, { status: 404 });
  }

  const staffDoc  = staffSnap.docs[0];
  const staffData = staffDoc.data();

  // ─── อัพเดท Firestore ────────────────────────────────────────────────────────
  await staffDoc.ref.update({
    lineId: session.lineId,  // ผูก LINE ID
    status: 'Active',        // เปลี่ยนสถานะเป็น Active
  });

  // ─── อัพเดท session ให้ครบ ────────────────────────────────────────────────────
  await setSession({
    lineId:        session.lineId,
    staffName:     staffData.name,
    staffNickname: staffData.nickname || '',
    mainBranchId:  staffData.mainBranchId,
    isLinked:      true,
  });

  return NextResponse.json({ success: true });
}
