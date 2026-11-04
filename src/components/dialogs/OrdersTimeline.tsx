import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Image, Popover, Segmented, Space, Spin, Tooltip, message } from 'antd';
import { CopyOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { pageBehaviorRules, pageReviewRecords, pageRiskEventItems } from '../../api/wdz';
import { APP, PRIMARY_LABELS, RISK_LABELS } from '../../constants/marks';
import { useDialogs } from '../../store/useDialogs';
import { useFilters } from '../../store/useFilters';
import { openMonitor } from '../../utils/monitor';
import type { EventOrder, ReviewRecord, RiskEvent } from '../../types/wdz';
import { money } from '../../utils/format';

/**
 * 排队订单时间轴（只读辅助视图，人工初筛私单用，不参与任何计算）：
 * 上方 AI 事件按工位分泳道，条长 = 事件时长（事件时间 - 时长 → 事件时间）；
 * 下方订单按发型师分泳道，细线 = 排队等待（创建→开始），粗条 = 服务（开始→结束），竖刻度 = 支付时间；
 * 当前事件的时间窗口 / 附近范围以底色标出，事件时间为红线。
 */
const isCalcStatus = (v?: string) => ['服务中', '待支付', '已支付', '已撤单'].includes(v || '');
/** 色块：私单=红，无风险/不合规=绿，互剪/重修/无效/重复=灰；未标记按风险等级：红=高、橙=中、绿=预警/低、灰=无效 */
const RED = '#f5222d', ORANGE = '#fa8c16', GREEN = '#95de64', GREY = '#bfbfbf';
const RISK_COLORS: Record<string, string> = { HIGH: RED, MEDIUM: ORANGE, WARNING: GREEN, LOW: GREEN, EXCLUDED: GREY };
/** 标记写在色块下方小字：私单=红，不剔除=绿，重算剔除=灰 */
const MARK_FG = { private: '#cf1322', kept: '#389e0d', dropped: '#8c8c8c' };
const MARK_STYLES: Record<string, { text: string; fg: string }> = {
  PRIVATE_ORDER: { text: '疑似私单', fg: MARK_FG.private },
  NO_RISK: { text: '无风险', fg: MARK_FG.kept }, STYLIST_NON_COMPLIANT: { text: '不合规', fg: MARK_FG.kept },
  STYLIST_MUTUAL_CUT: { text: '互剪', fg: MARK_FG.dropped }, SHORT_TERM_REWORK: { text: '重修', fg: MARK_FG.dropped },
  INVALID_EVENT: { text: '无效', fg: MARK_FG.dropped }, DUPLICATE_EVENT: { text: '重复', fg: MARK_FG.dropped },
};
/** 监控摄像头图标（线性，随文字色） */
const CctvIcon = () => (
  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M16.75 12h3.632a1 1 0 0 1 .894 1.447l-2.034 4.069a1 1 0 0 1-1.708.134l-2.124-2.97" />
    <path d="M17.106 9.053a1 1 0 0 1 .447 1.341l-3.106 6.211a1 1 0 0 1-1.342.447L3.61 12.3a2.92 2.92 0 0 1-1.3-3.91L3.69 5.6a2.92 2.92 0 0 1 3.92-1.3z" />
    <path d="M2 19h3.76a2 2 0 0 0 1.8-1.1L9 15" /><path d="M2 21v-4" /><path d="M7 9h.01" />
  </svg>
);
/** 悬停高亮统一：形状不变，外加同色光圈（灰色加深） */
const glow = (c: string) => `0 0 0 2px ${c === ORDER_OFF || c === GREY ? '#8c8c8c' : c}59`;
const barColor = (e: RiskEvent) => {
  const fg = e.primaryMarkType ? MARK_STYLES[e.primaryMarkType]?.fg : undefined;
  if (fg === MARK_FG.private) return RED;
  if (fg === MARK_FG.kept) return GREEN;
  if (fg === MARK_FG.dropped) return GREY;
  return RISK_COLORS[e.riskLevel || ''] || '#d9d9d9';
};
const MARK_FONT = 10, EV_ROW_H = 34, EV_BAR_H = 14;
/** 对比栏最多固定张数，超出挤掉最早的 */
const PIN_MAX = 3;
const PRIVATE_COLOR = '#a8071a', ORDER_WINDOW = '#08979c', ORDER_NEAR = '#4a6285', ORDER_OTHER = '#9fb4cc', ORDER_OFF = '#d9d9d9';
/** 排队等待线：加粗、取所属订单色半透明，起点圆点 = 下单时间 */
/** 时长：满 1 小时显示「X 小时 Y 分钟」 */
const minText = (min: number) => { const v = Math.round(min), h = Math.floor(v / 60), r = v % 60; return h ? `${h} 小时${r ? ` ${r} 分钟` : ''}` : `${r} 分钟`; };
const WAIT_H = 4;
/** 色块与小标签圆角（0 = 直角） */
const BAR_R = 0;
const waitColor = (c: string) => (c === ORDER_OFF ? '#bfbfbf' : `${c}8c`);
const SCALES = [{ label: '全天', value: 0.8 }, { label: '标准', value: 2 }, { label: '放大', value: 5 }];
const LABEL_W = 120, ROW_H = 24, DAY_END = 27 * 60; // 次日 03:00
/** 烫染在色块/订单条下方加「染」字标识（条外，短条也不遗漏），颜色仍表达风险/匹配 */
const isDyeEvent = (e: RiskEvent) => e.serviceType === '染发';
const isDyeOrder = (o: EventOrder) => o.itemCategory === 1;
const DyeText = () => <span style={{ color: '#b37feb', fontWeight: 600 }}>烫染</span>;
const PrivateMark = () => <span style={{ fontSize: 9, lineHeight: '12px', padding: '0 2px', marginRight: 3, background: PRIVATE_COLOR, color: '#fff', fontWeight: 300, borderRadius: BAR_R }}>私</span>;
/** 条下方小标签：悬停给释义，方便新用户（容器 pointerEvents:none，标签自身单独打开） */
const TagMark = ({ text, bg, tip }: { text: string; bg: string; tip: React.ReactNode }) => (
  <Tooltip title={tip}><span style={{ fontSize: 9, lineHeight: '12px', padding: '0 2px', marginRight: 2, background: bg, color: '#fff', fontWeight: 300, borderRadius: BAR_R, pointerEvents: 'auto', cursor: 'help' }}>{text}</span></Tooltip>
);
const DyeMark = ({ event }: { event?: boolean }) => <TagMark text="染" bg="#722ed1" tip={event ? '烫染事件' : '烫染订单'} />;
/** 多服务项目订单（服务项目名按逗号/顿号拆分超过 1 项），条下方加「多」字 */
const itemCount = (o: EventOrder) => (o.serviceItemName || '').split(/[,，、]/).filter((v) => v.trim()).length;
const isMultiOrder = (o: EventOrder) => itemCount(o) > 1;
const MULTI_COLOR = '#c41d7f';
const MultiMark = ({ o }: { o: EventOrder }) => <TagMark text="多" bg={MULTI_COLOR} tip={`多项目订单（${itemCount(o)} 项）：${o.serviceItemName || '-'}`} />;
/** 订单泳道含烫染/多项目单时加高，给条下方的标识留位 */
const OD_DYE_ROW_H = 34;
/** 纯洗吹单（含「洗」不含「剪」、非烫染）：大多不上报 AI 事件，条变淡并加「洗」字 */
const isWashOrder = (o: EventOrder) => !isDyeOrder(o) && /洗|冲/.test(o.serviceItemName || '') && !/剪/.test(o.serviceItemName || '');
const WASH_COLOR = '#4096ff';
const WashMark = () => <TagMark text="洗" bg={WASH_COLOR} tip="纯洗吹订单：大多不上报 AI 事件，条变淡显示" />;
const hasOrderTag = (o: EventOrder) => isDyeOrder(o) || isMultiOrder(o) || isWashOrder(o);
const orderRowH = (lane: Lane<OrderBar>) => (lane.rows.some((r) => r.some((b) => hasOrderTag(b.o))) ? OD_DYE_ROW_H : ROW_H);

interface Lane<T> { name: string; rows: T[][] }
interface OrderBar { o: EventOrder; create?: number; start?: number; end?: number; pay?: number; corrected?: number; from: number; to: number }
/** 订单条分段悬停：等待线 / 服务条 / 支付刻度 */
type OrderPart = 'create' | 'wait' | 'bar' | 'pay';
interface EventBar { e: RiskEvent; from: number; to: number; hasDuration: boolean }
/** 事件→订单关联：mark=标记时选的关联订单（实线），remark=备注里识别的订单号（虚线） */
interface Link { eventId: string; orderKey: string; source: 'mark' | 'remark'; color: string }
const orderKeyOf = (o: EventOrder) => `${o.orderId}|${o.orderStatus || ''}|${o.queuedNo || ''}`;
const ORDER_NO_RE = /\d{19}/g;

/** 同一泳道内时间重叠的条叠到下一行，行尽量少 */
function pack<T extends { from: number; to: number }>(items: T[]): T[][] {
  const rows: T[][] = []; const ends: number[] = [];
  [...items].sort((a, b) => a.from - b.from).forEach((it) => {
    const i = ends.findIndex((end) => end <= it.from);
    if (i >= 0) { rows[i].push(it); ends[i] = it.to; } else { rows.push([it]); ends.push(it.to); }
  });
  return rows;
}

/** 事件图片：固定宽高防加载跳动，未加载完浅灰占位，失败给提示 */
function EventImage({ url, width, height, onOpen }: { url?: string; width: number | string; height: number; onOpen: (u: string) => void }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  useEffect(() => setState('loading'), [url]);
  const box = { width, height, borderRadius: 2, overflow: 'hidden', position: 'relative' as const, background: state === 'ok' ? '#000' : '#f0f0f0' };
  if (!url) return <div style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 12 }}>无图片</div>;
  return (
    <div style={box}>
      {state === 'error' && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 12 }}>图片加载失败</div>}
      <img src={url} alt="" title="点击看大图" onLoad={() => setState('ok')} onError={() => setState('error')} onClick={() => onOpen(url)}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', cursor: 'zoom-in', opacity: state === 'ok' ? 1 : 0, transition: 'opacity .15s' }} />
    </div>
  );
}

