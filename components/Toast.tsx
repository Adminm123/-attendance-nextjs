'use client';
// ─── Toast Notification ───────────────────────────────────────────────────────
// แสดงข้อความแจ้งเตือนชั่วคราว (เหมือน snackbar)
// ใช้งาน: import { useToast } จากนั้น const { toast } = useToast()
//          toast('บันทึกสำเร็จ', 'success')

import { useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'warn' | 'info';

interface ToastItem {
  id:      number;
  message: string;
  type:    ToastType;
}

// สีของแต่ละประเภท toast
const TOAST_STYLES: Record<ToastType, string> = {
  success: 'background:#0f7a4a; color:#fff',
  error:   'background:#cc0000; color:#fff',
  warn:    'background:#b96b00; color:#fff',
  info:    'background:#0a1d3f; color:#fff',
};

// ─── Hook สำหรับใช้ Toast ─────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // เพิ่ม toast ใหม่ แล้วลบออกอัตโนมัติหลัง 3 วินาที
  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  return { toasts, toast };
}

// ─── Toast Container Component ────────────────────────────────────────────────
// วางไว้ที่ root ของหน้า เพื่อแสดง toast list
export function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '90px',        // อยู่เหนือ bottom navigation bar
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: '90%',
      maxWidth: '480px',
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            ...(() => {
              const styles: Record<string, string> = {};
              TOAST_STYLES[t.type].split(';').forEach(s => {
                const [k, v] = s.split(':');
                if (k && v) styles[k.trim()] = v.trim();
              });
              return styles;
            })(),
            padding:      '12px 18px',
            borderRadius: '12px',
            fontSize:     '14px',
            fontWeight:   '500',
            textAlign:    'center',
            animation:    'fadeIn .2s ease',
          }}
        >
          {t.message}
        </div>
      ))}
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(8px) } }`}</style>
    </div>
  );
}
