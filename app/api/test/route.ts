export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createSign }   from 'crypto';

export async function GET() {
  // ─── ดึง credentials ─────────────────────────────────────────────────────────
  let projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID ?? '';
  let clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? '';
  let privateKey  = '';

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const sa  = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      projectId   = sa.project_id;
      clientEmail = sa.client_email;
      privateKey  = sa.private_key;
    } catch (e) {
      return NextResponse.json({ error: 'JSON parse failed', detail: String(e) });
    }
  } else {
    const raw  = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '';
    privateKey = raw.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
  }

  // ─── สร้าง JWT และแลก access token กับ Google ────────────────────────────────
  let tokenStatus = '';
  let tokenError  = '';
  try {
    const now     = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      iss:   clientEmail,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud:   'https://oauth2.googleapis.com/token',
      exp:   now + 3600,
      iat:   now,
    });

    const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const body    = Buffer.from(payload).toString('base64url');
    const sign    = createSign('RSA-SHA256');
    sign.update(`${header}.${body}`);
    const sig     = sign.sign(privateKey, 'base64url');
    const jwt     = `${header}.${body}.${sig}`;

    const res  = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion:  jwt,
      }),
    });
    const data = await res.json() as any;
    tokenStatus = res.ok ? 'ok' : 'error';
    tokenError  = res.ok ? '' : JSON.stringify(data);
  } catch (e: any) {
    tokenStatus = 'exception';
    tokenError  = e?.message ?? String(e);
  }

  return NextResponse.json({
    projectId,
    clientEmail: clientEmail.slice(0, 30) + '...',
    keyOk:  privateKey.startsWith('-----BEGIN'),
    keyLen: privateKey.length,
    tokenStatus,
    tokenError,
    usingJson: !!process.env.FIREBASE_SERVICE_ACCOUNT,
  });
}
