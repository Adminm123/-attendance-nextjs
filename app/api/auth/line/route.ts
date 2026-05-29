// ─── LINE OAuth Callback ───────────────────────────────────────────────────────
// LINE จะ redirect กลับมาที่ URL นี้พร้อม ?code=xxx หลัง login สำเร็จ
// Flow:
//   1. รับ code จาก LINE
//   2. แลก code → access token
//   3. ดึง LINE profile (userId)
//   4. ค้น Firestore ว่า userId นี้ผูกกับพนักงานคนไหน
//   5. สร้าง session → redirect ไปหน้าที่ถูกต้อง

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, getLineProfile } from '@/lib/line';
import { adminDb }                              from '@/lib/firebase-admin';
import { setSession }                           from '@/lib/session';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get('code');
  const error = searchParams.get('error'); // เมื่อผู้ใช้กด "Cancel" ใน LINE

  // ─── กรณีที่ LINE ส่ง error กลับมา ────────────────────────────────────────────
  if (error || !code) {
    return NextResponse.redirect(new URL('/?error=cancelled', request.url));
  }

  try {
    // ─── Step 1: แลก code → access token ────────────────────────────────────────
    const accessToken = await exchangeCodeForToken(code);

    // ─── Step 2: ดึง LINE profile ────────────────────────────────────────────────
    const profile = await getLineProfile(accessToken);
    const lineId  = profile.userId; // LINE User ID เช่น "U1a2b3c4d..."

    // ─── Step 3: ค้นหาพนักงานที่ผูก LINE ID นี้ไว้ ──────────────────────────────
    const staffSnap = await adminDb
      .collection('staff')
      .where('lineId', '==', lineId)
      .where('status', '==', 'Active')
      .limit(1)
      .get();

    if (!staffSnap.empty) {
      // ✅ เคยผูกแล้ว → บันทึก session → ไปหน้าแรก (เช็คอิน)
      const staff = staffSnap.docs[0].data();
      await setSession({
        lineId,
        staffName:     staff.name,
        staffNickname: staff.nickname || '',
        mainBranchId:  staff.mainBranchId,
        isLinked:      true,
      });
      return NextResponse.redirect(new URL('/', request.url));
    }

    // ❌ ยังไม่เคยผูก → บันทึก session ชั่วคราว → ไปหน้าผูกบัญชี
    await setSession({
      lineId,
      staffName:     '',
      staffNickname: '',
      mainBranchId:  '',
      isLinked:      false,
    });
    return NextResponse.redirect(new URL('/link', request.url));

  } catch {
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }
}
