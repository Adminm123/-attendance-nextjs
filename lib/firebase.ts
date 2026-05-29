// ─── Firebase Client SDK ──────────────────────────────────────────────────────
// ไฟล์นี้ใช้ฝั่ง Browser (Client Component เท่านั้น)
// ใช้สำหรับ query Firestore โดยตรงจาก browser

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore }                    from 'firebase/firestore';

// config มาจาก Firebase Console → Project Settings → Your apps → Web app
// ค่า NEXT_PUBLIC_ จะถูกฝังลงใน JavaScript ที่ส่งให้ browser ได้เห็น
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ป้องกัน initialize ซ้ำ เพราะ Next.js อาจ render component หลายครั้ง
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// export db ไปใช้ใน component ต่างๆ
export const db = getFirestore(app);
