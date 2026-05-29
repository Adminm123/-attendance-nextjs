// ─── TypeScript Types ─────────────────────────────────────────────────────────
// กำหนด "รูปแบบ" ของข้อมูลที่ใช้ทั่วทั้งโปรเจค
// TypeScript จะช่วยแจ้งเตือนถ้าเราใส่ข้อมูลผิดประเภท

// ─── พนักงาน (เก็บใน Firestore collection: staff) ────────────────────────────
export interface Staff {
  id?:          string;       // Firestore document ID (auto-generated)
  name:         string;       // ชื่อ-นามสกุล
  nickname:     string;       // ชื่อเล่น
  lineId:       string;       // LINE User ID (ว่างถ้ายังไม่ผูก)
  mainBranchId: string;       // รหัสสาขาหลัก
  status:       'Pending' | 'Active' | 'Inactive';
  // Pending  = Admin เพิ่มแล้ว รอพนักงาน Login LINE มาผูก
  // Active   = ผูก LINE + ลงทะเบียนหน้าแล้ว ใช้งานได้
  // Inactive = ลาออก/พักงาน
  descriptors:  number[][];   // face descriptors จาก face-api.js (128 มิติ)
  createdAt:    Date;
}

// ─── สาขา (เก็บใน Firestore collection: branches) ────────────────────────────
export interface Branch {
  id:        string;   // รหัสสาขา เช่น "B01"
  name:      string;   // ชื่อสาขา เช่น "เซ็นทรัลพลาซา"
  province:  string;   // จังหวัด
  totalStaff: number;  // จำนวนพนักงานทั้งหมดในสาขา
  lat:       number;   // latitude (GPS)
  lng:       number;   // longitude (GPS)
  radius:    number;   // รัศมีที่ถือว่า "อยู่ในพื้นที่" (เมตร)
  openTime:  string;   // เวลาเปิด เช่น "09:00"
  closeTime: string;   // เวลาปิด เช่น "18:00"
  minStaff:  number;   // จำนวนพนักงานขั้นต่ำที่ต้องมี
}

// ─── บันทึกการเช็คอิน (เก็บใน Firestore collection: attendance) ──────────────
export interface AttendanceRecord {
  id?:           string;
  name:          string;
  time:          string;       // "09:30"
  date:          string;       // "2024-01-15"
  type:          'IN' | 'OUT'; // เข้างาน / ออกงาน
  branchId:      string;       // สาขาที่เช็คอินครั้งนี้
  homeBranchId:  string;       // สาขาหลักของพนักงาน
  isCrossBranch: boolean;      // true ถ้าเช็คอินที่สาขาอื่น
  lat:           number;
  lng:           number;
  status:        'ทันเวลา' | 'สาย' | 'ออกก่อนเวลา';
  lateMinutes:   number;       // นาทีที่สาย (0 ถ้าไม่สาย)
  accuracy:      number;       // ความแม่นยำ GPS (เมตร, -1 ถ้าไม่มี)
  createdAt?:    Date;
}

// ─── Session ของผู้ใช้ที่ login แล้ว ─────────────────────────────────────────
export interface SessionUser {
  lineId:        string;   // LINE User ID
  staffName:     string;   // ชื่อพนักงาน (ว่างถ้ายังไม่ผูก)
  staffNickname: string;   // ชื่อเล่น
  mainBranchId:  string;   // สาขาหลัก
  isLinked:      boolean;  // ผูก LINE กับพนักงานแล้วหรือยัง
}

// ─── ผลลัพธ์การเช็คอิน ────────────────────────────────────────────────────────
export interface AttendanceResult {
  success:      boolean;
  time?:        string;
  status?:      string;
  lateMinutes?: number;
  error?:       string;
}
