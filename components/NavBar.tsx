'use client';

import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/',       label: 'เช็คชื่อ' },
  { href: '/office', label: 'ออฟฟิศ'  },
];

export default function NavBar() {
  const path = usePathname();
  const isSpecial = path === '/register' || path === '/link';

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 200,
      background: 'var(--navy-900)',
      display: 'flex', alignItems: 'center',
      padding: '0 16px', height: 50,
      borderBottom: '1px solid rgba(255,255,255,.08)',
      gap: 12,
    }}>
      <a href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none', marginRight:'auto' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="Attendance" width={28} height={28} style={{ borderRadius: 7, objectFit:'cover' }} />
        <span style={{ color:'#fff', fontWeight:700, fontSize:15, letterSpacing:'.01em' }}>Attendance</span>
      </a>

      {isSpecial ? (
        <a href="/" style={{ color:'rgba(255,255,255,.55)', fontSize:12, fontWeight:600, textDecoration:'none', padding:'5px 10px', borderRadius:7, border:'1px solid rgba(255,255,255,.15)' }}>
          ← กลับ
        </a>
      ) : (
        <div style={{ display:'flex', gap:3 }}>
          {LINKS.map(l => {
            const active = path === l.href;
            return (
              <a key={l.href} href={l.href} style={{
                padding: '6px 11px', borderRadius: 8,
                fontSize: 12, fontWeight: 600, textDecoration: 'none',
                background: active ? 'rgba(255,255,255,.14)' : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,.5)',
                transition: 'all .15s',
              }}>
                {l.label}
              </a>
            );
          })}
        </div>
      )}
    </nav>
  );
}
