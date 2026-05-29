'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast, ToastContainer } from '@/components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'dashboard' | 'absent' | 'late' | 'logs' | 'summary';

interface StaffRow   { name: string; nickname: string; }
interface PresentRow { name: string; nickname: string; time: string; isCross?: boolean; }
interface Branch {
  id: string; name: string; province: string;
  total: number; actual: number; colorStatus: 'green' | 'yellow' | 'red';
  openTime: string; closeTime: string;
  present: PresentRow[]; missing: StaffRow[]; crossBranch: StaffRow[];
}

const todayStr = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
const monthStart = () => { const d = new Date(); d.setDate(1); return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }); };
const STATUS_COLOR = { green: 'var(--success)', yellow: 'var(--warn)', red: 'var(--red)' } as const;
const STATUS_LABEL = { green: 'ครบ', yellow: 'ขั้นต่ำ', red: 'ขาด' } as const;

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV: { key: Tab; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'ภาพรวม',    icon: '◉' },
  { key: 'absent',    label: 'ขาดงาน',    icon: '✕' },
  { key: 'late',      label: 'มาสาย',     icon: '⏱' },
  { key: 'logs',      label: 'บันทึกวัน', icon: '≡' },
  { key: 'summary',   label: 'สรุปราย',   icon: '⊞' },
];

