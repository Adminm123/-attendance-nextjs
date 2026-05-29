// ─── Dashboard API ─────────────────────────────────────────────────────────────
// GET /api/dashboard → ข้อมูลสรุปรายสาขาสำหรับ Office Dashboard

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminDb }      from '@/lib/firebase-admin';

export async function GET() {
  // วันนี้ (Bangkok time)
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });

  // ─── ดึงข้อมูลพร้อมกัน (parallel) ────────────────────────────────────────────
  const [branchSnap, staffSnap, attSnap] = await Promise.all([
    adminDb.collection('branches').orderBy('id').get(),
    adminDb.collection('staff').where('status', '==', 'Active').get(),
    adminDb.collection('attendance').where('date', '==', today).get(),
  ]);

  const branches   = branchSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const allStaff   = staffSnap.docs.map(d => d.data()) as any[];
  const todayAtt   = attSnap.docs.map(d => d.data()) as any[];

  // ─── หาคนที่เช็คอินวันนี้ ─────────────────────────────────────────────────────
  // เก็บเฉพาะ IN record ล่าสุดของแต่ละคน
  const latestIn: Record<string, any> = {};
  todayAtt
    .filter(r => r.type === 'IN')
    .forEach(r => {
      if (!latestIn[r.name] || r.time > latestIn[r.name].time) {
        latestIn[r.name] = r;
      }
    });

  // ─── สร้างข้อมูล dashboard แยกตามสาขา ───────────────────────────────────────
  const dashboard = branches.map((branch: any) => {
    const bId = branch.id;

    // พนักงานประจำสาขานี้
    const homeStaff = allStaff.filter(s => s.mainBranchId === bId);

    // คนที่เช็คอินที่สาขานี้วันนี้
    const presentHere = Object.values(latestIn).filter(r => r.branchId === bId);

    // คนที่ไปช่วยสาขาอื่น (บ้านอยู่สาขานี้ แต่เช็คอินที่อื่น)
    const crossBranch = homeStaff.filter(s =>
      latestIn[s.name] && latestIn[s.name].branchId !== bId
    );

    // คนที่ยังไม่มา (บ้านอยู่สาขานี้ และยังไม่เช็คอินที่ไหนเลย)
    const missing = homeStaff.filter(s => !latestIn[s.name]);

    const actual  = presentHere.length;
    const total   = homeStaff.length;
    const minStaff = branch.minStaff || total;

    // สีสถานะ: green=ครบ, yellow=ถึงขั้นต่ำ, red=ต่ำกว่าขั้นต่ำ
    let colorStatus = 'red';
    if      (actual >= total)    colorStatus = 'green';
    else if (actual >= minStaff) colorStatus = 'yellow';

    return {
      id:          bId,
      name:        branch.name,
      province:    branch.province,
      total,
      actual,
      minStaff,
      colorStatus,
      openTime:    branch.openTime,
      closeTime:   branch.closeTime,
      present:     presentHere.map(r => ({ name: r.name, nickname: r.nickname, time: r.time, isCross: r.isCrossBranch })),
      crossBranch: crossBranch.map(s => ({ name: s.name, nickname: s.nickname })),
      missing:     missing.map(s => ({ name: s.name, nickname: s.nickname })),
    };
  });

  return NextResponse.json({ success: true, dashboard, date: today });
}
