// หน้า Manager ถูกรวมเข้าไปอยู่ใน /office แล้ว (แท็บ "จัดการ")
import { redirect } from 'next/navigation';

export default function ManagerPage() {
  redirect('/office');
}
