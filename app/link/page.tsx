'use client';

import { useState, useEffect } from 'react';
import { useRouter }            from 'next/navigation';
import { useToast, ToastContainer } from '@/components/Toast';

type Step = 'select' | 'confirm' | 'done';

interface StaffItem {
  id:           string;
  name:         string;
  nickname:     string;
  mainBranchId: string;
  status:       string;
  lineId?:      string;
}

export default function LinkPage() {
  const router            = useRouter();
  const { toasts, toast } = useToast();

  const [step, setStep]         = useState<Step>('select');
  const [staffList, setStaff]   = useState<StaffItem[]>([]);
  const [selected, setSelected] = useState<StaffItem | null>(null);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [linking, setLinking]   = useState(false);

  useEffect(() => {
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

  const handleConfirm = async () => {
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
        setTimeout(() => router.push('/register'), 1800);
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
                width: '100%', padding: '12px 16px', borderRadius: 12,
                border: '1px solid var(--line)', fontSize: 14,
                marginBottom: 12, outline: 'none', fontFamily: 'inherit',
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
                      Admin ต้องเพิ่มชื่อพนักงานก่อน<br />
                      ผ่านหน้า <strong>ออฟฟิศ → จัดการ → + เพิ่มพนักงาน</strong>
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
              <div className="cascade" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(staff => (
                  <button
                    key={staff.id}
                    onClick={() => { setSelected(staff); setStep('confirm'); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px', borderRadius: 14,
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
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{staff.name}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                        {staff.nickname ? `(${staff.nickname}) · ` : ''}สาขา {staff.mainBranchId}
                      </div>
                    </div>
                    <span style={{ color: 'var(--muted)', fontSize: 18 }}>›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── ยืนยันชื่อ ─── */}
        {step === 'confirm' && selected && (
          <div className="spring-pop" style={{ paddingTop: 10 }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 6 }}>ยืนยันชื่อของคุณ</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                กรุณาตรวจสอบให้ถูกต้องก่อนยืนยัน
              </div>
            </div>

            <div style={{
              background: 'var(--navy-900)', borderRadius: 20,
              padding: '36px 24px', textAlign: 'center', marginBottom: 20,
              boxShadow: '0 8px 32px rgba(17,26,52,.25)',
            }}>
              <div style={{
                width: 88, height: 88, borderRadius: '50%',
                background: 'rgba(255,255,255,.12)',
                border: '2px solid rgba(255,255,255,.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: 36, fontWeight: 700, color: '#fff',
              }}>
                {selected.name.charAt(0)}
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                {selected.name}
              </div>
              {selected.nickname && (
                <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 17, marginTop: 6 }}>
                  ({selected.nickname})
                </div>
              )}
              <div style={{
                display: 'inline-block', marginTop: 14,
                background: 'rgba(255,255,255,.08)',
                borderRadius: 8, padding: '4px 12px',
                color: 'rgba(255,255,255,.45)', fontSize: 12,
              }}>
                สาขา {selected.mainBranchId}
              </div>
            </div>

            <button
              onClick={handleConfirm}
              disabled={linking}
              className="btn btn-primary"
              style={{ width: '100%', padding: 18, fontSize: 16, marginBottom: 10 }}
            >
              {linking ? 'กำลังเชื่อมต่อ...' : `ใช่ ฉันคือ ${selected.name}`}
            </button>
            <button
              onClick={() => { setSelected(null); setStep('select'); setSearch(''); }}
              className="btn btn-ghost"
              style={{ width: '100%' }}
            >
              ← เลือกชื่ออื่น
            </button>
          </div>
        )}

        {/* ─── สำเร็จ ─── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', paddingTop: 60 }} className="spring-pop">
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--navy-900)' }}>ผูกบัญชีสำเร็จ!</div>
            <div style={{ color: 'var(--muted)', marginTop: 8, fontSize: 13 }}>
              กำลังพาไปลงทะเบียนใบหน้า...
            </div>
          </div>
        )}

      </div>

      <ToastContainer toasts={toasts} />
    </>
  );
}
