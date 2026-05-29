# Attendance System — Next.js

ระบบเช็คชื่อพนักงานด้วยใบหน้าและ LINE Login

## Stack
- **Frontend/Backend**: Next.js 14 (App Router)
- **Database**: Firebase Firestore
- **Auth**: LINE Login OAuth
- **Face Recognition**: face-api.js (1:1 verification)
- **Hosting**: Vercel

## โครงสร้างโฟลเดอร์

```
app/
  page.tsx              ← หน้าแรก (เช็คอิน)
  HomeClient.tsx        ← UI ของหน้าแรก (Client Component)
  link/page.tsx         ← ผูก LINE กับชื่อพนักงาน
  office/page.tsx       ← Office Dashboard
  api/
    auth/line/          ← LINE OAuth callback
    auth/me/            ← ดึง session ปัจจุบัน
    auth/logout/        ← Logout
    auth/office/        ← Office/Manager login
    staff/              ← จัดการพนักงาน
    staff/link/         ← ผูก LINE ID
    staff/descriptors/  ← Face descriptors
    attendance/         ← บันทึกเช็คอิน
    dashboard/          ← ข้อมูล dashboard

components/
  FaceScanner.tsx       ← กล้อง + face recognition (1:1)
  LineLoginButton.tsx   ← ปุ่ม Login LINE
  Toast.tsx             ← แจ้งเตือน

lib/
  firebase.ts           ← Firebase client (browser)
  firebase-admin.ts     ← Firebase Admin (server only)
  line.ts               ← LINE OAuth helpers
  session.ts            ← Cookie session
  types.ts              ← TypeScript types
```

## วิธีเริ่มต้น

### 1. ติดตั้ง dependencies
```bash
npm install
```

### 2. ตั้งค่า environment variables
```bash
cp .env.local.example .env.local
# แก้ไขค่าใน .env.local
```

### 3. ดาวน์โหลด face-api.js models
วางใน `public/models/`:
- ssd_mobilenetv1_model-weights_manifest.json
- face_landmark_68_model-weights_manifest.json
- face_recognition_model-weights_manifest.json
- และไฟล์ .bin ที่เกี่ยวข้อง

ดาวน์โหลดได้จาก: https://github.com/justadudewhohacks/face-api.js/tree/master/weights

### 4. รัน development server
```bash
npm run dev
```
เปิด http://localhost:3000

### 5. ตั้งค่า LINE Login
1. ไปที่ https://developers.line.biz
2. สร้าง Provider → สร้าง LINE Login Channel
3. ใส่ Callback URL: `http://localhost:3000/api/auth/line`
4. คัดลอก Channel ID และ Channel Secret ใส่ใน .env.local

### 6. ตั้งค่า Firebase
1. ไปที่ https://console.firebase.google.com
2. สร้าง Project → เพิ่ม Web App
3. เปิด Firestore Database
4. ดาวน์โหลด Service Account key

## Deploy บน Vercel
```bash
npm install -g vercel
vercel
```
อย่าลืมตั้งค่า Environment Variables ใน Vercel Dashboard
