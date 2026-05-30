// เก็บ descriptors เป็น JSON string เดียว เพื่อหลีกเลี่ยง Firestore nested-array restriction

export function serializeDescriptors(descs: number[][]): string {
  return JSON.stringify(descs.map(d => Array.from(d)));
}

export function parseDescriptors(raw: any): number[][] {
  try {
    // format ใหม่: JSON string
    if (typeof raw === 'string') return JSON.parse(raw) as number[][];

    if (!Array.isArray(raw) || raw.length === 0) return [];

    const first = raw[0];

    // flat number[] (ความพยายามก่อนหน้า)
    if (typeof first === 'number') {
      const DIM = 128;
      const out: number[][] = [];
      for (let i = 0; i + DIM <= raw.length; i += DIM) out.push(raw.slice(i, i + DIM));
      return out;
    }

    // string[] (ความพยายามก่อนหน้า)
    if (typeof first === 'string') return raw.map((d: string) => d.split(',').map(Number));

    // { v: number[] }[]
    if (first?.v) return raw.map((d: any) => d.v as number[]);

    return [];
  } catch { return []; }
}
