'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast, ToastContainer } from '@/components/Toast';
import { PROVINCES, PREFIXES }      from '@/lib/provinces';

type Tab = 'dashboard' | 'absent' | 'late' | 'logs' | 'summary' | 'manage';

interface StaffRow   { name: string; nickname: string; }
interface PresentRow { name: string; nickname: string; time: string; isCross?: boolean; }
interface Branch {
  id: string; name: string; province: string;
  total: number; actual: number; colorStatus: 'green' | 'yellow' | 'red';
  openTime: string; closeTime: string;
  present: PresentRow[]; missing: StaffRow[]; crossBranch: StaffRow[];
}
interface MgStaff  { id: string; name: string; nickname: string; mainBranchId: string; status: string; hasDescriptors: boolean; lineId?: string; }
interface MgBranch { id: string; name: string; province: string; openTime: string; closeTime: string; minStaff: number; totalStaff: number; lat: number; lng: number; radius: number; }

const todayStr   = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
const monthStart = () => { const d = new Date(); d.setDate(1); return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }); };
const SC = { green: 'var(--success)', yellow: 'var(--warn)', red: 'var(--red)' } as const;
const SL = { green: 'ครบ', yellow: 'ขั้นต่ำ', red: 'ขาด' } as const;

const inp: React.CSSProperties = { width: '100%', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--line)', fontSize: 13, outline: 'none', fontFamily: 'inherit', color: 'var(--ink)', background: '#fff' };
const lbl: React.CSSProperties = { fontSize: 11, color: 'var(--muted)', marginBottom: 4, display: 'block', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 500 };

const GOLD       = '#C5962A';
const MG_UNLOCK  = 'office123';

const TABS: { key: Tab; label: string }[] = [
  { key: 'dashboard', label: 'ภาพรวม' },
  { key: 'absent',    label: 'ขาดงาน' },
  { key: 'late',      label: 'มาสาย'  },
  { key: 'logs',      label: 'บันทึก' },
  { key: 'summary',   label: 'สรุป'   },
  { key: 'manage',    label: 'จัดการ' },
];

