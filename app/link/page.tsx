'use client';

import { useState, useEffect } from 'react';
import { useRouter }            from 'next/navigation';
import FaceScanner              from '@/components/FaceScanner';
import { useToast, ToastContainer } from '@/components/Toast';

type Step = 'select' | 'loading' | 'scan' | 'done';

interface StaffItem {
  id:           string;
  name:         string;
  nickname:     string;
  mainBranchId: string;
  hasDescriptors: boolean;
  lineId?:      string;
  status:       string;
  descriptors?: number[][];
}

export default function LinkPage() {
  const router            = useRouter();
  const { toasts, toast } = useToast();

  const [step, setStep]           = useState<Step>('select');
  const [staffList, setStaff]     = useState<StaffItem[]>([]);
  const [selected, setSelected]   = useState<StaffItem | null>(null);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [linking, setLinking]     = useState(false);

  useEffect(() => {
    // Fetch all staff, filter client-side (avoids Firestore composite-index requirement)
    fetch('/api/staff')
      .then(r => r.json())
      .then(d => {
        const pending = (d.staff || []).filter((s: StaffItem) => !s.lineId && s.status !== 'Inactive');
        setStaff(pending);
      })
      .catch(() => toast('โหลดรายชื่อไม่สำเร็จ', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = staffList.filter(s =>
    s.name.includes(search) || (s.nickname || '').includes(search)
  );

  const handleSelectStaff = async (staff: StaffItem) => {
    if (!staff.hasDescriptors) {
      toast('ยังไม่มีข้อมูลใบหน้า ติดต่อ Admin', 'warn');
      return;
    }
    setStep('loading');
    try {
      const res  = await fetch(`/api/staff/descriptors?name=${encodeURIComponent(staff.name)}`);
      const data = await res.json();
      if (data.descriptors?.length) {
        setSelected({ ...staff, descriptors: data.descriptors });
        setStep('scan');
      } else {
        toast('ยังไม่มีข้อมูลใบหน้า ติดต่อ Admin', 'warn');
        setStep('select');
      }
    } catch {
      toast('เกิดข้อผิดพลาด', 'error');
      setStep('select');
    }
  };

  const handleFaceSuccess = async () => {
    if (!selected || linking) return;
    setLinking(true);
    try {
      const res  = await fetch('/api/staff/link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffName: selected.name }),
      });
      const data = await res.json();
      if (data.success) {
        setStep('done');
        setTimeout(() => router.push('/'), 2000);
      } else {
        toast(data.error || 'ผูกบัญชีไม่สำเร็จ', 'error');
        setStep('select');
      }
    } catch {
      toast('เกิดข้อผิดพลาด', 'error');
      setStep('select');
    } finally {
      setLinking(false);
    }
  };

  return (
    <>
      <div className="shell" style={{ paddingTop: 20 }}>

        {/* ─── เลือกชื่อ ─── */}
        {step === 'select' && (
          <div className="tab-panel">
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>เลือกชื่อคุณ</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                ทำครั้งเดียว ระบบจะจำ LINE ของคุณไว้
              </div>
            </div>

            <input
              type="text"
              placeholder="ค้นหาชื่อ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '12px',
                border: '1px solid var(--line)', fontSize: '14px',
                marginBottom: '12px', outline: 'none', fontFamily: 'inherit',
              }}
            />

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1,2,3].map(i => (
                  <div key={i} className="skeleton" style={{ height: 72, borderRadius: 14 }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                {search ? (
                  <>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                    <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>ไม่พบ &ldquo;{search}&rdquo;</div>
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>ลองค้นหาชื่อหรือชื่อเล่นอื่น</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
                    <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>ยังไม่มีรายชื่อรอผูกบัญชี</div>
                    <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.8, marginBottom: 20 }}>
                      Admin ต้องเพิ่มชื่อพนักงานก่อน<br />ผ่านหน้า <strong>ออฟฟิศ → จัดการ → + เพิ่ม</strong>
                    </div>
                    <a href="/office" style={{
                      display: 'inline-block', padding: '10px 22px', borderRadius: 12,
                      background: 'var(--navy-900)', color: '#fff', fontSize: 13,
                      fontWeight: 600, textDecoration: 'none',
                    }}>
                      ไปหน้าออฟฟิศ →
                    </a>
                  </>
                )}
              </div>
            ) : (
              <div className="cascade" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filtered.map(staff => (
                  <button
                    key={staff.id}
                    onClick={() => handleSelectStaff(staff)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '14px 16px', borderRadius: '14px',
                      background: 'var(--surface)', border: '1px solid var(--line)',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      transition: 'transform .15s, box-shadow .15s',
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', background: 'var(--navy-900)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, flexShrink: 0, fontSize: 15,
                    }}>
                      {staff.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{staff.name}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                        {staff.nickname ? `(${staff.nickname}) · ` : ''}สาขา {staff.mainBranchId}
                      </div>
                    </div>
                    {!staff.hasDescriptors
                      ? <span className="chip chip-warn" style={{ fontSize: 9, flexShrink: 0 }}>รอลงหน้า</span>
                      : <span style={{ color: 'var(--muted)', fontSize: '18px' }}>›</span>
                    }
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── กำลังโหลดข้อมูลใบหน้า ─── */}
        {step === 'loading' && (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>กำลังโหลดข้อมูลใบหน้า...</div>
          </div>
        )}

        {/* ─── สแกนหน้า ─── */}
        {step === 'scan' && selected && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>ยืนยันตัวตน</div>
              <div style={{ fontSize: 15, color: 'var(--navy-900)', fontWeight: 600 }}>{selected.name}</div>
              {selected.nickname && <div style={{ color: 'var(--muted)', fontSize: 13 }}>({selected.nickname})</div>}
            </div>

            <FaceScanner
              staffDescriptors={selected.descriptors!}
              staffName={selected.name}
              onSuccess={handleFaceSuccess}
              onError={msg => { toast(msg, 'error'); setStep('select'); }}
            />

            <button onClick={() => { setSelected(null); setStep('select'); }}
              className="btn btn-ghost" style={{ width: '100%', marginTop: 12 }}>
              ← เลือกชื่ออื่น
            </button>
          </>
        )}

        {/* ─── สำเร็จ ─── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', paddingTop: 60 }} className="spring-pop">
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--navy-900)' }}>ผูกบัญชีสำเร็จ</div>
            <div style={{ color: 'var(--muted)', marginTop: 8, fontSize: 13 }}>กำลังพาไปหน้าเช็คชื่อ...</div>
          </div>
        )}

      </div>

      <ToastContainer toasts={toasts} />
    </>
  );
}
