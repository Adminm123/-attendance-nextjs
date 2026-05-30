'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter }                                  from 'next/navigation';
import { useToast, ToastContainer }                   from '@/components/Toast';

const POSES = [
  { label: 'มองตรงเข้ากล้อง',  hint: 'ค้างไว้ ไม่ก้มไม่เงย' },
  { label: 'หันหน้าไปทางซ้าย', hint: 'ประมาณ 30–45 องศา' },
  { label: 'หันหน้าไปทางขวา',  hint: 'ประมาณ 30–45 องศา' },
  { label: 'ก้มหน้าเล็กน้อย',  hint: 'ประมาณ 20 องศา' },
  { label: 'เงยหน้าเล็กน้อย',  hint: 'ประมาณ 20 องศา' },
];

declare const faceapi: any;
const MODEL_URL = '/models';

export default function RegisterPage() {
  const router            = useRouter();
  const { toasts, toast } = useToast();
  const videoRef          = useRef<HTMLVideoElement>(null);
  const streamRef         = useRef<MediaStream | null>(null);

  const [step, setStep]           = useState<'intro' | 'capture' | 'saving' | 'done'>('intro');
  const [modelsReady, setModels]  = useState(false);
  const [modelError, setModelErr] = useState('');
  const [currentPose, setPose]    = useState(0);
  const [captured, setCaptured]   = useState<boolean[]>([false,false,false,false,false]);
  const [tempDescs, setTempDescs] = useState<number[][]>([]);
  const [isCapturing, setCapturing] = useState(false);
  const [hint, setHint]           = useState('');

  // ─── โหลด models + ตรวจ session ────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      // ตรวจว่า isLinked แล้วหรือยัง
      try {
        const r = await fetch('/api/auth/me');
        const d = await r.json();
        if (!d.user?.isLinked) {
          toast('กรุณาผูก LINE ก่อน', 'error');
          setTimeout(() => router.push('/link'), 1500);
          return;
        }
      } catch {
        // ถ้า me endpoint ล้ม ปล่อยผ่าน (API จะจัดการเอง)
      }

      // โหลด face-api models
      try {
        let attempts = 0;
        while (typeof faceapi === 'undefined' && attempts < 40) {
          await new Promise(r => setTimeout(r, 500));
          attempts++;
        }
        if (typeof faceapi === 'undefined') {
          throw new Error('โหลดไลบรารีไม่สำเร็จ — ตรวจสอบการเชื่อมต่อแล้วรีโหลดหน้า');
        }
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModels(true);
        setModelErr('');
      } catch (e: any) {
        const msg = e.message || 'โหลด AI ไม่สำเร็จ';
        setModelErr(msg);
        toast('โหลด AI ล้มเหลว: ' + msg, 'error');
      }
    }
    init();
    return () => stopCamera();
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e: any) {
      toast('ไม่สามารถเปิดกล้อง: ' + e.message, 'error');
    }
  }, []);

  // ─── ถ่ายและดึง descriptor ────────────────────────────────────────────────
  const captureOne = useCallback(async () => {
    if (!videoRef.current || isCapturing || !modelsReady) return;
    setCapturing(true);
    setHint('กำลังสแกน...');

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setHint('ไม่พบใบหน้า — ปรับตำแหน่งแล้วลองใหม่');
        toast('ไม่พบใบหน้า ปรับตำแหน่งแล้วลองใหม่', 'warn');
        setCapturing(false);
        return;
      }

      if (detection.detection.score < 0.7) {
        setHint('ความมั่นใจต่ำ — ปรับแสงให้สว่างขึ้น');
        toast('กรุณาปรับแสงให้สว่างขึ้น', 'warn');
        setCapturing(false);
        return;
      }

      const descriptor = Array.from(detection.descriptor) as number[];
      setTempDescs(prev => [...prev, descriptor]);
      setCaptured(prev => { const n = [...prev]; n[currentPose] = true; return n; });
      setHint(`ท่า ${currentPose + 1}/5 สำเร็จ`);
      toast(`ท่าที่ ${currentPose + 1} สำเร็จ`, 'success');

      if (currentPose < POSES.length - 1) {
        setTimeout(() => { setPose(p => p + 1); setHint(''); }, 800);
      } else {
        setTimeout(() => saveDescriptors([...tempDescs, descriptor]), 800);
      }
    } catch (e: any) {
      toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
      setHint('ลองใหม่อีกครั้ง');
    } finally {
      setCapturing(false);
    }
  }, [currentPose, isCapturing, modelsReady, tempDescs]);

  // ─── บันทึก descriptors ────────────────────────────────────────────────────
  const saveDescriptors = async (allDescs: number[][]) => {
    setStep('saving');
    stopCamera();
    try {
      const res  = await fetch('/api/staff/descriptors', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ descriptors: allDescs }),
      });
      const data = await res.json();
      if (data.success) {
        setStep('done');
        setTimeout(() => router.push('/'), 2000);
      } else {
        toast(data.error || `บันทึกไม่สำเร็จ (${res.status})`, 'error');
        setStep('capture');
        startCamera();
      }
    } catch {
      toast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
      setStep('capture');
      startCamera();
    }
  };

  const handleStart = () => {
    if (!modelsReady) { toast('AI Model ยังโหลดไม่เสร็จ', 'warn'); return; }
    setStep('capture');
    setPose(0);
    setCaptured([false,false,false,false,false]);
    setTempDescs([]);
    startCamera();
  };

  const pose = POSES[currentPose];

  return (
    <>
      <header style={{ background: 'var(--navy-900)', padding: '16px 18px' }}>
        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase' }}>ครั้งแรกเท่านั้น</div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>ลงทะเบียนใบหน้า</div>
      </header>

      <div className="shell" style={{ paddingTop: 20 }}>

        {/* ─── Intro ─── */}
        {step === 'intro' && (
          <div className="tab-panel">
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 6 }}>ลงทะเบียนใบหน้า</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>
                ถ่ายใบหน้า <strong>5 ท่า</strong> เพื่อให้ระบบจดจำได้แม่นยำ<br />
                ใช้เวลาประมาณ 1–2 นาที
              </div>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>เตรียมตัวก่อนเริ่ม</div>
              {[
                'อยู่ในที่มีแสงสว่างเพียงพอ',
                'ถอดหมวก แว่นกันแดด หน้ากาก',
                'หันหน้าให้อยู่กลางกล้อง',
                'ระยะห่างประมาณ 30–50 ซม.',
              ].map((tip, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6, fontSize: 13, color: 'var(--ink-soft)' }}>
                  <span style={{ color: 'var(--success)', flexShrink: 0 }}>✓</span>
                  {tip}
                </div>
              ))}
            </div>

            {modelError ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ background: 'var(--red-50)', border: '1px solid #fad6d6', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: 'var(--red)', marginBottom: 10 }}>
                  {modelError}
                </div>
                <button
                  onClick={() => { setModelErr(''); window.location.reload(); }}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: 16, fontSize: 15 }}
                >
                  รีโหลดหน้าเพื่อลองใหม่
                </button>
              </div>
            ) : (
              <button
                onClick={handleStart}
                disabled={!modelsReady}
                className="btn btn-primary"
                style={{ width: '100%', padding: 16, fontSize: 15 }}
              >
                {modelsReady ? 'เริ่มลงทะเบียน' : 'กำลังโหลด AI...'}
              </button>
            )}
          </div>
        )}

        {/* ─── Capture ─── */}
        {step === 'capture' && (
          <>
            {/* Progress */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
              {POSES.map((_, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: captured[i] ? 'var(--success)' : i === currentPose ? 'var(--navy-900)' : 'var(--line)',
                  transition: 'background .3s',
                }} />
              ))}
            </div>

            {/* Camera */}
            <div style={{ borderRadius: 16, overflow: 'hidden', background: '#000', marginBottom: 12, position: 'relative' }}>
              <video ref={videoRef} muted playsInline style={{ width: '100%', display: 'block' }} />
              {isCapturing && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.4)' }}>
                  <div className="spinner" />
                </div>
              )}
            </div>

            {/* Status hint */}
            {hint && (
              <div style={{
                textAlign: 'center', fontSize: 13, marginBottom: 10,
                color: hint.includes('สำเร็จ') ? 'var(--success)' : 'var(--muted)',
              }}>
                {hint}
              </div>
            )}

            {/* Capture button — contains pose label + hint */}
            <button
              onClick={captureOne}
              disabled={isCapturing || captured[currentPose]}
              className="btn"
              style={{
                width: '100%', padding: '14px 16px',
                background: captured[currentPose] ? 'var(--success)' : 'var(--navy-900)',
                color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              }}
            >
              {captured[currentPose] ? (
                <span style={{ fontSize: 15, fontWeight: 600 }}>ท่า {currentPose + 1} เสร็จแล้ว</span>
              ) : isCapturing ? (
                <span style={{ fontSize: 15 }}>กำลังสแกน...</span>
              ) : (
                <>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>ถ่าย ท่า {currentPose + 1}/5 · {pose.label}</span>
                  <span style={{ fontSize: 12, opacity: .65 }}>{pose.hint}</span>
                </>
              )}
            </button>
          </>
        )}

        {/* ─── Saving ─── */}
        {step === 'saving' && (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <div style={{ fontWeight: 600, color: 'var(--navy-900)' }}>กำลังบันทึกข้อมูลใบหน้า...</div>
          </div>
        )}

        {/* ─── Done ─── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', paddingTop: 60 }} className="spring-pop">
            <div style={{ fontSize: 56, color: 'var(--success)', marginBottom: 16, lineHeight: 1 }}>✓</div>
            <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--success)' }}>ลงทะเบียนสำเร็จ</div>
            <div style={{ color: 'var(--muted)', marginTop: 8, fontSize: 14 }}>กำลังพาไปหน้าเช็คอิน...</div>
          </div>
        )}

      </div>

      <ToastContainer toasts={toasts} />
    </>
  );
}
