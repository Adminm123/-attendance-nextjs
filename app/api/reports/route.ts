export const dynamic = 'force-dynamic';

// GET /api/reports?type=absent|late|logs|summary&date=YYYY-MM-DD&from=YYYY-MM-DD&to=YYYY-MM-DD
import { NextRequest, NextResponse } from 'next/server';
import { adminDb }                   from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'logs';
    const date = searchParams.get('date') || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
    const from = searchParams.get('from') || date;
    const to   = searchParams.get('to')   || date;

    // ─── Logs ──────────────────────────────────────────────────────────────────
    if (type === 'logs') {
      const snap = await adminDb.collection('attendance').where('date', '==', date).get();
      const records = snap.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
      return NextResponse.json({ records });
    }

    // ─── Absent ────────────────────────────────────────────────────────────────
    if (type === 'absent') {
      const [staffSnap, attSnap] = await Promise.all([
        adminDb.collection('staff').where('status', '==', 'Active').get(),
        adminDb.collection('attendance').where('date', '==', date).get(),
      ]);
      const allStaff  = staffSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      const checkedIn = new Set(
        attSnap.docs.filter(d => (d.data() as any).type === 'IN').map(d => (d.data() as any).name)
      );
      const absent = allStaff.filter(s => !checkedIn.has(s.name));
      return NextResponse.json({ absent, date });
    }

    // ─── Late ──────────────────────────────────────────────────────────────────
    if (type === 'late') {
      const snap = await adminDb.collection('attendance').where('date', '==', date).get();
      const records = snap.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .filter(r => r.type === 'IN' && r.status === 'สาย')
        .sort((a, b) => (b.lateMinutes ?? 0) - (a.lateMinutes ?? 0));
      return NextResponse.json({ records, date });
    }

    // ─── Summary ───────────────────────────────────────────────────────────────
    if (type === 'summary') {
      const [staffSnap, attSnap] = await Promise.all([
        adminDb.collection('staff').where('status', '==', 'Active').get(),
        adminDb.collection('attendance').where('date', '>=', from).where('date', '<=', to).get(),
      ]);
      const allStaff = staffSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      const attMap: Record<string, Record<string, any>> = {};

      attSnap.docs.forEach(d => {
        const r = d.data() as any;
        if (r.type !== 'IN') return;
        if (!attMap[r.name]) attMap[r.name] = {};
        attMap[r.name][r.date] = r;
      });

      const dates: string[] = [];
      let cur = new Date(from);
      const end = new Date(to);
      while (cur <= end) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }

      const summary = allStaff.map(s => ({
        name:         s.name,
        nickname:     s.nickname,
        branchId:     s.mainBranchId,
        days: dates.map(d => {
          const r = attMap[s.name]?.[d];
          if (!r) return { date: d, status: 'absent' };
          return { date: d, status: r.status === 'สาย' ? 'late' : 'present', time: r.time, lateMinutes: r.lateMinutes || 0 };
        }),
        totalPresent: dates.filter(d => attMap[s.name]?.[d]).length,
        totalLate:    dates.filter(d => attMap[s.name]?.[d]?.status === 'สาย').length,
        totalAbsent:  dates.filter(d => !attMap[s.name]?.[d]).length,
      }));

      return NextResponse.json({ summary, dates, from, to });
    }

    return NextResponse.json({ error: 'unknown type' }, { status: 400 });

  } catch (e: any) {
    console.error('[GET /api/reports]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
