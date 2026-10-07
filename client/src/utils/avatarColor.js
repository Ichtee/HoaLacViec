// Màu avatar cố định theo tên, để các quán khác nhau dễ phân biệt thay vì cùng một chữ cái xanh.
const PALETTE = [
  'bg-green-100 text-green-800',
  'bg-blue-100 text-blue-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-teal-100 text-teal-800',
  'bg-indigo-100 text-indigo-800',
  'bg-orange-100 text-orange-800',
  'bg-lime-100 text-lime-800',
];

export function avatarColorClass(name = '') {
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** Chữ cái đại diện: bỏ tiền tố "Quán"/"Cửa hàng" để không phải quán nào cũng là "Q". */
export function avatarInitial(name = '') {
  const cleaned = String(name).trim().replace(/^(quán|cửa hàng|tiệm|nhà hàng|cafe|cà phê)\s+/i, '');
  return (cleaned[0] || name?.[0] || '?').toUpperCase();
}