function parseGps(raw: string): { lat: number; lng: number } | null {
  const parts = raw.split(',').map(s => s.trim());
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

export default function OfficePage() {
  const { toasts, toast } = useToast();

  // ── Auth ──────────────────────────────────────────────────────────────────────
  const [authed,  setAuthed] = useState(false);
  const [pwd,     setPwd]    = useState('');
  const [logging, setLog]    = useState(false);

  // ── View ──────────────────────────────────────────────────────────────────────
  const [tab,     setTab]    = useState<Tab>('dashboard');
  const [clock,   setClock]  = useState('');
  const [lastUpd, setLastUpd]= useState('');

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  const [branches, setBranches] = useState<Branch[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  // ── Reports ───────────────────────────────────────────────────────────────────
  const [rDate,      setRDate]  = useState(todayStr);
  const [from,       setFrom]   = useState(monthStart);
  const [to,         setTo]     = useState(todayStr);
  const [absentList, setAbsent] = useState<any[]>([]);
  const [lateList,   setLate]   = useState<any[]>([]);
  const [logsList,   setLogs]   = useState<any[]>([]);
  const [summary,    setSumm]   = useState<{ data: any[]; dates: string[] } | null>(null);
  const [rLoading,   setRL]     = useState(false);
  const loadedRef      = useRef<Partial<Record<Tab, string>>>({});
  const prevPresentRef = useRef<Set<string>>(new Set());
  const [newRowKeys,  setNewRowKeys]  = useState<Set<string>>(new Set());

  // ── Manage: data ──────────────────────────────────────────────────────────────
  const [staffMg,    setStaffMg]    = useState<MgStaff[]>([]);
  const [branchesMg, setBranchesMg] = useState<MgBranch[]>([]);
  const [mgSearch,   setMgSearch]   = useState('');
  const [mgLoading,  setMgLoad]     = useState(false);

  // ── Manage: add forms ─────────────────────────────────────────────────────────
  const [showAddStaff,  setShowAddStaff]  = useState(false);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [staffForm,  setStaffForm]  = useState({ prefix: 'นาย', firstName: '', lastName: '', nickname: '', mainBranchId: '' });
  const [branchForm, setBranchForm] = useState({ id: '', name: '', province: '', totalStaff: '', minStaff: '', gps: '', radius: '50', openTime: '09:00', closeTime: '18:00' });
  const [addingStaff,  setAddingStaff]  = useState(false);
  const [addingBranch, setAddingBranch] = useState(false);

  // ── Manage: inline edit ───────────────────────────────────────────────────────
  const [editStaffId,   setEditStaffId]   = useState<string | null>(null);
  const [editBranchId,  setEditBranchId]  = useState<string | null>(null);
  const [staffEditBuf,  setStaffEditBuf]  = useState({ nickname: '', mainBranchId: '', status: '' });
  const [branchEditBuf, setBranchEditBuf] = useState({ name: '', province: '', gps: '', radius: '', openTime: '', closeTime: '', totalStaff: '', minStaff: '' });

  // ── Password modal ────────────────────────────────────────────────────────────
  const [pwdModal, setPwdModal] = useState<(() => Promise<void>) | null>(null);
  const [pwdVal,   setPwdVal]   = useState('');
  const [pwdBusy,  setPwdBusy]  = useState(false);

  // ── Clock ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('th-TH', {
      timeZone: 'Asia/Bangkok', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLog(true);
    try {
      const res  = await fetch('/api/auth/office', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pwd }) });
      const data = await res.json();
      if (data.success) setAuthed(true);
      else toast('รหัสผ่านไม่ถูกต้อง', 'error');
    } finally { setLog(false); }
  };

  // ── Dashboard ─────────────────────────────────────────────────────────────────
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
      setLastUpd(new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false }));
    } catch { if (!silent) toast('โหลดข้อมูลไม่สำเร็จ', 'error'); }
  };

  // ── Reports ───────────────────────────────────────────────────────────────────
  const fetchReport = async (t: Tab, date: string, force = false) => {
    if (t === 'dashboard' || t === 'summary' || t === 'manage') return;
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

  // ── Manage: load ──────────────────────────────────────────────────────────────
  const loadMgData = async () => {
    setMgLoad(true);
    try {
      const [sr, br] = await Promise.all([fetch('/api/staff'), fetch('/api/branches')]);
      const [sd, bd] = await Promise.all([sr.json(), br.json()]);
      setStaffMg(sd.staff || []);
      setBranchesMg(bd.branches || []);
    } catch { toast('โหลดข้อมูลไม่สำเร็จ', 'error'); }
    finally { setMgLoad(false); }
  };

  // ── Password modal ────────────────────────────────────────────────────────────
  const requirePwd = (fn: () => Promise<void>) => {
    setPwdVal('');
    setPwdModal(() => fn);
  };

  const doPwdConfirm = async () => {
    if (pwdVal !== MG_UNLOCK) { toast('รหัสไม่ถูกต้อง', 'error'); return; }
    setPwdBusy(true);
    try {
      await pwdModal!();
      setPwdModal(null);
      setPwdVal('');
    } catch {
      toast('เกิดข้อผิดพลาด', 'error');
    } finally {
      setPwdBusy(false);
    }
  };

  // ── Manage: save staff (edit) ─────────────────────────────────────────────────
  const handleSaveStaff = (s: MgStaff) => requirePwd(async () => {
    const res = await fetch('/api/staff', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: s.name, updates: {
        nickname: staffEditBuf.nickname,
        mainBranchId: staffEditBuf.mainBranchId,
        status: staffEditBuf.status,
      }}),
    });
    const data = await res.json();
    if (data.success) { toast('บันทึกสำเร็จ', 'success'); setEditStaffId(null); loadMgData(); }
    else toast(data.error || 'บันทึกไม่สำเร็จ', 'error');
  });

  // ── Manage: save branch (edit) ────────────────────────────────────────────────
  const handleSaveBranch = (b: MgBranch) => requirePwd(async () => {
    const rawGps = branchEditBuf.gps.trim();
    const gpsVal = rawGps ? parseGps(rawGps) : null;
    if (rawGps && !gpsVal) { toast('รูปแบบ GPS ไม่ถูกต้อง', 'warn'); return; }
    const res = await fetch('/api/branches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: b.id,
        name: branchEditBuf.name,
        province: branchEditBuf.province,
        totalStaff: Number(branchEditBuf.totalStaff) || 0,
        minStaff: Number(branchEditBuf.minStaff) || 0,
        lat: gpsVal ? gpsVal.lat : b.lat,
        lng: gpsVal ? gpsVal.lng : b.lng,
        radius: Number(branchEditBuf.radius) || 50,
        openTime: branchEditBuf.openTime,
        closeTime: branchEditBuf.closeTime,
      }),
    });
    const data = await res.json();
    if (data.success) { toast('บันทึกสำเร็จ', 'success'); setEditBranchId(null); loadMgData(); }
    else toast(data.error || 'บันทึกไม่สำเร็จ', 'error');
  });

  // ── Manage: add staff ─────────────────────────────────────────────────────────
  const handleAddStaffSubmit = () => {
    if (!staffForm.firstName.trim() || !staffForm.lastName.trim() || !staffForm.mainBranchId) {
      toast('กรุณากรอกชื่อ นามสกุล และเลือกสาขา', 'warn'); return;
    }
    const name = `${staffForm.prefix}${staffForm.firstName} ${staffForm.lastName}`.trim();
    requirePwd(async () => {
      setAddingStaff(true);
      try {
        const res  = await fetch('/api/staff', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, nickname: staffForm.nickname.trim(), mainBranchId: staffForm.mainBranchId }),
        });
        const data = await res.json();
        if (data.success) {
          toast(`เพิ่ม "${name}" สำเร็จ`, 'success');
          setStaffForm({ prefix: 'นาย', firstName: '', lastName: '', nickname: '', mainBranchId: '' });
          setShowAddStaff(false);
          loadMgData();
        } else toast(data.error || 'เพิ่มไม่สำเร็จ', 'error');
      } finally { setAddingStaff(false); }
    });
  };

  // ── Manage: add branch ────────────────────────────────────────────────────────
  const handleAddBranchSubmit = () => {
    if (!branchForm.id || !branchForm.name || !branchForm.province) {
      toast('กรุณากรอกรหัส ชื่อ และเลือกจังหวัด', 'warn'); return;
    }
    const gpsVal = branchForm.gps.trim() ? parseGps(branchForm.gps) : { lat: 0, lng: 0 };
    if (branchForm.gps.trim() && !gpsVal) {
      toast('รูปแบบ GPS ไม่ถูกต้อง เช่น 15.1141, 104.3235', 'warn'); return;
    }
    requirePwd(async () => {
      setAddingBranch(true);
      try {
        const res  = await fetch('/api/branches', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: branchForm.id.toUpperCase(), name: branchForm.name, province: branchForm.province,
            totalStaff: Number(branchForm.totalStaff) || 0, minStaff: Number(branchForm.minStaff) || 0,
            lat: gpsVal!.lat, lng: gpsVal!.lng, radius: Number(branchForm.radius) || 50,
            openTime: branchForm.openTime, closeTime: branchForm.closeTime,
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast('เพิ่มสาขาสำเร็จ', 'success');
          setBranchForm({ id: '', name: '', province: '', totalStaff: '', minStaff: '', gps: '', radius: '50', openTime: '09:00', closeTime: '18:00' });
          setShowAddBranch(false);
          loadMgData();
        } else toast(data.error || 'เพิ่มไม่สำเร็จ', 'error');
      } finally { setAddingBranch(false); }
    });
  };

  // ── Effects ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authed) return;
    fetchDashboard();
    const id = setInterval(() => fetchDashboard(true), 15000);
    return () => clearInterval(id);
  }, [authed]);

  useEffect(() => {
    if (!authed || tab === 'dashboard' || tab === 'summary' || tab === 'manage') return;
    const id = setInterval(() => fetchReport(tab, rDate, true), 30000);
    return () => clearInterval(id);
  }, [authed, tab, rDate]);

  useEffect(() => {
    if (authed && tab !== 'dashboard' && tab !== 'summary' && tab !== 'manage') fetchReport(tab, rDate);
  }, [tab, rDate, authed]);

  useEffect(() => {
    if (authed && tab === 'manage' && staffMg.length === 0 && branchesMg.length === 0) loadMgData();
  }, [tab, authed]);

  const handleDateChange = (d: string) => { setRDate(d); loadedRef.current[tab] = undefined; };
  const refreshAll = () => {
    loadedRef.current = {};
    fetchDashboard();
    if (tab !== 'dashboard' && tab !== 'summary' && tab !== 'manage') fetchReport(tab, rDate, true);
    if (tab === 'manage') loadMgData();
  };

  // Derived
  const totalStaff   = branches.reduce((s, b) => s + b.total,  0);
  const totalPresent = branches.reduce((s, b) => s + b.actual, 0);
  const totalAbsent  = branches.reduce((s, b) => s + b.missing.length, 0);
  const totalCross   = branches.reduce((s, b) => s + b.crossBranch.length, 0);
  const branchGreen  = branches.filter(b => b.colorStatus === 'green').length;
  const branchRed    = branches.filter(b => b.colorStatus === 'red').length;

  const mgFiltered   = staffMg.filter(s => s.name.includes(mgSearch) || (s.nickname || '').includes(mgSearch) || s.mainBranchId.includes(mgSearch));
  const mgBranchName = (id: string) => branchesMg.find(b => b.id === id)?.name || id;

  const statusChip = (s: MgStaff) => {
    if (s.status === 'Inactive') return <span className="chip chip-bad">ลาออก</span>;
    if (!s.lineId)               return <span className="chip chip-warn" style={{ background: 'var(--warn-50)', color: 'var(--warn)', borderColor: '#f3dfb3' }}>รอ LINE</span>;
    if (!s.hasDescriptors)       return <span className="chip chip-warn">รอลงหน้า</span>;
    return <span className="chip chip-ok">พร้อม</span>;
  };

  // ══════════════════════════════════════════════════════════════
  // LOGIN
  // ══════════════════════════════════════════════════════════════
  if (!authed) return (
    <>
      <div className="shell" style={{ paddingTop: 20 }}>
        <div className="card spring-pop" style={{ marginTop: 40, padding: '40px 28px' }}>
          <div className="eyebrow" style={{ textAlign: 'center', marginBottom: 16 }}>Office</div>
          <div style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 24 }}>รหัสผ่าน</div>
          <input type="password" placeholder="••••••••" value={pwd}
            onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ ...inp, textAlign: 'center', fontSize: 18, letterSpacing: '.25em', marginBottom: 14 }}
          />
          <button onClick={handleLogin} disabled={logging} className="btn btn-primary" style={{ width: '100%', padding: 16 }}>
            {logging ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
          </button>
          <a href="/" style={{ display: 'block', textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}>
            กลับหน้าหลัก
          </a>
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </>
  );

  // ══════════════════════════════════════════════════════════════
  // MAIN
  // ══════════════════════════════════════════════════════════════
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px 80px' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 0 16px', borderBottom: '1px solid var(--line)', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 44, fontWeight: 700, color: 'var(--navy-900)', fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-1px' }}>
              {clock || '--:--:--'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
              {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' })}
            </div>
            {lastUpd && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span className="live-dot" />อัพเดทล่าสุด {lastUpd}
              </div>
            )}
          </div>
          <button onClick={refreshAll} style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid var(--line)', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', fontFamily: 'inherit', flexShrink: 0 }}>
            รีเฟรช
          </button>
        </div>

        {/* KPI Strip */}
        <div className="kpi-grid" style={{ marginTop: 20 }}>
          {[
            { lbl: 'พนักงาน',     num: totalStaff,   cls: '' },
            { lbl: 'เข้างานแล้ว', num: totalPresent, cls: totalPresent >= totalStaff ? 'acc-green' : '' },
            { lbl: 'ขาดงาน',      num: totalAbsent,  cls: totalAbsent  > 0 ? 'acc-red'  : 'acc-green' },
            { lbl: 'สาขาครบ/ขาด', num: `${branchGreen}/${branchRed}`, cls: branchRed > 0 ? 'acc-warn' : 'acc-green' },
            { lbl: 'ช่วยสาขาอื่น',num: totalCross,   cls: totalCross > 0 ? 'acc-warn' : '' },
          ].map(k => (
            <div key={k.lbl} className={`kpi ${k.cls}`}>
              <div className="lbl">{k.lbl}</div>
              <div className="num" key={String(k.num)}>{k.num}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'var(--surface)', borderRadius: 12, padding: 4, border: '1px solid var(--line)', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flexShrink: 0, padding: '9px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: tab === t.key ? 'var(--navy-900)' : 'transparent',
            color:      tab === t.key ? '#fff' : 'var(--muted)',
            fontWeight: tab === t.key ? 600 : 400,
            fontSize: 12, fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && (
        <div className="tab-panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {branches.map(b => (
            <div key={b.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <button onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: SC[b.colorStatus], flexShrink: 0, boxShadow: `0 0 6px ${SC[b.colorStatus]}` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{b.province} · {b.openTime}–{b.closeTime}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 22, color: SC[b.colorStatus] }}>{b.actual}<span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>/{b.total}</span></div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{SL[b.colorStatus]}</div>
                </div>
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>{expanded === b.id ? '▲' : '▼'}</span>
              </button>

              {expanded === b.id && (
                <div style={{ borderTop: '1px solid var(--line)', padding: '12px 20px', background: 'var(--bg)' }}>
                  <Sect label={`เข้างานแล้ว (${b.present.length})`} color="var(--success)" show={b.present.length > 0}>
                    {b.present.map(p => {
                      const rk = `${b.id}:${p.name}`;
                      return (
                        <Row key={p.name} isNew={newRowKeys.has(rk)}>
                          <span>{p.nickname ? <b style={{ color: GOLD }}>({p.nickname})</b> : null} {p.name}{p.isCross && <Tag cls="chip-warn">ข้ามสาขา</Tag>}</span>
                          <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{p.time}</span>
                        </Row>
                      );
                    })}
                  </Sect>
                  <Sect label={`ช่วยสาขาอื่น (${b.crossBranch.length})`} color="var(--warn)" show={b.crossBranch.length > 0}>
                    {b.crossBranch.map(p => <Row key={p.name}><span>{p.nickname ? <b style={{ color: GOLD }}>({p.nickname})</b> : null} {p.name}</span></Row>)}
                  </Sect>
                  <Sect label={`ยังไม่มา (${b.missing.length})`} color="var(--red)" show={b.missing.length > 0}>
                    {b.missing.map(m => <Row key={m.name}><span>{m.nickname ? <b style={{ color: GOLD }}>({m.nickname})</b> : null} {m.name}</span></Row>)}
                  </Sect>
                  {b.present.length === 0 && b.missing.length === 0 && (
                    <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', margin: 0, padding: 8 }}>ไม่มีพนักงานประจำสาขานี้</p>
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
        <div className="tab-panel">
          <DateBar date={rDate} onChange={handleDateChange} loading={rLoading} onRefresh={() => { loadedRef.current.absent = undefined; fetchReport('absent', rDate, true); }} />
          {rLoading ? <Spinner /> : absentList.length === 0
            ? <Empty>ไม่มีพนักงานขาดงาน</Empty>
            : <>
                <div style={{ marginBottom: 12 }}><span className="chip chip-bad">{absentList.length} คน</span></div>
                <div className="card" style={{ overflow: 'hidden' }}>
                  <table className="tbl">
                    <thead><tr><th>ชื่อ</th><th>ชื่อเล่น</th><th>สาขา</th></tr></thead>
                    <tbody>
                      {absentList.map((s, i) => (
                        <tr key={i} className="row-hover">
                          <td style={{ fontWeight: 500 }}>{s.name}</td>
                          <td style={{ color: GOLD, fontWeight: 600 }}>{s.nickname || '—'}</td>
                          <td><span className="chip chip-bad">{s.mainBranchId}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
          }
        </div>
      )}

      {/* ── LATE ── */}
      {tab === 'late' && (
        <div className="tab-panel">
          <DateBar date={rDate} onChange={handleDateChange} loading={rLoading} onRefresh={() => { loadedRef.current.late = undefined; fetchReport('late', rDate, true); }} />
          {rLoading ? <Spinner /> : lateList.length === 0
            ? <Empty>ไม่มีพนักงานมาสาย</Empty>
            : <>
                <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="chip chip-warn">{lateList.length} คน</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    เฉลี่ย {Math.round(lateList.reduce((s, r) => s + (r.lateMinutes || 0), 0) / lateList.length)} นาที
                  </span>
                </div>
                <div className="card" style={{ overflow: 'hidden' }}>
                  <table className="tbl">
                    <thead><tr><th>ชื่อ</th><th>เวลาเข้า</th><th>สาย</th><th>สาขา</th></tr></thead>
                    <tbody>
                      {lateList.map((r, i) => (
                        <tr key={i} className="row-hover">
                          <td>
                            <div style={{ fontWeight: 600 }}>{r.name}</div>
                            {r.nickname && <div style={{ color: GOLD, fontSize: 11, fontWeight: 700 }}>({r.nickname})</div>}
                          </td>
                          <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.time} น.</td>
                          <td><span className="chip chip-warn">{r.lateMinutes} นาที</span></td>
                          <td style={{ color: 'var(--muted)', fontSize: 12 }}>{r.branchId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
          }
        </div>
      )}

      {/* ── LOGS ── */}
      {tab === 'logs' && (
        <div className="tab-panel">
          <DateBar date={rDate} onChange={handleDateChange} loading={rLoading} onRefresh={() => { loadedRef.current.logs = undefined; fetchReport('logs', rDate, true); }} />
          {rLoading ? <Spinner /> : logsList.length === 0
            ? <Empty>ไม่มีบันทึกวันนี้</Empty>
            : <>
                <div style={{ marginBottom: 12, display: 'flex', gap: 6 }}>
                  <span className="chip chip-ok">{logsList.filter((r: any) => r.type === 'IN').length} เข้า</span>
                  <span className="chip chip-bad">{logsList.filter((r: any) => r.type === 'OUT').length} ออก</span>
                </div>
                <div className="card" style={{ overflow: 'hidden' }}>
                  <table className="tbl">
                    <thead><tr><th>ชื่อ</th><th>เวลา</th><th>ประเภท</th><th>สถานะ</th><th>สาขา</th></tr></thead>
                    <tbody>
                      {logsList.map((r: any, i: number) => (
                        <tr key={i} className="row-hover">
                          <td>
                            <div style={{ fontWeight: 600 }}>{r.name}</div>
                            {r.nickname && <div style={{ color: GOLD, fontSize: 11, fontWeight: 700 }}>({r.nickname})</div>}
                          </td>
                          <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.time} น.</td>
                          <td><span className={`chip ${r.type === 'IN' ? 'chip-ok' : 'chip-bad'}`}>{r.type === 'IN' ? 'เข้า' : 'ออก'}</span></td>
                          <td><span className={`chip ${r.status === 'ทันเวลา' ? 'chip-ok' : 'chip-warn'}`}>{r.status}</span></td>
                          <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {r.branchId}{r.isCrossBranch && <Tag cls="chip-warn">ข้ามสาขา</Tag>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
          }
        </div>
      )}

      {/* ── SUMMARY ── */}
      {tab === 'summary' && (
        <div className="tab-panel">
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>ตั้งแต่</div>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                style={{ borderRadius: 9, border: '1px solid var(--line)', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>ถึง</div>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                style={{ borderRadius: 9, border: '1px solid var(--line)', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <button onClick={fetchSummary} disabled={rLoading} className="btn btn-primary" style={{ padding: '8px 18px', fontSize: 13 }}>
              {rLoading ? '...' : 'ดูสรุป'}
            </button>
          </div>

          {rLoading ? <Spinner /> : !summary
            ? <div style={{ color: 'var(--muted)', fontSize: 13, padding: 20, textAlign: 'center' }}>เลือกช่วงเวลาแล้วกด &quot;ดูสรุป&quot;</div>
            : <>
                <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' }}>
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓ มา</span>
                  <span style={{ color: 'var(--warn)', fontWeight: 700 }}>! สาย</span>
                  <span style={{ color: 'var(--red)', fontWeight: 700 }}>✕ ขาด</span>
                </div>
                <div className="card" style={{ overflow: 'auto' }}>
                  <table className="tbl" style={{ minWidth: Math.max(400, 180 + summary.dates.length * 58) }}>
                    <thead>
                      <tr>
                        <th style={{ position: 'sticky', left: 0, background: 'var(--navy-900)', zIndex: 1, minWidth: 130 }}>ชื่อ</th>
                        <th style={{ textAlign: 'center' }}>มา</th>
                        <th style={{ textAlign: 'center' }}>สาย</th>
                        <th style={{ textAlign: 'center' }}>ขาด</th>
                        {summary.dates.map(d => (
                          <th key={d} style={{ textAlign: 'center', whiteSpace: 'nowrap', minWidth: 52, fontVariantNumeric: 'tabular-nums' }}>
                            {d.slice(8)}/{d.slice(5, 7)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summary.data.map((s: any, i: number) => (
                        <tr key={i} className="row-hover">
                          <td style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 1, whiteSpace: 'nowrap' }}>
                            {s.nickname ? <span style={{ color: GOLD, fontWeight: 700, fontSize: 12 }}>({s.nickname}) </span> : ''}
                            <span style={{ fontWeight: 600 }}>{s.name}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}><span className="chip chip-ok">{s.totalPresent}</span></td>
                          <td style={{ textAlign: 'center' }}><span className={`chip ${s.totalLate > 0 ? 'chip-warn' : 'chip-ok'}`}>{s.totalLate}</span></td>
                          <td style={{ textAlign: 'center' }}><span className={`chip ${s.totalAbsent > 0 ? 'chip-bad' : 'chip-ok'}`}>{s.totalAbsent}</span></td>
                          {s.days.map((day: any, j: number) => (
                            <td key={j} style={{ textAlign: 'center', padding: '8px 4px' }}>
                              {day.status === 'present' && <span title={day.time} style={{ color: 'var(--success)', fontWeight: 700 }}>✓</span>}
                              {day.status === 'late'    && <span title={`สาย ${day.lateMinutes} นาที`} style={{ color: 'var(--warn)', fontWeight: 700 }}>!</span>}
                              {day.status === 'absent'  && <span style={{ color: 'var(--red)', fontWeight: 700 }}>✕</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
          }
        </div>
      )}

      {/* ══════════════ MANAGE ══════════════ */}
      {tab === 'manage' && (
        <div className="tab-panel">

          {/* ─── STAFF SECTION ─── */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>พนักงาน</div>
                <span className="chip chip-ok">{staffMg.filter(s => s.status !== 'Inactive').length} คน</span>
              </div>
              <button
                onClick={() => { setShowAddStaff(v => !v); setShowAddBranch(false); }}
                className="btn btn-soft"
                style={{ padding: '7px 14px', fontSize: 12 }}
              >
                {showAddStaff ? 'ซ่อน ✕' : '+ เพิ่มพนักงาน'}
              </button>
            </div>

            {/* Add staff form */}
            {showAddStaff && (
              <div className="card spring-pop" style={{ padding: '20px 18px', marginBottom: 12, border: '1.5px solid var(--navy-900)' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--navy-900)', marginBottom: 14 }}>เพิ่มพนักงานใหม่</div>

                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>คำนำหน้า *</label>
                  <select value={staffForm.prefix} onChange={e => setStaffForm(p => ({ ...p, prefix: e.target.value }))} style={inp}>
                    {PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={lbl}>ชื่อ *</label>
                    <input type="text" placeholder="สมชาย" value={staffForm.firstName}
                      onChange={e => setStaffForm(p => ({ ...p, firstName: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>นามสกุล *</label>
                    <input type="text" placeholder="ใจดี" value={staffForm.lastName}
                      onChange={e => setStaffForm(p => ({ ...p, lastName: e.target.value }))} style={inp} />
                  </div>
                </div>

                {(staffForm.firstName || staffForm.lastName) && (
                  <div style={{ marginBottom: 10, padding: '7px 12px', borderRadius: 8, background: 'var(--navy-50)', fontSize: 13 }}>
                    ชื่อเต็ม: <strong style={{ color: 'var(--navy-900)' }}>{staffForm.prefix}{staffForm.firstName} {staffForm.lastName}</strong>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <div>
                    <label style={lbl}>ชื่อเล่น</label>
                    <input type="text" placeholder="ชาย" value={staffForm.nickname}
                      onChange={e => setStaffForm(p => ({ ...p, nickname: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>สาขา *</label>
                    <select value={staffForm.mainBranchId} onChange={e => setStaffForm(p => ({ ...p, mainBranchId: e.target.value }))} style={inp}>
                      <option value="">เลือกสาขา</option>
                      {branchesMg.map(b => <option key={b.id} value={b.id}>{b.name} [{b.id}]</option>)}
                    </select>
                  </div>
                </div>

                <button onClick={handleAddStaffSubmit} disabled={addingStaff} className="btn btn-primary" style={{ width: '100%', padding: 14 }}>
                  {addingStaff ? 'กำลังเพิ่ม...' : 'เพิ่มพนักงาน — กดบันทึก ใส่รหัส'}
                </button>
              </div>
            )}

            {/* Search */}
            <input type="text" placeholder="ค้นหาชื่อ, ชื่อเล่น, สาขา..."
              value={mgSearch} onChange={e => setMgSearch(e.target.value)}
              style={{ ...inp, marginBottom: 10 }}
            />

            {/* Staff list */}
            {mgLoading
              ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 68, borderRadius: 14 }} />)}
                </div>
              : <div className="cascade" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {mgFiltered.map(s => (
                    <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                      <button
                        onClick={() => {
                          if (editStaffId === s.id) { setEditStaffId(null); return; }
                          setEditStaffId(s.id);
                          setBranchEditBuf(prev => prev); // keep branch buf
                          setStaffEditBuf({ nickname: s.nickname || '', mainBranchId: s.mainBranchId, status: s.status });
                        }}
                        style={{ width: '100%', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--navy-900)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, flexShrink: 0, fontSize: 14 }}>
                          {s.name.charAt(0)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>
                            {s.nickname && <span style={{ color: GOLD, fontSize: 12 }}>({s.nickname}) </span>}
                            {s.name}
                          </div>
                          <div className="eyebrow" style={{ marginTop: 2 }}>{mgBranchName(s.mainBranchId)} · {s.mainBranchId}</div>
                        </div>
                        {statusChip(s)}
                        <span style={{ color: 'var(--muted)', fontSize: 13, marginLeft: 4 }}>
                          {editStaffId === s.id ? '▲' : '✏️'}
                        </span>
                      </button>

                      {editStaffId === s.id && (
                        <div style={{ borderTop: '1px solid var(--line)', padding: '14px 16px', background: 'var(--bg)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                            <div>
                              <label style={lbl}>ชื่อเล่น</label>
                              <input type="text" value={staffEditBuf.nickname}
                                onChange={e => setStaffEditBuf(p => ({ ...p, nickname: e.target.value }))} style={inp} />
                            </div>
                            <div>
                              <label style={lbl}>สาขา</label>
                              <select value={staffEditBuf.mainBranchId}
                                onChange={e => setStaffEditBuf(p => ({ ...p, mainBranchId: e.target.value }))} style={inp}>
                                {branchesMg.map(b => <option key={b.id} value={b.id}>{b.id}</option>)}
                              </select>
                            </div>
                            <div>
                              <label style={lbl}>สถานะ</label>
                              <select value={staffEditBuf.status}
                                onChange={e => setStaffEditBuf(p => ({ ...p, status: e.target.value }))} style={inp}>
                                <option value="Pending">Pending</option>
                                <option value="Active">Active</option>
                                <option value="Inactive">ลาออก</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => handleSaveStaff(s)} className="btn btn-primary" style={{ flex: 1, padding: '10px', fontSize: 13 }}>
                              บันทึก
                            </button>
                            <button onClick={() => setEditStaffId(null)} className="btn btn-ghost" style={{ padding: '10px 14px', fontSize: 13 }}>
                              ยกเลิก
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {mgFiltered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)', fontSize: 14 }}>
                      {mgSearch ? 'ไม่พบพนักงาน' : 'ยังไม่มีพนักงาน — กด "+ เพิ่มพนักงาน" ด้านบน'}
                    </div>
                  )}
                </div>
            }
          </div>

          {/* ─── BRANCH SECTION ─── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>สาขา</div>
                <span className="chip chip-ok">{branchesMg.length} สาขา</span>
              </div>
              <button
                onClick={() => { setShowAddBranch(v => !v); setShowAddStaff(false); }}
                className="btn btn-soft"
                style={{ padding: '7px 14px', fontSize: 12 }}
              >
                {showAddBranch ? 'ซ่อน ✕' : '+ เพิ่มสาขา'}
              </button>
            </div>

            {/* Add branch form */}
            {showAddBranch && (
              <div className="card spring-pop" style={{ padding: '20px 18px', marginBottom: 12, border: '1.5px solid var(--navy-900)' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--navy-900)', marginBottom: 14 }}>เพิ่มสาขาใหม่</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={lbl}>รหัสสาขา *</label>
                    <input type="text" placeholder="B01" value={branchForm.id}
                      onChange={e => setBranchForm(p => ({ ...p, id: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>ชื่อสาขา *</label>
                    <input type="text" placeholder="เซ็นทรัล เชียงใหม่" value={branchForm.name}
                      onChange={e => setBranchForm(p => ({ ...p, name: e.target.value }))} style={inp} />
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>จังหวัด *</label>
                  <select value={branchForm.province} onChange={e => setBranchForm(p => ({ ...p, province: e.target.value }))} style={inp}>
                    <option value="">เลือกจังหวัด</option>
                    {PROVINCES.map(pv => <option key={pv} value={pv}>{pv}</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={lbl}>พนักงานทั้งหมด</label>
                    <input type="number" placeholder="10" value={branchForm.totalStaff}
                      onChange={e => setBranchForm(p => ({ ...p, totalStaff: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>ขั้นต่ำ</label>
                    <input type="number" placeholder="5" value={branchForm.minStaff}
                      onChange={e => setBranchForm(p => ({ ...p, minStaff: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>เปิด</label>
                    <input type="time" value={branchForm.openTime}
                      onChange={e => setBranchForm(p => ({ ...p, openTime: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>ปิด</label>
                    <input type="time" value={branchForm.closeTime}
                      onChange={e => setBranchForm(p => ({ ...p, closeTime: e.target.value }))} style={inp} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end', marginBottom: 16 }}>
                  <div>
                    <label style={lbl}>GPS (lat, lng)</label>
                    <input type="text" placeholder="15.114112, 104.323573" value={branchForm.gps}
                      onChange={e => setBranchForm(p => ({ ...p, gps: e.target.value }))} style={inp} />
                    {branchForm.gps && (
                      <div style={{ fontSize: 11, marginTop: 4, color: parseGps(branchForm.gps) ? 'var(--success)' : 'var(--red)' }}>
                        {parseGps(branchForm.gps) ? `✓ ${parseGps(branchForm.gps)!.lat.toFixed(5)}, ${parseGps(branchForm.gps)!.lng.toFixed(5)}` : 'รูปแบบไม่ถูกต้อง'}
                      </div>
                    )}
                  </div>
                  <div style={{ width: 80 }}>
                    <label style={lbl}>รัศมี (ม.)</label>
                    <input type="number" placeholder="50" value={branchForm.radius}
                      onChange={e => setBranchForm(p => ({ ...p, radius: e.target.value }))} style={inp} />
                  </div>
                </div>

                <button onClick={handleAddBranchSubmit} disabled={addingBranch} className="btn btn-primary" style={{ width: '100%', padding: 14 }}>
                  {addingBranch ? 'กำลังเพิ่ม...' : 'เพิ่มสาขา — กดบันทึก ใส่รหัส'}
                </button>
              </div>
            )}

            {/* Branch list */}
            <div className="cascade" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {branchesMg.map(b => {
                const count = staffMg.filter(s => s.mainBranchId === b.id && s.status !== 'Inactive').length;
                const ready = staffMg.filter(s => s.mainBranchId === b.id && s.status === 'Active' && s.hasDescriptors).length;
                return (
                  <div key={b.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <button
                      onClick={() => {
                        if (editBranchId === b.id) { setEditBranchId(null); return; }
                        setEditBranchId(b.id);
                        setBranchEditBuf({
                          name: b.name, province: b.province,
                          gps: b.lat ? `${b.lat}, ${b.lng}` : '',
                          radius: String(b.radius),
                          openTime: b.openTime, closeTime: b.closeTime,
                          totalStaff: String(b.totalStaff), minStaff: String(b.minStaff),
                        });
                      }}
                      style={{ width: '100%', padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{b.name}</div>
                        <div className="eyebrow" style={{ marginTop: 2 }}>[{b.id}] {b.province}{b.openTime ? ` · ${b.openTime}–${b.closeTime}` : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right', marginRight: 8, flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--navy-900)' }}>{count}<span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 11 }}> คน</span></div>
                        {count - ready > 0
                          ? <div style={{ fontSize: 10, color: 'var(--warn)' }}>{ready} พร้อม / {count - ready} รอ</div>
                          : <div style={{ fontSize: 10, color: 'var(--success)' }}>พร้อมทุกคน</div>
                        }
                      </div>
                      {b.lat !== 0 && <span className="chip" style={{ background:'var(--info-50)', color:'var(--info)', borderColor:'#cddff0', flexShrink: 0 }}>GPS</span>}
                      <span style={{ color: 'var(--muted)', fontSize: 13, flexShrink: 0 }}>
                        {editBranchId === b.id ? '▲' : '✏️'}
                      </span>
                    </button>

                    {editBranchId === b.id && (
                      <div style={{ borderTop: '1px solid var(--line)', padding: '14px 18px', background: 'var(--bg)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                          <div>
                            <label style={lbl}>ชื่อสาขา</label>
                            <input type="text" value={branchEditBuf.name}
                              onChange={e => setBranchEditBuf(p => ({ ...p, name: e.target.value }))} style={inp} />
                          </div>
                          <div>
                            <label style={lbl}>จังหวัด</label>
                            <select value={branchEditBuf.province}
                              onChange={e => setBranchEditBuf(p => ({ ...p, province: e.target.value }))} style={inp}>
                              {PROVINCES.map(pv => <option key={pv} value={pv}>{pv}</option>)}
                            </select>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                          <div>
                            <label style={lbl}>พนักงาน</label>
                            <input type="number" value={branchEditBuf.totalStaff}
                              onChange={e => setBranchEditBuf(p => ({ ...p, totalStaff: e.target.value }))} style={inp} />
                          </div>
                          <div>
                            <label style={lbl}>ขั้นต่ำ</label>
                            <input type="number" value={branchEditBuf.minStaff}
                              onChange={e => setBranchEditBuf(p => ({ ...p, minStaff: e.target.value }))} style={inp} />
                          </div>
                          <div>
                            <label style={lbl}>เปิด</label>
                            <input type="time" value={branchEditBuf.openTime}
                              onChange={e => setBranchEditBuf(p => ({ ...p, openTime: e.target.value }))} style={inp} />
                          </div>
                          <div>
                            <label style={lbl}>ปิด</label>
                            <input type="time" value={branchEditBuf.closeTime}
                              onChange={e => setBranchEditBuf(p => ({ ...p, closeTime: e.target.value }))} style={inp} />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8, marginBottom: 14 }}>
                          <div>
                            <label style={lbl}>GPS (lat, lng)</label>
                            <input type="text" placeholder="15.114112, 104.323573" value={branchEditBuf.gps}
                              onChange={e => setBranchEditBuf(p => ({ ...p, gps: e.target.value }))} style={inp} />
                            {branchEditBuf.gps && (
                              <div style={{ fontSize: 11, marginTop: 3, color: parseGps(branchEditBuf.gps) ? 'var(--success)' : 'var(--red)' }}>
                                {parseGps(branchEditBuf.gps) ? '✓ ถูกต้อง' : 'รูปแบบไม่ถูกต้อง'}
                              </div>
                            )}
                          </div>
                          <div>
                            <label style={lbl}>รัศมี (ม.)</label>
                            <input type="number" value={branchEditBuf.radius}
                              onChange={e => setBranchEditBuf(p => ({ ...p, radius: e.target.value }))} style={inp} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleSaveBranch(b)} className="btn btn-primary" style={{ flex: 1, padding: '10px', fontSize: 13 }}>
                            บันทึก
                          </button>
                          <button onClick={() => setEditBranchId(null)} className="btn btn-ghost" style={{ padding: '10px 14px', fontSize: 13 }}>
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {branchesMg.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)', fontSize: 14 }}>
                  ยังไม่มีสาขา — กด &quot;+ เพิ่มสาขา&quot; ด้านบน
                </div>
              )}
            </div>
          </div>

        </div>
      )}
      {/* ══════════════ END MANAGE ══════════════ */}

      <ToastContainer toasts={toasts} />

      {/* ─── Password Modal ─── */}
      {pwdModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20,
          }}
          onClick={e => { if (e.target === e.currentTarget) { setPwdModal(null); setPwdVal(''); } }}
        >
          <div className="card spring-pop" style={{ width: '100%', maxWidth: 340, padding: '28px 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔐</div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>ยืนยันการแก้ไข</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>ใส่รหัสผ่านเพื่อบันทึก</div>
            </div>
            <input
              type="password"
              placeholder="••••••••"
              value={pwdVal}
              onChange={e => setPwdVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doPwdConfirm()}
              autoFocus
              style={{ ...inp, textAlign: 'center', fontSize: 20, letterSpacing: '.2em', marginBottom: 14 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setPwdModal(null); setPwdVal(''); }} className="btn btn-ghost" style={{ flex: 1, padding: 14 }}>
                ยกเลิก
              </button>
              <button onClick={doPwdConfirm} disabled={pwdBusy} className="btn btn-primary" style={{ flex: 1, padding: 14 }}>
                {pwdBusy ? '...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DateBar({ date, onChange, loading, onRefresh }: { date: string; onChange: (d: string) => void; loading: boolean; onRefresh: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <input type="date" value={date} onChange={e => onChange(e.target.value)}
        style={{ borderRadius: 9, border: '1px solid var(--line)', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
      {loading
        ? <div className="spinner-sm" />
        : <button onClick={onRefresh} style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: '1px solid var(--line)', padding: '7px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit' }}>รีเฟรช</button>
      }
    </div>
  );
}

function Spinner() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 14 }}>{children}</div>;
}

function Sect({ label, color, show, children }: { label: string; color: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="eyebrow" style={{ color, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function Row({ children, isNew }: { children: React.ReactNode; isNew?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0', borderBottom: '1px solid var(--line-2)', fontSize: 13,
      ...(isNew ? { animation: 'rowSlideIn .55s ease-out forwards', borderRadius: 6, paddingLeft: 4 } : {})
    }}>
      {children}
    </div>
  );
}

function Tag({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`chip ${cls}`} style={{ marginLeft: 6, fontSize: 9 }}>{children}</span>;
}
