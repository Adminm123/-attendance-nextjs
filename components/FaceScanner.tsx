'use client';
// ─── Face Scanner Component ───────────────────────────────────────────────────
// Component นี้เปิดกล้อง ตรวจจับใบหน้า และ verify กับ descriptor ของพนักงานคนนั้น
// เปลี่ยนจาก 1:N (เทียบกับทุกคน) → 1:1 (เทียบกับตัวเองคนเดียว)
// นี่คือหัวใจของการแก้ปัญหา "แสกนขึ้นชื่อผิด"

import { useRef, useEffect, useState, useCallback } from 'react';

// ประกาศ type สำหรับ face-api.js ที่โหลดจาก CDN (window.faceapi)
declare const faceapi: any;

interface Props {
  // descriptors ของพนักงานคนนี้ (จาก Firestore)
  // เป็น array ของ 128 ตัวเลข แทนลักษณะใบหน้า
  staffDescriptors: number[][];
  staffName:        string;
  onSuccess:        () => void;  // callback เมื่อ verify ผ่าน
  onError?:         (msg: string) => void;
}

// โฟลเดอร์ที่เก็บ AI model (ต้องวางใน public/models/)
const MODEL_URL = '/models';

// ─── ค่าที่ปรับแต่งได้ ───────────────────────────────────────────────────────
const VERIFY_THRESHOLD = 0.42; // ระยะห่าง Euclidean สูงสุดที่ถือว่า "ผ่าน"
                                // ยิ่งน้อย = เข้มงวดมากขึ้น (ลดการสแกนผิด)
const MIN_GAP          = 0.07; // ช่องว่างขั้นต่ำระหว่าง best กับ second-best
                                // ถ้า 2 ค่าใกล้กันเกิน = ไม่แน่ใจ → reject
const HITS_NEEDED      = 4;    // ต้องสแกนผ่านติดต่อกัน 4 ครั้ง จึงยืนยัน
const SCAN_INTERVAL_MS = 500;  // สแกนทุก 500ms

