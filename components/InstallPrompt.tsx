'use client';

import { useEffect, useState } from 'react';

export default function InstallPrompt() {
  const [prompt, setPrompt]   = useState<any>(null);   // Android Chrome beforeinstallprompt
  const [isIOS, setIsIOS]     = useState(false);
  const [shown, setShown]     = useState(false);
  const [dismissed, setDismiss] = useState(false);

  useEffect(() => {
    // ตรวจว่าติดตั้งแล้วหรือยัง (standalone = ติดตั้งแล้ว)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // iOS Safari
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/chrome/i.test(ua)) {
      setIsIOS(true);
      setShown(true);
      return;
    }

    // Android Chrome / Edge — รอ beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
      setShown(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setShown(false);
    setPrompt(null);
  };

  if (!shown || dismissed) return null;

  // ─── iOS: แสดงคำแนะนำ
  if (isIOS) return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999,
      background: '#fff', borderTop: '1px solid #e6e8ee',
      padding: '14px 18px 24px', boxShadow: '0 -4px 24px rgba(0,0,0,.12)',
    }}>
      <button onClick={() => setDismiss(true)} style={{
        position: 'absolute', top: 10, right: 14,
        background: 'none', border: 'none', fontSize: 18, color: '#aaa', cursor: 'pointer',
      }}>✕</button>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>ติดตั้งแอพ Attendance</div>
      <div style={{ fontSize: 13, color: '#555', lineHeight: 1.7 }}>
        กด <b style={{ background:'#f0f0f0', padding:'1px 6px', borderRadius:4 }}>Share</b> แล้วเลือก
        <b> "Add to Home Screen"</b> เพื่อติดตั้ง
      </div>
    </div>
  );

  // ─── Android/Chrome: ปุ่มติดตั้ง
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999,
      background: '#fff', borderTop: '1px solid #e6e8ee',
      padding: '14px 18px 24px', boxShadow: '0 -4px 24px rgba(0,0,0,.12)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" width={44} height={44} style={{ borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Attendance</div>
        <div style={{ fontSize: 12, color: '#777' }}>ติดตั้งเพื่อเปิดได้เหมือนแอพทั่วไป</div>
      </div>
      <button onClick={() => setDismiss(true)} style={{
        background: 'none', border: 'none', fontSize: 18, color: '#aaa', cursor: 'pointer', flexShrink: 0,
      }}>✕</button>
      <button onClick={handleInstall} style={{
        background: '#0a1d3f', color: '#fff', border: 'none', borderRadius: 10,
        padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0,
        fontFamily: 'inherit',
      }}>
        ติดตั้ง
      </button>
    </div>
  );
}
