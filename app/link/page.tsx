'use client';
// ─── หน้าผูก LINE กับชื่อพนักงาน ─────────────────────────────────────────────
// พนักงานที่ Login LINE แล้ว แต่ยังไม่เคยผูกบัญชี จะมาที่หน้านี้
// Flow: เลือกชื่อตัวเองจาก list → สแกนหน้ายืนยัน → ผูก LineID → ไปหน้าแรก
// คนนอกไม่สามารถผูกได้ เพราะชื่อต้องมีใน Firestore ก่อน (Admin เพิ่มไว้)

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

  const [step, setStep]             = useState<Step>('select');
  const [pendingList, setPending]   = useState<PendingStaff[]>([]);
  const [selected, setSelected]     = useState<PendingStaff | null>(null);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [linking, setLinking]       = useState(false);

  // ─── โหลดรายชื่อพนักงานที่ยังไม่ผูก LINE (Status = Pending) ─────────────────
  useEffect(() => {
    async function loadPending() {
      try {
        // ดึงเฉพาะ Pending staff (ยังไม่มี LineID)
        const res  = await fetch('/api/staff?status=Pending');
        const data = await res.json();
        setPending(data.staff || []);
      } catch {
        toast('โหลดรายชื่อไม่สำเร็จ', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadPending();
  }, []);

  // กรองรายชื่อตามคำค้นหา
  const filtered = pendingList.filter(s =>
    s.name.includes(search) || s.nickname.includes(search)
  );

  // ─── เมื่อสแกนหน้าผ่าน → ผูก LineID กับพนักงานที่เลือก ─────────────────────
  const handleFaceSuccess = async () => {
    if (!selected || linking) return;
    setLinking(true);

    try {
      // บอก server ให้ผูก LINE ID (จาก cookie session) กับพนักงานคนนี้
      const res  = await fetch('/api/staff/link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ staffName: selected.name }),
      });
      const data = await res.json();

      if (data.success) {
        setStep('done');
        // รอ 2 วินาทีแล้วไปหน้าแรก
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
      <header style={{ background: 'var(--navy-900)', padding: '16px 18px' }}>
        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase' }}>
          ครั้งแรกเท่านั้น
        </div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>ผูกบัญชีพนักงาน</div>
      </header>

      <div className="shell" style={{ paddingTop: '20px' }}>

        {/* ─── Step 1: เลือกชื่อพนักงาน ────────────────────────────────────── */}
        {step === 'select' && (
          <>
            <div className="card" style={{ padding: '16px', marginBottom: '12px' }}>
              <p style={{ fontSize: '14px', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                เลือกชื่อของคุณจากรายการด้านล่าง<br />
                <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
                  (Admin เพิ่มรายชื่อไว้ให้แล้ว ถ้าหาชื่อไม่พบให้ติดต่อ HR)
                </span>
              </p>
            </div>

            {/* ช่องค้นหา */}
            <input
              type="text"
              placeholder="ค้นหาชื่อ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '12px',
                border: '1px solid var(--line)', fontSize: '14px',
                marginBottom: '12px', outline: 'none',
              }}
            />

            {/* รายชื่อพนักงาน */}
            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px' }}>
                <div className="spinner" style={{ margin: '0 auto 12px', borderColor: 'rgba(0,0,0,.1)', borderTopColor: 'var(--navy-900)' }} />
                กำลังโหลด...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px', fontSize: '14px' }}>
                {search ? 'ไม่พบชื่อที่ค้นหา' : 'ไม่มีรายชื่อที่รอผูกบัญชี'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filtered.map(staff => (
                  <button
                    key={staff.id}
                    onClick={() => {
                      setSelected(staff);
                      // ถ้าพนักงานยังไม่มี descriptor → ไปลงทะเบียนหน้าก่อน
                      // ถ้ามีแล้ว → สแกนยืนยัน
                      if (!staff.descriptors?.length) {
                        toast('กรุณาลงทะเบียนใบหน้าก่อน', 'warn');
                        // TODO: redirect ไป /register
                      } else {
                        setStep('scan');
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '14px 16px', borderRadius: '14px',
                      background: 'var(--surface)', border: '1px solid var(--line)',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'var(--navy-900)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, flexShrink: 0,
                    }}>
                      {staff.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{staff.name}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                        {staff.nickname && `(${staff.nickname}) · `}สาขา {staff.mainBranchId}
                      </div>
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: '18px' }}>›</div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── Step 2: สแกนใบหน้ายืนยัน ───────────────────────────────────── */}
        {step === 'scan' && selected && (
          <>
            <div className="card" style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>ยืนยันว่าคุณคือ</div>
              <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--navy-900)', marginTop: '4px' }}>
                {selected.name}
              </div>
              {selected.nickname && (
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>({selected.nickname})</div>
              )}
            </div>

            {/* สแกนหน้า 1:1 กับ descriptor ของพนักงานที่เลือก */}
            <FaceScanner
              staffDescriptors={selected.descriptors}
              staffName={selected.name}
              onSuccess={handleFaceSuccess}
              onError={(msg) => {
                toast(msg, 'error');
                setStep('select');
              }}
            />

            <button
              onClick={() => { setSelected(null); setStep('select'); }}
              className="btn btn-ghost w-full mt-4"
            >
              ← เลือกชื่ออื่น
            </button>
          </>
        )}

        {/* ─── Done ─────────────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', paddingTop: '60px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: '22px', color: 'var(--navy-900)' }}>
              ผูกบัญชีสำเร็จ!
            </div>
            <div style={{ color: 'var(--muted)', marginTop: '8px', fontSize: '14px' }}>
              กำลังพาไปหน้าเช็คอิน...
            </div>
          </div>
        )}

      </div>

      <ToastContainer toasts={toasts} />
    </>
  );
}
