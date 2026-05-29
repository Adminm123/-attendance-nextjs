// ─── Session Management ───────────────────────────────────────────────────────
// จัดการ session ผ่าน httpOnly Cookie
//
// httpOnly Cookie คืออะไร?
// → Browser เก็บไว้ให้อัตโนมัติ ส่งมาพร้อมทุก request
// → JavaScript ใน browser อ่านไม่ได้ → ปลอดภัยจาก XSS attack
// → ต่างจาก localStorage ที่ JS อ่านได้

import { cookies }     from 'next/headers'; // next/headers ใช้ได้ใน Server เท่านั้น
import { SessionUser } from './types';

const COOKIE_NAME = 'att_session';
const MAX_AGE     = 60 * 60 * 24 * 30; // 30 วัน (หน่วยเป็นวินาที)

// ─── บันทึก session ────────────────────────────────────────────────────────────
export async function setSession(user: SessionUser): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, JSON.stringify(user), {
    httpOnly: true,   // JS ใน browser อ่านไม่ได้
    secure:   process.env.NODE_ENV === 'production', // HTTPS เท่านั้นใน production
    maxAge:   MAX_AGE,
    path:     '/',
    sameSite: 'lax',  // ป้องกัน CSRF บางส่วน
  });
}

// ─── อ่าน session ─────────────────────────────────────────────────────────────
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookie      = cookieStore.get(COOKIE_NAME);
  if (!cookie) return null;
  try {
    return JSON.parse(cookie.value) as SessionUser;
  } catch {
    return null; // cookie เสียหาย → treat เหมือนไม่มี session
  }
}

// ─── ลบ session (logout) ──────────────────────────────────────────────────────
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
