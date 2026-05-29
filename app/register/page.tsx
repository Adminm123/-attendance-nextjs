'use client';
// ─── หน้าลงทะเบียนใบหน้า ─────────────────────────────────────────────────────
// พนักงานที่ผูก LINE แล้วแต่ยังไม่มี face descriptor จะมาที่หน้านี้
// ถ่ายใบหน้า 5 ท่า → บันทึก descriptor → กลับหน้าแรก

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter }                                  from 'next/navigation';
import { useToast, ToastContainer }                   from '@/components/Toast';

// ท่าที่ต้องถ่าย (5 ท่า หลากหลายมุม = descriptor แม่นยำขึ้น)
const POSES = [
  { label: 'มองตรงเข้ากล้อง',   emoji: '😐', hint: 'ค้างไว้ ไม่ก้มไม่เงย' },
  { label: 'หันหน้าไปทางซ้าย',  emoji: '←',  hint: 'ประมาณ 30-45 องศา' },
  { label: 'หันหน้าไปทางขวา',   emoji: '→',  hint: 'ประมาณ 30-45 องศา' },
  { label: 'ก้มหน้าเล็กน้อย',   emoji: '↓',  hint: 'ประมาณ 20 องศา' },
  { label: 'เงยหน้าเล็กน้อย',   emoji: '↑',  hint: 'ประมาณ 20 องศา' },
];

declare const faceapi: any;
const MODEL_URL = '/models';

