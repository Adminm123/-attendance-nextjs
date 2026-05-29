// ─── Home Page (หน้าเช็คอิน) ─────────────────────────────────────────────────
// นี่คือหน้าแรกที่พนักงานเห็นเมื่อเปิดแอป
// Server Component: ดึง session ฝั่ง server แล้วส่งข้อมูลให้ Client Component

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

  // ─── Login และผูกแล้ว (หรือยังไม่ผูก) → ส่งให้ HomeClient จัดการ UI ──────────
  return <HomeClient user={session} />;
}
