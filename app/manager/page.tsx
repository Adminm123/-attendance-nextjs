'use client';

import { useState } from 'react';
import { useToast, ToastContainer } from '@/components/Toast';
import { PROVINCES, PREFIXES }      from '@/lib/provinces';

type View = 'login' | 'main';
type Tab  = 'staff' | 'add' | 'branches' | 'add-branch';

interface Staff {
  id: string; name: string; nickname: string;
  mainBranchId: string; status: string; hasDescriptors: boolean; lineId?: string;
}
interface Branch {
  id: string; name: string; province: string;
  openTime?: string; closeTime?: string; minStaff?: number; totalStaff?: number;
}

const GOLD = '#C5962A';
const inp: React.CSSProperties  = { width:'100%', padding:'11px 14px', borderRadius:10, border:'1px solid var(--line)', fontSize:14, outline:'none', fontFamily:'inherit', color:'var(--ink)', background:'#fff' };
const lbl: React.CSSProperties  = { fontSize:11, color:'var(--muted)', marginBottom:5, display:'block', letterSpacing:'.06em', textTransform:'uppercase' as const, fontWeight:500 };

export default function ManagerPage() {
  const { toasts, toast } = useToast();
  const [view, setView]   = useState<View>('login');
  const [tab,  setTab]    = useState<Tab>('staff');
  const [pwd,  setPwd]    = useState('');
  const [loading, setLoad]= useState(false);

  const [staffList, setStaff]   = useState<Staff[]>([]);
  const [branches,  setBranches]= useState<Branch[]>([]);
  const [search,    setSearch]  = useState('');

  // ─── Add staff form (แยก prefix / ชื่อ / นามสกุล) ──────────────────────────────
  const [form, setForm] = useState({
    prefix: 'นาย', firstName: '', lastName: '', nickname: '', mainBranchId: '',
  });
  const [adding, setAdding] = useState(false);

  // ─── Add branch form ──────────────────────────────────────────────────────────
  const [branchForm, setBF] = useState({
    id:'', name:'', province:'',
    totalStaff:'', minStaff:'',
    lat:'', lng:'', radius:'50',
    openTime:'09:00', closeTime:'18:00',
  });
  const [addingBranch, setAB] = useState(false);

  // ─── Login ────────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoad(true);
    try {
      const res  = await fetch('/api/auth/office', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ password: pwd }) });
      const data = await res.json();
      if (data.success && data.role === 'manager') {
        setView('main'); loadData();
      } else if (data.success) {
        toast('บัญชีนี้ไม่มีสิทธิ์ Manager', 'error');
      } else {
        toast('รหัสผ่านไม่ถูกต้อง', 'error');
      }
    } finally { setLoad(false); }
  };

  const loadData = async () => {
    try {
      const [sr, br] = await Promise.all([fetch('/api/staff'), fetch('/api/branches')]);
      const [sd, bd] = await Promise.all([sr.json(), br.json()]);
      setStaff(sd.staff || []);
      setBranches(bd.branches || []);
    } catch { toast('โหลดข้อมูลไม่สำเร็จ', 'error'); }
  };

  // ─── Add staff ────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.mainBranchId) {
      toast('กรุณากรอกชื่อ นามสกุล และเลือกสาขา', 'warn'); return;
    }
    const name = `${form.prefix}${form.firstName} ${form.lastName}`.trim();
    setAdding(true);
    try {
      const res  = await fetch('/api/staff', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name, nickname: form.nickname.trim(), mainBranchId: form.mainBranchId }),
      });
      const data = await res.json();
      if (data.success) {
        toast(`เพิ่ม "${name}" สำเร็จ`, 'success');
        setForm({ prefix:'นาย', firstName:'', lastName:'', nickname:'', mainBranchId:'' });
        setTab('staff'); loadData();
      } else { toast(data.error || 'เพิ่มไม่สำเร็จ', 'error'); }
    } finally { setAdding(false); }
  };

  // ─── Transfer branch ──────────────────────────────────────────────────────────
  const handleTransfer = async (name: string, newBranchId: string) => {
    try {
      const res  = await fetch('/api/staff', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name, updates:{ mainBranchId: newBranchId } }) });
      const data = await res.json();
      if (data.success) { toast('ย้ายสาขาสำเร็จ', 'success'); loadData(); }
      else toast(data.error || 'ย้ายไม่สำเร็จ', 'error');
    } catch { toast('เกิดข้อผิดพลาด', 'error'); }
  };

  // ─── Change status ────────────────────────────────────────────────────────────
  const handleStatus = async (name: string, status: string) => {
    if (!window.confirm(`${status === 'Inactive' ? 'ยืนยันลาออก' : 'กลับมาทำงาน'} "${name}" ?`)) return;
    try {
      const res  = await fetch('/api/staff', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name, updates:{ status } }) });
      const data = await res.json();
      if (data.success) { toast('อัพเดทสำเร็จ', 'success'); loadData(); }
    } catch { toast('เกิดข้อผิดพลาด', 'error'); }
  };

  // ─── Add branch ───────────────────────────────────────────────────────────────
  const handleAddBranch = async () => {
    if (!branchForm.id || !branchForm.name || !branchForm.province) {
      toast('กรุณากรอกรหัส ชื่อ และเลือกจังหวัด', 'warn'); return;
    }
    setAB(true);
    try {
      const res  = await fetch('/api/branches', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          id:         branchForm.id.toUpperCase(),
          name:       branchForm.name,
          province:   branchForm.province,
          totalStaff: Number(branchForm.totalStaff) || 0,
          minStaff:   Number(branchForm.minStaff)   || 0,
          lat:        Number(branchForm.lat)         || 0,
          lng:        Number(branchForm.lng)         || 0,
          radius:     Number(branchForm.radius)      || 50,
          openTime:   branchForm.openTime,
          closeTime:  branchForm.closeTime,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast('เพิ่มสาขาสำเร็จ', 'success');
        setBF({ id:'', name:'', province:'', totalStaff:'', minStaff:'', lat:'', lng:'', radius:'50', openTime:'09:00', closeTime:'18:00' });
        setTab('branches'); loadData();
      } else { toast(data.error || 'เพิ่มไม่สำเร็จ', 'error'); }
    } finally { setAB(false); }
  };

  const filtered   = staffList.filter(s => s.name.includes(search) || s.nickname?.includes(search) || s.mainBranchId.includes(search));
  const branchName = (id: string) => branches.find(b => b.id === id)?.name || id;

  const statusChip = (s: Staff) => {
    if (s.status === 'Inactive') return <span className="chip chip-bad">ลาออก</span>;
    if (!s.lineId)               return <span className="chip chip-warn" style={{ background:'var(--warn-50)', color:'var(--warn)', borderColor:'#f3dfb3' }}>รอ LINE</span>;
    if (!s.hasDescriptors)       return <span className="chip chip-warn">รอลงหน้า</span>;
    return <span className="chip chip-ok">พร้อม</span>;
  };

  // ══════════════════════════════════════════════════════════════
  // LOGIN VIEW
  // ══════════════════════════════════════════════════════════════
  if (view === 'login') return (
    <>
      <header style={{ background:'var(--navy-900)', padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:9, letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(255,255,255,.4)', marginBottom:3 }}>MANAGER</div>
          <div style={{ color:'#fff', fontWeight:700, fontSize:16 }}>จัดการพนักงาน</div>
        </div>
        <a href="/" style={{ color:'rgba(255,255,255,.5)', fontSize:11, fontWeight:600, textDecoration:'none', padding:'5px 10px', borderRadius:7, border:'1px solid rgba(255,255,255,.15)' }}>← Home</a>
      </header>
      <div className="shell" style={{ paddingTop:20 }}>
        <div className="card" style={{ marginTop:40, padding:'40px 28px' }}>
          <div className="eyebrow" style={{ textAlign:'center', marginBottom:16 }}>Restricted Access</div>
          <div style={{ fontSize:20, fontWeight:600, textAlign:'center', marginBottom:24, lineHeight:1.5 }}>เข้าสู่ระบบ Manager</div>
          <input
            type="password" placeholder="••••••••" value={pwd}
            onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key==='Enter' && handleLogin()}
            style={{ ...inp, textAlign:'center', fontSize:20, letterSpacing:'.25em', marginBottom:14 }}
          />
          <button onClick={handleLogin} disabled={loading} className="btn btn-primary" style={{ width:'100%', padding:16 }}>
            {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
          </button>
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </>
  );

  // ══════════════════════════════════════════════════════════════
  // MAIN VIEW
  // ══════════════════════════════════════════════════════════════
  return (
    <>
      <header style={{ background:'var(--navy-900)', padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:9, letterSpacing:'.18em', textTransform:'uppercase', color:`rgba(${hexRgb(GOLD)},.7)`, marginBottom:3 }}>Manager · Console</div>
          <div style={{ color:'#fff', fontWeight:700, fontSize:16 }}>จัดการพนักงาน</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <a href="/" style={{ color:'rgba(255,255,255,.5)', fontSize:11, fontWeight:600, textDecoration:'none', padding:'5px 10px', borderRadius:7, border:'1px solid rgba(255,255,255,.15)' }}>← Home</a>
          <button onClick={() => setView('login')} style={{ fontSize:10, fontWeight:600, letterSpacing:'.16em', textTransform:'uppercase', color:'rgba(255,255,255,.4)', background:'none', border:'none', cursor:'pointer' }}>
            Sign out
          </button>
        </div>
      </header>

      <div className="shell" style={{ paddingTop:20 }}>

        {/* KPI */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
          {[
            { lbl:'ทั้งหมด',     val: staffList.length,                                                                        cls:'' },
            { lbl:'พร้อมใช้',    val: staffList.filter(s => s.status==='Active' && s.hasDescriptors).length,                    cls:'acc-green' },
            { lbl:'รอดำเนินการ', val: staffList.filter(s => s.status!=='Inactive' && (!s.lineId || !s.hasDescriptors)).length,  cls:'acc-warn' },
          ].map(k => (
            <div key={k.lbl} className={`kpi ${k.cls}`} style={{ padding:'14px 16px' }}>
              <div className="lbl">{k.lbl}</div>
              <div className="num" style={{ fontSize:26 }}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ display:'flex', gap:4, marginBottom:16, background:'var(--surface)', borderRadius:12, padding:4, border:'1px solid var(--line)' }}>
          {([['staff','พนักงาน'],['add','+ เพิ่ม'],['branches','สาขา'],['add-branch','+ สาขา']] as [Tab,string][]).map(([t,label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex:1, padding:'8px 6px', borderRadius:8, border:'none', cursor:'pointer',
              background: tab===t ? 'var(--navy-900)' : 'transparent',
              color: tab===t ? '#fff' : 'var(--muted)',
              fontWeight: tab===t ? 600 : 400,
              fontSize:12, fontFamily:'inherit', transition:'all .15s',
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* ─── Tab: รายชื่อพนักงาน ──────────────────────────────────────────── */}
        {tab === 'staff' && (
          <>
            <input
              type="text" placeholder="ค้นหาชื่อ, ชื่อเล่น, สาขา..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...inp, marginBottom:12, fontSize:13 }}
            />
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {filtered.map(s => (
                <div key={s.id} className="card" style={{ padding:'16px 18px' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom: s.status!=='Inactive' ? 12 : 0 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:15, lineHeight:1.5 }}>
                        {s.nickname && <span style={{ color:GOLD, fontWeight:700, fontSize:13 }}>({s.nickname}) </span>}
                        {s.name}
                      </div>
                      <div className="eyebrow" style={{ marginTop:3 }}>สาขา {branchName(s.mainBranchId)} · {s.mainBranchId}</div>
                    </div>
                    {statusChip(s)}
                  </div>

                  {s.status !== 'Inactive' && (
                    <div style={{ display:'flex', gap:8 }}>
                      <select defaultValue="" onChange={e => { if (e.target.value) handleTransfer(s.name, e.target.value); }}
                        style={{ flex:1, padding:'7px 10px', borderRadius:8, border:'1px solid var(--line)', fontSize:12, color:'var(--info)', background:'none', cursor:'pointer', fontFamily:'inherit' }}>
                        <option value="" disabled>ย้ายสาขา...</option>
                        {branches.filter(b => b.id !== s.mainBranchId).map(b => (
                          <option key={b.id} value={b.id}>{b.name} [{b.id}]</option>
                        ))}
                      </select>
                      <button onClick={() => handleStatus(s.name, 'Inactive')}
                        style={{ padding:'7px 12px', borderRadius:8, border:'1px solid var(--red-50)', background:'var(--red-50)', color:'var(--red)', fontSize:12, cursor:'pointer', fontWeight:600, fontFamily:'inherit', whiteSpace:'nowrap' }}>
                        ลาออก
                      </button>
                    </div>
                  )}
                  {s.status === 'Inactive' && (
                    <button onClick={() => handleStatus(s.name, 'Pending')}
                      style={{ marginTop:8, width:'100%', padding:'7px', borderRadius:8, border:'1px solid var(--line)', background:'none', color:'var(--muted)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                      กลับมาทำงาน
                    </button>
                  )}
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ textAlign:'center', padding:48, color:'var(--muted)', fontSize:14 }}>
                  {search ? 'ไม่พบพนักงาน' : 'ยังไม่มีพนักงาน — กด "+ เพิ่ม"'}
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── Tab: เพิ่มพนักงาน ───────────────────────────────────────────── */}
        {tab === 'add' && (
          <div className="card" style={{ padding:'22px 20px' }}>
            <div className="eyebrow" style={{ marginBottom:16 }}>เพิ่มพนักงานใหม่</div>

            {/* คำนำหน้า */}
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>คำนำหน้า *</label>
              <select value={form.prefix} onChange={e => setForm(p => ({ ...p, prefix:e.target.value }))} style={inp}>
                {PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* ชื่อ + นามสกุล */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div>
                <label style={lbl}>ชื่อ *</label>
                <input type="text" placeholder="สมชาย" value={form.firstName}
                  onChange={e => setForm(p => ({ ...p, firstName:e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>นามสกุล *</label>
                <input type="text" placeholder="ใจดี" value={form.lastName}
                  onChange={e => setForm(p => ({ ...p, lastName:e.target.value }))} style={inp} />
              </div>
            </div>

            {/* Preview ชื่อเต็ม */}
            {(form.firstName || form.lastName) && (
              <div style={{ marginBottom:12, padding:'8px 12px', borderRadius:8, background:'var(--navy-50)', fontSize:13, color:'var(--ink-soft)' }}>
                ชื่อเต็ม: <strong style={{ color:'var(--navy-900)' }}>
                  {form.prefix}{form.firstName} {form.lastName}
                </strong>
              </div>
            )}

            {/* ชื่อเล่น */}
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>ชื่อเล่น</label>
              <input type="text" placeholder="ชาย" value={form.nickname}
                onChange={e => setForm(p => ({ ...p, nickname:e.target.value }))} style={inp} />
            </div>

            {/* สาขา */}
            <div style={{ marginBottom:20 }}>
              <label style={lbl}>สาขา *</label>
              <select value={form.mainBranchId} onChange={e => setForm(p => ({ ...p, mainBranchId:e.target.value }))} style={inp}>
                <option value="">เลือกสาขา</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name} · {b.id}</option>)}
              </select>
            </div>

            <div style={{ background:'var(--navy-50)', borderRadius:12, padding:14, marginBottom:16, fontSize:12, color:'var(--ink-soft)', lineHeight:1.8 }}>
              📌 หลังเพิ่มแล้ว พนักงานต้อง:<br />
              1. เปิดแอป Login LINE<br />
              2. เลือกชื่อตัวเองในหน้าผูกบัญชี<br />
              3. ลงทะเบียนใบหน้า 5 ท่า
            </div>

            <button onClick={handleAdd} disabled={adding} className="btn btn-primary" style={{ width:'100%', padding:16 }}>
              {adding ? 'กำลังเพิ่ม...' : 'เพิ่มพนักงาน'}
            </button>
          </div>
        )}

        {/* ─── Tab: สาขา ───────────────────────────────────────────────────── */}
        {tab === 'branches' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {branches.map(b => {
              const count = staffList.filter(s => s.mainBranchId===b.id && s.status!=='Inactive').length;
              const ready = staffList.filter(s => s.mainBranchId===b.id && s.status==='Active' && s.hasDescriptors).length;
              return (
                <div key={b.id} className="card" style={{ padding:'16px 18px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:14, lineHeight:1.5 }}>{b.name}</div>
                      <div className="eyebrow" style={{ marginTop:3 }}>[{b.id}] {b.province}{b.openTime ? ` · ${b.openTime}–${b.closeTime}` : ''}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontWeight:700, fontSize:22, color:'var(--navy-900)' }}>{count}</div>
                      <div style={{ fontSize:10, color:'var(--muted)' }}>พนักงาน</div>
                    </div>
                  </div>
                  <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid var(--line-2)', display:'flex', gap:8 }}>
                    <span className="chip chip-ok">{ready} พร้อม</span>
                    {count - ready > 0 && <span className="chip chip-warn">{count - ready} รอลงทะเบียน</span>}
                  </div>
                </div>
              );
            })}
            {branches.length === 0 && (
              <div style={{ textAlign:'center', padding:48, color:'var(--muted)', fontSize:14 }}>
                ยังไม่มีสาขา — กด &quot;+ สาขา&quot; เพื่อเพิ่ม
              </div>
            )}
          </div>
        )}

        {/* ─── Tab: เพิ่มสาขา ──────────────────────────────────────────────── */}
        {tab === 'add-branch' && (
          <div className="card" style={{ padding:'22px 20px' }}>
            <div className="eyebrow" style={{ marginBottom:16 }}>เพิ่มสาขาใหม่</div>

            {/* รหัส + ชื่อ */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:10, marginBottom:12 }}>
              <div>
                <label style={lbl}>รหัสสาขา *</label>
                <input type="text" placeholder="B01" value={branchForm.id}
                  onChange={e => setBF(p => ({ ...p, id:e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>ชื่อสาขา *</label>
                <input type="text" placeholder="เซ็นทรัล เชียงใหม่" value={branchForm.name}
                  onChange={e => setBF(p => ({ ...p, name:e.target.value }))} style={inp} />
              </div>
            </div>

            {/* จังหวัด (dropdown) */}
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>จังหวัด *</label>
              <select value={branchForm.province} onChange={e => setBF(p => ({ ...p, province:e.target.value }))} style={inp}>
                <option value="">เลือกจังหวัด</option>
                {PROVINCES.map(pv => <option key={pv} value={pv}>{pv}</option>)}
              </select>
            </div>

            {/* จำนวนพนักงาน */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div>
                <label style={lbl}>พนักงานทั้งหมด</label>
                <input type="number" placeholder="10" value={branchForm.totalStaff}
                  onChange={e => setBF(p => ({ ...p, totalStaff:e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>ขั้นต่ำที่ต้องมี</label>
                <input type="number" placeholder="5" value={branchForm.minStaff}
                  onChange={e => setBF(p => ({ ...p, minStaff:e.target.value }))} style={inp} />
              </div>
            </div>

            {/* เวลาทำการ */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div>
                <label style={lbl}>เวลาเปิด</label>
                <input type="time" value={branchForm.openTime}
                  onChange={e => setBF(p => ({ ...p, openTime:e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>เวลาปิด</label>
                <input type="time" value={branchForm.closeTime}
                  onChange={e => setBF(p => ({ ...p, closeTime:e.target.value }))} style={inp} />
              </div>
            </div>

            {/* GPS */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:8 }}>
              <div>
                <label style={lbl}>Latitude</label>
                <input type="number" step="any" placeholder="13.7563" value={branchForm.lat}
                  onChange={e => setBF(p => ({ ...p, lat:e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Longitude</label>
                <input type="number" step="any" placeholder="100.5018" value={branchForm.lng}
                  onChange={e => setBF(p => ({ ...p, lng:e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>รัศมี (ม.)</label>
                <input type="number" placeholder="50" value={branchForm.radius}
                  onChange={e => setBF(p => ({ ...p, radius:e.target.value }))} style={inp} />
              </div>
            </div>

            <div style={{ marginBottom:16, padding:'10px 14px', borderRadius:9, background:'var(--info-50)', fontSize:12, color:'var(--info)', lineHeight:1.8 }}>
              📍 เปิด Google Maps → คลิกขวาตำแหน่งสาขา → คัดลอก lat, lng<br />
              รัศมีเริ่มต้น <strong>50 ม.</strong> — ปรับเพิ่มถ้าสาขาใหญ่
            </div>

            <button onClick={handleAddBranch} disabled={addingBranch} className="btn btn-primary" style={{ width:'100%', padding:16 }}>
              {addingBranch ? 'กำลังเพิ่ม...' : 'เพิ่มสาขา'}
            </button>
          </div>
        )}

      </div>
      <ToastContainer toasts={toasts} />
    </>
  );
}

function hexRgb(hex: string) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}
