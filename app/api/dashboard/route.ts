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
// ใช้ Map กรองสาขาที่มี id ซ้ำกันก่อนเริ่มประมวลผล
const uniqueBranches = Array.from(
  new Map(branches.map(branch => [branch.id, branch])).values()
);

const dashboard = uniqueBranches.map((branch: any) => {
  const bId = branch.id;

  // ... (ส่วนการคำนวณที่เหลือเหมือนเดิม) ...
  const homeStaff = allStaff.filter(s => s.mainBranchId === bId);
  const presentHere = Object.values(latestIn).filter(r => r.branchId === bId);
  const crossBranch = homeStaff.filter(s =>
    latestIn[s.name] && latestIn[s.name].branchId !== bId
  );
  const missing = homeStaff.filter(s => !latestIn[s.name]);

  const actual  = presentHere.length;
  const total   = homeStaff.length;
  const minStaff = branch.minStaff || total;

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