export default function FaceScanner({ staffDescriptors, staffName, onSuccess, onError }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus]       = useState<'loading' | 'ready' | 'scanning' | 'done'>('loading');
  const [hint, setHint]           = useState('กำลังโหลด AI Model...');
  const [hits, setHits]           = useState(0);
  const [modelsReady, setModels]  = useState(false);

  const timerRef  = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hitsRef   = useRef(0); // ใช้ ref เพราะ interval closure ไม่เห็น state ล่าสุด

  // ─── โหลด AI Models ──────────────────────────────────────────────────────────
  // โหลดครั้งเดียว ใช้ทั้ง component lifecycle
  useEffect(() => {
    async function loadModels() {
      try {
        // รอให้ face-api.js โหลดจาก CDN ก่อน
        let attempts = 0;
        while (typeof faceapi === 'undefined' && attempts < 20) {
          await new Promise(r => setTimeout(r, 500));
          attempts++;
        }
        if (typeof faceapi === 'undefined') throw new Error('face-api.js โหลดไม่สำเร็จ');

        // โหลด 3 model ที่จำเป็น
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),  // ตรวจจับใบหน้า
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL), // จุด landmark 68 จุด
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL), // แปลงใบหน้าเป็น descriptor
        ]);
        setModels(true);
        setHint('กดเริ่มสแกนใบหน้า');
        setStatus('ready');
      } catch (e: any) {
        setHint('โหลด AI ล้มเหลว: ' + e.message);
        onError?.('โหลด AI Model ไม่สำเร็จ');
      }
    }
    loadModels();

    // Cleanup: หยุดกล้องเมื่อ component ถูกทำลาย
    return () => stopCamera();
  }, []);

  // ─── หยุดกล้องและ timer ───────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (timerRef.current)  { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ─── เริ่มสแกน ────────────────────────────────────────────────────────────────
  const startScan = useCallback(async () => {
    if (!modelsReady || !videoRef.current) return;

    try {
      // ขอเปิดกล้อง (จะขอ permission จาก browser)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      streamRef.current       = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      hitsRef.current = 0;
      setHits(0);
      setStatus('scanning');
      setHint('หันหน้าตรงเข้ากล้อง...');

      // ─── สร้าง LabeledFaceDescriptors สำหรับ 1:1 matching ──────────────────────
      // เก็บเฉพาะ descriptor ของพนักงานคนนี้เท่านั้น (ไม่ใช่ทุกคนในระบบ!)
      const labeledDescriptors = [
        new faceapi.LabeledFaceDescriptors(
          staffName,
          staffDescriptors.map(d => new Float32Array(d))
        ),
      ];
      // threshold ต่ำกว่านี้ถือว่าเป็นคนเดียวกัน
      const matcher = new faceapi.FaceMatcher(labeledDescriptors, VERIFY_THRESHOLD);

      // ─── Loop สแกนทุก 500ms ────────────────────────────────────────────────────
      timerRef.current = setInterval(async () => {
        const video  = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !video.videoWidth) return;

        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // ตรวจจับใบหน้า + คำนวณ descriptor ของเฟรมนี้
        const detection = await faceapi
          .detectSingleFace(video)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          hitsRef.current = 0;
          setHits(0);
          setHint('ไม่พบใบหน้า — หันหน้าตรงเข้ากล้อง');
          return;
        }

        // วาดกรอบรอบใบหน้า
        const { box } = detection.detection;
        ctx.strokeStyle = '#0f7a4a';
        ctx.lineWidth   = 3;
        ctx.beginPath();
        ctx.roundRect(box.x, box.y, box.width, box.height, 10);
        ctx.stroke();

        // ─── 1:1 Matching ─────────────────────────────────────────────────────────
        const bestMatch = matcher.findBestMatch(detection.descriptor);

        // ตรวจสอบเพิ่มเติม: ช่องว่างระหว่าง best กับ descriptor อื่นๆ
        // ป้องกันกรณีที่ match "พอดีผ่าน" แต่ไม่มั่นใจ
        const distances = staffDescriptors.map(d =>
          faceapi.euclideanDistance(detection.descriptor, new Float32Array(d))
        );
        const minDist = Math.min(...distances);
        const maxDist = Math.max(...distances);
        const gap     = maxDist - minDist; // ยิ่ง gap มาก = มั่นใจมากขึ้น

        if (bestMatch.label === 'unknown' || gap < MIN_GAP) {
          // ไม่ผ่าน: ใบหน้าไม่ตรง หรือ ไม่มั่นใจพอ
          hitsRef.current = 0;
          setHits(0);
          setHint(bestMatch.label === 'unknown'
            ? 'ใบหน้าไม่ตรงกับข้อมูลในระบบ'
            : 'กรุณาหันหน้าให้ตรงขึ้น...'
          );
          ctx.strokeStyle = '#cc0000';
          ctx.beginPath();
          ctx.roundRect(box.x, box.y, box.width, box.height, 10);
          ctx.stroke();
          return;
        }

        // ─── ผ่าน: นับ hits ──────────────────────────────────────────────────────
        hitsRef.current += 1;
        setHits(hitsRef.current);
        setHint(`กำลังยืนยัน... (${hitsRef.current}/${HITS_NEEDED})`);

        // วาดชื่อเหนือกรอบ
        ctx.fillStyle = 'rgba(15,122,74,.9)';
        ctx.fillRect(box.x, box.y - 32, box.width, 32);
        ctx.fillStyle   = '#fff';
        ctx.font        = '600 14px "IBM Plex Sans Thai",sans-serif';
        ctx.textAlign   = 'center';
        ctx.fillText(`✓ ${staffName}`, box.x + box.width / 2, box.y - 10);

        // ยืนยันสำเร็จเมื่อผ่านครบ N ครั้งติดต่อกัน
        if (hitsRef.current >= HITS_NEEDED) {
          stopCamera();
          setStatus('done');
          setHint('ยืนยันตัวตนสำเร็จ ✓');
          onSuccess();
        }
      }, SCAN_INTERVAL_MS);

    } catch (e: any) {
      setHint('ไม่สามารถเปิดกล้องได้: ' + e.message);
      onError?.('เปิดกล้องไม่ได้ กรุณาอนุญาต camera permission');
    }
  }, [modelsReady, staffDescriptors, staffName, onSuccess, onError, stopCamera]);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '400px', margin: '0 auto' }}>
      {/* Video + Canvas ซ้อนกัน */}
      <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', background: '#000' }}>
        <video
          ref={videoRef}
          muted
          playsInline   // จำเป็นสำหรับ iOS (ไม่งั้นเปิดกล้องไม่ได้)
          style={{ width: '100%', display: 'block' }}
        />
        {/* Canvas วาดทับ video เพื่อแสดงกรอบใบหน้า */}
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />
      </div>

      {/* แสดงสถานะ */}
      <div style={{ textAlign: 'center', marginTop: '12px' }}>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '8px' }}>{hint}</p>

        {/* Progress bar */}
        {status === 'scanning' && (
          <div style={{ background: 'var(--line)', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              background: 'var(--success)',
              width: `${(hits / HITS_NEEDED) * 100}%`,
              transition: 'width .3s',
            }} />
          </div>
        )}

        {/* ปุ่มเริ่มสแกน */}
        {status === 'ready' && (
          <button onClick={startScan} className="btn btn-primary w-full mt-3">
            เริ่มสแกนใบหน้า
          </button>
        )}

        {/* สำเร็จ */}
        {status === 'done' && (
          <div style={{ color: 'var(--success)', fontWeight: 600, fontSize: '16px' }}>
            ✓ ยืนยันตัวตนสำเร็จ
          </div>
        )}
      </div>
    </div>
  );
}
