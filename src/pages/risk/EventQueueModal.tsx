import { useEffect, useState } from 'react';
import { Button, Card, Modal, Space, message } from 'antd';
import { exportEventQueueEvents, getRiskSummary, pageRiskEventItems } from '../../api/wdz';
import { EventFilterFields, emptyEventFilter, type EventFilter } from '../../components/EventFilterFields';
import { EventTable } from '../../components/EventTable';
import { SummaryStats } from '../../components/SummaryStats';
import { APP, DEFAULT_END_DATE, DEFAULT_START_DATE } from '../../constants/marks';
import { useDialogs } from '../../store/useDialogs';
import { useFilters } from '../../store/useFilters';
import type { PageRiskEventReq, RiskEvent, RiskSummary } from '../../types/wdz';

export const eventFilterPayload = (f: EventFilter): Partial<PageRiskEventReq> => ({
  startDate: f.startDate, endDate: f.endDate, eventId: f.eventId.trim().replace(/^#/, '') || null, reviewStatus: f.reviewStatus, riskLevels: f.riskLevels,
  primaryMarkType: f.primaryMarkType, secondaryMarkType: f.secondaryMarkType, lastOperatorName: f.lastOperatorName.trim(), lastMarkStartDate: f.lastMarkStartDate, lastMarkEndDate: f.lastMarkEndDate,
});

/** 「查看事件与排队」弹窗：某门店的事件列表（勾选批量标记、行点击看排队订单），从门店排行进入 */
export function EventQueueModal({ storeName, onClose }: { storeName: string | null; onClose: () => void }) {
  const { ruleId, risk } = useFilters();
  const { refreshTick, openReview, ordersEventId } = useDialogs();
  const [f, setF] = useState<EventFilter>(emptyEventFilter(DEFAULT_START_DATE, DEFAULT_END_DATE));
  const [page, setPage] = useState({ pageNum: 1, pageSize: 10 });
  const [rows, setRows] = useState<RiskEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const set = (p: Partial<EventFilter>) => setF((x) => ({ ...x, ...p }));

  const payload = (p = page): PageRiskEventReq => ({ app: APP, pageNum: p.pageNum, pageSize: p.pageSize, ruleId, applicationScope: risk.applicationScope, storeName, ...eventFilterPayload(f) });
  const load = async (p = page) => {
    if (!storeName) return;
    setLoading(true);
    try {
      const [r, s] = await Promise.all([pageRiskEventItems(payload(p)), getRiskSummary(payload(p))]);
      const list = r.records || [];
      setRows(list); setTotal(r.total); setSummary(s);
      const visible = new Set(list.map((e) => String(e.eventId)));
      setSelected((ids) => ids.filter((id) => visible.has(id)));
    } catch { setRows([]); } finally { setLoading(false); }
  };
  useEffect(() => { if (storeName) { setF(emptyEventFilter(DEFAULT_START_DATE, DEFAULT_END_DATE)); setSelected([]); const p = { pageNum: 1, pageSize: 10 }; setPage(p); setTimeout(() => load(p), 0); } }, [storeName]);
  useEffect(() => { if (storeName) load(); }, [refreshTick]);
  const search = () => { const p = { ...page, pageNum: 1 }; setPage(p); load(p); };
  const first = rows[0];
  const storeInfo = first && (
    <Card size="small" title={storeName || '门店概况'} style={{ minWidth: 260 }}>
      <span style={{ marginRight: 12 }}>城市：<b>{first.cityName || '-'}</b></span><span style={{ marginRight: 12 }}>城市经理：<b>{first.cityManagerName || '-'}</b></span><span>区域经理：<b>{first.regionManagerName || '-'}</b></span>
    </Card>
  );
  const batchReview = () => {
    const evs = rows.filter((e) => selected.includes(String(e.eventId)));
    if (!evs.length) { message.error('请至少选择一个事件'); return; }
    openReview(evs);
  };
  return (
    <Modal title={`查看事件与排队 - ${storeName ?? ''}`} open={!!storeName} onCancel={onClose} footer={null} width="95vw" style={{ top: 16 }} destroyOnHidden data-testid="event-queue-modal">
      <SummaryStats s={summary} extra={storeInfo} />
      <div style={{ background: '#fafafa', padding: 10, borderRadius: 6, marginBottom: 8 }}>
        <Space size={[8, 8]} wrap>
          <EventFilterFields f={f} set={set} onEnter={search} prefix="eq-" />
          <Button type="primary" data-testid="eq-search" onClick={search}>查询</Button>
          <Button onClick={() => { setF(emptyEventFilter(DEFAULT_START_DATE, DEFAULT_END_DATE)); setTimeout(search, 0); }}>重置</Button>
        </Space>
      </div>
      <Card size="small" title={<span>事件列表 <span style={{ color: '#999', fontWeight: 400 }}>共 {total} 条 · 已选 {selected.length} 条 · 点击行查看排队订单</span></span>}
        extra={<Space><Button size="small" type="primary" data-testid="eq-batch-review" onClick={batchReview}>批量标记</Button>
          <Button size="small" onClick={async () => { try { const r = await exportEventQueueEvents(payload()); message.success('已提交导出任务：' + JSON.stringify(r ?? '')); } catch { /* */ } }}>导出</Button>
          <Button size="small" type="link" onClick={() => load()}>刷新</Button></Space>}>
        <EventTable events={rows} loading={loading} selected={selected} onSelect={setSelected} activeOrdersEventId={ordersEventId}
          pagination={{ current: page.pageNum, pageSize: page.pageSize, total, onChange: (pn, ps) => { const p = { pageNum: ps !== page.pageSize ? 1 : pn, pageSize: ps }; setPage(p); load(p); } }} />
      </Card>
    </Modal>
  );
}
