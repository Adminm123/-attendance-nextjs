// ─── Next.js Configuration ────────────────────────────────────────────────────
// ตั้งค่าระดับ project เช่น domain ที่อนุญาต, redirect, headers

/** @type {import('next').NextConfig} */
const nextConfig = {
  // อนุญาตให้โหลดรูปจาก LINE CDN (รูป profile ของผู้ใช้)
  images: {
    domains: ['profile.line-scdn.net'],
  },
};

export default nextConfig;
