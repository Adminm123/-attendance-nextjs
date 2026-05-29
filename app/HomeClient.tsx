'use client';

import { useState, useEffect, useRef } from 'react';
import { SessionUser }                  from '@/lib/types';
import LineLoginButton                  from '@/components/LineLoginButton';
import FaceScanner                      from '@/components/FaceScanner';
import { useToast, ToastContainer }     from '@/components/Toast';

interface Props { user: SessionUser | null; }
type PageState = 'login' | 'home' | 'scanning' | 'result';

// Haversine distance (km)
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function HomeClient({ user }: Props) {
  const { toasts, toast } = useToast();

  const [pageState, setPageState]     = useState<PageState>(user ? 'home' : 'login');
  const [staffDescriptors, setDescs]  = useState<number[][]>([]);
  const [todayStatus, setTodayStatus] = useState<{ hasIn: boolean; hasOut: boolean } | null>(null);
  const [currentTime, setCurrentTime] = useState('');
  const [scanResult, setScanResult]   = useState<{ time: string; status: string; type: string; lateMinutes?: number } | null>(null);
  const [isLogging, setIsLogging]     = useState(false);
  const [branchData, setBranchData]   = useState<any>(null);
  const [gpsStatus, setGpsStatus]     = useState<'ok' | 'outside' | 'unknown'>('unknown');
  const rippleRef = useRef<HTMLButtonElement>(null);

  // Clock
  useEffect(() => {
    const tick = () => setCurrentTime(new Date().toLocaleTimeString('th-TH', {
      timeZone: 'Asia/Bangkok', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
    }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Load descriptors + today status + branch GPS
  useEffect(() => {
    if (!user) return;
    async function loadData() {
      try {
        const [staffRes, attRes, branchRes] = await Promise.all([
          fetch(`/api/staff?name=${encodeURIComponent(user!.staffName)}&withDescriptors=true`),
          fetch(`/api/attendance?name=${encodeURIComponent(user!.staffName)}&date=${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' })}`),
          fetch(`/api/branches?id=${encodeURIComponent(user!.mainBranchId)}`),
        ]);
        const [staffData, attData, branchJson] = await Promise.all([staffRes.json(), attRes.json(), branchRes.json()]);

        if (staffData.staff?.[0]?.descriptors) setDescs(staffData.staff[0].descriptors);

        const hasIn  = attData.records?.some((r: any) => r.type === 'IN')  ?? false;
        const hasOut = attData.records?.some((r: any) => r.type === 'OUT') ?? false;
        setTodayStatus({ hasIn, hasOut });

        const branch = branchJson.branches?.[0] || branchJson.branch || null;
        setBranchData(branch);

        // GPS check
        if (branch?.lat && branch?.lng && branch?.radius) {
          try {
            const pos = await getGPS();
            if (pos) {
              const dist = haversine(pos.lat, pos.lng, branch.lat, branch.lng);
              setGpsStatus(dist <= branch.radius ? 'ok' : 'outside');
            }
          } catch { /* no GPS */ }
        } else {
          setGpsStatus('ok');
        }
      } catch { toast('โหลดข้อมูลไม่สำเร็จ', 'error'); }
    }
    loadData();
  }, [user]);

  const handleFaceSuccess = async () => {
    if (isLogging) return;
    setIsLogging(true);
    const type = todayStatus?.hasIn ? 'OUT' : 'IN';
    try {
      const gps = await getGPS();
      const res  = await fetch('/api/attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, branchId: user!.mainBranchId, lat: gps?.lat, lng: gps?.lng, accuracy: gps?.accuracy }),
      });
      const data = await res.json();
      if (data.success) {
        setScanResult({ time: data.time, status: data.status, type, lateMinutes: data.lateMinutes });
        setPageState('result');
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
    } finally { setIsLogging(false); }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  };

  const addRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const circle = document.createElement('span');
    const diameter = Math.max(btn.clientWidth, btn.clientHeight);
    const radius   = diameter / 2;
    const rect     = btn.getBoundingClientRect();
    circle.style.cssText = `width:${diameter}px;height:${diameter}px;left:${e.clientX-rect.left-radius}px;top:${e.clientY-rect.top-radius}px;`;
    circle.classList.add('ripple');
    btn.querySelector('.ripple')?.remove();
    btn.appendChild(circle);
  };

  const isCheckInDone = todayStatus?.hasOut;
  const canScan = staffDescriptors.length > 0 && !isCheckInDone;

  return (
    <>
      {/* Appbar */}
      <header style={{ background: 'var(--navy-900)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'var(--navy-900)', fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>AT</span>
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>ระบบเช็คชื่อ</div>
            <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase' }}>ATTENDANCE</div>
          </div>
        </div>
        {user && (
          <button onClick={handleLogout} style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}>
            ออกจากระบบ
          </button>
        )}
      </header>

      <div className="shell" style={{ paddingTop: 20 }}>

        {/* ─── Login ─── */}
        {pageState === 'login' && (
          <div style={{ textAlign: 'center', paddingTop: 40 }} className="fade-up">
            <div style={{ fontSize: 52, fontWeight: 700, color: 'var(--navy-900)', fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
              {currentTime || '--:--:--'}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 48 }}>
              {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="card" style={{ padding: '40px 28px' }}>
              <div style={{ fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 28, fontWeight: 600 }}>ATTENDANCE SYSTEM</div>
              <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 2.2, padding: '16px 0 8px' }}>เข้าสู่ระบบ</div>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0, marginBottom: 36, lineHeight: 2.4, padding: '10px 0' }}>
                ใช้ LINE เพื่อยืนยันตัวตน<br />ครั้งแรกเท่านั้น ครั้งต่อไปจำอัตโนมัติ
              </p>
              <LineLoginButton />
            </div>
          </div>
        )}

        {/* ─── Home ─── */}
        {pageState === 'home' && user && (
          <div className="fade-up">
            {/* Clock */}
            <div style={{ textAlign: 'center', paddingBottom: 20 }}>
              <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--navy-900)', fontVariantNumeric: 'tabular-nums' }}>
                {currentTime || '--:--:--'}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
                {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>

            {/* Staff card */}
            <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--navy-900)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                  {user.staffName.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{user.staffName}</div>
                  {user.staffNickname && <div style={{ color: 'var(--muted)', fontSize: 12 }}>({user.staffNickname})</div>}
                </div>
              </div>

              {/* Status chips */}
              {todayStatus && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className={`chip ${todayStatus.hasIn ? 'chip-ok' : 'chip-warn'}`}>
                    {todayStatus.hasIn ? '✓ เช็คอินแล้ว' : '○ ยังไม่เช็คอิน'}
                  </span>
                  {todayStatus.hasIn && (
                    <span className={`chip ${todayStatus.hasOut ? 'chip-ok' : 'chip-warn'}`}>
                      {todayStatus.hasOut ? '✓ เช็คเอาท์แล้ว' : '○ ยังไม่เช็คเอาท์'}
                    </span>
                  )}
                  {gpsStatus === 'outside' && (
                    <span className="chip chip-bad">⚠ นอกพื้นที่</span>
                  )}
                </div>
              )}
            </div>

            {/* Scan tile */}
            {!isCheckInDone && (
              <button
                ref={rippleRef}
                className="scan-tile"
                disabled={!canScan}
                onClick={e => { addRipple(e); setPageState('scanning'); }}
              >
                <div className="glow" />
                <div className="grain" />
                <div className="ring" />
                <div className="ring2" />
                <div className="lens" />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginBottom: 12, fontWeight: 600 }}>
                    {!staffDescriptors.length ? 'กำลังโหลด...' : todayStatus?.hasIn ? 'เช็คเอาท์' : 'เช็คอิน'}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3, marginBottom: 8 }}>
                    {!staffDescriptors.length ? (
                      <span>กำลังโหลดข้อมูล...</span>
                    ) : todayStatus?.hasIn ? (
                      <span>สแกนหน้า <span className="gold-text">เช็คเอาท์</span></span>
                    ) : (
                      <span>สแกนหน้า <span className="gold-text">เช็คอิน</span></span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>
                    กดเพื่อเปิดกล้อง → ยืนยันใบหน้า
                  </div>
                </div>
              </button>
            )}

            {isCheckInDone && (
              <div className="card fade-up" style={{ textAlign: 'center', padding: 28, background: 'var(--success-50)', borderColor: '#cfe7da' }}>
                <div className="success-mark" style={{ marginBottom: 16 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 56, height: 56, color: 'var(--success)' }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--success)' }}>เสร็จสิ้นสำหรับวันนี้</div>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>เช็คอินและเช็คเอาท์เรียบร้อยแล้ว</div>
              </div>
            )}
          </div>
        )}

        {/* ─── Scanning ─── */}
        {pageState === 'scanning' && user && staffDescriptors.length > 0 && (
          <div className="fade-up">
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>
                {todayStatus?.hasIn ? 'สแกนหน้าเพื่อเช็คเอาท์' : 'สแกนหน้าเพื่อเช็คอิน'}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>ยืนยันว่าเป็น {user.staffName}</div>
            </div>

            <FaceScanner
              staffDescriptors={staffDescriptors}
              staffName={user.staffName}
              onSuccess={handleFaceSuccess}
              onError={msg => { toast(msg, 'error'); setPageState('home'); }}
            />

            <button onClick={() => setPageState('home')} className="btn btn-ghost" style={{ width: '100%', marginTop: 12 }}>
              ยกเลิก
            </button>
          </div>
        )}

        {/* ─── Result ─── */}
        {pageState === 'result' && scanResult && (
          <div className="fade-up" style={{ textAlign: 'center', paddingTop: 40 }}>
            <div className="success-mark" style={{ marginBottom: 20 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 60, height: 60, color: scanResult.status === 'สาย' ? 'var(--warn)' : 'var(--success)' }}>
                {scanResult.status === 'สาย'
                  ? <><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>
                  : <polyline points="20 6 9 17 4 12" />
                }
              </svg>
            </div>

            <div style={{ fontWeight: 700, fontSize: 24, color: 'var(--navy-900)', marginBottom: 8 }}>
              {scanResult.type === 'IN' ? 'เช็คอินสำเร็จ' : 'เช็คเอาท์สำเร็จ'}
            </div>
            <div style={{ fontSize: 40, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginBottom: 16 }}>
              {scanResult.time} น.
            </div>
            <span className={`chip ${scanResult.status === 'ทันเวลา' ? 'chip-ok' : 'chip-warn'}`} style={{ fontSize: 14, padding: '6px 16px' }}>
              {scanResult.status}
              {scanResult.lateMinutes ? ` (${scanResult.lateMinutes} นาที)` : ''}
            </span>

            <button onClick={() => setPageState('home')} className="btn btn-primary" style={{ width: '100%', marginTop: 32, padding: '16px' }}>
              กลับหน้าหลัก
            </button>
          </div>
        )}

      </div>

      <ToastContainer toasts={toasts} />
    </>
  );
}

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
