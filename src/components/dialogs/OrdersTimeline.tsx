import { useEffect, useMemo, useRef, useState } from 'react';
import { Segmented, Space, Spin, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { pageBehaviorRules, pageReviewRecords, pageRiskEventItems } from '../../api/wdz';
import { APP, PRIMARY_LABELS, RISK_LABELS } from '../../constants/marks';
import { useDialogs } from '../../store/useDialogs';
import { useFilters } from '../../store/useFilters';
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
  PRIVATE_ORDER: { text: '私单', fg: MARK_FG.private },
  NO_RISK: { text: '无风险', fg: MARK_FG.kept }, STYLIST_NON_COMPLIANT: { text: '不合规', fg: MARK_FG.kept },
  STYLIST_MUTUAL_CUT: { text: '互剪', fg: MARK_FG.dropped }, SHORT_TERM_REWORK: { text: '重修', fg: MARK_FG.dropped },
  INVALID_EVENT: { text: '无效', fg: MARK_FG.dropped }, DUPLICATE_EVENT: { text: '重复', fg: MARK_FG.dropped },
};
const barColor = (e: RiskEvent) => {
  const fg = e.primaryMarkType ? MARK_STYLES[e.primaryMarkType]?.fg : undefined;
  if (fg === MARK_FG.private) return RED;
  if (fg === MARK_FG.kept) return GREEN;
  if (fg === MARK_FG.dropped) return GREY;
  return RISK_COLORS[e.riskLevel || ''] || '#d9d9d9';
};
const MARK_FONT = 10, EV_ROW_H = 34, EV_BAR_H = 14;
const PRIVATE_COLOR = '#a8071a', ORDER_WINDOW = '#08979c', ORDER_NEAR = '#4a6285', ORDER_OTHER = '#9fb4cc', ORDER_OFF = '#d9d9d9';
const SCALES = [{ label: '全天', value: 0.8 }, { label: '标准', value: 2 }, { label: '放大', value: 5 }];
const LABEL_W = 120, ROW_H = 24, DAY_END = 27 * 60; // 次日 03:00
/** 烫染在色块/订单条下方加「染」字标识（条外，短条也不遗漏），颜色仍表达风险/匹配 */
const isDyeEvent = (e: RiskEvent) => e.serviceType === '染发';
const isDyeOrder = (o: EventOrder) => o.itemCategory === 1;
const DyeText = () => <span style={{ color: '#b37feb', fontWeight: 600 }}>烫染</span>;
const PrivateMark = () => <span style={{ fontSize: 9, lineHeight: '12px', padding: '0 2px', marginRight: 3, background: PRIVATE_COLOR, color: '#fff', borderRadius: 2 }}>私</span>;
const DyeMark = () => <span style={{ fontSize: 9, lineHeight: '12px', padding: '0 2px', marginRight: 2, background: '#722ed1', color: '#fff', borderRadius: 2 }}>染</span>;
/** 多服务项目订单（服务项目名按逗号/顿号拆分超过 1 项），条下方加「多」字 */
const itemCount = (o: EventOrder) => (o.serviceItemName || '').split(/[,，、]/).filter((v) => v.trim()).length;
const isMultiOrder = (o: EventOrder) => itemCount(o) > 1;
const MULTI_COLOR = '#c41d7f';
const MultiMark = () => <span style={{ fontSize: 9, lineHeight: '12px', padding: '0 2px', marginRight: 2, background: MULTI_COLOR, color: '#fff', borderRadius: 2 }}>多</span>;
/** 订单泳道含烫染/多项目单时加高，给条下方的标识留位 */
const OD_DYE_ROW_H = 34;
const hasOrderTag = (o: EventOrder) => isDyeOrder(o) || isMultiOrder(o);
const orderRowH = (lane: Lane<OrderBar>) => (lane.rows.some((r) => r.some((b) => hasOrderTag(b.o))) ? OD_DYE_ROW_H : ROW_H);

interface Lane<T> { name: string; rows: T[][] }
interface OrderBar { o: EventOrder; create?: number; start?: number; end?: number; pay?: number; corrected?: number; from: number; to: number }
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

