'use client';

import { useState, useEffect } from 'react';
import { useRouter }            from 'next/navigation';
import FaceScanner              from '@/components/FaceScanner';
import { useToast, ToastContainer } from '@/components/Toast';

type Step = 'select' | 'scan' | 'done';

interface PendingStaff {
  id:           string;
  name:         string;
  nickname:     string;
  mainBranchId: string;
  descriptors:  number[][];
}

export default function LinkPage() {
  const router            = useRouter();
  const { toasts, toast } = useToast();

  const [step, setStep]           = useState<Step>('select');
  const [pendingList, setPending] = useState<PendingStaff[]>([]);
  const [selected, setSelected]   = useState<PendingStaff | null>(null);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [linking, setLinking]     = useState(false);

  useEffect(() => {
    fetch('/api/staff?status=Pending')
      .then(r => r.json())
      .then(d => setPending(d.staff || []))
      .catch(() => toast('โหลดรายชื่อไม่สำเร็จ', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = pendingList.filter(s =>
    s.name.includes(search) || s.nickname.includes(search)
  );

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
          <>
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
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '48px' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                กำลังโหลด...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '48px', fontSize: '14px' }}>
                {search ? `ไม่พบ "${search}"` : 'ไม่มีรายชื่อ — ติดต่อ Admin'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filtered.map(staff => (
                  <button
                    key={staff.id}
                    onClick={() => {
                      setSelected(staff);
                      if (!staff.descriptors?.length) {
                        toast('ยังไม่มีข้อมูลใบหน้า ติดต่อ Admin', 'warn');
                      } else {
                        setStep('scan');
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '14px 16px', borderRadius: '14px',
                      background: 'var(--surface)', border: '1px solid var(--line)',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
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
                    <span style={{ color: 'var(--muted)', fontSize: '18px' }}>›</span>
                  </button>
                ))}
              </div>
            )}
          </>
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
              staffDescriptors={selected.descriptors}
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
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--navy-900)' }}>ผูกบัญชีสำเร็จ</div>
            <div style={{ color: 'var(--muted)', marginTop: 8, fontSize: 13 }}>กำลังพาไปหน้าเช็คชื่อ...</div>
          </div>
        )}

      </div>

      <ToastContainer toasts={toasts} />
    </>
  );
}
