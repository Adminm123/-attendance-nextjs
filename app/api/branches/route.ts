// ─── Branches API ─────────────────────────────────────────────────────────────
// GET  /api/branches      → ดึงรายการสาขาทั้งหมด
// POST /api/branches      → เพิ่ม/แก้ไขสาขา

import { NextRequest, NextResponse } from 'next/server';
import { adminDb }                   from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id) {
    const doc = await adminDb.collection('branches').doc(id).get();
    const branch = doc.exists ? { id: doc.id, ...doc.data() } : null;
    return NextResponse.json({ branches: branch ? [branch] : [], branch });
  }

  const snap     = await adminDb.collection('branches').orderBy('id').get();
  const branches = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ branches });
}

// เพิ่มหรือแก้ไขสาขา (ใช้ id เป็น key)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id, name, province, totalStaff, lat, lng, radius, openTime, closeTime, minStaff } = body;

  if (!id || !name) {
    return NextResponse.json({ error: 'กรุณาระบุ id และชื่อสาขา' }, { status: 400 });
  }

  // ใช้ id เป็น document id ใน Firestore
  await adminDb.collection('branches').doc(id).set({
    id, name, province: province || '',
    totalStaff: Number(totalStaff) || 0,
    lat: Number(lat) || 0,
    lng: Number(lng) || 0,
    radius: Number(radius) || 200,
    openTime:  openTime  || '09:00',
    closeTime: closeTime || '18:00',
    minStaff:  Number(minStaff) || 0,
    updatedAt: new Date(),
  }, { merge: true }); // merge: true = อัพเดทเฉพาะ field ที่ส่งมา

  return NextResponse.json({ success: true });
}
