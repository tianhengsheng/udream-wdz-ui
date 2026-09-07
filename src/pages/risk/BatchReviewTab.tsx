import { useEffect, useRef, useState } from 'react';
import { Button, Card, Input, Select, Space, message } from 'antd';
import { exportBatchEvents, getRiskSummary, pageRiskEventItems } from '../../api/wdz';
import { AreaCascade, type AreaValue } from '../../components/AreaCascade';
import { EventFilterFields, L, emptyEventFilter, type EventFilter } from '../../components/EventFilterFields';
import { EventTable } from '../../components/EventTable';
import { SummaryStats } from '../../components/SummaryStats';
import { APP, APPLICATION_SCOPES, DEFAULT_END_DATE, DEFAULT_START_DATE, opts } from '../../constants/marks';
import { useDialogs } from '../../store/useDialogs';
import { useFilters } from '../../store/useFilters';
import type { ApplicationScope, PageRiskEventReq, RiskEvent, RiskSummary } from '../../types/wdz';
import { eventFilterPayload } from './EventQueueModal';

/** 批量核查页签：跨门店事件明细分页，勾选后批量标记；行点击看排队订单；带查看打卡 */
export function BatchReviewTab({ active }: { active: boolean }) {
  const { ruleId, risk, changeScope } = useFilters();
  const { refreshTick, openReview, ordersEventId } = useDialogs();
  const [area, setArea] = useState<AreaValue>({});
  const [storeName, setStoreName] = useState('');
  const [f, setF] = useState<EventFilter>(emptyEventFilter(DEFAULT_START_DATE, DEFAULT_END_DATE));
  const [page, setPage] = useState({ pageNum: 1, pageSize: 20 });
  const [rows, setRows] = useState<RiskEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const inited = useRef(false);
  const set = (p: Partial<EventFilter>) => setF((x) => ({ ...x, ...p }));

  const payload = (p = page): PageRiskEventReq => ({
    app: APP, pageNum: p.pageNum, pageSize: p.pageSize, ruleId: useFilters.getState().ruleId, applicationScope: useFilters.getState().risk.applicationScope,
    city: area.city ?? null, cityManagerId: area.cityManagerId ?? null, orgIds: area.orgIds ?? null, storeName: storeName.trim() || null, ...eventFilterPayload(f),
  });
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
  useEffect(() => { if (active && !inited.current) { inited.current = true; load(); } }, [active]);
  useEffect(() => { if (inited.current) load(); }, [refreshTick]);
  const search = () => { const p = { ...page, pageNum: 1 }; setPage(p); load(p); };
  const batchReview = () => {
    const evs = rows.filter((e) => selected.includes(String(e.eventId)));
    if (!evs.length) { message.error('请至少选择一个事件'); return; }
    openReview(evs);
  };
  return (
    <div>
      <SummaryStats s={summary} />
      <div data-testid="batch-filter" style={{ background: '#fff', padding: 10, borderRadius: 6, marginBottom: 8 }}>
        <Space size={[8, 8]} wrap>
          <L t="应用范围"><Select data-testid="batch-scope" style={{ width: 90 }} value={risk.applicationScope} options={opts(APPLICATION_SCOPES)} onChange={(v) => changeScope(v as ApplicationScope).then(search)} /></L>
          <L t="管理区域"><AreaCascade value={area} onChange={setArea} /></L>
          <L t="门店名称"><Input data-testid="batch-storeName" allowClear placeholder="请输入门店名称" style={{ width: 150 }} value={storeName} onChange={(e) => setStoreName(e.target.value)} onPressEnter={search} /></L>
          <EventFilterFields f={f} set={set} onEnter={search} prefix="batch-" />
          <Button type="primary" data-testid="batch-search" onClick={search}>查询</Button>
          <Button onClick={() => { setArea({}); setStoreName(''); setF(emptyEventFilter(DEFAULT_START_DATE, DEFAULT_END_DATE)); setTimeout(search, 0); }}>重置</Button>
        </Space>
      </div>
      <Card size="small" title={<span>待核查事件 <span style={{ color: '#999', fontWeight: 400 }}>共 {total} 条 · 已选 {selected.length} 条 · 规则 {ruleId ?? '-'} · 点击行查看排队订单</span></span>}
        extra={<Space><Button size="small" type="primary" data-testid="batch-review" onClick={batchReview}>批量标记</Button>
          <Button size="small" onClick={async () => { try { const r = await exportBatchEvents(payload()); message.success('已提交导出任务：' + JSON.stringify(r ?? '')); } catch { /* */ } }}>导出</Button>
          <Button size="small" type="link" onClick={() => load()}>刷新</Button></Space>}>
        <EventTable events={rows} loading={loading} withStore withAttendance selected={selected} onSelect={setSelected} activeOrdersEventId={ordersEventId}
          pagination={{ current: page.pageNum, pageSize: page.pageSize, total, onChange: (pn, ps) => { const p = { pageNum: ps !== page.pageSize ? 1 : pn, pageSize: ps }; setPage(p); load(p); } }} />
      </Card>
    </div>
  );
}