export default function OfficePage() {
  const { toasts, toast } = useToast();

  const [authed,   setAuthed]  = useState(false);
  const [pwd,      setPwd]     = useState('');
  const [logging,  setLog]     = useState(false);
  const [tab,      setTab]     = useState<Tab>('dashboard');
  const [sideOpen, setSide]    = useState(false);
  const [lastUpd,  setLastUpd] = useState('');

  // Dashboard
  const [branches,  setBranches] = useState<Branch[]>([]);
  const [expanded,  setExpanded] = useState<string | null>(null);

  // Reports — shared date state
  const [rDate, setRDate] = useState(todayStr);
  const [from,  setFrom]  = useState(monthStart);
  const [to,    setTo]    = useState(todayStr);

  // Report data
  const [absentList, setAbsent] = useState<any[]>([]);
  const [lateList,   setLate]   = useState<any[]>([]);
  const [logsList,   setLogs]   = useState<any[]>([]);
  const [summary,    setSumm]   = useState<{ data: any[]; dates: string[] } | null>(null);
  const [rLoading,   setRL]     = useState(false);

  // Track which date each report was last loaded for (avoid re-fetch on tab switch)
  const loadedRef = useRef<Partial<Record<Tab, string>>>({});

  // ─── Login ────────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLog(true);
    try {
      const res  = await fetch('/api/auth/office', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pwd }) });
      const data = await res.json();
      if (data.success) {
        setAuthed(true);
      } else {
        toast('รหัสผ่านไม่ถูกต้อง', 'error');
      }
    } finally { setLog(false); }
  };

  // ─── Fetch dashboard ──────────────────────────────────────────────────────────
  const fetchDashboard = async () => {
    try {
      const res  = await fetch('/api/dashboard');
      const data = await res.json();
      setBranches(data.dashboard || []);
      setLastUpd(new Date().toLocaleTimeString('th-TH', { timeZone:'Asia/Bangkok', hour12:false }));
    } catch { toast('โหลด dashboard ไม่สำเร็จ', 'error'); }
  };

  // ─── Fetch report by type + date ─────────────────────────────────────────────
  const fetchReport = async (t: Tab, date: string) => {
    if (t === 'dashboard') return;
    if (t === 'summary')   return; // summary has its own button
    const cacheKey = `${t}:${date}`;
    if (loadedRef.current[t] === cacheKey) return; // already loaded for this date
    setRL(true);
    try {
      const res  = await fetch(`/api/reports?type=${t}&date=${date}`);
      const data = await res.json();
      if (t === 'absent') setAbsent(data.absent  || []);
      if (t === 'late')   setLate(data.records   || []);
      if (t === 'logs')   setLogs(data.records   || []);
      loadedRef.current[t] = cacheKey;
    } catch { toast('โหลดข้อมูลไม่สำเร็จ', 'error'); }
    finally { setRL(false); }
  };

  const fetchSummary = async () => {
    setRL(true);
    try {
      const res  = await fetch(`/api/reports?type=summary&from=${from}&to=${to}`);
      const data = await res.json();
      setSumm(data.summary ? { data: data.summary, dates: data.dates } : null);
    } catch { toast('โหลดสรุปไม่สำเร็จ', 'error'); }
    finally { setRL(false); }
  };

  // ─── Auto-refresh dashboard every 60s ────────────────────────────────────────
  useEffect(() => {
    if (!authed) return;
    fetchDashboard();
    const id = setInterval(fetchDashboard, 60000);
    return () => clearInterval(id);
  }, [authed]);

  // ─── Load report when tab or date changes ─────────────────────────────────────
  useEffect(() => {
    if (authed && tab !== 'dashboard' && tab !== 'summary') {
      fetchReport(tab, rDate);
    }
  }, [tab, rDate, authed]);

  const handleDateChange = (d: string) => {
    setRDate(d);
    // Invalidate cache for current tab so it re-fetches
    loadedRef.current[tab] = undefined;
  };

  const refreshAll = () => {
    loadedRef.current = {};
    fetchDashboard();
    if (tab !== 'dashboard' && tab !== 'summary') fetchReport(tab, rDate);
  };

  // ─── KPI values ───────────────────────────────────────────────────────────────
  const totalStaff   = branches.reduce((s, b) => s + b.total,  0);
  const totalPresent = branches.reduce((s, b) => s + b.actual, 0);
  const totalAbsent  = branches.reduce((s, b) => s + b.missing.length, 0);
  const totalCross   = branches.reduce((s, b) => s + b.crossBranch.length, 0);
  const branchGreen  = branches.filter(b => b.colorStatus === 'green').length;
  const branchRed    = branches.filter(b => b.colorStatus === 'red').length;

  // ══════════════════════════════════════════════════════════════
  // LOGIN
  // ══════════════════════════════════════════════════════════════
  if (!authed) return (
    <>
      <header style={{ background:'var(--navy-900)', padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ color:'rgba(255,255,255,.45)', fontSize:9, letterSpacing:'.18em', textTransform:'uppercase' }}>OFFICE</div>
          <div style={{ color:'#fff', fontWeight:700, fontSize:16 }}>Dashboard สำนักงาน</div>
        </div>
        <a href="/" style={{ color:'rgba(255,255,255,.5)', fontSize:11, fontWeight:600, textDecoration:'none', padding:'5px 10px', borderRadius:7, border:'1px solid rgba(255,255,255,.15)' }}>← Home</a>
      </header>
      <div className="shell" style={{ paddingTop:20 }}>
        <div className="card" style={{ marginTop:40, padding:'40px 28px' }}>
          <div className="eyebrow" style={{ textAlign:'center', marginBottom:16 }}>Restricted Access</div>
          <div style={{ fontSize:20, fontWeight:600, textAlign:'center', marginBottom:24 }}>เข้าสู่ระบบ Office</div>
          <input type="password" placeholder="••••••••" value={pwd}
            onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key==='Enter' && handleLogin()}
            style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'1px solid var(--line)', fontSize:18, textAlign:'center', letterSpacing:'.25em', marginBottom:14, outline:'none', fontFamily:'inherit' }}
          />
          <button onClick={handleLogin} disabled={logging} className="btn btn-primary" style={{ width:'100%', padding:16 }}>
            {logging ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
          </button>
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </>
  );

  // ══════════════════════════════════════════════════════════════
  // MAIN DASHBOARD
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="office-shell">
      {sideOpen && <div className="office-overlay" onClick={() => setSide(false)} />}

      {/* ─── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className={`office-side${sideOpen ? ' open' : ''}`}>
        <div style={{ padding:'20px 20px 14px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid rgba(255,255,255,.08)' }}>
          <div style={{ width:32, height:32, borderRadius:9, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <span style={{ color:'var(--navy-900)', fontWeight:700, fontSize:12, fontFamily:'monospace' }}>M</span>
          </div>
          <div>
            <div style={{ color:'#fff', fontWeight:600, fontSize:13, letterSpacing:'.1em', textTransform:'uppercase', lineHeight:1.2 }}>M Technologies</div>
            <div style={{ color:'rgba(255,255,255,.4)', fontSize:9, letterSpacing:'.1em', textTransform:'uppercase', marginTop:2 }}>Office Console</div>
          </div>
        </div>

        <div className="side-section"><div className="side-eyebrow">รายงาน</div></div>
        <nav className="side-nav">
          {NAV.map(item => (
            <button key={item.key} onClick={() => { setTab(item.key); setSide(false); }}
              className={`side-nav-btn${tab === item.key ? ' active' : ''}`}>
              <span style={{ fontSize:15, width:20, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="side-foot">
          <div>อัพเดท: <strong style={{ color:'rgba(255,255,255,.65)' }}>{lastUpd || '—'} น.</strong></div>
          <button onClick={refreshAll} style={{ marginTop:10, fontSize:10, color:'rgba(255,255,255,.5)', background:'none', border:'1px solid rgba(255,255,255,.15)', padding:'4px 10px', borderRadius:6, cursor:'pointer', fontFamily:'inherit' }}>
            🔄 รีเฟรช
          </button>
        </div>
      </aside>

      {/* ─── Main ─────────────────────────────────────────────────────────────── */}
      <main className="office-main">
        {/* Topbar */}
        <div className="office-topbar">
          <button onClick={() => setSide(v => !v)} style={{ display:'flex', alignItems:'center', justifyContent:'center', width:36, height:36, borderRadius:9, border:'1px solid var(--line)', background:'none', cursor:'pointer', marginRight:14, flexShrink:0 }}>☰</button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, color:'var(--muted)', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:4 }}>
              {new Date().toLocaleDateString('th-TH', { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'Asia/Bangkok' })}
            </div>
            <h1 style={{ margin:0, fontSize:18, fontWeight:600 }}>{NAV.find(n => n.key===tab)?.label}</h1>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <a href="/" style={{ fontSize:11, color:'var(--muted)', textDecoration:'none', padding:'6px 10px', borderRadius:8, border:'1px solid var(--line)', fontWeight:600 }}>← Home</a>
            <button onClick={refreshAll} style={{ fontSize:12, color:'var(--muted)', background:'none', border:'1px solid var(--line)', padding:'6px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit' }}>🔄</button>
          </div>
        </div>

        <div className="office-content">

          {/* ══════════ DASHBOARD ══════════ */}
          {tab === 'dashboard' && (
            <>
              {/* KPI Strip */}
              <div className="kpi-grid" style={{ marginBottom:24 }}>
                {[
                  { lbl:'พนักงานทั้งหมด', num: totalStaff,   cls:'' },
                  { lbl:'เข้างานแล้ว',    num: totalPresent, cls: totalPresent >= totalStaff ? 'acc-green' : '' },
                  { lbl:'ขาดงาน',         num: totalAbsent,  cls: totalAbsent  > 0 ? 'acc-red'  : 'acc-green' },
                  { lbl:'สาขาครบ/ขาด',   num: `${branchGreen}/${branchRed}`, cls: branchRed > 0 ? 'acc-warn' : 'acc-green' },
                  { lbl:'ช่วยสาขาอื่น',  num: totalCross,   cls: totalCross   > 0 ? 'acc-warn' : '' },
                ].map(k => (
                  <div key={k.lbl} className={`kpi ${k.cls}`}>
                    <div className="lbl">{k.lbl}</div>
                    <div className="num count-num">{k.num}</div>
                  </div>
                ))}
              </div>

              {/* Branch cards */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
                {branches.map(b => (
                  <div key={b.id} className="card" style={{ padding:0, overflow:'hidden' }}>
                    <button onClick={() => setExpanded(expanded===b.id ? null : b.id)}
                      style={{ width:'100%', padding:'16px 20px', display:'flex', alignItems:'center', gap:12, background:'none', border:'none', cursor:'pointer', textAlign:'left' }}>
                      <div style={{ width:12, height:12, borderRadius:'50%', background:STATUS_COLOR[b.colorStatus], flexShrink:0, boxShadow:`0 0 6px ${STATUS_COLOR[b.colorStatus]}` }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:14 }}>{b.name}</div>
                        <div style={{ fontSize:12, color:'var(--muted)' }}>{b.province} · {b.openTime}–{b.closeTime}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontWeight:700, fontSize:22, color:STATUS_COLOR[b.colorStatus] }}>{b.actual}<span style={{ fontSize:13, color:'var(--muted)', fontWeight:400 }}>/{b.total}</span></div>
                        <div style={{ fontSize:10, color:'var(--muted)' }}>{STATUS_LABEL[b.colorStatus]}</div>
                      </div>
                      <span style={{ color:'var(--muted)', fontSize:11 }}>{expanded===b.id ? '▲' : '▼'}</span>
                    </button>

                    {expanded === b.id && (
                      <div style={{ borderTop:'1px solid var(--line)', padding:'12px 20px', background:'var(--bg)' }}>
                        <Section label={`เข้างานแล้ว (${b.present.length})`} color="var(--success)" show={b.present.length > 0}>
                          {b.present.map(p => (
                            <Row key={p.name}>
                              <span>{p.nickname ? <b style={{ color:'#C5962A' }}>({p.nickname})</b> : null} {p.name}{p.isCross && <Tag cls="chip-warn">ข้ามสาขา</Tag>}</span>
                              <span style={{ color:'var(--muted)', fontVariantNumeric:'tabular-nums' }}>{p.time}</span>
                            </Row>
                          ))}
                        </Section>
                        <Section label={`ไปช่วยสาขาอื่น (${b.crossBranch.length})`} color="var(--warn)" show={b.crossBranch.length > 0}>
                          {b.crossBranch.map(p => <Row key={p.name}><span>{p.nickname ? <b style={{ color:'#C5962A' }}>({p.nickname})</b> : null} {p.name}</span></Row>)}
                        </Section>
                        <Section label={`ยังไม่มา (${b.missing.length})`} color="var(--red)" show={b.missing.length > 0}>
                          {b.missing.map(m => <Row key={m.name}><span>{m.nickname ? <b style={{ color:'#C5962A' }}>({m.nickname})</b> : null} {m.name}</span></Row>)}
                        </Section>
                        {b.present.length===0 && b.missing.length===0 && (
                          <p style={{ color:'var(--muted)', fontSize:13, textAlign:'center', padding:12, margin:0 }}>ไม่มีพนักงานประจำสาขานี้</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {branches.length === 0 && <Empty>ยังไม่มีข้อมูลสาขา</Empty>}
              </div>
            </>
          )}

          {/* ══════════ ABSENT ══════════ */}
          {tab === 'absent' && (
            <>
              <DatePicker date={rDate} onChange={handleDateChange} loading={rLoading} />
              {rLoading ? <Spinner /> : absentList.length === 0
                ? <Empty>ไม่มีพนักงานขาดงาน 🎉</Empty>
                : (
                  <>
                    <div style={{ marginBottom:12 }}>
                      <span className="chip chip-bad">{absentList.length} คน</span>
                    </div>
                    <div className="card" style={{ overflow:'hidden' }}>
                      <table className="tbl">
                        <thead><tr><th>ชื่อ</th><th>ชื่อเล่น</th><th>สาขา</th></tr></thead>
                        <tbody>
                          {absentList.map((s, i) => (
                            <tr key={i} className="row-hover">
                              <td style={{ fontWeight:500 }}>{s.name}</td>
                              <td style={{ color:'#C5962A', fontWeight:600 }}>{s.nickname || '—'}</td>
                              <td><span className="chip chip-bad">{s.mainBranchId}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
              }
            </>
          )}

          {/* ══════════ LATE ══════════ */}
          {tab === 'late' && (
            <>
              <DatePicker date={rDate} onChange={handleDateChange} loading={rLoading} />
              {rLoading ? <Spinner /> : lateList.length === 0
                ? <Empty>ไม่มีพนักงานมาสาย 🎉</Empty>
                : (
                  <>
                    <div style={{ marginBottom:12, display:'flex', gap:8, alignItems:'center' }}>
                      <span className="chip chip-warn">{lateList.length} คน</span>
                      <span style={{ fontSize:12, color:'var(--muted)' }}>
                        เฉลี่ย {Math.round(lateList.reduce((s,r) => s + (r.lateMinutes||0), 0) / lateList.length)} นาที
                      </span>
                    </div>
                    <div className="card" style={{ overflow:'hidden' }}>
                      <table className="tbl">
                        <thead><tr><th>ชื่อ</th><th>เวลาเข้า</th><th>สาย</th><th>สาขา</th></tr></thead>
                        <tbody>
                          {lateList.map((r, i) => (
                            <tr key={i} className="row-hover">
                              <td>
                                <div style={{ fontWeight:600 }}>{r.name}</div>
                                {r.nickname && <div style={{ color:'#C5962A', fontSize:11, fontWeight:700 }}>({r.nickname})</div>}
                              </td>
                              <td style={{ fontVariantNumeric:'tabular-nums' }}>{r.time} น.</td>
                              <td><span className="chip chip-warn">{r.lateMinutes} นาที</span></td>
                              <td style={{ color:'var(--muted)', fontSize:12 }}>{r.branchId}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
              }
            </>
          )}

          {/* ══════════ LOGS ══════════ */}
          {tab === 'logs' && (
            <>
              <DatePicker date={rDate} onChange={handleDateChange} loading={rLoading} />
              {rLoading ? <Spinner /> : logsList.length === 0
                ? <Empty>ไม่มีบันทึกการเช็คอินวันนี้</Empty>
                : (
                  <>
                    <div style={{ marginBottom:12 }}>
                      <span className="chip chip-ok">{logsList.filter((r:any)=>r.type==='IN').length} เช็คอิน</span>
                      {' '}
                      <span className="chip chip-bad">{logsList.filter((r:any)=>r.type==='OUT').length} เช็คเอาท์</span>
                    </div>
                    <div className="card" style={{ overflow:'hidden' }}>
                      <table className="tbl">
                        <thead><tr><th>ชื่อ</th><th>เวลา</th><th>ประเภท</th><th>สถานะ</th><th>สาขา</th></tr></thead>
                        <tbody>
                          {logsList.map((r:any, i:number) => (
                            <tr key={i} className="row-hover">
                              <td>
                                <div style={{ fontWeight:600 }}>{r.name}</div>
                                {r.nickname && <div style={{ color:'#C5962A', fontSize:11, fontWeight:700 }}>({r.nickname})</div>}
                              </td>
                              <td style={{ fontVariantNumeric:'tabular-nums' }}>{r.time} น.</td>
                              <td><span className={`chip ${r.type==='IN' ? 'chip-ok' : 'chip-bad'}`}>{r.type==='IN' ? '▶ เข้า' : '◀ ออก'}</span></td>
                              <td><span className={`chip ${r.status==='ทันเวลา' ? 'chip-ok' : 'chip-warn'}`}>{r.status}</span></td>
                              <td style={{ fontSize:12, color:'var(--muted)' }}>
                                {r.branchId}
                                {r.isCrossBranch && <Tag cls="chip-warn">ข้ามสาขา</Tag>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
              }
            </>
          )}

          {/* ══════════ SUMMARY ══════════ */}
          {tab === 'summary' && (
            <>
              <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'flex-end', flexWrap:'wrap' }}>
                <div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>จากวันที่</div>
                  <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>ถึงวันที่</div>
                  <input type="date" value={to} onChange={e => setTo(e.target.value)} />
                </div>
                <button onClick={fetchSummary} disabled={rLoading} className="btn btn-primary" style={{ padding:'8px 18px', fontSize:13 }}>
                  {rLoading ? '...' : 'ดูสรุป'}
                </button>
              </div>

              {rLoading ? <Spinner /> : !summary ? (
                <div style={{ color:'var(--muted)', fontSize:13, padding:20, textAlign:'center' }}>กดปุ่ม "ดูสรุป" เพื่อโหลดข้อมูล</div>
              ) : (
                <>
                  <div style={{ marginBottom:12, display:'flex', gap:8, flexWrap:'wrap' }}>
                    <span className="chip chip-ok">มาทำงาน = ✓</span>
                    <span className="chip chip-warn">สาย = ⏱</span>
                    <span className="chip chip-bad">ขาดงาน = ✕</span>
                  </div>
                  <div className="card" style={{ overflow:'auto' }}>
                    <table className="tbl" style={{ minWidth: Math.max(400, 180 + summary.dates.length * 58) }}>
                      <thead>
                        <tr>
                          <th style={{ position:'sticky', left:0, background:'var(--navy-900)', zIndex:1, minWidth:130 }}>ชื่อ</th>
                          <th style={{ textAlign:'center' }}>มา</th>
                          <th style={{ textAlign:'center' }}>สาย</th>
                          <th style={{ textAlign:'center' }}>ขาด</th>
                          {summary.dates.map(d => (
                            <th key={d} style={{ textAlign:'center', whiteSpace:'nowrap', minWidth:52, fontVariantNumeric:'tabular-nums' }}>
                              {d.slice(8)}/{d.slice(5,7)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {summary.data.map((s: any, i: number) => (
                          <tr key={i} className="row-hover">
                            <td style={{ position:'sticky', left:0, background:'#fff', zIndex:1, whiteSpace:'nowrap' }}>
                              {s.nickname ? <span style={{ color:'#C5962A', fontWeight:700, fontSize:12 }}>({s.nickname}) </span> : ''}
                              <span style={{ fontWeight:600 }}>{s.name}</span>
                            </td>
                            <td style={{ textAlign:'center' }}><span className="chip chip-ok">{s.totalPresent}</span></td>
                            <td style={{ textAlign:'center' }}><span className={`chip ${s.totalLate>0?'chip-warn':'chip-ok'}`}>{s.totalLate}</span></td>
                            <td style={{ textAlign:'center' }}><span className={`chip ${s.totalAbsent>0?'chip-bad':'chip-ok'}`}>{s.totalAbsent}</span></td>
                            {s.days.map((day: any, j: number) => (
                              <td key={j} style={{ textAlign:'center', padding:'8px 4px' }}>
                                {day.status==='present' && <span title={day.time} style={{ color:'var(--success)', fontWeight:700 }}>✓</span>}
                                {day.status==='late'    && <span title={`สาย ${day.lateMinutes} นาที`} style={{ color:'var(--warn)', fontWeight:700 }}>⏱</span>}
                                {day.status==='absent'  && <span style={{ color:'var(--red)', fontWeight:700 }}>✕</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

        </div>
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  );
}

// ─── Reusable sub-components ──────────────────────────────────────────────────
function DatePicker({ date, onChange, loading }: { date: string; onChange: (d: string) => void; loading: boolean }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
      <input type="date" value={date} onChange={e => onChange(e.target.value)}
        style={{ borderRadius:9, border:'1px solid var(--line)', padding:'8px 12px', fontSize:13, fontFamily:'inherit', outline:'none' }} />
      {loading && <div className="spinner-sm" />}
    </div>
  );
}

function Spinner() {
  return <div style={{ display:'flex', justifyContent:'center', padding:48 }}><div className="spinner" /></div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card" style={{ textAlign:'center', padding:48, color:'var(--muted)', fontSize:15 }}>{children}</div>;
}

function Section({ label, color, show, children }: { label: string; color: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <div style={{ marginBottom:10 }}>
      <div className="eyebrow" style={{ color, marginBottom:6 }}>{label}</div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--line-2)', fontSize:13 }}>
      {children}
    </div>
  );
}

function Tag({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`chip ${cls}`} style={{ marginLeft:6, fontSize:9 }}>{children}</span>;
}
