import { useEffect, useState } from 'react';
import { Badge, Button, Card, Checkbox, Input, Popover, Select, Space, Tooltip, message } from 'antd';
import { DownOutlined, FilterOutlined, UpOutlined } from '@ant-design/icons';
import { exportBatchEvents, getRiskSummary, pageRiskEventItems } from '../../api/wdz';
import { AreaCascade } from '../../components/AreaCascade';
import { eventFieldDefs } from '../../components/EventFilterFields';
import { EventTable } from '../../components/EventTable';
import { SummaryStats } from '../../components/SummaryStats';
import { APP, APPLICATION_SCOPES, opts } from '../../constants/marks';
import { useDialogs } from '../../store/useDialogs';
import { useFilters } from '../../store/useFilters';
import type { ApplicationScope, PageRiskEventReq, RiskEvent, RiskSummary } from '../../types/wdz';
import { eventFilterPayload } from './EventQueueModal';

/** 筛选字段：顺序即展示顺序；DEFAULT_COMMON 为默认常用（对齐线上页面） */
const FIELD_ORDER = ['dateRange', 'applicationScope', 'storeName', 'riskLevels', 'primaryMarkType', 'reviewStatus', 'eventId', 'area', 'secondaryMarkType', 'lastOperatorName', 'markRange'] as const;
type FieldKey = (typeof FIELD_ORDER)[number];
const DEFAULT_COMMON: FieldKey[] = ['dateRange', 'applicationScope', 'storeName', 'riskLevels', 'primaryMarkType', 'reviewStatus', 'eventId'];
const COMMON_KEY = 'wdz.batch.commonFields', EXPAND_KEY = 'wdz.batch.filterExpanded';
const readLocal = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d; } catch { return d; } };
const writeLocal = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 无存储时仅本次生效 */ } };
const FW = '100%'; // 控件铺满网格单元，宽度由网格列决定

