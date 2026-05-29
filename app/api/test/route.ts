export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  const raw = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '(not set)';
  const key = raw.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');

  let firebaseStatus = 'untested';
  let firebaseError  = '';

  try {
    const { initializeApp, getApps, cert, deleteApp } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    const apps = getApps();
    const app  = apps.length
      ? apps[0]
      : initializeApp({ credential: cert({
          projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
          privateKey:  key,
        }) }, 'test-' + Date.now());

    const db = getFirestore(app);
    await db.collection('_test').limit(1).get();
    firebaseStatus = 'ok';
    if (!apps.length) await deleteApp(app);
  } catch (e: any) {
    firebaseStatus = 'error';
    firebaseError  = e?.message ?? String(e);
  }

  return NextResponse.json({
    version: '2',
    keyStart: key.slice(0, 40),
    keyEnd:   key.slice(-30),
    keyLength: key.length,
    firebaseStatus,
    firebaseError,
  });
}
