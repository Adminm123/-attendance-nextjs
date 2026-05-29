// ─── Firebase Admin SDK ───────────────────────────────────────────────────────
// ไฟล์นี้ใช้ฝั่ง Server เท่านั้น (API Routes)
// Admin SDK มีสิทธิ์เต็มใน Firestore ไม่ต้องผ่าน Security Rules
// ห้าม import ในไฟล์ที่มี 'use client' เด็ดขาด!

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore }  from 'firebase-admin/firestore';

// Lazy init — รัน initialize เฉพาะตอน request จริง ไม่รันตอน build
function init(): Firestore {
  if (!getApps().length) {
    // วิธีที่ 1: ใช้ JSON ทั้งก้อน (น่าเชื่อถือที่สุด)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({ credential: cert(sa) });
    } else {
      // วิธีที่ 2: ใช้ fields แยก
      const raw = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '';
      const privateKey = raw.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
      initializeApp({
        credential: cert({
          projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
          privateKey,
        }),
      });
    }
  }
  return getFirestore();
}

// Proxy ทำให้ adminDb.collection(...) ทำงานได้เหมือนเดิม
// แต่ Firebase จะ initialize เฉพาะตอนที่มีการเรียกใช้จริง
export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
    return (init() as any)[prop];
  },
});
