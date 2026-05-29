'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast, ToastContainer } from '@/components/Toast';

type Tab = 'dashboard' | 'absent' | 'late' | 'logs' | 'summary';

interface StaffRow   { name: string; nickname: string; }
interface PresentRow { name: string; nickname: string; time: string; isCross?: boolean; }
interface Branch {
  id: string; name: string; province: string;
  total: number; actual: number; colorStatus: 'green' | 'yellow' | 'red';
  openTime: string; closeTime: string;
  present: PresentRow[]; missing: StaffRow[]; crossBranch: StaffRow[];
}

const todayStr   = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
const monthStart = () => { const d = new Date(); d.setDate(1); return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }); };
const SC = { green: 'var(--success)', yellow: 'var(--warn)', red: 'var(--red)' } as const;
const SL = { green: 'ครบ', yellow: 'ขั้นต่ำ', red: 'ขาด' } as const;

const TABS: { key: Tab; label: string }[] = [
  { key: 'dashboard', label: 'ภาพรวม'  },
  { key: 'absent',    label: 'ขาดงาน'  },
  { key: 'late',      label: 'มาสาย'   },
  { key: 'logs',      label: 'บันทึก'  },
  { key: 'summary',   label: 'สรุป'    },
];

export default function OfficePage() {
  const { toasts, toast } = useToast();

  const [authed,  setAuthed] = useState(false);
  const [pwd,     setPwd]    = useState('');
  const [logging, setLog]    = useState(false);
  const [tab,     setTab]    = useState<Tab>('dashboard');
  const [clock,   setClock]  = useState('');
  const [lastUpd, setLastUpd]= useState('');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [rDate, setRDate] = useState(todayStr);
  const [from,  setFrom]  = useState(monthStart);
  const [to,    setTo]    = useState(todayStr);

  const [absentList, setAbsent] = useState<any[]>([]);
  const [lateList,   setLate]   = useState<any[]>([]);
  const [logsList,   setLogs]   = useState<any[]>([]);
  const [summary,    setSumm]   = useState<{ data: any[]; dates: string[] } | null>(null);
  const [rLoading,   setRL]     = useState(false);

  const loadedRef      = useRef<Partial<Record<Tab, string>>>({});
  const prevPresentRef = useRef<Set<string>>(new Set());
  const [newRowKeys, setNewRowKeys] = useState<Set<string>>(new Set());

  // Live clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('th-TH', { timeZone:'Asia/Bangkok', hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleLogin = async () => {
    setLog(true);
    try {
      const res  = await fetch('/api/auth/office', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pwd }) });
      const data = await res.json();
      if (data.success) setAuthed(true);
      else toast('รหัสผ่านไม่ถูกต้อง', 'error');
    } finally { setLog(false); }
  };

  const fetchDashboard = async (silent = false) => {
    try {
      const res  = await fetch('/api/dashboard');
      const data = await res.json();
      const nb: Branch[] = data.dashboard || [];

      const incoming = new Set<string>();
      nb.forEach(b => b.present.forEach(p => incoming.add(`${b.id}:${p.name}`)));
      const added = new Set<string>();
      incoming.forEach(k => { if (!prevPresentRef.current.has(k)) added.add(k); });
      prevPresentRef.current = incoming;

      if (added.size > 0 && silent) {
        toast(`เช็คอินใหม่ ${added.size} คน`, 'success');
        setNewRowKeys(added);
        setTimeout(() => setNewRowKeys(new Set()), 4000);
      }
      setBranches(nb);
      setLastUpd(new Date().toLocaleTimeString('th-TH', { timeZone:'Asia/Bangkok', hour12:false }));
    } catch { if (!silent) toast('โหลดข้อมูลไม่สำเร็จ', 'error'); }
  };

  const fetchReport = async (t: Tab, date: string, force = false) => {
    if (t === 'dashboard' || t === 'summary') return;
    const key = `${t}:${date}`;
    if (!force && loadedRef.current[t] === key) return;
    setRL(true);
    try {
      const res  = await fetch(`/api/reports?type=${t}&date=${date}`);
      const data = await res.json();
      if (t === 'absent') setAbsent(data.absent  || []);
      if (t === 'late')   setLate(data.records   || []);
      if (t === 'logs') {
        const inc: any[] = data.records || [];
        if (force && logsList.length > 0 && inc.length > logsList.length)
          toast(`บันทึกใหม่ ${inc.length - logsList.length} รายการ`, 'success');
        setLogs(inc);
      }
      loadedRef.current[t] = key;
    } catch { toast('โหลดข้อมูลไม่สำเร็จ', 'error'); }
    finally  { setRL(false); }
  };

  const fetchSummary = async () => {
    setRL(true);
    try {
      const res  = await fetch(`/api/reports?type=summary&from=${from}&to=${to}`);
      const data = await res.json();
      setSumm(data.summary ? { data: data.summary, dates: data.dates } : null);
    } catch { toast('โหลดสรุปไม่สำเร็จ', 'error'); }
    finally  { setRL(false); }
  };

  useEffect(() => {
    if (!authed) return;
    fetchDashboard();
    const id = setInterval(() => fetchDashboard(true), 15000);
    return () => clearInterval(id);
  }, [authed]);

  useEffect(() => {
    if (!authed || tab === 'dashboard' || tab === 'summary') return;
    const id = setInterval(() => fetchReport(tab, rDate, true), 30000);
    return () => clearInterval(id);
  }, [authed, tab, rDate]);

  useEffect(() => {
    if (authed && tab !== 'dashboard' && tab !== 'summary') fetchReport(tab, rDate);
  }, [tab, rDate, authed]);

  const handleDateChange = (d: string) => {
    setRDate(d);
    loadedRef.current[tab] = undefined;
  };

  const refreshAll = () => {
    loadedRef.current = {};
    fetchDashboard();
    if (tab !== 'dashboard' && tab !== 'summary') fetchReport(tab, rDate, true);
  };

  const totalStaff   = branches.reduce((s, b) => s + b.total,  0);
  const totalPresent = branches.reduce((s, b) => s + b.actual, 0);
  const totalAbsent  = branches.reduce((s, b) => s + b.missing.length, 0);
  const totalCross   = branches.reduce((s, b) => s + b.crossBranch.length, 0);
  const branchGreen  = branches.filter(b => b.colorStatus === 'green').length;
  const branchRed    = branches.filter(b => b.colorStatus === 'red').length;

  // ── LOGIN ──────────────────────────────────────────────────────────────────────
  if (!authed) return (
    <>
      <div className="shell" style={{ paddingTop:20 }}>
        <div className="card" style={{ marginTop:40, padding:'40px 28px' }}>
          <div className="eyebrow" style={{ textAlign:'center', marginBottom:16 }}>Office</div>
          <div style={{ fontSize:20, fontWeight:700, textAlign:'center', marginBottom:24 }}>รหัสผ่าน</div>
          <input type="password" placeholder="••••••••" value={pwd}
            onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key==='Enter' && handleLogin()}
            style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'1px solid var(--line)', fontSize:18, textAlign:'center', letterSpacing:'.25em', marginBottom:14, outline:'none', fontFamily:'inherit' }}
          />
          <button onClick={handleLogin} disabled={logging} className="btn btn-primary" style={{ width:'100%', padding:16 }}>
            {logging ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
          </button>
          <a href="/" style={{ display:'block', textAlign:'center', marginTop:14, fontSize:13, color:'var(--muted)', textDecoration:'none' }}>
            กลับหน้าหลัก
          </a>
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </>
  );

  // ── MAIN ───────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth:960, margin:'0 auto', padding:'0 16px 80px' }}>

      {/* ── Header: เวลา + วันที่ ── */}
      <div style={{ padding:'20px 0 16px', borderBottom:'1px solid var(--line)', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
          <div>
            <div style={{ fontSize:44, fontWeight:700, color:'var(--navy-900)', fontVariantNumeric:'tabular-nums', lineHeight:1, letterSpacing:'-1px' }}>
              {clock || '--:--:--'}
            </div>
            <div style={{ fontSize:13, color:'var(--muted)', marginTop:6 }}>
              {new Date().toLocaleDateString('th-TH', { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'Asia/Bangkok' })}
            </div>
            {lastUpd && (
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:4, display:'flex', alignItems:'center', gap:5 }}>
                <span className="live-dot" />อัพเดทล่าสุด {lastUpd}
              </div>
            )}
          </div>
          <button onClick={refreshAll} style={{ padding:'8px 14px', borderRadius:9, border:'1px solid var(--line)', background:'none', cursor:'pointer', fontSize:12, color:'var(--muted)', fontFamily:'inherit', flexShrink:0 }}>
            รีเฟรช
          </button>
        </div>

        {/* KPI Strip */}
        <div className="kpi-grid" style={{ marginTop:20 }}>
          {[
            { lbl:'พนักงาน',   num: totalStaff,   cls:'' },
            { lbl:'เข้างานแล้ว', num: totalPresent, cls: totalPresent >= totalStaff ? 'acc-green' : '' },
            { lbl:'ขาดงาน',    num: totalAbsent,  cls: totalAbsent  > 0 ? 'acc-red'  : 'acc-green' },
            { lbl:'สาขาครบ/ขาด', num: `${branchGreen}/${branchRed}`, cls: branchRed > 0 ? 'acc-warn' : 'acc-green' },
            { lbl:'ช่วยสาขาอื่น', num: totalCross, cls: totalCross > 0 ? 'acc-warn' : '' },
          ].map(k => (
            <div key={k.lbl} className={`kpi ${k.cls}`}>
              <div className="lbl">{k.lbl}</div>
              <div className="num">{k.num}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{ display:'flex', gap:2, marginBottom:20, background:'var(--surface)', borderRadius:12, padding:4, border:'1px solid var(--line)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex:1, padding:'9px 4px', borderRadius:9, border:'none', cursor:'pointer',
            background: tab===t.key ? 'var(--navy-900)' : 'transparent',
            color:      tab===t.key ? '#fff' : 'var(--muted)',
            fontWeight: tab===t.key ? 600 : 400,
            fontSize:12, fontFamily:'inherit', transition:'all .15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
          {branches.map(b => (
            <div key={b.id} className="card" style={{ padding:0, overflow:'hidden' }}>
              <button onClick={() => setExpanded(expanded===b.id ? null : b.id)}
                style={{ width:'100%', padding:'16px 20px', display:'flex', alignItems:'center', gap:12, background:'none', border:'none', cursor:'pointer', textAlign:'left' }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:SC[b.colorStatus], flexShrink:0, boxShadow:`0 0 6px ${SC[b.colorStatus]}` }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>{b.name}</div>
                  <div style={{ fontSize:12, color:'var(--muted)' }}>{b.province} · {b.openTime}–{b.closeTime}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontWeight:700, fontSize:22, color:SC[b.colorStatus] }}>{b.actual}<span style={{ fontSize:13, color:'var(--muted)', fontWeight:400 }}>/{b.total}</span></div>
                  <div style={{ fontSize:10, color:'var(--muted)' }}>{SL[b.colorStatus]}</div>
                </div>
                <span style={{ color:'var(--muted)', fontSize:11 }}>{expanded===b.id ? '▲' : '▼'}</span>
              </button>

              {expanded === b.id && (
                <div style={{ borderTop:'1px solid var(--line)', padding:'12px 20px', background:'var(--bg)' }}>
                  <Sect label={`เข้างานแล้ว (${b.present.length})`} color="var(--success)" show={b.present.length > 0}>
                    {b.present.map(p => {
                      const rk = `${b.id}:${p.name}`;
                      return (
                        <Row key={p.name} isNew={newRowKeys.has(rk)}>
                          <span>{p.nickname ? <b style={{ color:'#C5962A' }}>({p.nickname})</b> : null} {p.name}{p.isCross && <Tag cls="chip-warn">ข้ามสาขา</Tag>}</span>
                          <span style={{ color:'var(--muted)', fontVariantNumeric:'tabular-nums' }}>{p.time}</span>
                        </Row>
                      );
                    })}
                  </Sect>
                  <Sect label={`ช่วยสาขาอื่น (${b.crossBranch.length})`} color="var(--warn)" show={b.crossBranch.length > 0}>
                    {b.crossBranch.map(p => <Row key={p.name}><span>{p.nickname ? <b style={{ color:'#C5962A' }}>({p.nickname})</b> : null} {p.name}</span></Row>)}
                  </Sect>
                  <Sect label={`ยังไม่มา (${b.missing.length})`} color="var(--red)" show={b.missing.length > 0}>
                    {b.missing.map(m => <Row key={m.name}><span>{m.nickname ? <b style={{ color:'#C5962A' }}>({m.nickname})</b> : null} {m.name}</span></Row>)}
                  </Sect>
                  {b.present.length===0 && b.missing.length===0 && (
                    <p style={{ color:'var(--muted)', fontSize:13, textAlign:'center', margin:0, padding:8 }}>ไม่มีพนักงานประจำสาขานี้</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {branches.length === 0 && <Empty>ยังไม่มีข้อมูลสาขา</Empty>}
        </div>
      )}

      {/* ── ABSENT ── */}
      {tab === 'absent' && (
        <>
          <DateBar date={rDate} onChange={handleDateChange} loading={rLoading} onRefresh={() => { loadedRef.current.absent = undefined; fetchReport('absent', rDate, true); }} />
          {rLoading ? <Spinner /> : absentList.length === 0
            ? <Empty>ไม่มีพนักงานขาดงาน</Empty>
            : <>
                <div style={{ marginBottom:12 }}>
                  <span className="chip chip-bad">{absentList.length} คน</span>
                </div>
                <div className="card" style={{ overflow:'hidden' }}>
                  <table className="tbl">
                    <thead><tr><th>ชื่อ</th><th>ชื่อเล่น</th><th>สาขา</th></tr></thead>
                    <tbody>
                      {absentList.map((s,i) => (
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
          }
        </>
      )}

      {/* ── LATE ── */}
      {tab === 'late' && (
        <>
          <DateBar date={rDate} onChange={handleDateChange} loading={rLoading} onRefresh={() => { loadedRef.current.late = undefined; fetchReport('late', rDate, true); }} />
          {rLoading ? <Spinner /> : lateList.length === 0
            ? <Empty>ไม่มีพนักงานมาสาย</Empty>
            : <>
                <div style={{ marginBottom:12, display:'flex', gap:8, alignItems:'center' }}>
                  <span className="chip chip-warn">{lateList.length} คน</span>
                  <span style={{ fontSize:12, color:'var(--muted)' }}>
                    เฉลี่ย {Math.round(lateList.reduce((s,r) => s+(r.lateMinutes||0),0)/lateList.length)} นาที
                  </span>
                </div>
                <div className="card" style={{ overflow:'hidden' }}>
                  <table className="tbl">
                    <thead><tr><th>ชื่อ</th><th>เวลาเข้า</th><th>สาย</th><th>สาขา</th></tr></thead>
                    <tbody>
                      {lateList.map((r,i) => (
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
          }
        </>
      )}

      {/* ── LOGS ── */}
      {tab === 'logs' && (
        <>
          <DateBar date={rDate} onChange={handleDateChange} loading={rLoading} onRefresh={() => { loadedRef.current.logs = undefined; fetchReport('logs', rDate, true); }} />
          {rLoading ? <Spinner /> : logsList.length === 0
            ? <Empty>ไม่มีบันทึกวันนี้</Empty>
            : <>
                <div style={{ marginBottom:12, display:'flex', gap:6 }}>
                  <span className="chip chip-ok">{logsList.filter((r:any)=>r.type==='IN').length} เข้า</span>
                  <span className="chip chip-bad">{logsList.filter((r:any)=>r.type==='OUT').length} ออก</span>
                </div>
                <div className="card" style={{ overflow:'hidden' }}>
                  <table className="tbl">
                    <thead><tr><th>ชื่อ</th><th>เวลา</th><th>ประเภท</th><th>สถานะ</th><th>สาขา</th></tr></thead>
                    <tbody>
                      {logsList.map((r:any,i:number) => (
                        <tr key={i} className="row-hover">
                          <td>
                            <div style={{ fontWeight:600 }}>{r.name}</div>
                            {r.nickname && <div style={{ color:'#C5962A', fontSize:11, fontWeight:700 }}>({r.nickname})</div>}
                          </td>
                          <td style={{ fontVariantNumeric:'tabular-nums' }}>{r.time} น.</td>
                          <td><span className={`chip ${r.type==='IN' ? 'chip-ok' : 'chip-bad'}`}>{r.type==='IN' ? 'เข้า' : 'ออก'}</span></td>
                          <td><span className={`chip ${r.status==='ทันเวลา' ? 'chip-ok' : 'chip-warn'}`}>{r.status}</span></td>
                          <td style={{ fontSize:12, color:'var(--muted)' }}>
                            {r.branchId}{r.isCrossBranch && <Tag cls="chip-warn">ข้ามสาขา</Tag>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
          }
        </>
      )}

      {/* ── SUMMARY ── */}
      {tab === 'summary' && (
        <>
          <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'flex-end', flexWrap:'wrap' }}>
            <div>
              <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>ตั้งแต่</div>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                style={{ borderRadius:9, border:'1px solid var(--line)', padding:'8px 12px', fontSize:13, fontFamily:'inherit', outline:'none' }} />
            </div>
            <div>
              <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>ถึง</div>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                style={{ borderRadius:9, border:'1px solid var(--line)', padding:'8px 12px', fontSize:13, fontFamily:'inherit', outline:'none' }} />
            </div>
            <button onClick={fetchSummary} disabled={rLoading} className="btn btn-primary" style={{ padding:'8px 18px', fontSize:13 }}>
              {rLoading ? '...' : 'ดูสรุป'}
            </button>
          </div>

          {rLoading ? <Spinner /> : !summary
            ? <div style={{ color:'var(--muted)', fontSize:13, padding:20, textAlign:'center' }}>เลือกช่วงเวลาแล้วกด "ดูสรุป"</div>
            : <>
                <div style={{ marginBottom:12, display:'flex', gap:8, flexWrap:'wrap', fontSize:12, color:'var(--muted)' }}>
                  <span style={{ color:'var(--success)', fontWeight:700 }}>✓ มา</span>
                  <span style={{ color:'var(--warn)', fontWeight:700 }}>! สาย</span>
                  <span style={{ color:'var(--red)', fontWeight:700 }}>✕ ขาด</span>
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
                      {summary.data.map((s:any,i:number) => (
                        <tr key={i} className="row-hover">
                          <td style={{ position:'sticky', left:0, background:'#fff', zIndex:1, whiteSpace:'nowrap' }}>
                            {s.nickname ? <span style={{ color:'#C5962A', fontWeight:700, fontSize:12 }}>({s.nickname}) </span> : ''}
                            <span style={{ fontWeight:600 }}>{s.name}</span>
                          </td>
                          <td style={{ textAlign:'center' }}><span className="chip chip-ok">{s.totalPresent}</span></td>
                          <td style={{ textAlign:'center' }}><span className={`chip ${s.totalLate>0?'chip-warn':'chip-ok'}`}>{s.totalLate}</span></td>
                          <td style={{ textAlign:'center' }}><span className={`chip ${s.totalAbsent>0?'chip-bad':'chip-ok'}`}>{s.totalAbsent}</span></td>
                          {s.days.map((day:any,j:number) => (
                            <td key={j} style={{ textAlign:'center', padding:'8px 4px' }}>
                              {day.status==='present' && <span title={day.time}         style={{ color:'var(--success)', fontWeight:700 }}>✓</span>}
                              {day.status==='late'    && <span title={`สาย ${day.lateMinutes} นาที`} style={{ color:'var(--warn)', fontWeight:700 }}>!</span>}
                              {day.status==='absent'  && <span style={{ color:'var(--red)', fontWeight:700 }}>✕</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
          }
        </>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DateBar({ date, onChange, loading, onRefresh }: { date: string; onChange: (d:string) => void; loading: boolean; onRefresh: () => void }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
      <input type="date" value={date} onChange={e => onChange(e.target.value)}
        style={{ borderRadius:9, border:'1px solid var(--line)', padding:'8px 12px', fontSize:13, fontFamily:'inherit', outline:'none' }} />
      {loading
        ? <div className="spinner-sm" />
        : <button onClick={onRefresh} style={{ fontSize:12, color:'var(--muted)', background:'none', border:'1px solid var(--line)', padding:'7px 12px', borderRadius:9, cursor:'pointer', fontFamily:'inherit' }}>รีเฟรช</button>
      }
    </div>
  );
}

function Spinner() {
  return <div style={{ display:'flex', justifyContent:'center', padding:48 }}><div className="spinner" /></div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card" style={{ textAlign:'center', padding:48, color:'var(--muted)', fontSize:14 }}>{children}</div>;
}

function Sect({ label, color, show, children }: { label: string; color: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <div style={{ marginBottom:10 }}>
      <div className="eyebrow" style={{ color, marginBottom:6 }}>{label}</div>
      {children}
    </div>
  );
}

function Row({ children, isNew }: { children: React.ReactNode; isNew?: boolean }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--line-2)', fontSize:13,
      ...(isNew ? { animation:'rowSlideIn .55s ease-out forwards', borderRadius:6, paddingLeft:4 } : {}) }}>
      {children}
    </div>
  );
}

function Tag({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`chip ${cls}`} style={{ marginLeft:6, fontSize:9 }}>{children}</span>;
}
