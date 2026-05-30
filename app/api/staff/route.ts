// ─── Staff API ─────────────────────────────────────────────────────────────────
// GET   /api/staff          → ดึงรายชื่อพนักงาน (filter ตาม ?status=Pending)
// POST  /api/staff          → Admin เพิ่มพนักงานใหม่
// PATCH /api/staff          → อัพเดทข้อมูล (ผูก LineID / บันทึก face)

import { NextRequest, NextResponse } from 'next/server';
import { adminDb }                   from '@/lib/firebase-admin';
import { getSession }                from '@/lib/session';

// ─── GET: ดึงรายชื่อพนักงาน ──────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status         = searchParams.get('status');          // 'Pending' | 'Active' | 'Inactive'
  const name           = searchParams.get('name');            // ค้นหาชื่อเฉพาะ
  const withDescriptors = searchParams.get('withDescriptors') === 'true'; // ส่ง descriptors กลับมาด้วย

  let query = adminDb.collection('staff') as FirebaseFirestore.Query;
  if (status) query = query.where('status', '==', status);
  if (name)   query = query.where('name',   '==', name);
  query = query.orderBy('name');

  const snap  = await query.get();
  const staff = snap.docs.map(doc => {
    const data = doc.data();
    return {
      id:             doc.id,
      name:           data.name,
      nickname:       data.nickname,
      lineId:         data.lineId,
      mainBranchId:   data.mainBranchId,
      status:         data.status,
      hasDescriptors: (data.descriptors?.length ?? 0) > 0,
      // ส่ง descriptors จริงเมื่อ withDescriptors=true (ใช้ตอนสแกนหน้า)
      ...(withDescriptors ? { descriptors: data.descriptors || [] } : {}),
      createdAt:      data.createdAt,
    };
  });

  return NextResponse.json({ staff });
}

// ─── POST: Admin เพิ่มพนักงานใหม่ ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, nickname, mainBranchId } = body;

  if (!name || !mainBranchId) {
    return NextResponse.json({ error: 'กรุณากรอกชื่อและสาขา' }, { status: 400 });
  }

  // ตรวจว่ามีชื่อนี้แล้วหรือยัง
  const existing = await adminDb.collection('staff').where('name', '==', name).get();
  if (!existing.empty) {
    return NextResponse.json({ error: 'มีชื่อนี้ในระบบแล้ว' }, { status: 409 });
  }

  // สร้าง document ใหม่ (Status = Pending = รอพนักงาน login LINE มาผูก)
  const ref = await adminDb.collection('staff').add({
    name,
    nickname:    nickname || '',
    lineId:      '',           // ว่าง รอผูก LINE
    mainBranchId,
    status:      'Pending',
    descriptors: [],           // ว่าง รอลงทะเบียนหน้า
    createdAt:   new Date(),
  });

  return NextResponse.json({ success: true, id: ref.id });
}

// ─── PATCH: อัพเดทข้อมูลพนักงาน ─────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { name, updates } = body;

  if (!name) {
    return NextResponse.json({ error: 'ไม่ระบุชื่อพนักงาน' }, { status: 400 });
  }

  // หา document ตามชื่อ
  const snap = await adminDb.collection('staff').where('name', '==', name).limit(1).get();
  if (snap.empty) {
    return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 });
  }

  // อัพเดทเฉพาะ field ที่ส่งมา
  await snap.docs[0].ref.update(updates);
  return NextResponse.json({ success: true });
}
