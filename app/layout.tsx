// ─── Root Layout ──────────────────────────────────────────────────────────────
// ไฟล์นี้เป็น "กรอบ" ที่ครอบทุกหน้าในแอป
// เปรียบเหมือน <html> <body> ที่ใช้ร่วมกันทุกหน้า
// ถ้าแก้ที่นี่ → ทุกหน้าเปลี่ยนพร้อมกัน

import type { Metadata, Viewport } from 'next';
import './globals.css';
import PwaRegister from '@/components/PwaRegister';

// ─── Metadata = <title>, <meta> สำหรับ SEO และ PWA ─────────────────────────────
export const metadata: Metadata = {
  title:       'M Technologies · ระบบเช็คชื่อ',
  description: 'ระบบเช็คชื่อพนักงานด้วยใบหน้าและ LINE Login',
  manifest:    '/manifest.json',
  icons: {
    icon:  [
      { url: '/favicon.png',   type: 'image/png' },
      { url: '/icon-192.png',  type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png',  type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable:        true,
    statusBarStyle: 'default',
    title:          'M-Attendance',
  },
};

// Viewport แยกออกจาก metadata ใน Next.js 14+
export const viewport: Viewport = {
  width:            'device-width',
  initialScale:     1,
  maximumScale:     1,   // ป้องกัน zoom บน iOS (สำหรับ PWA)
  themeColor:       '#0a1d3f',
};

// ─── Root Layout Component ────────────────────────────────────────────────────
// children = เนื้อหาของแต่ละหน้า (page.tsx) จะถูกใส่ตรงนี้
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        {/* โหลด Google Fonts สำหรับภาษาไทย */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* face-api.js โหลดจาก CDN (library ตรวจจับใบหน้า) */}
        <script
          src="https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js"
          defer
        />
      </head>
      <body style={{ fontFamily: "'IBM Plex Sans Thai', 'IBM Plex Sans', system-ui, sans-serif" }}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
