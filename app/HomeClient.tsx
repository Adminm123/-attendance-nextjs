'use client';
// ─── Home Client Component ────────────────────────────────────────────────────
// ส่วน interactive ของหน้าแรก
// 'use client' เพราะต้องใช้ useState, กล้อง, GPS, กดปุ่ม

import { useState, useEffect } from 'react';
import { SessionUser }          from '@/lib/types';
import LineLoginButton          from '@/components/LineLoginButton';
import FaceScanner              from '@/components/FaceScanner';
import { useToast, ToastContainer } from '@/components/Toast';

interface Props {
  user: SessionUser | null; // null = ยังไม่ได้ login
}

// สถานะของหน้า
type PageState = 'login' | 'home' | 'scanning' | 'result';

export default function HomeClient({ user }: Props) {
  const { toasts, toast } = useToast();

  const [pageState, setPageState]       = useState<PageState>(user ? 'home' : 'login');
  const [staffDescriptors, setDescs]    = useState<number[][]>([]);
  const [todayStatus, setTodayStatus]   = useState<{ hasIn: boolean; hasOut: boolean } | null>(null);
  const [currentTime, setCurrentTime]   = useState('');
  const [scanResult, setScanResult]     = useState<{ time: string; status: string; type: string } | null>(null);
  const [isLogging, setIsLogging]       = useState(false);

  // ─── นาฬิกาแสดงเวลาปัจจุบัน ──────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      setCurrentTime(new Date().toLocaleTimeString('th-TH', {
        timeZone: 'Asia/Bangkok', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
      }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id); // cleanup เมื่อ component ถูกทำลาย
  }, []);

  // ─── โหลด descriptors และสถานะวันนี้ ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    // ดึง face descriptors ของพนักงานคนนี้จาก Firestore
    async function loadData() {
      try {
        // ดึง descriptors
        const staffRes = await fetch(`/api/staff?name=${encodeURIComponent(user!.staffName)}&withDescriptors=true`);
        const staffData = await staffRes.json();
        if (staffData.staff?.[0]?.descriptors) {
          setDescs(staffData.staff[0].descriptors);
        }

        // ดึงสถานะการเช็คอินวันนี้
        const today   = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
        const attRes  = await fetch(`/api/attendance?name=${encodeURIComponent(user!.staffName)}&date=${today}`);
        const attData = await attRes.json();
        const hasIn   = attData.records?.some((r: any) => r.type === 'IN')  ?? false;
        const hasOut  = attData.records?.some((r: any) => r.type === 'OUT') ?? false;
        setTodayStatus({ hasIn, hasOut });
      } catch (e) {
        toast('โหลดข้อมูลไม่สำเร็จ', 'error');
      }
    }
    loadData();
  }, [user]);

  // ─── เมื่อสแกนหน้าผ่าน → บันทึกเช็คอิน ─────────────────────────────────────
  const handleFaceSuccess = async () => {
    if (isLogging) return;
    setIsLogging(true);

    // กำหนดประเภท: ถ้ายังไม่ IN → เช็คอิน, ถ้า IN แล้ว → เช็คเอาท์
    const type = todayStatus?.hasIn ? 'OUT' : 'IN';

    try {
      // ดึง GPS ก่อนบันทึก
      const gps = await getGPS();

      const res  = await fetch('/api/attendance', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          type,
          branchId: user!.mainBranchId,
          lat:      gps?.lat,
          lng:      gps?.lng,
          accuracy: gps?.accuracy,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setScanResult({ time: data.time, status: data.status, type });
        setPageState('result');
        // อัพเดทสถานะ
        setTodayStatus(prev => ({
          hasIn:  type === 'IN'  ? true : (prev?.hasIn  ?? false),
          hasOut: type === 'OUT' ? true : (prev?.hasOut ?? false),
        }));
      } else {
        toast(data.error || 'บันทึกไม่สำเร็จ', 'error');
        setPageState('home');
      }
    } catch {
      toast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
      setPageState('home');
    } finally {
      setIsLogging(false);
    }
  };

  // ─── Logout ───────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  };

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════

  return (
    <>
      {/* ─── Appbar ─────────────────────────────────────────────────────── */}
      <header style={{
        background: 'var(--navy-900)',
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase' }}>
            ATTENDANCE
          </div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>ระบบเช็คชื่อ</div>
        </div>
        {user && (
          <button
            onClick={handleLogout}
            style={{ color: 'rgba(255,255,255,.5)', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ออกจากระบบ
          </button>
        )}
      </header>

      <div className="shell" style={{ paddingTop: '20px' }}>

        {/* ─── หน้า Login ──────────────────────────────────────────────────── */}
        {pageState === 'login' && (
          <div style={{ textAlign: 'center', paddingTop: '40px' }}>
            {/* นาฬิกา */}
            <div style={{ fontSize: '52px', fontWeight: 700, color: 'var(--navy-900)', fontVariantNumeric: 'tabular-nums', marginBottom: '4px' }}>
              {currentTime || '--:--:--'}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '48px' }}>
              {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>

            <div className="card" style={{ padding: '32px 24px' }}>
              <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>เข้าสู่ระบบ</div>
              <div style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>
                ใช้ LINE เพื่อยืนยันตัวตน<br/>ครั้งแรกเท่านั้น ครั้งต่อไปจำอัตโนมัติ
              </div>
              <LineLoginButton />
            </div>
          </div>
        )}

        {/* ─── หน้าหลัก (login แล้ว) ──────────────────────────────────────── */}
        {pageState === 'home' && user && (
          <>
            {/* นาฬิกา + ชื่อ */}
            <div style={{ textAlign: 'center', paddingBottom: '20px' }}>
              <div style={{ fontSize: '48px', fontWeight: 700, color: 'var(--navy-900)', fontVariantNumeric: 'tabular-nums' }}>
                {currentTime || '--:--:--'}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px' }}>
                {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>

            {/* Card ข้อมูลพนักงาน */}
            <div className="card" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'var(--navy-900)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '18px', fontWeight: 700, flexShrink: 0,
                }}>
                  {user.staffName.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>{user.staffName}</div>
                  {user.staffNickname && (
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>({user.staffNickname})</div>
                  )}
                </div>
              </div>

              {/* สถานะวันนี้ */}
              {todayStatus && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--line)', display: 'flex', gap: '8px' }}>
                  <span className={`chip ${todayStatus.hasIn ? 'chip-ok' : 'chip-warn'}`}>
                    {todayStatus.hasIn ? '✓ เช็คอินแล้ว' : '○ ยังไม่เช็คอิน'}
                  </span>
                  {todayStatus.hasIn && (
                    <span className={`chip ${todayStatus.hasOut ? 'chip-ok' : 'chip-warn'}`}>
                      {todayStatus.hasOut ? '✓ เช็คเอาท์แล้ว' : '○ ยังไม่เช็คเอาท์'}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ปุ่มเช็คอิน/เอาท์ */}
            {!todayStatus?.hasOut && (
              <button
                onClick={() => setPageState('scanning')}
                disabled={!staffDescriptors.length}
                className="btn w-full py-5 text-lg"
                style={{
                  background: todayStatus?.hasIn ? 'var(--red)' : 'var(--success)',
                  color: '#fff',
                  width: '100%',
                  borderRadius: '20px',
                  opacity: staffDescriptors.length ? 1 : 0.5,
                }}
              >
                {!staffDescriptors.length
                  ? 'กำลังโหลด...'
                  : todayStatus?.hasIn
                    ? '🚪 เช็คเอาท์ (สแกนใบหน้า)'
                    : '✓ เช็คอิน (สแกนใบหน้า)'
                }
              </button>
            )}

            {todayStatus?.hasOut && (
              <div className="card" style={{ textAlign: 'center', background: 'var(--success-50)', borderColor: '#cfe7da' }}>
                <div style={{ fontSize: '24px', marginBottom: '4px' }}>✓</div>
                <div style={{ fontWeight: 600, color: 'var(--success)' }}>เสร็จสิ้นสำหรับวันนี้</div>
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>เช็คอินและเช็คเอาท์เรียบร้อย</div>
              </div>
            )}
          </>
        )}

        {/* ─── หน้าสแกนใบหน้า ───────────────────────────────────────────────── */}
        {pageState === 'scanning' && user && staffDescriptors.length > 0 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontWeight: 600, fontSize: '16px' }}>
                {todayStatus?.hasIn ? 'สแกนหน้าเพื่อเช็คเอาท์' : 'สแกนหน้าเพื่อเช็คอิน'}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>
                ยืนยันว่าเป็น {user.staffName}
              </div>
            </div>

            {/* FaceScanner: verify 1:1 เฉพาะพนักงานคนนี้ */}
            <FaceScanner
              staffDescriptors={staffDescriptors}
              staffName={user.staffName}
              onSuccess={handleFaceSuccess}
              onError={(msg) => {
                toast(msg, 'error');
                setPageState('home');
              }}
            />

            <button
              onClick={() => setPageState('home')}
              className="btn btn-ghost w-full mt-4"
            >
              ยกเลิก
            </button>
          </div>
        )}

        {/* ─── หน้าผลลัพธ์ ──────────────────────────────────────────────────── */}
        {pageState === 'result' && scanResult && (
          <div style={{ textAlign: 'center', paddingTop: '40px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>
              {scanResult.status === 'สาย' ? '⚠️' : '✅'}
            </div>
            <div style={{ fontWeight: 700, fontSize: '24px', color: 'var(--navy-900)', marginBottom: '8px' }}>
              {scanResult.type === 'IN' ? 'เช็คอินสำเร็จ' : 'เช็คเอาท์สำเร็จ'}
            </div>
            <div style={{ fontSize: '36px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginBottom: '16px' }}>
              {scanResult.time} น.
            </div>
            <span className={`chip ${scanResult.status === 'ทันเวลา' ? 'chip-ok' : 'chip-warn'}`} style={{ fontSize: '14px', padding: '6px 16px' }}>
              {scanResult.status}
            </span>

            <button
              onClick={() => setPageState('home')}
              className="btn btn-primary w-full mt-8 py-4"
            >
              กลับหน้าหลัก
            </button>
          </div>
        )}

      </div>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} />
    </>
  );
}

// ─── Helper: ดึง GPS position ────────────────────────────────────────────────
function getGPS(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      ()  => resolve(null),
      { timeout: 10000, enableHighAccuracy: true }
    );
  });
}