/** 批量核查页签：跨门店事件明细分页，勾选后批量标记；行点击看排队订单；带查看打卡 */
export function BatchReviewTab({ active }: { active: boolean }) {
  // 筛选条件读写三个页签共用的 useFilters.risk，分页各自保留
  const { ruleId, risk, changeScope, setRisk, resetRisk } = useFilters();
  const { refreshTick, openReview, ordersEventId } = useDialogs();
  const [page, setPage] = useState({ pageNum: 1, pageSize: 20 });
  const [rows, setRows] = useState<RiskEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [common, setCommon] = useState<FieldKey[]>(() => readLocal(COMMON_KEY, DEFAULT_COMMON).filter((k) => (FIELD_ORDER as readonly string[]).includes(k)));
  const [expanded, setExpanded] = useState<boolean>(() => readLocal(EXPAND_KEY, false));
  const saveCommon = (v: FieldKey[]) => { setCommon(v); writeLocal(COMMON_KEY, v); };
  const toggleExpand = () => { setExpanded(!expanded); writeLocal(EXPAND_KEY, !expanded); };
  const payload = (p = page): PageRiskEventReq => {
    const { risk: f, ruleId: rid } = useFilters.getState();
    return {
      app: APP, pageNum: p.pageNum, pageSize: p.pageSize, ruleId: rid, applicationScope: f.applicationScope,
      city: f.area.city ?? null, cityManagerId: f.area.cityManagerId ?? null, orgIds: f.area.orgIds ?? null, storeName: f.storeName.trim() || null, ...eventFilterPayload(f),
    };
  };
  const load = async (p = page) => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([pageRiskEventItems(payload(p)), getRiskSummary(payload(p))]);
      const list = r.records || [];
      setRows(list); setTotal(r.total); setSummary(s);
      const visible = new Set(list.map((e) => String(e.eventId)));
      setSelected((ids) => ids.filter((id) => visible.has(id)));
    } catch { setRows([]); } finally { setLoading(false); }
  };
  // 每次切入都按共用筛选重查（其他页签可能改过条件）
  useEffect(() => { if (active) load(); }, [active]);
  useEffect(() => { if (active) load(); }, [refreshTick]);
  const search = () => { const p = { ...page, pageNum: 1 }; setPage(p); load(p); };
  const batchReview = () => {
    const evs = rows.filter((e) => selected.includes(String(e.eventId)));
    if (!evs.length) { message.error('请至少选择一个事件'); return; }
    openReview(evs);
  };
  const ev = eventFieldDefs(risk, setRisk, search, 'batch-', FW);
  const fields: Record<FieldKey, { label: string; node: React.ReactNode; active: boolean }> = {
    ...ev,
    dateRange: { ...ev.dateRange, label: '事件日期', node: ev.dateRange.node },
    riskLevels: { ...ev.riskLevels, label: '风险等级' },
    applicationScope: { label: '应用范围', active: risk.applicationScope !== 'ALL', node: <Select data-testid="batch-scope" style={{ width: FW }} value={risk.applicationScope} options={opts(APPLICATION_SCOPES)} onChange={(v) => changeScope(v as ApplicationScope).then(search)} /> },
    storeName: { label: '门店名称', active: !!risk.storeName.trim(), node: <Input data-testid="batch-storeName" allowClear placeholder="请输入门店名称" style={{ width: FW }} value={risk.storeName} onChange={(e) => setRisk({ storeName: e.target.value })} onPressEnter={search} /> },
    area: { label: '管理区域', active: !!(risk.area.city || risk.area.cityManagerId || risk.area.orgIds), node: <AreaCascade value={risk.area} onChange={(area) => setRisk({ area })} /> },
  };
  // 收起时隐藏但仍生效的条件数，提示在筛选按钮上
  const hiddenActive = expanded ? 0 : FIELD_ORDER.filter((k) => !common.includes(k) && fields[k].active).length;
  return (
    <div>
      <div data-testid="batch-filter" style={{ background: '#fff', padding: 12, borderRadius: 6, marginBottom: 8 }}>
        {/* 字段按网格排布，标签右对齐；按钮组放在网格最后一格靠右 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', columnGap: 20, rowGap: 10, alignItems: 'center' }}>
          {FIELD_ORDER.filter((k) => expanded || common.includes(k)).map((k) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, gridColumn: k === 'area' ? 'span 2' : undefined }}>
              <span style={{ color: '#666', whiteSpace: 'nowrap', width: 84, flex: 'none', textAlign: 'right' }}>{fields[k].label}：</span>
              <div style={{ flex: 1, minWidth: 0 }}>{fields[k].node}</div>
            </div>
          ))}
        <Space style={{ gridColumn: '-2 / -1', justifySelf: 'end' }} wrap>
          <Popover trigger="click" placement="bottomRight" title="常用筛选（收起时显示）" content={
            <div style={{ width: 260 }}>
              <Checkbox.Group data-testid="batch-common-fields" value={common} onChange={(v) => saveCommon(FIELD_ORDER.filter((k) => (v as string[]).includes(k)))}
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 6 }} options={FIELD_ORDER.map((k) => ({ value: k, label: fields[k].label }))} />
              <div style={{ textAlign: 'right', marginTop: 8 }}><Button size="small" type="link" onClick={() => saveCommon(DEFAULT_COMMON)}>恢复默认</Button></div>
            </div>}>
            <Tooltip title="选择常用筛选"><Badge count={hiddenActive} size="small"><Button icon={<FilterOutlined />} data-testid="batch-field-picker" /></Badge></Tooltip>
          </Popover>
          <Button type="primary" data-testid="batch-search" onClick={search}>查询</Button>
          <Button onClick={() => { resetRisk(); setTimeout(search, 0); }}>重置</Button>
          <Button onClick={async () => { try { const r = await exportBatchEvents(payload()); message.success('已提交导出任务：' + JSON.stringify(r ?? '')); } catch { /* */ } }}>导出</Button>
          <Button data-testid="batch-review" disabled={!selected.length} onClick={batchReview}>批量标记</Button>
          <Button type="link" data-testid="batch-expand" onClick={toggleExpand} style={{ padding: 0 }}>{expanded ? <>收起 <UpOutlined /></> : <>展开 <DownOutlined /></>}</Button>
        </Space>
        </div>
      </div>
      <SummaryStats s={summary} />
      <Card size="small" title={<span>待核查事件 <span style={{ color: '#999', fontWeight: 400 }}>共 {total} 条 · 已选 {selected.length} 条 · 规则 {ruleId ?? '-'} · 点击行查看排队订单</span></span>}
        extra={<Button size="small" type="link" onClick={() => load()}>刷新</Button>}>
        <EventTable events={rows} loading={loading} withStore withAttendance selected={selected} onSelect={setSelected} activeOrdersEventId={ordersEventId}
          pagination={{ current: page.pageNum, pageSize: page.pageSize, total, onChange: (pn, ps) => { const p = { pageNum: ps !== page.pageSize ? 1 : pn, pageSize: ps }; setPage(p); load(p); } }} />
      </Card>
    </div>
  );
}
