// ─── Home Page (หน้าเช็คอิน) ─────────────────────────────────────────────────
// นี่คือหน้าแรกที่พนักงานเห็นเมื่อเปิดแอป
// Server Component: ดึง session ฝั่ง server แล้วส่งข้อมูลให้ Client Component

import { redirect }    from 'next/navigation';
import { getSession }  from '@/lib/session';
import HomeClient      from './HomeClient';

// ─── Server Component ─────────────────────────────────────────────────────────
// ทำงานบน server → อ่าน cookie → ตรวจสอบ session
// ไม่มี 'use client' → นี่คือ Server Component
export default async function HomePage() {
  // อ่าน session จาก cookie (ทำได้บน server เท่านั้น)
  const session = await getSession();

  // ─── ยังไม่ได้ login → แสดงหน้า login ───────────────────────────────────────
  // ไม่ redirect เพราะต้องแสดงปุ่ม LINE Login
  if (!session) {
    return <HomeClient user={null} />;
  }

  // ─── Login แล้วแต่ยังไม่ผูก LINE กับชื่อพนักงาน ──────────────────────────────
  if (!session.isLinked) {
    redirect('/link'); // ไปหน้าเลือกชื่อพนักงาน
  }

  // ─── Login และผูกแล้ว → แสดงหน้าเช็คอิน ─────────────────────────────────────
  return <HomeClient user={session} />;
}
