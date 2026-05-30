// Firestore ไม่รองรับ nested array (number[][])
// → เก็บแต่ละ descriptor เป็น string "n1,n2,...,n128"

export function serializeDescriptors(descs: number[][]): string[] {
  return descs.map(d => Array.from(d).join(','));
}

export function parseDescriptors(raw: any[]): number[][] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map(d => {
    if (typeof d === 'string')       return d.split(',').map(Number);
    if (Array.isArray(d))            return d;
    if (d?.v && Array.isArray(d.v)) return d.v;
    return [];
  });
}
