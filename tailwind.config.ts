// ─── Tailwind CSS Configuration ───────────────────────────────────────────────
// เพิ่มสีที่ใช้ในโปรเจคเข้าไปใน Tailwind

import type { Config } from 'tailwindcss';

const config: Config = {
  // บอก Tailwind ให้สแกนหาคลาสใน files เหล่านี้
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // สีที่ใช้ในระบบ (navy + red theme)
      colors: {
        navy: {
          950: '#050d1f',
          900: '#0a1d3f',  // สีหลัก (appbar, header)
          800: '#102a52',
          700: '#1a3563',
          600: '#2a4a7a',
          500: '#4a6896',
          100: '#e6ecf5',
          50:  '#f1f4fa',
        },
        brand: {
          red:    '#cc0000',  // สีแดงสำหรับ accent
          red700: '#a30000',
          red50:  '#fef2f2',
        },
      },
      fontFamily: {
        // ฟอนต์หลักรองรับภาษาไทย
        sans: ['IBM Plex Sans Thai', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
