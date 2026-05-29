import type { Metadata, Viewport } from 'next';
import './globals.css';
import PwaRegister    from '@/components/PwaRegister';
import NavBar         from '@/components/NavBar';
import InstallPrompt  from '@/components/InstallPrompt';

export const metadata: Metadata = {
  title:       'Attendance',
  description: 'ระบบเช็คชื่อพนักงาน M Technologies',
  manifest:    '/manifest.json',
  icons: {
    icon:  [
      { url: '/favicon.png',   type: 'image/png' },
      { url: '/icon-192.png',  type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png',  type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable:        true,
    statusBarStyle: 'default',
    title:          'Attendance',
  },
};

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor:   '#ffffff',   // status bar สีขาวตอนโหลด
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" style={{ background: '#fff' }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script
          src="https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js"
          defer
        />
      </head>
      <body style={{ fontFamily: "'IBM Plex Sans Thai', 'IBM Plex Sans', system-ui, sans-serif", background: '#fff' }}>
        {/* iOS PWA splash overlay — fades out once page hydrates */}
        <div id="ios-splash" style={{ position:'fixed', inset:0, background:'#fff', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, pointerEvents:'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" width={96} height={96} style={{ borderRadius:22 }} />
        </div>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var s=document.getElementById('ios-splash');if(s){s.style.transition='opacity .35s';setTimeout(function(){s.style.opacity='0';setTimeout(function(){s.remove()},400)},600)}})()` }} />
        <PwaRegister />
        <NavBar />
        <div className="dev-banner">DEVELOPED BY M. THATSANAPHONG</div>
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
