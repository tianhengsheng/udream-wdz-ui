/**
 * 检测配置编辑器的默认值与数组字段结构（与 jar 内 index.html configModal 默认行、v2.js configObject/readConfigArray 同源）。
 * 保存时 detection 结构必须与后端强类型 DTO BehaviorRuleParameters 一致，加规则级字段要两边同步。
 */
export type Row = Record<string, string | number | null | undefined>;
export interface ArraySpec { key: string; title: string; first: 'index' | 'timeField'; cols: { key: string; label: string }[]; addable: boolean }

export const SCALAR_KEYS = [
  'timeWindowMinutes', 'orderTimeToleranceMinutes', 'deduplicationMinutes', 'shortEventMode', 'shortEventMinutes',
  'enableOrderCountLimit', 'enableEventBinding', 'eventBindingThreshold', 'windowDiffPerOrder', 'windowDiffMaxScore',
  'nearbyDiffPerOrder', 'nearbyDiffMaxScore', 'commonDiffPerOrder', 'commonDiffMaxScore', 'nearbyMinutes', 'minSampleCount',
] as const;

const tier = (key: string, title: string): ArraySpec => ({ key, title, first: 'index', addable: true, cols: [{ key: 'durationThresholdMinutes', label: '阈值(分)' }, { key: 'correctionWeight', label: '权重' }, { key: 'minimumSampleCount', label: '取样' }] });
const nearby = (key: string, title: string): ArraySpec => ({ key, title, first: 'timeField', addable: false, cols: [{ key: 'beforeIntervalMinutes', label: '前(N分)' }, { key: 'beforeIntervalDeductionWeight', label: '扣权重' }, { key: 'afterIntervalMinutes', label: '后(N分)' }, { key: 'afterIntervalDeductionWeight', label: '扣权重' }] });
const dist = (key: string, title: string, l: string): ArraySpec => ({ key, title, first: 'index', addable: true, cols: [{ key: 'distanceMinutes', label: l }, { key: 'deductionWeight', label: '扣分' }] });
const svc = (key: string, title: string): ArraySpec => ({ key, title, first: 'timeField', addable: false, cols: [
  { key: 'beforeBaseMinutes', label: '前(分)' }, { key: 'beforeBaseDeductionWeight', label: '扣权重' }, { key: 'beforeIntervalMinutes', label: '前(每N分)' }, { key: 'beforeIntervalDeductionWeight', label: '扣权重' },
  { key: 'afterBaseMinutes', label: '后(分)' }, { key: 'afterBaseDeductionWeight', label: '扣权重' }, { key: 'afterIntervalMinutes', label: '后(每N分)' }, { key: 'afterIntervalDeductionWeight', label: '扣权重' }] });

/** 分区 → 数组字段（普通/烫染成对） */
export const SECTIONS: { title: string; hint?: string; arrays: ArraySpec[] }[] = [
  { title: '取样分段', arrays: [tier('normalDurationCorrectionTiers', '普通'), tier('dyeDurationCorrectionTiers', '烫染')] },
  { title: '规则A-附近订单权重', hint: '范围分钟数在上方 nearbyMinutes', arrays: [nearby('normalNearbyOrderWeights', '普通订单'), nearby('dyeNearbyOrderWeights', '烫染订单')] },
  { title: '规则A-创建时间距离', arrays: [dist('normalCreateTimeDistanceTiers', '普通订单', '时间差'), dist('dyeCreateTimeDistanceTiers', '烫染订单', '时间差')] },
  { title: '规则A-服务开始时间距离', arrays: [dist('normalServiceStartDistanceTiers', '普通订单', '距开始'), dist('dyeServiceStartDistanceTiers', '烫染订单', '距开始')] },
  { title: '规则B-服务时间权重', hint: 'service_start + service_end 双维度取最优', arrays: [svc('normalServiceTimeWeights', '普通订单'), svc('dyeServiceTimeWeights', '烫染订单')] },
];
export const BETA_SPEC: ArraySpec = { key: 'betaWeightTiers', title: '规则B权重β档位', first: 'index', addable: true, cols: [{ key: 'serviceDurationRatioThreshold', label: '时长比值≥' }, { key: 'betaWeight', label: 'β(规则B权重)' }] };

const t = (a: number, b: number, c: number) => ({ durationThresholdMinutes: a, correctionWeight: b, minimumSampleCount: c });
const nb = (f: string, a: number, b: number, c: number, d: number) => ({ timeField: f, beforeIntervalMinutes: a, beforeIntervalDeductionWeight: b, afterIntervalMinutes: c, afterIntervalDeductionWeight: d });
const d = (a: number, b: number) => ({ distanceMinutes: a, deductionWeight: b });
const sv = (f: string, v: number[]) => ({ timeField: f, beforeBaseMinutes: v[0], beforeBaseDeductionWeight: v[1], beforeIntervalMinutes: v[2], beforeIntervalDeductionWeight: v[3], afterBaseMinutes: v[4], afterBaseDeductionWeight: v[5], afterIntervalMinutes: v[6], afterIntervalDeductionWeight: v[7] });