export default function RegisterPage() {
  const router            = useRouter();
  const { toasts, toast } = useToast();
  const videoRef          = useRef<HTMLVideoElement>(null);
  const streamRef         = useRef<MediaStream | null>(null);

  const [step, setStep]             = useState<'intro' | 'capture' | 'saving' | 'done'>('intro');
  const [modelsReady, setModels]    = useState(false);
  const [currentPose, setPose]      = useState(0);         // ท่าปัจจุบัน (0-4)
  const [captured, setCaptured]     = useState<boolean[]>([false,false,false,false,false]);
  const [tempDescs, setTempDescs]   = useState<number[][]>([]); // descriptors ที่เก็บไว้
  const [isCapturing, setCapturing] = useState(false);
  const [hint, setHint]             = useState('');

  // ─── โหลด AI Models ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        let attempts = 0;
        while (typeof faceapi === 'undefined' && attempts < 30) {
          await new Promise(r => setTimeout(r, 500));
          attempts++;
        }
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModels(true);
      } catch (e: any) {
        toast('โหลด AI ล้มเหลว: ' + e.message, 'error');
      }
    }
    load();
    return () => stopCamera();
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // ─── เปิดกล้อง ────────────────────────────────────────────────────────────
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

  // ─── ถ่ายภาพและดึง descriptor ────────────────────────────────────────────
  const captureOne = useCallback(async () => {
    if (!videoRef.current || isCapturing || !modelsReady) return;
    setCapturing(true);
    setHint('กำลังสแกน...');

    try {
      // ตรวจจับใบหน้าและคำนวณ descriptor
      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setHint('ไม่พบใบหน้า — ลองใหม่อีกครั้ง');
        toast('ไม่พบใบหน้า ปรับตำแหน่งแล้วลองใหม่', 'warn');
        setCapturing(false);
        return;
      }

      // ตรวจสอบ detection score (ต้องมั่นใจพอ)
      const score = detection.detection.score;
      if (score < 0.7) {
        setHint('ความมั่นใจต่ำ — แสงอาจไม่พอ ลองใหม่');
        toast('กรุณาปรับแสงให้สว่างขึ้น', 'warn');
        setCapturing(false);
        return;
      }

      // บันทึก descriptor ของท่านี้
      const descriptor = Array.from(detection.descriptor) as number[]; // Float32Array → number[]
      setTempDescs(prev => [...prev, descriptor]);

      // อัพเดทสถานะ
      setCaptured(prev => {
        const next = [...prev];
        next[currentPose] = true;
        return next;
      });

      setHint(`ท่า ${currentPose + 1}/5 สำเร็จ ✓`);
      toast(`ท่าที่ ${currentPose + 1} สำเร็จ`, 'success');

      // ไปท่าถัดไปหรือเสร็จสิ้น
      if (currentPose < POSES.length - 1) {
        setTimeout(() => {
          setPose(p => p + 1);
          setHint('');
        }, 800);
      } else {
        // ครบทุกท่าแล้ว
        setTimeout(() => saveDescriptors([...tempDescs, descriptor]), 800);
      }

    } catch (e: any) {
      toast('เกิดข้อผิดพลาด: ' + e.message, 'error');
      setHint('ลองใหม่อีกครั้ง');
    } finally {
      setCapturing(false);
    }
  }, [currentPose, isCapturing, modelsReady, tempDescs]);

  // ─── บันทึก descriptors ลง Firestore ─────────────────────────────────────
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
        toast(data.error || 'บันทึกไม่สำเร็จ', 'error');
        setStep('capture');
        startCamera();
      }
    } catch {
      toast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
      setStep('capture');
      startCamera();
    }
  };

  // ─── เริ่มถ่าย ────────────────────────────────────────────────────────────
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
        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase' }}>ครั้งแรกเท่านั้น</div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>ลงทะเบียนใบหน้า</div>
      </header>

      <div className="shell" style={{ paddingTop: '20px' }}>

        {/* ─── Intro ─────────────────────────────────────────────────────── */}
        {step === 'intro' && (
          <div style={{ textAlign: 'center', paddingTop: '20px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📷</div>
            <div style={{ fontWeight: 700, fontSize: '20px', marginBottom: '8px' }}>ลงทะเบียนใบหน้า</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.7, marginBottom: '32px' }}>
              ระบบจะขอถ่ายใบหน้า <strong>5 ท่า</strong><br />
              เพื่อให้จดจำใบหน้าได้แม่นยำในทุกสภาพแสง<br />
              ใช้เวลาประมาณ 1-2 นาที
            </div>

            <div className="card" style={{ textAlign: 'left', marginBottom: '24px' }}>
              <div style={{ fontWeight: 600, marginBottom: '10px' }}>เตรียมตัวก่อนเริ่ม</div>
              {['อยู่ในที่ที่มีแสงสว่างพอ', 'ถอดหมวก แว่นกันแดด หน้ากาก', 'หันหน้าให้อยู่กลางกล้อง', 'ระยะห่างประมาณ 30-50 ซม.'].map((tip, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '6px', fontSize: '13px', color: 'var(--ink-soft)' }}>
                  <span style={{ color: 'var(--success)', flexShrink: 0 }}>✓</span>
                  {tip}
                </div>
              ))}
            </div>

            <button
              onClick={handleStart}
              disabled={!modelsReady}
              className="btn btn-primary w-full py-4 text-base"
            >
              {modelsReady ? 'เริ่มลงทะเบียน' : 'กำลังโหลด AI...'}
            </button>
          </div>
        )}

        {/* ─── Capture ────────────────────────────────────────────────────── */}
        {step === 'capture' && (
          <>
            {/* Progress dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}>
              {POSES.map((_, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: captured[i] ? 'var(--success)' : i === currentPose ? 'var(--navy-900)' : 'var(--line)',
                  transition: 'background .3s',
                }} />
              ))}
            </div>

            {/* ท่าปัจจุบัน */}
            <div className="card" style={{ textAlign: 'center', padding: '16px', marginBottom: '12px' }}>
              <div style={{ fontSize: '32px', marginBottom: '4px' }}>{pose.emoji}</div>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>ท่า {currentPose + 1}/5 · {pose.label}</div>
              <div style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '2px' }}>{pose.hint}</div>
            </div>

            {/* กล้อง */}
            <div style={{ borderRadius: '16px', overflow: 'hidden', background: '#000', marginBottom: '12px', position: 'relative' }}>
              <video ref={videoRef} muted playsInline style={{ width: '100%', display: 'block' }} />
              {isCapturing && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,.4)',
                }}>
                  <div className="spinner" />
                </div>
              )}
            </div>

            {hint && (
              <div style={{ textAlign: 'center', color: captured[currentPose] ? 'var(--success)' : 'var(--muted)', fontSize: '13px', marginBottom: '10px' }}>
                {hint}
              </div>
            )}

            {/* ปุ่มถ่าย */}
            <button
              onClick={captureOne}
              disabled={isCapturing || captured[currentPose]}
              className="btn w-full py-4 text-base"
              style={{
                background: captured[currentPose] ? 'var(--success)' : 'var(--navy-900)',
                color: '#fff',
              }}
            >
              {captured[currentPose] ? `✓ ท่า ${currentPose + 1} เสร็จแล้ว` : isCapturing ? 'กำลังสแกน...' : `📸 ถ่าย · ${pose.label}`}
            </button>
          </>
        )}

        {/* ─── Saving ─────────────────────────────────────────────────────── */}
        {step === 'saving' && (
          <div style={{ textAlign: 'center', paddingTop: '80px' }}>
            <div className="spinner" style={{ margin: '0 auto 16px', borderColor: 'rgba(0,0,0,.1)', borderTopColor: 'var(--navy-900)' }} />
            <div style={{ fontWeight: 600, color: 'var(--navy-900)' }}>กำลังบันทึกข้อมูลใบหน้า...</div>
          </div>
        )}

        {/* ─── Done ───────────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', paddingTop: '60px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: '22px', color: 'var(--success)' }}>ลงทะเบียนสำเร็จ!</div>
            <div style={{ color: 'var(--muted)', marginTop: '8px', fontSize: '14px' }}>กำลังพาไปหน้าเช็คอิน...</div>
          </div>
        )}

      </div>

      <ToastContainer toasts={toasts} />
    </>
  );
}
