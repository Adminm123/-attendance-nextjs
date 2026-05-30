// Firestore ไม่รองรับ nested array
// → เก็บ descriptors ทั้งหมดเป็น number[] ตัวเดียว (flat) ขนาด N×128
// → อ่านกลับมาโดยตัด slice ทีละ 128 ตัว

const DIM = 128; // face-api descriptor มี 128 มิติเสมอ

export function serializeDescriptors(descs: number[][]): number[] {
  return descs.flatMap(d => Array.from(d));
}

export function parseDescriptors(raw: any): number[][] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const first = raw[0];

  // Format ใหม่: flat number[] → ตัด slice ทีละ DIM
  if (typeof first === 'number') {
    const result: number[][] = [];
    for (let i = 0; i + DIM <= raw.length; i += DIM) {
      result.push(raw.slice(i, i + DIM));
    }
    return result;
  }

  // Format string[] (ความพยายามก่อนหน้า)
  if (typeof first === 'string') {
    return raw.map((d: string) => d.split(',').map(Number));
  }

  // Format { v: number[] }[]
  if (first?.v && Array.isArray(first.v)) {
    return raw.map((d: any) => d.v as number[]);
  }

  return [];
}
