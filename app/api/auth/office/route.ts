// ─── Office/Manager Login ──────────────────────────────────────────────────────
// ตรวจสอบ password สำหรับ Office และ Manager dashboard

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { password, role } = await request.json();

  // เปรียบกับ env variable (ไม่ hardcode password ในโค้ด)
  const officePass  = process.env.OFFICE_PASSWORD;
  const managerPass = process.env.MANAGER_PASSWORD;

  if (password === officePass) {
    return NextResponse.json({ success: true, role: 'office' });
  }
  if (password === managerPass) {
    return NextResponse.json({ success: true, role: 'manager' });
  }

  return NextResponse.json({ success: false }, { status: 401 });
}
