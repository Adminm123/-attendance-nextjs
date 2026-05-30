// ─── Attendance API ────────────────────────────────────────────────────────────
// POST /api/attendance → บันทึกเช็คอิน หรือ เช็คเอาท์
// GET  /api/attendance → ดึงประวัติ

import { NextRequest, NextResponse } from 'next/server';
import { adminDb }                   from '@/lib/firebase-admin';
import { getSession }                from '@/lib/session';

// ─── POST: บันทึกเช็คอิน/เอาท์ ────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // ต้อง login แล้วและผูก LINE แล้วเท่านั้น
  const session = await getSession();
  if (!session?.isLinked) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 });
  }

  const body = await request.json();
  const { type, branchId, lat, lng, accuracy } = body;

  if (!type || !branchId) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
  }

  // ─── คำนวณวันที่และเวลา (GMT+7) ──────────────────────────────────────────────
  const now     = new Date();
  const options = { timeZone: 'Asia/Bangkok' };

  // รูปแบบ "09:30"
  const timeStr = now.toLocaleTimeString('th-TH', {
    ...options, hour12: false, hour: '2-digit', minute: '2-digit'
  });
  // รูปแบบ "2024-01-15"
  const dateStr = now.toLocaleDateString('sv-SE', options); // sv-SE ให้รูปแบบ YYYY-MM-DD

  // ─── ตรวจสอบว่าเช็คอิน/เอาท์ซ้ำไหม ──────────────────────────────────────────
  const todaySnap = await adminDb.collection('attendance')
    .where('name', '==', session.staffName)
    .where('date', '==', dateStr)
    .get();

  const todayRecords = todaySnap.docs.map(d => d.data());
  const hasIn  = todayRecords.some(r => r.type === 'IN');
  const hasOut = todayRecords.some(r => r.type === 'OUT');

  if (type === 'OUT' && !hasIn)  return NextResponse.json({ error: 'ยังไม่ได้เช็คอินวันนี้' },  { status: 400 });
  if (type === 'OUT' && hasOut)  return NextResponse.json({ error: 'เลิกงานไปแล้ววันนี้' },     { status: 400 });
  if (type === 'IN'  && hasIn)   return NextResponse.json({ error: 'เช็คอินไปแล้ววันนี้' },     { status: 400 });

  // ─── ดึงข้อมูลสาขาเพื่อคำนวณ late/early ─────────────────────────────────────
  const branchDoc = await adminDb.collection('branches').doc(branchId).get();
  const branch    = branchDoc.data();

  let status      = 'ทันเวลา';
  let lateMinutes = 0;

  if (type === 'IN' && branch?.openTime) {
    // คำนวณว่ามาสายกี่นาที
    const [cH, cM] = timeStr.split(':').map(Number);
    const [oH, oM] = branch.openTime.split(':').map(Number);
    const diff = (cH * 60 + cM) - (oH * 60 + oM);
    if (diff > 0) { status = 'สาย'; lateMinutes = diff; }
  }

  if (type === 'OUT' && branch?.closeTime) {
    // คำนวณว่าออกก่อนเวลากี่นาที
    const [cH, cM] = timeStr.split(':').map(Number);
    const [eH, eM] = branch.closeTime.split(':').map(Number);
    const diff = (eH * 60 + eM) - (cH * 60 + cM);
    if (diff > 0) { status = 'ออกก่อนเวลา'; lateMinutes = diff; }
  }

  // ─── บันทึกลง Firestore ───────────────────────────────────────────────────────
  await adminDb.collection('attendance').add({
    name:          session.staffName,
    nickname:      session.staffNickname,
    time:          timeStr,
    date:          dateStr,
    type,
    branchId,
    homeBranchId:  session.mainBranchId,
    isCrossBranch: branchId !== session.mainBranchId,
    lat:           lat      ?? 0,
    lng:           lng      ?? 0,
    status,
    lateMinutes,
    accuracy:      accuracy ?? -1,
    createdAt:     new Date(),
  });

  return NextResponse.json({ success: true, time: timeStr, status, lateMinutes });
}

// ─── GET: ดึงประวัติการเช็คอิน ────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const name = searchParams.get('name');

    let query = adminDb.collection('attendance') as FirebaseFirestore.Query;
    if (date) query = query.where('date', '==', date);
    if (name) query = query.where('name', '==', name);
    // ไม่ใช้ orderBy เพื่อหลีกเลี่ยง composite index — sort ใน memory แทน

    const snap    = await query.limit(200).get();
    const records = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() as any }))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

    return NextResponse.json({ records });
  } catch (e: any) {
    console.error('[GET /api/attendance]', e.message);
    return NextResponse.json({ records: [], error: e.message }, { status: 500 });
  }
}