export function OrdersTimeline({ orders, ordersLoading, event, onOrderClick }: { orders: EventOrder[]; ordersLoading: boolean; event: RiskEvent | null; onOrderClick: (o: EventOrder) => void }) {
  const openDetail = useDialogs((s) => s.openDetail);
  const openReview = useDialogs((s) => s.openReview);
  const refreshTick = useDialogs((s) => s.refreshTick);
  const reviewing = useDialogs((s) => !!s.reviewEvents);
  const [dayEvents, setDayEvents] = useState<RiskEvent[]>([]);
  const [params, setParams] = useState<{ window: number; nearby: number }>({ window: 10, nearby: 60 });
  /** 同店当天事件+规则参数已就绪的事件 ID；与订单、当前事件全部到齐后才渲染，只渲染一次 */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [scale, setScale] = useState(2);
  /** 浮层/对比栏图片点击看大图（预览挂在组件根，浮层关闭不影响） */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  /** 点击选中的事件（弹浮层：图片 + 操作） */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 对比栏固定的事件 ID（按固定先后） */
  const [pinIds, setPinIds] = useState<string[]>([]);
  /** 事件 ID → 最新一条初核/复核记录的备注 */
  const [remarks, setRemarks] = useState<Map<string, { first?: string; second?: string }>>(new Map());
  const [legendMore, setLegendMore] = useState(false); // 图例默认只展示事件/订单
  const [hover, setHover] = useState<{ kind: 'e' | 'o'; key: string; part?: OrderPart } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const base = useMemo(() => (event?.eventTime ? dayjs(String(event.eventTime).slice(0, 10)) : null), [event?.eventTime]);
  const m = (t?: string | null) => (t && base ? dayjs(t).diff(base, 'second') / 60 : undefined);
  /** 悬浮用短时间：当天只显示 时:分，跨天显示 次日 时:分 */
  const hm = (t?: string | null) => {
    if (!t) return '-';
    const d = dayjs(t);
    return base && !d.isSame(base, 'day') ? `次日 ${d.format('HH:mm')}` : d.format('HH:mm');
  };

  // 同店当天 AI 事件 + 当前规则的窗口/附近分钟数，均为只读查询
  useEffect(() => {
    if (!event?.storeName || !base) return;
    const { ruleId, risk } = useFilters.getState();
    const date = base.format('YYYY-MM-DD');
    setLoadedFor(null);
    const loadEvents = async () => {
      const all: RiskEvent[] = [];
      for (let pageNum = 1; pageNum <= 5; pageNum++) {
        const r = await pageRiskEventItems({ app: APP, pageNum, pageSize: 100, ruleId, applicationScope: risk.applicationScope, storeName: event.storeName, startDate: date, endDate: date });
        all.push(...(r.records || []));
        if (all.length >= r.total || !(r.records || []).length) break;
      }
      return all.filter((e) => e.storeName === event.storeName); // 门店名是前缀匹配，精确收口
    };
    // 同店当天核查日志，取每个事件最新一条初核/复核的备注
    const loadRemarks = async () => {
      const all: ReviewRecord[] = [];
      for (let pageNum = 1; pageNum <= 5; pageNum++) {
        const r = await pageReviewRecords({ app: APP, pageNum, pageSize: 100, storeName: event.storeName, eventStartDate: date, eventEndDate: date, logScope: 'all' });
        all.push(...(r.records || []));
        if (all.length >= r.total || !(r.records || []).length) break;
      }
      const latest = new Map<string, ReviewRecord>(); // key: 事件ID|核实类型
      all.filter((r) => r.storeName === event.storeName && (r.actionType === 'FIRST_REVIEW' || r.actionType === 'SECOND_REVIEW')).forEach((r) => {
        const k = `${r.eventId}|${r.actionType}`; const prev = latest.get(k);
        if (!prev || String(r.createTime || '') > String(prev.createTime || '')) latest.set(k, r);
      });
      const out = new Map<string, { first?: string; second?: string }>();
      latest.forEach((r) => {
        if (!r.remark) return;
        const id = String(r.eventId); const v = out.get(id) || {};
        if (r.actionType === 'FIRST_REVIEW') v.first = r.remark; else v.second = r.remark;
        out.set(id, v);
      });
      return out;
    };
    Promise.all([
      loadEvents().catch(() => [] as RiskEvent[]),
      loadRemarks().catch(() => new Map<string, { first?: string; second?: string }>()),
      pageBehaviorRules({ app: APP, pageNum: 1, pageSize: 50 }).then((r) => (r.records || []).find((x) => String(x.id) === String(ruleId))).catch(() => undefined),
    ]).then(([evs, rms, rule]) => {
      // 同一回调内批量更新，只触发一次渲染
      const p = (rule?.parameters || {}) as Record<string, number>;
      setDayEvents(evs);
      setRemarks(rms);
      setParams({ window: p.timeWindowMinutes || 10, nearby: p.nearbyMinutes || 60 });
      setLoadedFor(String(event.eventId));
    });
  }, [event?.eventId, refreshTick]); // 标记提交后 bumpRefresh 重新拉取，色块/备注即时更新

  // 换事件清空选中与对比栏
  useEffect(() => { setSelectedId(null); setPinIds([]); }, [event?.eventId]);
  // Esc 只关浮层：捕获阶段拦截，不让外层抽屉也跟着关闭
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && !previewUrl) { ev.stopPropagation(); setSelectedId(null); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [selectedId, previewUrl]);

  const orderBars: OrderBar[] = useMemo(() => orders.map((o) => {
    const create = m(o.orderCreateTime), start = m(o.serviceStartTime), end = m(o.serviceEndTime);
    const from = create ?? start ?? 0;
    return { o, create, start, end, pay: m(o.payTime), corrected: m(o.correctedStartTime), from, to: Math.max(end ?? start ?? from, from) + 1 };
  }), [orders, base]);
  const eventBars: EventBar[] = useMemo(() => dayEvents.map((e) => {
    const to = m(e.eventTime) ?? 0; const dur = e.serviceDurationSeconds;
    return { e, to, from: dur ? to - dur / 60 : to - 1, hasDuration: !!dur };
  }), [dayEvents, base]);

  // 私单关联的发型师：泳道名标红
  const privateLinks = useMemo(() => {
    const craftsmen = new Set<string>();
    dayEvents.filter((e) => e.primaryMarkType === 'PRIVATE_ORDER').forEach((e) => {
      if (e.markedCraftsmanId) craftsmen.add(String(e.markedCraftsmanId));
      if (e.markedCraftsmanName) craftsmen.add(e.markedCraftsmanName);
    });
    return { craftsmen };
  }, [dayEvents]);

  // 事件→订单连线：关联订单 + 备注里的 19 位数字，按订单号或订单 ID 匹配当前列表；线色同事件色块
  const links = useMemo(() => {
    const out: Link[] = [];
    const find = (v: string) => orderBars.filter((b) => String(b.o.orderId) === v || b.o.orderNo === v);
    dayEvents.forEach((e) => {
      const id = String(e.eventId); const seen = new Set<string>();
      const add = (v: string | undefined, source: Link['source']) => {
        if (!v) return;
        const hit = find(String(v));
        if (!hit.length) return;
        hit.forEach((b) => { const k = orderKeyOf(b.o); if (!seen.has(k)) { seen.add(k); out.push({ eventId: id, orderKey: k, source, color: barColor(e) }); } });
      };
      add(e.markedOrderId, 'mark'); add(e.markedOrderNo, 'mark');
      const rm = remarks.get(id);
      new Set(`${rm?.first || ''} ${rm?.second || ''}`.match(ORDER_NO_RE) || []).forEach((v) => add(v, 'remark'));
    });
    return out;
  }, [dayEvents, orderBars, remarks]);
  const isPrivateLane = (lane: Lane<OrderBar>) => privateLinks.craftsmen.has(lane.name)
    || lane.rows.some((r) => r.some((b) => !!b.o.craftsmanId && privateLinks.craftsmen.has(String(b.o.craftsmanId))));

  const eventLanes: Lane<EventBar>[] = useMemo(() => {
    const g = new Map<string, EventBar[]>();
    eventBars.forEach((b) => { const k = b.e.workName || '未知工位'; g.set(k, [...(g.get(k) || []), b]); });
    // 排布按「色块宽 / 下方小字宽」取大，避免相邻小字重叠
    const packLabeled = (items: EventBar[]) => pack(items.map((b) => {
      const text = b.e.primaryMarkType ? MARK_STYLES[b.e.primaryMarkType]?.text : undefined;
      const labelPx = (text ? text.length * MARK_FONT + 6 : 0) + (isDyeEvent(b.e) ? 16 : 0);
      const half = Math.max((b.to - b.from) / 2, labelPx / 2 / scale);
      const c = (b.from + b.to) / 2;
      return { b, from: c - half, to: c + half };
    })).map((row) => row.map((it) => it.b));
    return [...g.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, items]) => ({ name, rows: packLabeled(items) }));
  }, [eventBars, scale]);
  const orderLanes: Lane<OrderBar>[] = useMemo(() => {
    const g = new Map<string, OrderBar[]>();
    orderBars.forEach((b) => { const k = b.o.craftsmanName || '未分配'; g.set(k, [...(g.get(k) || []), b]); });
    return [...g.entries()].sort((a, b) => Math.min(...a[1].map((x) => x.from)) - Math.min(...b[1].map((x) => x.from)))
      .map(([name, items]) => ({ name, rows: pack(items) }));
  }, [orderBars]);

  const cur = event ? { t: m(event.eventTime) ?? 0, dur: event.serviceDurationSeconds } : null;
  // 轴范围：数据最早/最晚各留 30 分钟，按整点取整，限定在 当天 00:00 ~ 次日 03:00
  const spans = [...orderBars.map((b) => [b.from, b.to]), ...eventBars.map((b) => [b.from, b.to])].flat();
  const axisStart = Math.max(0, Math.floor(((spans.length ? Math.min(...spans) : 540) - 30) / 60) * 60);
  const axisEnd = Math.min(DAY_END, Math.ceil(((spans.length ? Math.max(...spans) : 1320) + 30) / 60) * 60);
  const x = (min: number) => (Math.min(Math.max(min, axisStart), axisEnd) - axisStart) * scale;
  const width = (axisEnd - axisStart) * scale;
  const step = scale >= 4 ? 15 : scale >= 1.5 ? 30 : 60;
  const ticks: number[] = []; for (let t = axisStart; t <= axisEnd; t += step) ticks.push(t);
  const hhmm = (t: number) => `${t >= 1440 ? '+1 ' : ''}${String(Math.floor((t % 1440) / 60)).padStart(2, '0')}:${String(Math.round(t % 60)).padStart(2, '0')}`;
  const windowStart = cur ? Math.floor(cur.t / params.window) * params.window : 0;

  const ready = !!event && !ordersLoading && loadedFor === String(event.eventId);
  // 切换缩放/数据就绪后把当前事件滚到视口中间
  useEffect(() => {
    if (!ready || !cur || !scrollRef.current) return;
    scrollRef.current.scrollLeft = Math.max(0, x(cur.t) + LABEL_W - scrollRef.current.clientWidth / 2);
  }, [scale, ready, axisStart]);

  const line = { fontSize: 12, lineHeight: '18px' };
  const orderTip = (b: OrderBar, part?: OrderPart) => {
    const match = b.o.matchType === 'WINDOW' ? '窗口订单' : b.o.matchType === 'NEARBY' ? '附近订单' : '';
    const corrected = b.o.correctedStartTime && b.o.correctedStartTime !== b.o.serviceStartTime ? hm(b.o.correctedStartTime) : '';
    // 分段提示：等待线只给等待时长、支付刻度只给支付时间，其余归服务条
    if (part === 'wait' && b.create != null && b.start != null) return <div style={line}>排队等待 {minText(b.start - b.create)}</div>;
    if (part === 'create') return <div style={line}>下单 {hm(b.o.orderCreateTime)}</div>;
    if (part === 'pay') return <div style={line}>支付 {hm(b.o.payTime)}</div>;
    const svcMin = b.start != null && b.end != null ? Math.round(b.end - b.start) : null;
    // 订单卡片：标题行（单号+状态）+ 字段表 + 关联事件
    const chip = (t: string, c: string) => <span style={{ fontSize: 11, lineHeight: '16px', padding: '0 5px', borderRadius: 3, border: `1px solid ${c}`, color: c }}>{t}</span>;
    const row = (k: string, v: React.ReactNode) => (
      <div style={{ display: 'flex', gap: 8 }}><span style={{ width: 40, flex: 'none', color: 'rgba(255,255,255,0.45)' }}>{k}</span><span style={{ flex: 1 }}>{v}</span></div>
    );
    const orderLinks = links.filter((l) => l.orderKey === orderKeyOf(b.o));
    return (
      <div style={{ ...line, minWidth: 240 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>订单</span><b style={{ fontSize: 14 }}>{b.o.queuedNo || '-'}</b>
          <span style={{ flex: 1 }} />
          {b.o.orderStatus && chip(b.o.orderStatus, '#95de64')}{match && chip(match, '#91caff')}
        </div>
        {row('发型师', b.o.craftsmanName || '-')}
        {row('项目', <>{isDyeOrder(b.o) ? <><DyeText /> · </> : null}{isWashOrder(b.o) ? <><span style={{ color: '#69b1ff', fontWeight: 600 }}>洗吹</span> · </> : null}{isMultiOrder(b.o) ? <><span style={{ color: '#ff85c0', fontWeight: 600 }}>{itemCount(b.o)}项</span> · </> : null}{b.o.serviceItemName || '-'}</>)}
        {row('金额', money(b.o.orderAmount))}
        {(b.o.serviceStartTime || b.o.serviceEndTime) && row('服务', <>{hm(b.o.serviceStartTime)} ~ {hm(b.o.serviceEndTime)}{svcMin != null ? <span style={{ color: 'rgba(255,255,255,0.45)' }}> · {minText(svcMin)}</span> : null}{corrected ? <div style={{ color: 'rgba(255,255,255,0.45)' }}>矫正开始 {corrected}</div> : null}</>)}
        {row('单号', <>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>{b.o.orderNo || '-'}</span>
          {b.o.orderNo && (
            <CopyOutlined title="复制单号" style={{ marginLeft: 6, color: 'rgba(255,255,255,0.65)', cursor: 'pointer' }}
              onClick={() => navigator.clipboard.writeText(b.o.orderNo!).then(() => message.success('已复制单号'), () => message.error('复制失败'))} />
          )}
        </>)}
        {orderLinks.length > 0 && (
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            {orderLinks.map((l) => {
              const e = dayEvents.find((x) => String(x.eventId) === l.eventId);
              return <div key={l.eventId} style={{ color: '#ffd666' }}>关联事件 #{l.eventId} · {MARK_STYLES[e?.primaryMarkType || '']?.text || '未标记'} · 来自{l.source === 'mark' ? '标记' : '备注'}</div>;
            })}
          </div>
        )}
      </div>
    );
  };
  const durText = (b: EventBar) => (b.hasDuration ? minText((b.e.serviceDurationSeconds || 0) / 60) : '未知');
  const rangeText = (b: EventBar) => `${b.hasDuration ? `${hm(dayjs(b.e.eventTime).subtract(b.e.serviceDurationSeconds || 0, 'second').format('YYYY-MM-DD HH:mm:ss'))} ~ ` : ''}${hm(b.e.eventTime)}`;
  /** 事件文字摘要：悬停提示与点击浮层共用 */
  const eventInfo = (b: EventBar, dark: boolean) => {
    const risk = RISK_LABELS[b.e.riskLevel || ''] || b.e.riskLevel || '-';
    const rc = RISK_COLORS[b.e.riskLevel || ''] || GREY;
    const rm = remarks.get(String(b.e.eventId));
    // 事件卡片：与订单卡片同款（标题行 + 字段表），悬停深色、点击浮层浅色
    const muted = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', divider = dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)';
    const row = (k: string, v: React.ReactNode) => (
      <div style={{ display: 'flex', gap: 8 }}><span style={{ width: 40, flex: 'none', color: muted }}>{k}</span><span style={{ flex: 1, minWidth: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{v}</span></div>
    );
    return (
      <div style={{ minWidth: 240 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 6, marginBottom: 6, borderBottom: `1px solid ${divider}` }}>
          <span style={{ color: muted }}>AI 事件</span><b style={{ fontSize: 14 }}>#{b.e.eventId}</b>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, lineHeight: '16px', padding: '0 5px', borderRadius: 3, background: rc, color: rc === GREEN || rc === GREY ? '#1f1f1f' : '#fff' }}>{risk}{b.e.riskScore != null ? ` ${b.e.riskScore} 分` : ''}</span>
        </div>
        {row('工位', b.e.workName || '-')}
        {row('类型', isDyeEvent(b.e) ? <DyeText /> : (b.e.serviceType || b.e.checkType || '-'))}
        {row('时间', <>{rangeText(b)}<span style={{ color: muted }}> · {durText(b)}</span></>)}
        {b.e.primaryMarkType && row('标记', PRIMARY_LABELS[b.e.primaryMarkType] || b.e.primaryMarkType)}
        {rm?.first && row('初核', <span style={{ color: dark ? '#ffd666' : '#d48806' }}>{rm.first}</span>)}
        {rm?.second && row('复核', <span style={{ color: dark ? '#ff7875' : '#cf1322' }}>{rm.second}</span>)}
      </div>
    );
  };
  /** 悬停：只看文字 */
  const eventTip = (b: EventBar) => <div style={line}>{eventInfo(b, true)}</div>;
  const togglePin = (id: string) => setPinIds((ids) => {
    if (ids.includes(id)) return ids.filter((x) => x !== id);
    if (ids.length >= PIN_MAX) message.info(`对比栏最多 ${PIN_MAX} 张，已移出最早固定的一张`);
    return [...ids, id].slice(-PIN_MAX);
  });
  /** 点击浮层：文字 + 图片（点开大图）+ 操作按钮；点任一按钮后收起浮层 */
  const eventPopover = (b: EventBar) => {
    const id = String(b.e.eventId);
    const pinned = pinIds.includes(id);
    return (
      <div style={{ ...line, width: 300 }} data-testid={`tl-popover-${id}`}>
        {eventInfo(b, false)}
        <div style={{ marginTop: 6 }}><EventImage url={b.e.imageUrl} width={300} height={169} onOpen={setPreviewUrl} /></div>
        <Space size={6} style={{ marginTop: 8 }} wrap>
          <Button size="small" data-testid={`tl-detail-${id}`} onClick={() => { setSelectedId(null); openDetail(id); }}>详情</Button>
          <Button size="small" data-testid={`tl-monitor-${id}`} onClick={() => { setSelectedId(null); openMonitor(b.e); }}>查看监控</Button>
          <Button size="small" data-testid={`tl-pin-${id}`} onClick={() => { setSelectedId(null); togglePin(id); }}>{pinned ? '取消固定' : '📌 固定对比'}</Button>
          <Button size="small" type="primary" data-testid={`tl-review-${id}`} onClick={() => { setSelectedId(null); openReview([b.e]); }}>标记</Button>
        </Space>
      </div>
    );
  };
  /** 已固定事件按时间先后编号 ①②③：对比栏卡片与时间轴色块用同一编号对应 */
  const pinnedBars = pinIds.map((id) => eventBars.find((b) => String(b.e.eventId) === id)).filter((b): b is EventBar => !!b)
    .sort((a, b) => a.from - b.from);
  const pinNo = new Map(pinnedBars.map((b, i) => [String(b.e.eventId), i + 1]));
  const PIN_COLOR = '#722ed1';
  const pinBadge = (n: number) => (
    // 小号描边样式，避免抢眼
    <span style={{ display: 'inline-block', boxSizing: 'border-box', minWidth: 12, height: 12, lineHeight: '10px', borderRadius: 6, border: `1px solid ${PIN_COLOR}`, background: '#fff', color: PIN_COLOR, fontSize: 9, textAlign: 'center', verticalAlign: 'middle' }}>{n}</span>
  );
  /** 卡片点文字：选中并把色块滚到视口中间 */
  const locate = (b: EventBar) => {
    setSelectedId(String(b.e.eventId));
    if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, x((b.from + b.to) / 2) + LABEL_W - scrollRef.current.clientWidth / 2);
  };
  /** 对比栏：固定的事件图片并排，按事件时间排序 */
  const pinBar = () => {
    const bars = pinnedBars;
    if (!bars.length) return null;
    return (
      <div data-testid="tl-pinbar" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, padding: 8, background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 4 }}>
        {bars.map((b) => {
          const id = String(b.e.eventId);
          const lit = hover?.kind === 'e' && hover.key === id;
          return (
            // 悬停卡片 ⇄ 高亮对应色块（共用 hover 状态）
            <div key={id} data-testid={`tl-pin-card-${id}`} onMouseEnter={() => setHover({ kind: 'e', key: id })} onMouseLeave={() => setHover(null)}
              style={{ width: 240, fontSize: 12, lineHeight: '18px', border: `${lit ? 2 : 1}px solid ${lit ? PIN_COLOR : id === String(event?.eventId) ? '#f5222d' : '#e8e8e8'}`, borderRadius: 4, background: '#fff', padding: lit ? 3 : 4 }}>
              <EventImage url={b.e.imageUrl} width="100%" height={130} onOpen={setPreviewUrl} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                {pinBadge(pinNo.get(id) || 0)}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} title="定位到该事件" onClick={() => locate(b)}>
                  #{id} · {b.e.workName || '-'} · {rangeText(b)}
                </span>
                <a onClick={() => togglePin(id)} title="移出对比栏">✕</a>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', color: '#888' }}>
                <span style={{ flex: 1 }}>{RISK_LABELS[b.e.riskLevel || ''] || '-'} · {durText(b)}{b.e.primaryMarkType ? ` · ${PRIMARY_LABELS[b.e.primaryMarkType] || b.e.primaryMarkType}` : ''}</span>
                <a data-testid={`tl-pin-monitor-${id}`} onClick={() => openMonitor(b.e)}>查看监控</a>
              </div>
            </div>
          );
        })}
        <Space direction="vertical" size={4}>
          <span style={{ color: '#999', fontSize: 12 }}>对比栏 {bars.length}/{PIN_MAX}</span>
          <Button size="small" onClick={() => setPinIds([])}>清空</Button>
        </Space>
      </div>
    );
  };

  /** 泳道左侧标签：名称 + 右侧计数；AI 泳道带「AI」标识，分组末行底线加深（不改高度，连线坐标不受影响） */
  type LaneMeta = { label?: React.ReactNode; count?: string; ai?: boolean; groupEnd?: boolean; muted?: boolean; avatar?: string | null };
  const AVATAR = 24;
  const laneBlock = (name: string, rowCount: number, children: React.ReactNode, key: string, tint?: string, privateLane = false, rowH = ROW_H, meta: LaneMeta = {}) => (
    <div key={key} style={{ display: 'flex', borderBottom: `1px solid ${meta.groupEnd ? '#d9d9d9' : '#f0f0f0'}`, background: tint }}>
      <div style={{ width: LABEL_W, boxSizing: 'border-box', flex: 'none', position: 'sticky', left: 0, zIndex: 3, background: tint || '#fff', padding: '0 8px', fontSize: 12, height: rowCount * rowH, borderRight: '1px solid #f0f0f0',
        display: 'flex', alignItems: 'flex-start', gap: 4, lineHeight: `${Math.min(rowH, 30)}px`, color: privateLane ? PRIVATE_COLOR : meta.muted ? '#8c8c8c' : '#262626', fontWeight: privateLane ? 600 : undefined }} title={name}>
        {privateLane ? <span><PrivateMark /></span> : null}
        {meta.avatar !== undefined && (
          // 发型师头像（点开大图）；无图时用姓氏首字占位
          <span style={{ flex: 'none', width: AVATAR, height: AVATAR, marginTop: (Math.min(rowH, 30) - AVATAR) / 2, borderRadius: '50%', overflow: 'hidden', background: '#e6f4ff', color: '#1677ff', fontSize: 11, lineHeight: `${AVATAR}px`, textAlign: 'center', fontWeight: 600 }}>
            {meta.avatar ? <Image src={meta.avatar} width={AVATAR} height={AVATAR} style={{ objectFit: 'cover', display: 'block' }} preview={{ mask: null }} /> : name.slice(0, 1)}
          </span>
        )}
        {meta.ai ? (
          // AI 工位：黑底白线摄像头，与发型师头像同尺寸圆形
          <span title="AI 摄像头检测工位" style={{ flex: 'none', width: AVATAR, height: AVATAR, marginTop: (Math.min(rowH, 30) - AVATAR) / 2, borderRadius: '50%', background: '#262626', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><CctvIcon /></span>
        ) : null}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: meta.muted ? undefined : 500 }}>{meta.label ?? name}</span>
        {meta.count ? <span style={{ flex: 'none', fontSize: 11, color: '#8c8c8c', fontWeight: 400 }}>{meta.count}</span> : null}
      </div>
      <div style={{ position: 'relative', width, height: rowCount * rowH, flex: 'none' }}>{children}</div>
    </div>
  );

  // 图例统一为「色块 + 文字」：色块统一占 14px 宽居中，文字统一灰黑
  const item = (c: string, t: React.ReactNode, h = 6, w = 10) => (
    <span key={String(t)} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <span style={{ width: 10, display: 'inline-flex', justifyContent: 'center' }}><i style={{ width: w, height: h, background: c, borderRadius: 1 }} /></span>{t}
    </span>
  );
  const linkItem = (dashed: boolean, t: string) => (
    <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <svg width={12} height={6}><line x1={0} y1={3} x2={12} y2={3} stroke="#bfbfbf" strokeWidth={1.5} strokeDasharray={dashed ? '3 2' : undefined} /></svg>{t}
    </span>
  );
  const legendRows: [string, React.ReactNode[]][] = [
    ['事件', [item(RED, '高风险'), item(ORANGE, '中风险'), item(GREEN, '低风险'), item(GREY, '无效')]],
    ['订单', [item(ORDER_WINDOW, '窗口'), item(ORDER_NEAR, '附近'),item(ORDER_OFF, '不参与计算'), item(waitColor(ORDER_NEAR), '排队等待', WAIT_H), item('#000', '支付', 8, 2)]],
    ['标记', [item(MARK_FG.private, '私单'), item(MARK_FG.kept, '无风险/不合规'), item(MARK_FG.dropped, '互剪/重修/无效/重复'), item('#722ed1', '烫染'), item(MULTI_COLOR, '多项目'), item(WASH_COLOR, '洗吹(条变淡)'), linkItem(false, '标记关联订单'), linkItem(true, '备注订单')]],
    ['底色', [item('rgba(250,173,20,0.35)', `窗口 ${params.window}′`), item('rgba(22,119,255,0.18)', `附近 ±${params.nearby}′`), <span key="cur" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 10, display: 'inline-flex', justifyContent: 'center' }}><i style={{ height: 8, borderLeft: '1px dashed #f5222d' }} /></span>当前事件起止
    </span>]],
  ];

  // 连线坐标：按泳道累计高度（每条泳道底边 1px），事件取色块/小字下方中点，订单取服务条上边中点
  const linkLayer = () => {
    if (!links.length) return null;
    const ev = new Map<string, { x: number; y: number }>(); const od = new Map<string, { x: number; y: number }>();
    let y = ROW_H + 1;
    eventLanes.forEach((lane) => {
      lane.rows.forEach((row, ri) => row.forEach((b) => {
        const w = Math.max(3, x(b.to) - x(b.from));
        ev.set(String(b.e.eventId), { x: LABEL_W + x(b.from) + w / 2, y: y + ri * EV_ROW_H + 4 + EV_BAR_H + (b.e.primaryMarkType || isDyeEvent(b.e) ? 15 : 1) });
      }));
      y += lane.rows.length * EV_ROW_H + 1;
    });
    orderLanes.forEach((lane) => {
      const rh = orderRowH(lane);
      lane.rows.forEach((row, ri) => row.forEach((b) => {
        const cx = b.start != null ? x(b.start) + Math.max(3, x(b.end ?? b.start + 1) - x(b.start)) / 2 : x(b.from) + 3;
        od.set(orderKeyOf(b.o), { x: LABEL_W + cx, y: y + ri * rh + 5 });
      }));
      y += lane.rows.length * rh + 1;
    });
    const active = (l: Link) => !hover || (hover.kind === 'e' ? hover.key === l.eventId : hover.key === l.orderKey);
    return (
      <svg style={{ position: 'absolute', left: 0, top: 0, width: width + LABEL_W, height: y, pointerEvents: 'none', zIndex: 2, overflow: 'visible' }}>
        {links.map((l) => {
          const a = ev.get(l.eventId), b = od.get(l.orderKey);
          if (!a || !b) return null;
          const on = active(l), mid = (a.y + b.y) / 2;
          return (
            <g key={`${l.eventId}-${l.orderKey}`} opacity={hover ? (on ? 1 : 0.1) : 0.45}>
              <path d={`M${a.x},${a.y} C${a.x},${mid} ${b.x},${mid} ${b.x},${b.y}`} fill="none" stroke={l.color} strokeWidth={hover && on ? 2 : 1.5} strokeDasharray={l.source === 'remark' ? '4 3' : undefined} />
              <circle cx={b.x} cy={b.y} r={2.5} fill={l.color} />
            </g>
          );
        })}
      </svg>
    );
  };

  if (!ready) return <div style={{ padding: 40, textAlign: 'center' }}><Spin tip="加载订单与当天事件…"><div style={{ height: 40 }} /></Spin></div>;
  return (
    <div data-testid="orders-timeline">
      {/* 上方只留操作 */}
      <div style={{ marginBottom: 8 }}>
        <Segmented value={scale} options={SCALES} onChange={(v) => setScale(Number(v))} />
      </div>
      {pinBar()}
      <div ref={scrollRef} style={{ overflowX: 'auto', border: '1px solid #f0f0f0', position: 'relative' }}>
        <div style={{ position: 'relative', width: width + LABEL_W }}>
          {/* 纵向网格：整点实线、其余虚线，压在色块之下 */}
          <div style={{ position: 'absolute', left: LABEL_W, top: ROW_H + 1, bottom: 0, width, pointerEvents: 'none', zIndex: 1 }}>
            {ticks.map((t) => <i key={t} style={{ position: 'absolute', left: x(t), top: 0, bottom: 0, borderLeft: t % 60 === 0 ? '1px solid rgba(0,0,0,0.06)' : '1px dashed rgba(0,0,0,0.04)' }} />)}
          </div>
          {/* 覆盖层：附近范围、时间窗口、当前事件时间线 */}
          {cur && (
            <div style={{ position: 'absolute', left: LABEL_W, top: 0, bottom: 0, width, pointerEvents: 'none', zIndex: 1 }}>
              <div style={{ position: 'absolute', left: x(cur.t - params.nearby), width: x(cur.t + params.nearby) - x(cur.t - params.nearby), top: 0, bottom: 0, background: 'rgba(22,119,255,0.06)' }} />
              <div style={{ position: 'absolute', left: x(windowStart), width: x(windowStart + params.window) - x(windowStart), top: 0, bottom: 0, background: 'rgba(250,173,20,0.18)' }} />
              {cur.dur ? <div style={{ position: 'absolute', left: x(cur.t - cur.dur / 60), top: 0, bottom: 0, borderLeft: '1px dashed #f5222d' }} /> : null}
              {/* 1px 线向左收 1px，与开始线一样贴在色块边缘内侧 */}
              <div style={{ position: 'absolute', left: x(cur.t) - 1, top: 0, bottom: 0, borderLeft: '1px dashed #f5222d' }} />
            </div>
          )}
          {/* 时间刻度 */}
          {/* 时间刻度：整点深色、半点/刻钟浅色，底部短刻度线 */}
          {laneBlock('时间', 1, ticks.map((t) => {
            const hour = t % 60 === 0;
            return (
              <span key={t} style={{ position: 'absolute', left: x(t), top: 0, height: ROW_H }}>
                <span style={{ position: 'absolute', left: 3, top: 0, lineHeight: `${ROW_H - 2}px`, whiteSpace: 'nowrap', fontSize: hour ? 12 : 11, fontWeight: hour ? 500 : undefined, color: hour ? '#595959' : '#bfbfbf' }}>{hhmm(t)}</span>
                <i style={{ position: 'absolute', left: 0, bottom: 0, height: hour ? 8 : 4, borderLeft: `1px solid ${hour ? '#bfbfbf' : '#d9d9d9'}` }} />
              </span>
            );
          }), 'axis', '#fafafa', false, ROW_H, {
            muted: true,
            // 左上角放当前显示总数（受订单状态/订单号筛选影响）
            label: <span data-testid="tl-totals" style={{ fontSize: 11 }}>事件 <b style={{ color: '#262626' }}>{eventBars.length}</b><span style={{ margin: '0 4px', color: '#d9d9d9' }}>·</span>订单 <b style={{ color: '#262626' }}>{orderBars.length}</b></span>,
          })}
          {/* AI 事件泳道 */}
          {eventLanes.map((lane, li) => laneBlock(lane.name, lane.rows.length, lane.rows.flatMap((row, ri) => row.map((b) => {
            const isCur = String(b.e.eventId) === String(event.eventId);
            const mark = b.e.primaryMarkType ? MARK_STYLES[b.e.primaryMarkType] : undefined;
            const left = x(b.from), w = Math.max(3, x(b.to) - x(b.from)), top = ri * EV_ROW_H + 4;
            const id = String(b.e.eventId);
            const selected = selectedId === id, no = pinNo.get(id);
            const lit = !!no && hover?.kind === 'e' && hover.key === id;
            // 当前事件不改色（与图例一致），只加细边框；选中=蓝描边，已固定对比=紫描边（与卡片互相悬停时加粗）
            const ring = [isCur ? 'inset 0 0 0 1px rgba(0,0,0,0.6)' : '', selected ? '0 0 0 2px #1677ff' : no ? `0 0 0 ${lit ? 3 : 2}px ${PIN_COLOR}` : hover?.kind === 'e' && hover.key === id ? glow(barColor(b.e)) : ''].filter(Boolean).join(', ');
            return [
              <Popover key={b.e.eventId} trigger="click" placement="bottom" content={eventPopover(b)}
                open={selected && !previewUrl} onOpenChange={(v) => setSelectedId((sid) => (v ? id : sid === id ? null : sid))}>
                <Tooltip title={eventTip(b)} overlayStyle={{ maxWidth: 320 }} open={selected || previewUrl || reviewing ? false : undefined}>
                  <div data-testid={`tl-event-${id}`} onMouseEnter={() => setHover({ kind: 'e', key: id })} onMouseLeave={() => setHover(null)}
                    style={{ position: 'absolute', left, width: w, top, height: EV_BAR_H, cursor: 'pointer', zIndex: selected ? 3 : isCur ? 2 : 1,
                    background: barColor(b.e), borderRadius: BAR_R, boxShadow: ring || undefined,
                    opacity: b.hasDuration ? 1 : 0.6, overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: `${EV_BAR_H}px` }}>
                  </div>
                </Tooltip>
              </Popover>,
              // 固定编号：色块左上角，与对比栏卡片编号一致
              no && (
                <div key={`${b.e.eventId}-pin`} style={{ position: 'absolute', left: left - 5, top: top - 5, zIndex: 4, pointerEvents: 'none', lineHeight: 0 }}>{pinBadge(no)}</div>
              ),
              (mark || isDyeEvent(b.e)) && (
                <div key={`${b.e.eventId}-mark`} style={{ position: 'absolute', left: left + w / 2, top: top + EV_BAR_H + 2, transform: 'translateX(-50%)', fontSize: MARK_FONT, lineHeight: '12px',
                  color: mark?.fg, fontWeight: b.e.primaryMarkType === 'PRIVATE_ORDER' ? 600 : undefined, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 2 }}>{isDyeEvent(b.e) ? <DyeMark event /> : null}{mark?.text}</div>
              ),
            ];
          })), `ev-${lane.name}`, '#fffdf5', false, EV_ROW_H, { ai: true, count: `${lane.rows.flat().length} 个`, groupEnd: li === eventLanes.length - 1 }))}
          {/* 订单泳道（按发型师） */}
          {orderLanes.map((lane) => { const rh = orderRowH(lane); return laneBlock(lane.name, lane.rows.length, lane.rows.flatMap((row, ri) => row.map((b) => {
            const calc = isCalcStatus(b.o.orderStatus);
            const color = !calc ? ORDER_OFF : b.o.matchType === 'WINDOW' ? ORDER_WINDOW : b.o.matchType === 'NEARBY' ? ORDER_NEAR : ORDER_OTHER;
            const top = ri * rh;
            const k = orderKeyOf(b.o);
            const part = hover?.kind === 'o' && hover.key === k ? hover.part : undefined;
            const enter = (p?: OrderPart) => () => setHover({ kind: 'o', key: k, part: p });
            const hl = (p: OrderPart, c: string) => (part === p ? glow(c) : undefined);
            const wc = waitColor(color);
            const sx = b.start != null ? x(b.start) - x(b.from) : 0, sw = b.start != null ? Math.max(3, x(b.end ?? b.start + 1) - x(b.start)) : 6;
            return (
              // 每段各挂 Tooltip，箭头对准悬停的那一段
              // 点击绑在各段上：绑容器会被悬浮窗（portal）里的点击冒泡触发
              <div key={k} onMouseEnter={() => setHover({ kind: 'o', key: k })} onMouseLeave={() => setHover(null)} style={{ position: 'absolute', left: x(b.from), width: Math.max(4, x(b.to) - x(b.from)), top, height: ROW_H, zIndex: 2 }}>
                {b.create != null && b.start != null && b.start > b.create && (
                  <Tooltip title={orderTip(b, 'wait')}>
                    <div onClick={() => onOrderClick(b.o)} onMouseEnter={enter('wait')} onMouseLeave={enter()}
                      style={{ position: 'absolute', cursor: 'pointer', left: 0, width: x(b.start) - x(b.create), top: 0, height: ROW_H }}>
                      {/* 整行高透明热区，线细也好悬停 */}
                      <div style={{ position: 'absolute', left: 0, right: 0, top: ROW_H / 2 - WAIT_H / 2, height: WAIT_H, background: wc, borderRadius: BAR_R, boxShadow: hl('wait', color) }} />
                    </div>
                  </Tooltip>
                )}
                {b.create != null && b.start != null && b.start > b.create && (
                  <Tooltip title={orderTip(b, 'create')}>
                    {/* 下单圆点：独立 12px 热区 */}
                    <div onClick={() => onOrderClick(b.o)} onMouseEnter={enter('create')} onMouseLeave={enter()} style={{ position: 'absolute', cursor: 'pointer', left: -4, top: ROW_H / 2 - 6, width: 12, height: 12, zIndex: 1 }}>
                      <i style={{ position: 'absolute', left: 3, top: 3, width: 6, height: 6, borderRadius: 3, background: '#fff', border: `1.5px solid ${wc}`, boxSizing: 'border-box', boxShadow: hl('create', color) }} />
                    </div>
                  </Tooltip>
                )}
                {b.start != null && (
                  <Tooltip title={orderTip(b, 'bar')} overlayStyle={{ maxWidth: 360 }}>
                    <div onClick={() => onOrderClick(b.o)} onMouseEnter={enter('bar')} onMouseLeave={enter()} style={{ position: 'absolute', cursor: 'pointer', left: x(b.start) - x(b.from), width: Math.max(3, x(b.end ?? b.start + 1) - x(b.start)), top: 5, height: ROW_H - 10, background: color, borderRadius: BAR_R,
                      boxShadow: hl('bar', color), opacity: isWashOrder(b.o) ? 0.4 : calc ? 1 : 0.7, fontSize: 10, color: '#fff', overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: `${ROW_H - 10}px`, paddingLeft: 2 }}>
                      {x(b.end ?? b.start) - x(b.start) > 36 ? (b.o.queuedNo || '') : ''}
                    </div>
                  </Tooltip>
                )}
                {b.start == null && (
                  <Tooltip title={orderTip(b, 'bar')}>
                    <div onClick={() => onOrderClick(b.o)} style={{ position: 'absolute', cursor: 'pointer', left: 0, width: 6, top: 7, height: ROW_H - 14, border: `1px dashed ${color}`, borderRadius: BAR_R }} />
                  </Tooltip>
                )}
                {b.pay != null && (
                  <Tooltip title={orderTip(b, 'pay')}>
                    <div onClick={() => onOrderClick(b.o)} onMouseEnter={enter('pay')} onMouseLeave={enter()} style={{ position: 'absolute', cursor: 'pointer', left: x(b.pay) - x(b.from) - 3, width: 8, top: 0, height: ROW_H, zIndex: 1 }}>
                      <i style={{ position: 'absolute', left: 3, top: 3, width: 2, height: ROW_H - 6, background: '#000', boxShadow: hl('pay', '#000000') }} />
                    </div>
                  </Tooltip>
                )}
                  {hasOrderTag(b.o) && <div style={{ position: 'absolute', left: sx + sw / 2, top: ROW_H - 3, transform: 'translateX(-50%)', lineHeight: '12px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{isDyeOrder(b.o) ? <DyeMark /> : null}{isWashOrder(b.o) ? <WashMark /> : null}{isMultiOrder(b.o) ? <MultiMark o={b.o} /> : null}</div>}
              </div>
            );
          })), `od-${lane.name}`, undefined, isPrivateLane(lane), rh, { count: `${lane.rows.flat().length} 单`, avatar: lane.rows.flat().find((b) => b.o.craftsmanAvatarUrl)?.o.craftsmanAvatarUrl ?? null }); })}
          {linkLayer()}
          {!eventLanes.length && !orderLanes.length && <div style={{ padding: 24, color: '#999' }}>暂无数据</div>}
        </div>
      </div>
      {/* 图例弱化：小字浅灰、色块缩小、行距收紧 */}
      <div style={{ fontSize: 11, lineHeight: '16px', marginTop: 6, display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 2, columnGap: 10, color: '#8c8c8c' }}>
        {legendRows.slice(0, legendMore ? legendRows.length : 2).map(([k, v]) => [
          <span key={`${k}-k`} style={{ color: '#bfbfbf' }}>{k}</span>,
          <Space key={`${k}-v`} size={12} wrap>{v}</Space>,
        ])}
        {/* 末行左侧：查看更多 / 收起（标记、底色两行） */}
        <a data-testid="tl-legend-more" onClick={() => setLegendMore((m) => !m)} style={{ gridColumn: '1 / -1', justifySelf: 'start', fontSize: 11, color: '#1677ff' }}>
          {legendMore ? '收起' : '查看更多'} {legendMore ? <UpOutlined /> : <DownOutlined />}
        </a>
      </div>
      {previewUrl && <Image src={previewUrl} style={{ display: 'none' }} preview={{ visible: true, src: previewUrl, onVisibleChange: (v) => { if (!v) setPreviewUrl(null); } }} />}
    </div>
  );
}
