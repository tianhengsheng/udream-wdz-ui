export const fmtTime = (v?: string | null) => (v ? String(v).replace('T', ' ').slice(0, 19) : '-');
export const fmtDate = (v?: string | null) => { const t = fmtTime(v); return t === '-' ? t : t.slice(0, 10); };
export const num = (v: unknown, digits = 2) => { const n = Number(v); return Number.isFinite(n) ? n.toFixed(digits) : '-'; };
export const money = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? `¥${n.toFixed(2)}` : '-'; };
export const duration = (s: unknown) => { const v = Number(s); if (!Number.isFinite(v)) return '-'; const h = Math.floor(v / 3600); const m = Math.floor((v % 3600) / 60); return h ? `${h}小时${m}分钟` : `${m}分钟`; };
export const dash = (v: unknown) => (v == null || v === '' ? '-' : String(v));
