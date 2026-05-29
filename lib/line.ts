// ─── LINE Login OAuth Helpers ─────────────────────────────────────────────────
// รวม function ทุกอย่างที่เกี่ยวกับ LINE Login

// ค่าเหล่านี้อยู่ใน .env.local เท่านั้น ไม่เปิดเผยให้ browser เห็น
const LINE_CLIENT_ID     = process.env.LINE_CLIENT_ID!;
const LINE_CLIENT_SECRET = process.env.LINE_CLIENT_SECRET!;

// URL ที่ LINE จะ redirect กลับมาหลัง login สำเร็จ
// ต้องตรงกับที่ตั้งค่าใน LINE Developers Console
function getCallbackUrl() {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/line`;
}

// ─── สร้าง URL สำหรับ redirect ไป LINE Login ──────────────────────────────────
// state ใช้ป้องกัน CSRF attack (random string ที่เราสร้างเอง)
export function getLineLoginUrl(): string {
  // สร้าง random state เพื่อป้องกัน CSRF
  const state = Math.random().toString(36).substring(2);

  const params = new URLSearchParams({
    response_type: 'code',               // OAuth 2.0 Authorization Code Flow
    client_id:     LINE_CLIENT_ID,
    redirect_uri:  getCallbackUrl(),
    state,
    scope:         'profile openid',     // ขอแค่ข้อมูล profile (ชื่อ, userId, รูป)
  });

  return `https://access.line.me/oauth2/v2.1/authorize?${params}`;
}

// ─── แลก Authorization Code เป็น Access Token ────────────────────────────────
// LINE ส่ง code กลับมา → เราแลกเป็น token เพื่อดึง profile
export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  getCallbackUrl(),
      client_id:     LINE_CLIENT_ID,
      client_secret: LINE_CLIENT_SECRET,
    }),
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`LINE token error: ${data.error_description || 'unknown'}`);
  }
  return data.access_token;
}

// ─── ดึง Profile จาก LINE ────────────────────────────────────────────────────
// ได้ข้อมูล: userId (ถาวร), displayName, pictureUrl
export async function getLineProfile(accessToken: string) {
  const response = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('ไม่สามารถดึงข้อมูล LINE profile ได้');
  }

  const profile = await response.json();
  return profile as {
    userId:      string;  // LINE User ID เช่น "U1a2b3c4..." ถาวรไม่เปลี่ยน
    displayName: string;  // ชื่อที่ตั้งใน LINE
    pictureUrl:  string;  // URL รูป profile LINE
  };
}
