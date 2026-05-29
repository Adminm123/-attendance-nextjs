'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast, ToastContainer } from '@/components/Toast';

type Tab = 'dashboard' | 'absent' | 'late' | 'logs' | 'summary';

interface BranchSummary {
  id: string; name: string; province: string;
  total: number; actual: number; colorStatus: 'green' | 'yellow' | 'red';
  openTime: string;
  present:     { name: string; nickname: string; time: string; isCross?: boolean }[];
  missing:     { name: string; nickname: string }[];
  crossBranch: { name: string; nickname: string }[];
}

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });

export default function OfficePage() {
  const { toasts, toast } = useToast();

  const [authed,   setAuthed]   = useState(false);
  const [password, setPwd]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [tab,      setTab]      = useState<Tab>('dashboard');
  const [sideOpen, setSide]     = useState(false);
  const [lastUpd,  setLastUpd]  = useState('');

  // Dashboard
  const [dashboard,  setDash]   = useState<BranchSummary[]>([]);
  const [expanded,   setExp]    = useState<string | null>(null);

  // Report state
  const [reportDate,    setRDate]  = useState(today());
  const [absentList,    setAbsent] = useState<any[]>([]);
  const [lateList,      setLate]   = useState<any[]>([]);
  const [logsList,      setLogs]   = useState<any[]>([]);
  const [summaryData,   setSumm]   = useState<{ summary: any[]; dates: string[]; from: string; to: string } | null>(null);
  const [summFrom,      setSfrom]  = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
  });
  const [summTo, setSto] = useState(today());
  const [reportLoading, setRLoad] = useState(false);

  // ─── Login ────────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/office', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const data = await res.json();
      if (data.success) {
        setAuthed(true);
        loadDashboard();
      } else {
        toast('รหัสผ่านไม่ถูกต้อง', 'error');
      }
    } finally { setLoading(false); }
  };

  // ─── Dashboard ────────────────────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    try {
      const res  = await fetch('/api/dashboard');
      const data = await res.json();
      setDash(data.dashboard || []);
      setLastUpd(new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false }));
    } catch { toast('โหลด dashboard ไม่สำเร็จ', 'error'); }
  }, []);

  useEffect(() => {
    if (!authed) return;
    const id = setInterval(loadDashboard, 60000);
    return () => clearInterval(id);
  }, [authed, loadDashboard]);

  // ─── Reports ──────────────────────────────────────────────────────────────────
  const loadReport = useCallback(async (t: Tab, date?: string) => {
    if (t === 'dashboard') { loadDashboard(); return; }
    setRLoad(true);
    try {
      if (t === 'absent') {
        const res  = await fetch(`/api/reports?type=absent&date=${date || reportDate}`);
        const data = await res.json();
        setAbsent(data.absent || []);
      } else if (t === 'late') {
        const res  = await fetch(`/api/reports?type=late&date=${date || reportDate}`);
        const data = await res.json();
        setLate(data.records || []);
      } else if (t === 'logs') {
        const res  = await fetch(`/api/reports?type=logs&date=${date || reportDate}`);
        const data = await res.json();
        setLogs(data.records || []);
      } else if (t === 'summary') {
        const res  = await fetch(`/api/reports?type=summary&from=${summFrom}&to=${summTo}`);
        const data = await res.json();
        setSumm(data);
      }
    } catch { toast('โหลดข้อมูลไม่สำเร็จ', 'error'); }
    finally { setRLoad(false); }
  }, [reportDate, summFrom, summTo, loadDashboard]);

  // Auto-load when tab changes
  useEffect(() => {
    if (authed) loadReport(tab);
  }, [tab, authed]);

  const switchTab = (t: Tab) => { setTab(t); setSide(false); };

  // ─── KPI ─────────────────────────────────────────────────────────────────────
  const totalPresent = dashboard.reduce((s, b) => s + b.actual, 0);
  const branchGreen  = dashboard.filter(b => b.colorStatus === 'green').length;
  const branchRed    = dashboard.filter(b => b.colorStatus === 'red').length;
  const totalAbsent  = dashboard.reduce((s, b) => s + b.missing.length, 0);
  const totalCross   = dashboard.reduce((s, b) => s + b.crossBranch.length, 0);

  const statusColor = { green: 'var(--success)', yellow: 'var(--warn)', red: 'var(--red)' };
  const statusLabel = { green: 'ครบ', yellow: 'ขั้นต่ำ', red: 'ขาด' };

  // ─── Sidebar Nav items ────────────────────────────────────────────────────────
  const navItems: { key: Tab; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'ภาพรวม',   icon: '◉' },
    { key: 'absent',    label: 'ขาดงาน',   icon: '✕' },
    { key: 'late',      label: 'มาสาย',    icon: '⏱' },
    { key: 'logs',      label: 'บันทึก',   icon: '≡' },
    { key: 'summary',   label: 'สรุปราย',  icon: '⊞' },
  ];

  if (!authed) return (
    <>
      <header style={{ background: 'var(--navy-900)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase' }}>OFFICE</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Dashboard สำนักงาน</div>
        </div>
        <a href="/" style={{ color: 'rgba(255,255,255,.5)', fontSize: 11, fontWeight: 600, textDecoration: 'none', padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,.15)' }}>← Home</a>
      </header>
      <div className="shell" style={{ paddingTop: 20 }}>
        <div className="card" style={{ marginTop: 40, padding: '32px 24px' }}>
          <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 20, textAlign: 'center' }}>เข้าสู่ระบบ Office</div>
          <input
            type="password" placeholder="รหัสผ่าน" value={password}
            onChange={e => setPwd(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="inp" style={{ marginBottom: 12 }}
          />
          <button onClick={handleLogin} disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: 16 }}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="office-shell">
      {/* Overlay (mobile) */}
      {sideOpen && <div className="office-overlay" onClick={() => setSide(false)} />}

      {/* ─── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className={`office-side${sideOpen ? ' open' : ''}`}>
        {/* Brand */}
        <div style={{ padding: '22px 22px 16px', display: 'flex', alignItems: 'center', gap: 11, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: 'var(--navy-900)', fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>AT</span>
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase', lineHeight: 1.2 }}>Attendance</div>
            <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 2, lineHeight: 1.2 }}>Office Console</div>
          </div>
        </div>

        {/* Nav */}
        <div className="side-section">
          <div className="side-eyebrow">รายงาน</div>
        </div>
        <nav className="side-nav">
          {navItems.map(item => (
            <button key={item.key} onClick={() => switchTab(item.key)} className={`side-nav-btn${tab === item.key ? ' active' : ''}`}>
              <span style={{ fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="side-foot">
          <div style={{ marginBottom: 6 }}>
            <strong style={{ color: 'rgba(255,255,255,.65)' }}>อัพเดทล่าสุด</strong>
          </div>
          <div>{lastUpd || '—'} น.</div>
          <div style={{ marginTop: 8 }}>
            <button onClick={() => { loadDashboard(); loadReport(tab); }} style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', background: 'none', border: '1px solid rgba(255,255,255,.15)', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
              🔄 รีเฟรช
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main Content ──────────────────────────────────────────────────────── */}
      <main className="office-main">
        {/* Topbar */}
        <div className="office-topbar">
          {/* Hamburger (mobile) */}
          <button onClick={() => setSide(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 9, border: '1px solid var(--line)', background: 'none', cursor: 'pointer', marginRight: 14, flexShrink: 0 }}>
            ☰
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' })}
            </div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
              {navItems.find(n => n.key === tab)?.label || 'Dashboard'}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href="/" style={{ fontSize: 11, color: 'var(--muted)', textDecoration: 'none', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line)', fontWeight: 600 }}>← Home</a>
            <button onClick={() => { loadDashboard(); loadReport(tab); }} style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: '1px solid var(--line)', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              🔄
            </button>
          </div>
        </div>

        <div className="office-content">

          {/* ─── Dashboard Tab ────────────────────────────────────────────────── */}
          {tab === 'dashboard' && (
            <>
              {/* KPI strip */}
              <div className="kpi-grid" style={{ marginBottom: 24 }}>
                {[
                  { lbl: 'เข้างานแล้ว',  num: totalPresent, cls: '' },
                  { lbl: 'ขาดงาน',        num: totalAbsent,  cls: totalAbsent  > 0 ? 'acc-red'  : '' },
                  { lbl: 'สาขาครบ',       num: branchGreen,  cls: 'acc-green' },
                  { lbl: 'สาขาขาด',       num: branchRed,    cls: branchRed    > 0 ? 'acc-red'  : '' },
                  { lbl: 'ช่วยสาขาอื่น', num: totalCross,   cls: totalCross   > 0 ? 'acc-warn' : '' },
                ].map(k => (
                  <div key={k.lbl} className={`kpi ${k.cls}`}>
                    <div className="lbl">{k.lbl}</div>
                    <div className="num count-num">{k.num}</div>
                  </div>
                ))}
              </div>

              {/* Branch cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                {dashboard.map(branch => (
                  <div key={branch.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <button
                      onClick={() => setExp(expanded === branch.id ? null : branch.id)}
                      style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: statusColor[branch.colorStatus], flexShrink: 0, boxShadow: `0 0 6px ${statusColor[branch.colorStatus]}` }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{branch.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{branch.province} · {branch.openTime}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: 20, color: statusColor[branch.colorStatus] }}>{branch.actual}/{branch.total}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{statusLabel[branch.colorStatus]}</div>
                      </div>
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>{expanded === branch.id ? '▲' : '▼'}</span>
                    </button>

                    {expanded === branch.id && (
                      <div style={{ borderTop: '1px solid var(--line)', padding: '12px 20px' }}>
                        {branch.present.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div className="eyebrow" style={{ color: 'var(--success)', marginBottom: 6 }}>เข้างานแล้ว ({branch.present.length})</div>
                            {branch.present.map(p => (
                              <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line-2)', fontSize: 13 }}>
                                <span>
                                  {p.nickname ? `(${p.nickname}) ` : ''}{p.name}
                                  {p.isCross && <span className="chip chip-warn" style={{ marginLeft: 6, fontSize: 9 }}>ช่วยสาขา</span>}
                                </span>
                                <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{p.time} น.</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {branch.crossBranch.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div className="eyebrow" style={{ color: 'var(--warn)', marginBottom: 6 }}>ไปช่วยสาขาอื่น ({branch.crossBranch.length})</div>
                            {branch.crossBranch.map(p => (
                              <div key={p.name} style={{ padding: '6px 0', borderBottom: '1px solid var(--line-2)', fontSize: 13, color: 'var(--ink-soft)' }}>
                                {p.nickname ? `(${p.nickname}) ` : ''}{p.name}
                              </div>
                            ))}
                          </div>
                        )}
                        {branch.missing.length > 0 && (
                          <div>
                            <div className="eyebrow" style={{ color: 'var(--red)', marginBottom: 6 }}>ยังไม่มา ({branch.missing.length})</div>
                            {branch.missing.map(m => (
                              <div key={m.name} style={{ padding: '6px 0', borderBottom: '1px solid var(--line-2)', fontSize: 13, color: 'var(--ink-soft)' }}>
                                {m.nickname ? `(${m.nickname}) ` : ''}{m.name}
                              </div>
                            ))}
                          </div>
                        )}
                        {branch.present.length === 0 && branch.missing.length === 0 && (
                          <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 16 }}>ไม่มีพนักงานประจำสาขานี้</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {dashboard.length === 0 && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48, color: 'var(--muted)' }}>ยังไม่มีข้อมูลสาขา</div>
                )}
              </div>
            </>
          )}

          {/* ─── Absent Tab ──────────────────────────────────────────────────── */}
          {tab === 'absent' && (
            <>
              <DateBar date={reportDate} onChange={d => { setRDate(d); loadReport('absent', d); }} loading={reportLoading} />
              {reportLoading ? <Loading /> : (
                absentList.length === 0
                  ? <Empty>ไม่มีพนักงานขาดงาน 🎉</Empty>
                  : <div className="card" style={{ overflow: 'hidden' }}>
                      <table className="tbl">
                        <thead><tr><th>ชื่อ</th><th>ชื่อเล่น</th><th>สาขา</th></tr></thead>
                        <tbody>
                          {absentList.map((s, i) => (
                            <tr key={i}>
                              <td>{s.name}</td>
                              <td style={{ color: 'var(--muted)' }}>{s.nickname || '—'}</td>
                              <td><span className="chip chip-bad">{s.mainBranchId}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
              )}
            </>
          )}

          {/* ─── Late Tab ────────────────────────────────────────────────────── */}
          {tab === 'late' && (
            <>
              <DateBar date={reportDate} onChange={d => { setRDate(d); loadReport('late', d); }} loading={reportLoading} />
              {reportLoading ? <Loading /> : (
                lateList.length === 0
                  ? <Empty>ไม่มีพนักงานมาสาย 🎉</Empty>
                  : <div className="card" style={{ overflow: 'hidden' }}>
                      <table className="tbl">
                        <thead><tr><th>ชื่อ</th><th>เวลา</th><th>สาย (นาที)</th><th>สาขา</th></tr></thead>
                        <tbody>
                          {lateList.map((r, i) => (
                            <tr key={i}>
                              <td><b>{r.name}</b>{r.nickname ? <span style={{ color: 'var(--muted)', fontSize: 12 }}> ({r.nickname})</span> : ''}</td>
                              <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.time} น.</td>
                              <td><span className="chip chip-warn">{r.lateMinutes} นาที</span></td>
                              <td style={{ color: 'var(--muted)' }}>{r.branchId}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
              )}
            </>
          )}

          {/* ─── Logs Tab ────────────────────────────────────────────────────── */}
          {tab === 'logs' && (
            <>
              <DateBar date={reportDate} onChange={d => { setRDate(d); loadReport('logs', d); }} loading={reportLoading} />
              {reportLoading ? <Loading /> : (
                logsList.length === 0
                  ? <Empty>ไม่มีบันทึกการเช็คอิน</Empty>
                  : <div className="card" style={{ overflow: 'hidden' }}>
                      <table className="tbl">
                        <thead><tr><th>ชื่อ</th><th>เวลา</th><th>ประเภท</th><th>สถานะ</th><th>สาขา</th></tr></thead>
                        <tbody>
                          {logsList.map((r: any, i: number) => (
                            <tr key={i}>
                              <td><b>{r.name}</b>{r.nickname ? <span style={{ color: 'var(--muted)', fontSize: 12 }}> ({r.nickname})</span> : ''}</td>
                              <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.time} น.</td>
                              <td>
                                <span className={`chip ${r.type === 'IN' ? 'chip-ok' : 'chip-bad'}`}>
                                  {r.type === 'IN' ? '▶ เข้า' : '◀ ออก'}
                                </span>
                              </td>
                              <td>
                                <span className={`chip ${r.status === 'ทันเวลา' ? 'chip-ok' : 'chip-warn'}`}>{r.status}</span>
                              </td>
                              <td style={{ color: 'var(--muted)' }}>
                                {r.branchId}
                                {r.isCrossBranch && <span className="chip chip-warn" style={{ marginLeft: 4, fontSize: 9 }}>ข้ามสาขา</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
              )}
            </>
          )}

          {/* ─── Summary Tab ─────────────────────────────────────────────────── */}
          {tab === 'summary' && (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>จาก</div>
                  <input type="date" value={summFrom} onChange={e => setSfrom(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>ถึง</div>
                  <input type="date" value={summTo} onChange={e => setSto(e.target.value)} />
                </div>
                <button onClick={() => loadReport('summary')} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
                  ดูสรุป
                </button>
              </div>

              {reportLoading ? <Loading /> : !summaryData ? null : (
                <div className="card" style={{ overflow: 'auto' }}>
                  <table className="tbl" style={{ minWidth: Math.max(400, 220 + summaryData.dates.length * 60) }}>
                    <thead>
                      <tr>
                        <th style={{ position: 'sticky', left: 0, background: 'var(--navy-900)', zIndex: 1 }}>ชื่อ</th>
                        <th>มา</th>
                        <th>สาย</th>
                        <th>ขาด</th>
                        {summaryData.dates.map(d => (
                          <th key={d} style={{ textAlign: 'center', whiteSpace: 'nowrap', minWidth: 60 }}>
                            {d.slice(8)}/{d.slice(5,7)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summaryData.summary.map((s, i) => (
                        <tr key={i}>
                          <td style={{ position: 'sticky', left: 0, background: '#fff', fontWeight: 600, zIndex: 1, whiteSpace: 'nowrap' }}>
                            {s.name}{s.nickname ? <span style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 400 }}> ({s.nickname})</span> : ''}
                          </td>
                          <td><span className="chip chip-ok">{s.totalPresent}</span></td>
                          <td><span className={`chip ${s.totalLate > 0 ? 'chip-warn' : 'chip-ok'}`}>{s.totalLate}</span></td>
                          <td><span className={`chip ${s.totalAbsent > 0 ? 'chip-bad' : 'chip-ok'}`}>{s.totalAbsent}</span></td>
                          {s.days.map((day: any, j: number) => (
                            <td key={j} style={{ textAlign: 'center', padding: '8px 4px' }}>
                              {day.status === 'present' && <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 700 }}>✓</span>}
                              {day.status === 'late'    && <span style={{ fontSize: 10, color: 'var(--warn)',    fontWeight: 700 }}>⏱</span>}
                              {day.status === 'absent'  && <span style={{ fontSize: 10, color: 'var(--red)',     fontWeight: 700 }}>✕</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

        </div>
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function DateBar({ date, onChange, loading }: { date: string; onChange: (d: string) => void; loading: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <input
        type="date" value={date}
        onChange={e => onChange(e.target.value)}
        style={{ borderRadius: 9, border: '1px solid var(--line)', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
      />
      {loading && <div className="spinner-sm" />}
    </div>
  );
}

function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
      <div className="spinner" />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 15 }}>
      {children}
    </div>
  );
}
