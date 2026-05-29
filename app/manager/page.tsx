'use client';
// ─── Manager Console ──────────────────────────────────────────────────────────
// สำหรับ Manager/HR จัดการพนักงาน:
// - ดูรายชื่อพนักงานทั้งหมด
// - เพิ่มพนักงานใหม่
// - ย้ายสาขา / เปลี่ยนสถานะ

import { useState, useEffect } from 'react';
import { useToast, ToastContainer } from '@/components/Toast';

type View = 'login' | 'main';
type Tab  = 'staff' | 'add' | 'branches' | 'add-branch';

interface Staff {
  id: string; name: string; nickname: string;
  mainBranchId: string; status: string; hasDescriptors: boolean; lineId?: string;
}
interface Branch { id: string; name: string; province: string; totalStaff: number; }

export default function ManagerPage() {
  const { toasts, toast }   = useToast();
  const [view, setView]     = useState<View>('login');
  const [tab, setTab]       = useState<Tab>('staff');
  const [password, setPwd]  = useState('');
  const [loading, setLoad]  = useState(false);

  // ─── Staff list ───────────────────────────────────────────────────────────
  const [staffList, setStaff]  = useState<Staff[]>([]);
  const [branches, setBranches]= useState<Branch[]>([]);
  const [search, setSearch]    = useState('');

  // ─── Add staff form ───────────────────────────────────────────────────────
  const [form, setForm] = useState({ name: '', nickname: '', mainBranchId: '' });
  const [adding, setAdding] = useState(false);

  // ─── Add branch form ──────────────────────────────────────────────────────
  const [branchForm, setBranchForm] = useState({
    id: '', name: '', province: '',
    totalStaff: '', lat: '', lng: '',
    radius: '200', openTime: '09:00', closeTime: '18:00', minStaff: ''
  });
  const [addingBranch, setAddingBranch] = useState(false);

  // ─── Login ────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoad(true);
    try {
      const res  = await fetch('/api/auth/office', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success && data.role === 'manager') {
        setView('main');
        loadData();
      } else if (data.success) {
        toast('บัญชีนี้ไม่มีสิทธิ์ Manager', 'error');
      } else {
        toast('รหัสผ่านไม่ถูกต้อง', 'error');
      }
    } finally { setLoad(false); }
  };

  // ─── โหลดข้อมูล ──────────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      const [staffRes, branchRes] = await Promise.all([
        fetch('/api/staff'),
        fetch('/api/branches'),
      ]);
      const [staffData, branchData] = await Promise.all([staffRes.json(), branchRes.json()]);
      setStaff(staffData.staff   || []);
      setBranches(branchData.branches || []);
    } catch { toast('โหลดข้อมูลไม่สำเร็จ', 'error'); }
  };

  // ─── เพิ่มพนักงานใหม่ ─────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!form.name.trim() || !form.mainBranchId) {
      toast('กรุณากรอกชื่อและเลือกสาขา', 'warn');
      return;
    }
    setAdding(true);
    try {
      const res  = await fetch('/api/staff', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast('เพิ่มพนักงานสำเร็จ', 'success');
        setForm({ name: '', nickname: '', mainBranchId: '' });
        setTab('staff');
        loadData();
      } else {
        toast(data.error || 'เพิ่มไม่สำเร็จ', 'error');
      }
    } finally { setAdding(false); }
  };

  // ─── ย้ายสาขา ─────────────────────────────────────────────────────────────
  const handleTransfer = async (name: string, newBranchId: string) => {
    try {
      const res  = await fetch('/api/staff', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, updates: { mainBranchId: newBranchId } }),
      });
      const data = await res.json();
      if (data.success) { toast('ย้ายสาขาสำเร็จ', 'success'); loadData(); }
      else toast(data.error || 'ย้ายไม่สำเร็จ', 'error');
    } catch { toast('เกิดข้อผิดพลาด', 'error'); }
  };

  // ─── เพิ่มสาขาใหม่ ────────────────────────────────────────────────────────────
  const handleAddBranch = async () => {
    if (!branchForm.id || !branchForm.name) {
      toast('กรุณากรอกรหัสและชื่อสาขา', 'warn'); return;
    }
    setAddingBranch(true);
    try {
      const res  = await fetch('/api/branches', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          id:         branchForm.id.toUpperCase(),
          name:       branchForm.name,
          province:   branchForm.province,
          totalStaff: Number(branchForm.totalStaff) || 0,
          lat:        Number(branchForm.lat)         || 0,
          lng:        Number(branchForm.lng)         || 0,
          radius:     Number(branchForm.radius)      || 200,
          openTime:   branchForm.openTime,
          closeTime:  branchForm.closeTime,
          minStaff:   Number(branchForm.minStaff)    || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast('เพิ่มสาขาสำเร็จ', 'success');
        setBranchForm({ id:'', name:'', province:'', totalStaff:'', lat:'', lng:'', radius:'200', openTime:'09:00', closeTime:'18:00', minStaff:'' });
        setTab('branches');
        loadData();
      } else {
        toast(data.error || 'เพิ่มไม่สำเร็จ', 'error');
      }
    } finally { setAddingBranch(false); }
  };

  // ─── เปลี่ยนสถานะ (ลาออก/กลับมา) ────────────────────────────────────────
  const handleStatus = async (name: string, status: string) => {
    const confirm = window.confirm(`${status === 'Inactive' ? 'ยืนยันลาออก' : 'กลับมาทำงาน'} "${name}" ?`);
    if (!confirm) return;
    try {
      const res  = await fetch('/api/staff', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, updates: { status } }),
      });
      const data = await res.json();
      if (data.success) { toast('อัพเดทสำเร็จ', 'success'); loadData(); }
    } catch { toast('เกิดข้อผิดพลาด', 'error'); }
  };

  const filtered = staffList.filter(s =>
    s.name.includes(search) || s.nickname?.includes(search) || s.mainBranchId.includes(search)
  );
  const branchName = (id: string) => branches.find(b => b.id === id)?.name || id;

  // ─── Status Badge ──────────────────────────────────────────────────────────
  const statusChip = (s: Staff) => {
    if (s.status === 'Inactive') return <span className="chip chip-bad">ลาออก</span>;
    if (s.status === 'Pending')  return <span className="chip" style={{ background: 'var(--warn-50)', color: 'var(--warn)' }}>รอผูก LINE</span>;
    if (!s.hasDescriptors)       return <span className="chip chip-warn">รอลงทะเบียนหน้า</span>;
    return <span className="chip chip-ok">ใช้งานได้</span>;
  };

  return (
    <>
      <header style={{ background: 'var(--navy-900)', padding: '16px 18px' }}>
        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase' }}>MANAGER</div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>จัดการพนักงาน</div>
      </header>

      <div className="shell" style={{ paddingTop: '20px' }}>

        {/* ─── Login ─────────────────────────────────────────────────── */}
        {view === 'login' && (
          <div className="card" style={{ marginTop: '40px' }}>
            <div style={{ fontWeight: 600, fontSize: '18px', marginBottom: '16px', textAlign: 'center' }}>
              เข้าสู่ระบบ Manager
            </div>
            <input
              type="password"
              placeholder="รหัสผ่าน Manager"
              value={password}
              onChange={e => setPwd(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--line)', fontSize: '15px', marginBottom: '12px', outline: 'none' }}
            />
            <button onClick={handleLogin} disabled={loading} className="btn btn-primary w-full py-4">
              {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
            </button>
          </div>
        )}

        {/* ─── Main ──────────────────────────────────────────────────── */}
        {view === 'main' && (
          <>
            {/* Tab Bar */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'var(--surface)', borderRadius: '12px', padding: '4px', border: '1px solid var(--line)', flexWrap: 'wrap' }}>
              {([['staff', 'พนักงาน'], ['add', '+ พนักงาน'], ['branches', 'สาขา'], ['add-branch', '+ สาขา']] as [Tab, string][]).map(([t, label]) => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: tab === t ? 'var(--navy-900)' : 'transparent',
                  color: tab === t ? '#fff' : 'var(--muted)',
                  fontWeight: tab === t ? 600 : 400,
                  fontSize: '13px', fontFamily: 'inherit',
                }}>
                  {label}
                </button>
              ))}
            </div>

            {/* ─── Tab: รายชื่อพนักงาน ──────────────────────────── */}
            {tab === 'staff' && (
              <>
                {/* สถิติ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                  {[
                    { label: 'ทั้งหมด',     val: staffList.length,                                  color: 'var(--navy-900)' },
                    { label: 'ใช้งานได้',    val: staffList.filter(s => s.status === 'Active' && s.hasDescriptors).length, color: 'var(--success)' },
                    { label: 'รอดำเนินการ', val: staffList.filter(s => s.status === 'Pending' || !s.hasDescriptors).length, color: 'var(--warn)' },
                  ].map(stat => (
                    <div key={stat.label} className="card" style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '22px', fontWeight: 700, color: stat.color }}>{stat.val}</div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* ค้นหา */}
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ, ชื่อเล่น, สาขา..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--line)', fontSize: '13px', marginBottom: '10px', outline: 'none' }}
                />

                {/* รายชื่อ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filtered.map(s => (
                    <div key={s.id} className="card" style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{s.name}</div>
                          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                            {s.nickname && `(${s.nickname}) · `}{branchName(s.mainBranchId)}
                          </div>
                        </div>
                        {statusChip(s)}
                      </div>

                      {/* Action Buttons */}
                      {s.status !== 'Inactive' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {/* ย้ายสาขา */}
                          <select
                            defaultValue=""
                            onChange={e => { if (e.target.value) handleTransfer(s.name, e.target.value); }}
                            style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '12px', color: 'var(--info)', background: 'none', cursor: 'pointer' }}
                          >
                            <option value="" disabled>ย้ายสาขา...</option>
                            {branches.filter(b => b.id !== s.mainBranchId).map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          {/* ลาออก */}
                          <button
                            onClick={() => handleStatus(s.name, 'Inactive')}
                            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--red-50)', background: 'var(--red-50)', color: 'var(--red)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                          >
                            ลาออก
                          </button>
                        </div>
                      )}

                      {s.status === 'Inactive' && (
                        <button
                          onClick={() => handleStatus(s.name, 'Pending')}
                          style={{ width: '100%', padding: '6px', borderRadius: '8px', border: '1px solid var(--line)', background: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer' }}
                        >
                          กลับมาทำงาน
                        </button>
                      )}
                    </div>
                  ))}

                  {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '14px' }}>
                      ไม่พบข้อมูล
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ─── Tab: เพิ่มพนักงาน ───────────────────────────────── */}
            {tab === 'add' && (
              <div className="card">
                <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '16px' }}>เพิ่มพนักงานใหม่</div>

                {[
                  { label: 'ชื่อ-นามสกุล *', key: 'name',       placeholder: 'เช่น นายสมชาย ใจดี' },
                  { label: 'ชื่อเล่น',        key: 'nickname',   placeholder: 'เช่น ชาย' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>{f.label}</div>
                    <input
                      type="text"
                      placeholder={f.placeholder}
                      value={form[f.key as keyof typeof form]}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--line)', fontSize: '14px', outline: 'none' }}
                    />
                  </div>
                ))}

                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>สาขา *</div>
                  <select
                    value={form.mainBranchId}
                    onChange={e => setForm(prev => ({ ...prev, mainBranchId: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--line)', fontSize: '14px', outline: 'none', background: '#fff' }}
                  >
                    <option value="">เลือกสาขา</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} · {b.id}</option>
                    ))}
                  </select>
                </div>

                <div className="card" style={{ background: 'var(--navy-50)', border: 'none', padding: '12px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                    📌 หลังเพิ่มแล้ว พนักงานต้อง:<br />
                    1. เปิดแอปแล้ว Login LINE<br />
                    2. เลือกชื่อตัวเองและสแกนหน้า<br />
                    3. ลงทะเบียนใบหน้า 5 ท่า
                  </div>
                </div>

                <button
                  onClick={handleAdd}
                  disabled={adding}
                  className="btn btn-primary w-full py-4"
                >
                  {adding ? 'กำลังเพิ่ม...' : 'เพิ่มพนักงาน'}
                </button>
              </div>
            )}

            {/* ─── Tab: สาขา ───────────────────────────────────────── */}
            {tab === 'branches' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {branches.map(b => {
                  const count = staffList.filter(s => s.mainBranchId === b.id && s.status !== 'Inactive').length;
                  return (
                    <div key={b.id} className="card" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{b.name}</div>
                          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{b.province} · รหัส {b.id}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--navy-900)' }}>{count}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>พนักงาน</div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {branches.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '14px' }}>
                    ยังไม่มีข้อมูลสาขา — กด &quot;+ สาขา&quot; เพื่อเพิ่ม
                  </div>
                )}
              </div>
            )}

            {/* ─── Tab: เพิ่มสาขา ──────────────────────────────────── */}
            {tab === 'add-branch' && (
              <div className="card">
                <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '16px' }}>เพิ่มสาขาใหม่</div>

                {/* ข้อมูลพื้นฐาน */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>รหัสสาขา *</div>
                    <input
                      type="text" placeholder="B01"
                      value={branchForm.id}
                      onChange={e => setBranchForm(p => ({ ...p, id: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--line)', fontSize: '14px', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>ชื่อสาขา *</div>
                    <input
                      type="text" placeholder="เซ็นทรัลพลาซา"
                      value={branchForm.name}
                      onChange={e => setBranchForm(p => ({ ...p, name: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--line)', fontSize: '14px', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>จังหวัด</div>
                  <input
                    type="text" placeholder="กรุงเทพมหานคร"
                    value={branchForm.province}
                    onChange={e => setBranchForm(p => ({ ...p, province: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--line)', fontSize: '14px', outline: 'none' }}
                  />
                </div>

                {/* จำนวนพนักงาน */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  {[
                    { label: 'จำนวนพนักงานทั้งหมด', key: 'totalStaff', placeholder: '10' },
                    { label: 'จำนวนขั้นต่ำ',         key: 'minStaff',   placeholder: '5' },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>{f.label}</div>
                      <input
                        type="number" placeholder={f.placeholder}
                        value={branchForm[f.key as keyof typeof branchForm]}
                        onChange={e => setBranchForm(p => ({ ...p, [f.key]: e.target.value }))}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--line)', fontSize: '14px', outline: 'none' }}
                      />
                    </div>
                  ))}
                </div>

                {/* เวลาทำการ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  {[
                    { label: 'เวลาเปิด',  key: 'openTime',  type: 'time' },
                    { label: 'เวลาปิด',   key: 'closeTime', type: 'time' },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>{f.label}</div>
                      <input
                        type={f.type}
                        value={branchForm[f.key as keyof typeof branchForm]}
                        onChange={e => setBranchForm(p => ({ ...p, [f.key]: e.target.value }))}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--line)', fontSize: '14px', outline: 'none' }}
                      />
                    </div>
                  ))}
                </div>

                {/* GPS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                  {[
                    { label: 'Latitude',  key: 'lat',    placeholder: '13.7563' },
                    { label: 'Longitude', key: 'lng',    placeholder: '100.5018' },
                    { label: 'รัศมี (ม.)', key: 'radius', placeholder: '200' },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>{f.label}</div>
                      <input
                        type="number" placeholder={f.placeholder}
                        value={branchForm[f.key as keyof typeof branchForm]}
                        onChange={e => setBranchForm(p => ({ ...p, [f.key]: e.target.value }))}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--line)', fontSize: '14px', outline: 'none' }}
                      />
                    </div>
                  ))}
                </div>

                <div className="card" style={{ background: 'var(--navy-50)', border: 'none', padding: '12px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                    📍 หา Latitude/Longitude ได้จาก Google Maps<br />
                    คลิกขวาที่ตำแหน่งสาขา → &quot;What&apos;s here?&quot;<br />
                    รัศมี = ระยะทางที่ถือว่า &quot;อยู่ในพื้นที่&quot; (แนะนำ 100-300 ม.)
                  </div>
                </div>

                <button
                  onClick={handleAddBranch}
                  disabled={addingBranch}
                  className="btn btn-primary w-full py-4"
                >
                  {addingBranch ? 'กำลังเพิ่ม...' : 'เพิ่มสาขา'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <ToastContainer toasts={toasts} />
    </>
  );
}
