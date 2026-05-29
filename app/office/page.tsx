'use client';
// ─── Office Dashboard ─────────────────────────────────────────────────────────
// แสดงสถานะรายสาขาแบบ real-time
// office login ด้วย password (ไม่ใช่ LINE)

import { useState, useEffect } from 'react';
import { useToast, ToastContainer } from '@/components/Toast';

type View = 'login' | 'dashboard';

interface BranchSummary {
  id:          string;
  name:        string;
  province:    string;
  total:       number;
  actual:      number;
  colorStatus: 'green' | 'yellow' | 'red';
  openTime:    string;
  present:     { name: string; nickname: string; time: string }[];
  missing:     { name: string; nickname: string }[];
  crossBranch: { name: string; nickname: string }[];
}

export default function OfficePage() {
  const { toasts, toast }   = useToast();
  const [view, setView]     = useState<View>('login');
  const [password, setPwd]  = useState('');
  const [loading, setLoad]  = useState(false);
  const [dashboard, setDash]= useState<BranchSummary[]>([]);
  const [lastUpdate, setUpd]= useState('');
  const [expanded, setExp]  = useState<string | null>(null); // สาขาที่กดดูรายละเอียด

  // ─── Login ด้วย password ──────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoad(true);
    try {
      const res  = await fetch('/api/auth/office', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        setView('dashboard');
        loadDashboard();
      } else {
        toast('รหัสผ่านไม่ถูกต้อง', 'error');
      }
    } finally {
      setLoad(false);
    }
  };

  // ─── โหลดข้อมูล Dashboard ─────────────────────────────────────────────────────
  const loadDashboard = async () => {
    try {
      const res  = await fetch('/api/dashboard');
      const data = await res.json();
      setDash(data.dashboard || []);
      setUpd(new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false }));
    } catch {
      toast('โหลดข้อมูลไม่สำเร็จ', 'error');
    }
  };

  // Auto-refresh ทุก 60 วินาที
  useEffect(() => {
    if (view !== 'dashboard') return;
    const id = setInterval(loadDashboard, 60000);
    return () => clearInterval(id);
  }, [view]);

  // สีของ badge สถานะสาขา
  const statusColor = { green: 'var(--success)', yellow: 'var(--warn)', red: 'var(--red)' };
  const statusLabel = { green: 'ครบ', yellow: 'ขั้นต่ำ', red: 'ขาด' };

  return (
    <>
      <header style={{ background: 'var(--navy-900)', padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase' }}>OFFICE</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>Dashboard สำนักงาน</div>
        </div>
        {view === 'dashboard' && (
          <button onClick={loadDashboard} style={{ color: 'rgba(255,255,255,.6)', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer' }}>
            🔄 {lastUpdate && `อัพเดท ${lastUpdate}`}
          </button>
        )}
      </header>

      <div className="shell" style={{ paddingTop: '20px' }}>

        {/* ─── Login Form ──────────────────────────────────────────────────── */}
        {view === 'login' && (
          <div className="card" style={{ marginTop: '40px' }}>
            <div style={{ fontWeight: 600, fontSize: '18px', marginBottom: '16px', textAlign: 'center' }}>
              เข้าสู่ระบบ Office
            </div>
            <input
              type="password"
              placeholder="รหัสผ่าน"
              value={password}
              onChange={e => setPwd(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--line)', fontSize: '15px', marginBottom: '12px', outline: 'none' }}
            />
            <button onClick={handleLogin} disabled={loading} className="btn btn-primary w-full py-4">
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </div>
        )}

        {/* ─── Dashboard ──────────────────────────────────────────────────── */}
        {view === 'dashboard' && (
          <>
            {/* สรุปภาพรวม */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              {[
                { label: 'สาขาครบ',     val: dashboard.filter(b => b.colorStatus === 'green').length,  color: 'var(--success)' },
                { label: 'สาขาขาด',     val: dashboard.filter(b => b.colorStatus === 'red').length,    color: 'var(--red)' },
                { label: 'เข้างานแล้ว', val: dashboard.reduce((s, b) => s + b.actual, 0),              color: 'var(--navy-900)' },
              ].map(stat => (
                <div key={stat.label} className="card" style={{ textAlign: 'center', padding: '14px 8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: stat.color }}>{stat.val}</div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* รายการสาขา */}
            {dashboard.map(branch => (
              <div key={branch.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Header สาขา */}
                <button
                  onClick={() => setExp(expanded === branch.id ? null : branch.id)}
                  style={{
                    width: '100%', padding: '16px', display: 'flex',
                    alignItems: 'center', gap: '12px', background: 'none',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {/* Dot สถานะ */}
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: statusColor[branch.colorStatus], flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{branch.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{branch.province} · {branch.openTime}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '18px', color: statusColor[branch.colorStatus] }}>
                      {branch.actual}/{branch.total}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{statusLabel[branch.colorStatus]}</div>
                  </div>
                  <div style={{ color: 'var(--muted)' }}>{expanded === branch.id ? '▲' : '▼'}</div>
                </button>

                {/* รายละเอียด (expand) */}
                {expanded === branch.id && (
                  <div style={{ borderTop: '1px solid var(--line)', padding: '12px 16px' }}>
                    {/* คนที่เข้างานแล้ว */}
                    {branch.present.length > 0 && (
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
                          เข้างานแล้ว ({branch.present.length})
                        </div>
                        {branch.present.map(p => (
                          <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line-2)', fontSize: '13px' }}>
                            <span>{p.nickname ? `(${p.nickname}) ` : ''}{p.name}</span>
                            <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{p.time} น.</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* คนที่ยังไม่มา */}
                    {branch.missing.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--red)', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
                          ยังไม่มา ({branch.missing.length})
                        </div>
                        {branch.missing.map(m => (
                          <div key={m.name} style={{ padding: '6px 0', borderBottom: '1px solid var(--line-2)', fontSize: '13px', color: 'var(--ink-soft)' }}>
                            {m.nickname ? `(${m.nickname}) ` : ''}{m.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      <ToastContainer toasts={toasts} />
    </>
  );
}
