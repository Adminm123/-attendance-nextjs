'use client';

import { useState } from 'react';

const LINE_SVG = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.070 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
  </svg>
);

export default function LineLoginButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/line-url');
      const data = await res.json();
      if (data.url) {
        // On iOS PWA (WKWebView), window.location.href doesn't trigger LINE app.
        // Opening via _blank forces Safari which handles the LINE deep link properly.
        const isIOSPWA =
          /iphone|ipad|ipod/i.test(navigator.userAgent) &&
          window.matchMedia('(display-mode: standalone)').matches;
        if (isIOSPWA) {
          const a = document.createElement('a');
          a.href = data.url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => setLoading(false), 1500);
        } else {
          window.location.href = data.url;
        }
      } else {
        alert('ไม่สามารถเชื่อมต่อ LINE ได้ กรุณาลองใหม่');
        setLoading(false);
      }
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่');
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogin}
      disabled={loading}
      className={`btn w-full py-4 text-base font-semibold ${className ?? ''}`}
      style={{ background: '#06C755', color: '#fff', borderRadius: '16px', opacity: loading ? .75 : 1, transition: 'opacity .2s' }}
    >
      <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
        {loading
          ? <><span className="spinner-sm" style={{ borderTopColor:'#fff', borderColor:'rgba(255,255,255,.3)' }} />กำลังเชื่อมต่อ...</>
          : <>{LINE_SVG}เข้าสู่ระบบด้วย LINE</>
        }
      </span>
    </button>
  );
}
