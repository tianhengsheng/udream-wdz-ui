import { DatePicker, Input, Select } from 'antd';
import dayjs from 'dayjs';
import { PRIMARY_LABELS, REVIEW_LABELS, RISK_LABELS, SECONDARY_OPTIONS, opts } from '../constants/marks';
import type { PrimaryMarkType, ReviewStatus, RiskLevel } from '../types/wdz';

/** 批量核查 / 查看事件与排队 共用的事件级筛选字段 */
export interface EventFilter {
  startDate: string | null; endDate: string | null; eventId: string; reviewStatus: ReviewStatus | ''; riskLevels: RiskLevel[];
  primaryMarkType: PrimaryMarkType | ''; secondaryMarkType: string; lastOperatorName: string; lastMarkStartDate: string | null; lastMarkEndDate: string | null;
}
export const emptyEventFilter = (startDate: string | null, endDate: string | null): EventFilter => ({
  startDate, endDate, eventId: '', reviewStatus: '', riskLevels: ['HIGH', 'MEDIUM'], primaryMarkType: '', secondaryMarkType: '', lastOperatorName: '', lastMarkStartDate: null, lastMarkEndDate: null,
});
export const L = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#666', whiteSpace: 'nowrap' }}>{t}</span>{children}</span>
);
const range = (a: string | null, b: string | null): [dayjs.Dayjs | null, dayjs.Dayjs | null] => [a ? dayjs(a) : null, b ? dayjs(b) : null];

/** 事件级筛选字段定义：key → 标签 + 控件，供整行平铺或按常用字段折叠复用 */
export type EventFieldKey = 'dateRange' | 'eventId' | 'reviewStatus' | 'riskLevels' | 'primaryMarkType' | 'secondaryMarkType' | 'lastOperatorName' | 'markRange';
export function eventFieldDefs(f: EventFilter, set: (p: Partial<EventFilter>) => void, onEnter: () => void, prefix = '', w: number | string = 0): Record<EventFieldKey, { label: string; node: React.ReactNode; active: boolean }> {
  const secondaryOpts = (f.primaryMarkType ? SECONDARY_OPTIONS[f.primaryMarkType] || [] : Object.values(SECONDARY_OPTIONS).flat()).map((v) => ({ value: v, label: v }));
  const width = (d: number) => w || d; // 传 w 时统一控件宽度（可为 '100%'）
  return {
    dateRange: { label: '事件时间', active: false, node: <DatePicker.RangePicker data-testid={`${prefix}dateRange`} style={w ? { width: w } : undefined} value={range(f.startDate, f.endDate)} onChange={(v) => set({ startDate: v?.[0]?.format('YYYY-MM-DD') ?? null, endDate: v?.[1]?.format('YYYY-MM-DD') ?? null })} /> },
    eventId: { label: '事件ID', active: !!f.eventId, node: <Input data-testid={`${prefix}eventId`} allowClear placeholder="请输入事件ID" style={{ width: width(160) }} value={f.eventId} onChange={(e) => set({ eventId: e.target.value })} onPressEnter={onEnter} /> },
    reviewStatus: { label: '核实状态', active: !!f.reviewStatus, node: <Select data-testid={`${prefix}reviewStatus`} allowClear placeholder="全部" style={{ width: width(100) }} value={f.reviewStatus || undefined} options={opts(REVIEW_LABELS)} onChange={(v) => set({ reviewStatus: (v as any) || '' })} /> },
    riskLevels: { label: '风险类型', active: f.riskLevels.length > 0, node: <Select data-testid={`${prefix}riskLevels`} mode="multiple" allowClear maxTagCount="responsive" placeholder="全部" style={{ width: width(160) }} value={f.riskLevels} options={opts(RISK_LABELS)} onChange={(v) => set({ riskLevels: v })} /> },
    primaryMarkType: { label: '标记类型', active: !!f.primaryMarkType, node: <Select data-testid={`${prefix}primaryMarkType`} allowClear placeholder="全部" style={{ width: width(150) }} value={f.primaryMarkType || undefined} options={opts(PRIMARY_LABELS)} onChange={(v) => set({ primaryMarkType: (v as any) || '', secondaryMarkType: '' })} /> },
    secondaryMarkType: { label: '标记类型二级', active: !!f.secondaryMarkType, node: <Select data-testid={`${prefix}secondaryMarkType`} allowClear placeholder="全部" style={{ width: width(200) }} value={f.secondaryMarkType || undefined} options={secondaryOpts} onChange={(v) => set({ secondaryMarkType: v || '' })} /> },
    lastOperatorName: { label: '最近标记人', active: !!f.lastOperatorName, node: <Input data-testid={`${prefix}lastOperatorName`} allowClear placeholder="请输入最近标记人" style={{ width: width(130) }} value={f.lastOperatorName} onChange={(e) => set({ lastOperatorName: e.target.value })} onPressEnter={onEnter} /> },
    markRange: { label: '最近标记时间', active: !!(f.lastMarkStartDate || f.lastMarkEndDate), node: <DatePicker.RangePicker data-testid={`${prefix}markRange`} style={w ? { width: w } : undefined} value={range(f.lastMarkStartDate, f.lastMarkEndDate)} onChange={(v) => set({ lastMarkStartDate: v?.[0]?.format('YYYY-MM-DD') ?? null, lastMarkEndDate: v?.[1]?.format('YYYY-MM-DD') ?? null })} /> },
  };
}

export function EventFilterFields({ f, set, onEnter, prefix = '' }: { f: EventFilter; set: (p: Partial<EventFilter>) => void; onEnter: () => void; prefix?: string }) {
  const defs = eventFieldDefs(f, set, onEnter, prefix);
  return <>{(Object.keys(defs) as EventFieldKey[]).map((k) => <L key={k} t={defs[k].label}>{defs[k].node}</L>)}</>;
}