export function OrdersTimeline({ orders, ordersLoading, event, onOrderClick }: { orders: EventOrder[]; ordersLoading: boolean; event: RiskEvent | null; onOrderClick: (o: EventOrder) => void }) {
  const openDetail = useDialogs((s) => s.openDetail);
  const [dayEvents, setDayEvents] = useState<RiskEvent[]>([]);
  const [params, setParams] = useState<{ window: number; nearby: number }>({ window: 10, nearby: 60 });
  /** 同店当天事件+规则参数已就绪的事件 ID；与订单、当前事件全部到齐后才渲染，只渲染一次 */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [scale, setScale] = useState(2);
  /** 事件 ID → 最新一条初核/复核记录的备注 */
  const [remarks, setRemarks] = useState<Map<string, { first?: string; second?: string }>>(new Map());
  const [hover, setHover] = useState<{ kind: 'e' | 'o'; key: string } | null>(null);
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
  }, [event?.eventId]);

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
    return [...g.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, items]) => ({ name: `AI · ${name}`, rows: packLabeled(items) }));
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
  const orderTip = (b: OrderBar) => {
    const match = b.o.matchType === 'WINDOW' ? '窗口订单' : b.o.matchType === 'NEARBY' ? '附近订单' : '';
    const corrected = b.o.correctedStartTime && b.o.correctedStartTime !== b.o.serviceStartTime ? `（矫正 ${hm(b.o.correctedStartTime)}）` : '';
    return (
      <div style={line}>
        {links.filter((l) => l.orderKey === orderKeyOf(b.o)).map((l) => {
          const e = dayEvents.find((x) => String(x.eventId) === l.eventId);
          return <div key={l.eventId} style={{ color: '#ffd666' }}>关联事件 #{l.eventId} · {MARK_STYLES[e?.primaryMarkType || '']?.text || '未标记'} · 来自{l.source === 'mark' ? '标记' : '备注'}</div>;
        })}
        <div><b>{b.o.queuedNo || '-'}</b> · {b.o.craftsmanName || '-'} · {b.o.orderStatus || '-'}{match ? ` · ${match}` : ''}</div>
        <div>{isDyeOrder(b.o) ? <><DyeText /> · </> : null}{isMultiOrder(b.o) ? <><span style={{ color: '#ff85c0', fontWeight: 600 }}>{itemCount(b.o)}项</span> · </> : null}{b.o.serviceItemName || '-'} · {money(b.o.orderAmount)}</div>
        <div>排队 {hm(b.o.orderCreateTime)} → 服务 {hm(b.o.serviceStartTime)}{corrected} ~ {hm(b.o.serviceEndTime)}</div>
        {b.o.payTime && <div>支付 {hm(b.o.payTime)}</div>}
        <div style={{ color: '#aaa' }}>{b.o.orderNo || ''}</div>
      </div>
    );
  };
  const eventTip = (b: EventBar) => {
    const risk = RISK_LABELS[b.e.riskLevel || ''] || b.e.riskLevel || '-';
    return (
      <div style={line}>
        <div><b>#{b.e.eventId}</b> · {b.e.workName || '-'} · {isDyeEvent(b.e) ? <DyeText /> : (b.e.serviceType || b.e.checkType || '-')}</div>
        <div>{risk}{b.e.riskScore != null ? ` ${b.e.riskScore} 分` : ''} · 时长 {b.hasDuration ? `${Math.round((b.e.serviceDurationSeconds || 0) / 60)} 分钟` : '未知'}</div>
        <div>{b.hasDuration ? `${hm(dayjs(b.e.eventTime).subtract(b.e.serviceDurationSeconds || 0, 'second').format('YYYY-MM-DD HH:mm:ss'))} ~ ` : ''}{hm(b.e.eventTime)}</div>
        {b.e.primaryMarkType && <div>已标记：{PRIMARY_LABELS[b.e.primaryMarkType] || b.e.primaryMarkType}</div>}
        {remarks.get(String(b.e.eventId))?.first && <div style={{ color: '#ffd666', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>初核：{remarks.get(String(b.e.eventId))?.first}</div>}
        {remarks.get(String(b.e.eventId))?.second && <div style={{ color: '#ff7875', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>复核：{remarks.get(String(b.e.eventId))?.second}</div>}
      </div>
    );
  };

  const laneBlock = (name: string, rowCount: number, children: React.ReactNode, key: string, tint?: string, privateLane = false, rowH = ROW_H) => (
    <div key={key} style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', background: tint }}>
      <div style={{ width: LABEL_W, flex: 'none', position: 'sticky', left: 0, zIndex: 3, background: tint || '#fff', padding: '0 6px', fontSize: 12, lineHeight: `${rowH}px`, borderRight: '1px solid #f0f0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: privateLane ? PRIVATE_COLOR : undefined, fontWeight: privateLane ? 600 : undefined }} title={name}>{privateLane ? <PrivateMark /> : null}{name}</div>
      <div style={{ position: 'relative', width, height: rowCount * rowH, flex: 'none' }}>{children}</div>
    </div>
  );

  // 图例统一为「色块 + 文字」：色块统一占 14px 宽居中，文字统一灰黑
  const item = (c: string, t: React.ReactNode, h = 8, w = 14) => (
    <span key={String(t)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 14, display: 'inline-flex', justifyContent: 'center' }}><i style={{ width: w, height: h, background: c, borderRadius: 1 }} /></span>{t}
    </span>
  );
  const linkItem = (dashed: boolean, t: string) => (
    <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <svg width={18} height={8}><line x1={1} y1={4} x2={17} y2={4} stroke="#8c8c8c" strokeWidth={1.5} strokeDasharray={dashed ? '3 2' : undefined} /></svg>{t}
    </span>
  );
  const legendRows: [string, React.ReactNode[]][] = [
    ['事件', [item(RED, '高/私单'), item(ORANGE, '中'), item(GREEN, '预警/低/无风险/不合规'), item(GREY, '无效/互剪/重修/重复')]],
    ['订单', [item(ORDER_WINDOW, '窗口'), item(ORDER_NEAR, '附近'), item(ORDER_OTHER, '其他计算'), item(ORDER_OFF, '不参与计算'), item('#bbb', '排队等待', 2), item('#000', '支付', 10, 2)]],
    ['标记', [item(MARK_FG.private, '私单'), item(MARK_FG.kept, '无风险/不合规'), item(MARK_FG.dropped, '互剪/重修/无效/重复'), item('#722ed1', '烫染'), item(MULTI_COLOR, '多项目'), linkItem(false, '标记关联订单'), linkItem(true, '备注订单')]],
    ['底色', [item('rgba(250,173,20,0.35)', `窗口 ${params.window}′`), item('rgba(22,119,255,0.18)', `附近 ±${params.nearby}′`), item('#f5222d', '当前事件', 10, 2)]],
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
        <Segmented size="small" value={scale} options={SCALES} onChange={(v) => setScale(Number(v))} />
      </div>
      <div ref={scrollRef} style={{ overflowX: 'auto', border: '1px solid #f0f0f0', position: 'relative' }}>
        <div style={{ position: 'relative', width: width + LABEL_W }}>
          {/* 覆盖层：附近范围、时间窗口、当前事件时间线 */}
          {cur && (
            <div style={{ position: 'absolute', left: LABEL_W, top: 0, bottom: 0, width, pointerEvents: 'none', zIndex: 1 }}>
              <div style={{ position: 'absolute', left: x(cur.t - params.nearby), width: x(cur.t + params.nearby) - x(cur.t - params.nearby), top: 0, bottom: 0, background: 'rgba(22,119,255,0.06)' }} />
              <div style={{ position: 'absolute', left: x(windowStart), width: x(windowStart + params.window) - x(windowStart), top: 0, bottom: 0, background: 'rgba(250,173,20,0.18)' }} />
              {cur.dur ? <div style={{ position: 'absolute', left: x(cur.t - cur.dur / 60), top: 0, bottom: 0, borderLeft: '1px dashed #f5222d' }} /> : null}
              <div style={{ position: 'absolute', left: x(cur.t), top: 0, bottom: 0, borderLeft: '2px solid #f5222d' }} />
            </div>
          )}
          {/* 时间刻度 */}
          {laneBlock('时间', 1, ticks.map((t) => (
            <span key={t} style={{ position: 'absolute', left: x(t), top: 0, fontSize: 11, color: '#888', borderLeft: '1px solid #e8e8e8', paddingLeft: 2, height: ROW_H, lineHeight: `${ROW_H}px` }}>{hhmm(t)}</span>
          )), 'axis', '#fafafa')}
          {/* AI 事件泳道 */}
          {eventLanes.map((lane) => laneBlock(lane.name, lane.rows.length, lane.rows.flatMap((row, ri) => row.map((b) => {
            const isCur = String(b.e.eventId) === String(event.eventId);
            const mark = b.e.primaryMarkType ? MARK_STYLES[b.e.primaryMarkType] : undefined;
            const left = x(b.from), w = Math.max(3, x(b.to) - x(b.from)), top = ri * EV_ROW_H + 4;
            return [
              <Tooltip key={b.e.eventId} title={eventTip(b)}>
                <div onClick={() => openDetail(String(b.e.eventId))} onMouseEnter={() => setHover({ kind: 'e', key: String(b.e.eventId) })} onMouseLeave={() => setHover(null)}
                  style={{ position: 'absolute', left, width: w, top, height: EV_BAR_H, cursor: 'pointer', zIndex: isCur ? 2 : 1,
                  // 当前事件不改色（与图例一致），只加细边框
                  background: barColor(b.e), borderRadius: 2, boxShadow: isCur ? 'inset 0 0 0 1px rgba(0,0,0,0.6)' : undefined,
                  opacity: b.hasDuration ? 1 : 0.6, overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: `${EV_BAR_H}px` }}>
                </div>
              </Tooltip>,
              (mark || isDyeEvent(b.e)) && (
                <div key={`${b.e.eventId}-mark`} style={{ position: 'absolute', left: left + w / 2, top: top + EV_BAR_H + 2, transform: 'translateX(-50%)', fontSize: MARK_FONT, lineHeight: '12px',
                  color: mark?.fg, fontWeight: b.e.primaryMarkType === 'PRIVATE_ORDER' ? 600 : undefined, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 2 }}>{isDyeEvent(b.e) ? <DyeMark /> : null}{mark?.text}</div>
              ),
            ];
          })), `ev-${lane.name}`, '#fffdf5', false, EV_ROW_H))}
          {/* 订单泳道（按发型师） */}
          {orderLanes.map((lane) => { const rh = orderRowH(lane); return laneBlock(lane.name, lane.rows.length, lane.rows.flatMap((row, ri) => row.map((b) => {
            const calc = isCalcStatus(b.o.orderStatus);
            const color = !calc ? ORDER_OFF : b.o.matchType === 'WINDOW' ? ORDER_WINDOW : b.o.matchType === 'NEARBY' ? ORDER_NEAR : ORDER_OTHER;
            const top = ri * rh;
            const k = orderKeyOf(b.o);
            const sx = b.start != null ? x(b.start) - x(b.from) : 0, sw = b.start != null ? Math.max(3, x(b.end ?? b.start + 1) - x(b.start)) : 6;
            return (
              <Tooltip key={k} title={orderTip(b)}>
                <div onClick={() => onOrderClick(b.o)} onMouseEnter={() => setHover({ kind: 'o', key: k })} onMouseLeave={() => setHover(null)} style={{ position: 'absolute', left: x(b.from), width: Math.max(4, x(b.to) - x(b.from)), top, height: ROW_H, cursor: 'pointer', zIndex: 2 }}>
                  {b.create != null && b.start != null && b.start > b.create && (
                    <div style={{ position: 'absolute', left: 0, width: x(b.start) - x(b.create), top: ROW_H / 2 - 1, height: 2, background: '#bbb' }} />
                  )}
                  {b.start != null && (
                    <div style={{ position: 'absolute', left: x(b.start) - x(b.from), width: Math.max(3, x(b.end ?? b.start + 1) - x(b.start)), top: 5, height: ROW_H - 10, background: color, borderRadius: 2,
                      opacity: calc ? 1 : 0.7, fontSize: 10, color: '#fff', overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: `${ROW_H - 10}px`, paddingLeft: 2 }}>
                      {x(b.end ?? b.start) - x(b.start) > 36 ? (b.o.queuedNo || '') : ''}
                    </div>
                  )}
                  {b.start == null && <div style={{ position: 'absolute', left: 0, width: 6, top: 7, height: ROW_H - 14, border: `1px dashed ${color}`, borderRadius: 2 }} />}
                  {b.pay != null && <div style={{ position: 'absolute', left: x(b.pay) - x(b.from), top: 3, height: ROW_H - 6, borderLeft: '2px solid #000' }} />}
                  {hasOrderTag(b.o) && <div style={{ position: 'absolute', left: sx + sw / 2, top: ROW_H - 3, transform: 'translateX(-50%)', lineHeight: '12px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{isDyeOrder(b.o) ? <DyeMark /> : null}{isMultiOrder(b.o) ? <MultiMark /> : null}</div>}
                </div>
              </Tooltip>
            );
          })), `od-${lane.name}`, undefined, isPrivateLane(lane), rh); })}
          {linkLayer()}
          {!eventLanes.length && !orderLanes.length && <div style={{ padding: 24, color: '#999' }}>暂无数据</div>}
        </div>
      </div>
      {/* 图例放下方，按类分行 */}
      <div style={{ fontSize: 12, marginTop: 8, display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 6, columnGap: 12, color: '#595959' }}>
        {legendRows.map(([k, v]) => [<span key={`${k}-k`} style={{ color: '#999' }}>{k}</span>, <Space key={`${k}-v`} size={16} wrap>{v}</Space>])}
      </div>
      <div style={{ color: '#999', fontSize: 12, marginTop: 6 }}>
        AI 事件条长 = 事件时长（去重丢弃的事件不在检测结果中，不显示）；订单受上方状态/订单号筛选影响；点事件看详情，点订单看订单详情。仅供人工初筛，不参与计算。
      </div>
    </div>
  );
}
