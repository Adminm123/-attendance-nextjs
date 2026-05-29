// ─── Firebase Admin SDK ───────────────────────────────────────────────────────
// ไฟล์นี้ใช้ฝั่ง Server เท่านั้น (API Routes)
// Admin SDK มีสิทธิ์เต็มใน Firestore ไม่ต้องผ่าน Security Rules
// ห้าม import ในไฟล์ที่มี 'use client' เด็ดขาด!

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore }                  from 'firebase-admin/firestore';

// initialize ครั้งเดียว ป้องกัน error "app already exists"
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      // Private key จาก .env.local จะมี \n เป็น literal string
      // ต้องแปลงเป็น newline จริงๆ ก่อนใช้
      privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

// export adminDb ไปใช้ใน API Routes
export const adminDb = getFirestore();