export const DEFAULT_PARAMS: Record<string, unknown> = {
  timeWindowMinutes: 10, orderTimeToleranceMinutes: 5, deduplicationMinutes: 12, shortEventMinutes: 8,
  enableOrderCountLimit: false, enableEventBinding: false, eventBindingThreshold: 0.3,
  windowDiffPerOrder: 1, windowDiffMaxScore: 1.5, nearbyDiffPerOrder: 1, nearbyDiffMaxScore: 1.5, commonDiffPerOrder: 4, commonDiffMaxScore: 6,
  nearbyMinutes: 60, minSampleCount: 5,
  normalDurationCorrectionTiers: [t(15, 0.8, 0), t(15, 1.1, 5), t(15, 1.3, 50), t(15, 1.3, 100)],
  dyeDurationCorrectionTiers: [t(60, 0.8, 0), t(60, 1.2, 5), t(60, 1.1, 10), t(60, 1, 20)],
  normalNearbyOrderWeights: [nb('service_start', 3, 0.1, 10, 0.2), nb('service_end', 3, 0.1, 3, 0.3), nb('create_time', 3, 0.1, 3, 0.2)],
  dyeNearbyOrderWeights: [nb('service_start', 5, 0.1, 10, 0.1), nb('service_end', 5, 0.1, 5, 0.1), nb('create_time', 10, 0.1, 5, 0.1)],
  normalCreateTimeDistanceTiers: [d(5, 0.05), d(10, 0.1), d(15, 0.2), d(20, 0.3), d(30, 0.5)],
  dyeCreateTimeDistanceTiers: [d(10, 0.1), d(20, 0.2), d(30, 0.4), d(45, 0.6), d(60, 0.8)],
  normalServiceStartDistanceTiers: [d(5, 0.1), d(10, 0.15), d(15, 0.25), d(20, 0.4), d(30, 0.5)],
  dyeServiceStartDistanceTiers: [d(10, 0.05), d(20, 0.1), d(30, 0.2), d(45, 0.3), d(60, 0.4)],
  normalServiceTimeWeights: [sv('service_start', [3, 0.05, 4, 0.2, 3, 0.05, 4, 0.2]), sv('service_end', [3, 0.05, 4, 0.2, 3, 0.05, 4, 0.2])],
  dyeServiceTimeWeights: [sv('service_start', [3, 0.05, 10, 0.1, 3, 0.05, 15, 0.1]), sv('service_end', [3, 0.05, 5, 0.15, 3, 0.05, 5, 0.15])],
  betaWeightTiers: [0.6, 0.7, 0.8, 1, 1.2, 1.3].map((r, i) => ({ serviceDurationRatioThreshold: r, betaWeight: [0.5, 0.6, 0.7, 0.8, 0.9, 1][i] })),
};
export const ARRAY_KEYS = [...SECTIONS.flatMap((s) => s.arrays.map((a) => a.key)), BETA_SPEC.key];

/** 编辑器状态 → 后端 detection 结构（数值化；理发时长过滤只传分钟数，后端补 EXCLUDE、空补默认 8；风险阈值固定同 v2） */
export function toDetection(p: Record<string, unknown>) {
  const num = (k: string) => { const v = Number(p[k]); return Number.isFinite(v) ? v : 0; };
  const rows = (k: string) => ((p[k] as Row[]) || []).map((r) => Object.fromEntries(Object.entries(r).map(([c, v]) => [c, c === 'timeField' ? v : (Number.isFinite(Number(v)) ? Number(v) : 0)])));
  const sm = String(p.shortEventMinutes ?? '').trim();
  const smv = sm ? Number(sm) : NaN;
  return {
    timeWindowMinutes: num('timeWindowMinutes'), orderTimeToleranceMinutes: num('orderTimeToleranceMinutes'), deduplicationMinutes: num('deduplicationMinutes'),
    shortEventMode: null, shortEventMinutes: Number.isFinite(smv) && smv > 0 ? smv : null,
    enableOrderCountLimit: !!p.enableOrderCountLimit, enableEventBinding: !!p.enableEventBinding, eventBindingThreshold: num('eventBindingThreshold'),
    windowDiffPerOrder: num('windowDiffPerOrder'), windowDiffMaxScore: num('windowDiffMaxScore'), nearbyDiffPerOrder: num('nearbyDiffPerOrder'), nearbyDiffMaxScore: num('nearbyDiffMaxScore'),
    commonDiffPerOrder: num('commonDiffPerOrder'), commonDiffMaxScore: num('commonDiffMaxScore'), nearbyMinutes: num('nearbyMinutes'), minSampleCount: num('minSampleCount'),
    highRiskThreshold: 7, mediumRiskThreshold: 4, lowRiskThreshold: 0, watchThreshold: 3,
    ...Object.fromEntries(ARRAY_KEYS.map((k) => [k, rows(k)])),
  };
}

/** 后端 parameters（或 configJson.detection）→ 编辑器状态：缺的 key 用默认（理发时长过滤默认 8） */
export function fromParameters(src: unknown): Record<string, unknown> {
  let cfg: any = src;
  try { if (typeof src === 'string') cfg = JSON.parse(src); } catch { cfg = null; }
  const s = (cfg && (cfg.detection || cfg)) || {};
  const out: Record<string, unknown> = { ...DEFAULT_PARAMS };
  for (const k of SCALAR_KEYS) if (Object.prototype.hasOwnProperty.call(s, k) && s[k] != null) out[k] = s[k];
  for (const k of ARRAY_KEYS) if (Array.isArray(s[k]) && s[k].length) out[k] = s[k].map((r: Row) => ({ ...r }));
  return out;
}
