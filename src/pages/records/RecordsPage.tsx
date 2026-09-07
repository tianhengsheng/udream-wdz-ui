import { useEffect, useState } from 'react';
import { Button, Card, DatePicker, Input, Select, Space, Table, message, type TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { exportReviewRecords, pageReviewRecords } from '../../api/wdz';
import { AreaCascade, type AreaValue } from '../../components/AreaCascade';
import { L } from '../../components/EventFilterFields';
import { MediaThumb } from '../../components/MediaThumb';
import { APP, DEFAULT_END_DATE, DEFAULT_START_DATE, PRIMARY_LABELS, REVIEW_LABELS, SECONDARY_OPTIONS, opts } from '../../constants/marks';
import { recordCols } from '../../components/dialogs/RecordModal';
import { useDialogs } from '../../store/useDialogs';
import type { PageReviewRecordReq, ReviewRecord } from '../../types/wdz';
import { dash, fmtTime } from '../../utils/format';

const range = (a: string | null, b: string | null): [dayjs.Dayjs | null, dayjs.Dayjs | null] => [a ? dayjs(a) : null, b ? dayjs(b) : null];
const fmt = (v: any): string | null => v?.format('YYYY-MM-DD') ?? null;

interface F { eventId: string; eventStartDate: string | null; eventEndDate: string | null; primaryMarkType: string; secondaryMarkType: string; area: AreaValue; storeName: string; operatorName: string; operationStartDate: string | null; operationEndDate: string | null; reviewStatus: string; logScope: 'all' | 'latest' }
const EMPTY: F = { eventId: '', eventStartDate: DEFAULT_START_DATE, eventEndDate: DEFAULT_END_DATE, primaryMarkType: '', secondaryMarkType: '', area: {}, storeName: '', operatorName: '', operationStartDate: null, operationEndDate: null, reviewStatus: '', logScope: 'all' };

/** 核查日志页：初核、复核、退回及业务处理的审计流水；查看详情复用事件详情弹窗 */
export function RecordsPage() {
  const { openDetail, refreshTick } = useDialogs();
  const [f, setF] = useState<F>(EMPTY);
  const [page, setPage] = useState({ pageNum: 1, pageSize: 20 });
  const [rows, setRows] = useState<ReviewRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const set = (p: Partial<F>) => setF((x) => ({ ...x, ...p }));
  const payload = (p = page): PageReviewRecordReq => ({
    app: APP, pageNum: p.pageNum, pageSize: p.pageSize, eventId: f.eventId.trim().replace(/^#/, '') || null, operatorName: f.operatorName.trim(), reviewStatus: f.reviewStatus,
    storeName: f.storeName.trim(), primaryMarkType: f.primaryMarkType, secondaryMarkType: f.secondaryMarkType, city: f.area.city ?? null, cityManagerId: f.area.cityManagerId ?? null, orgIds: f.area.orgIds ?? null,
    eventStartDate: f.eventStartDate, eventEndDate: f.eventEndDate, operationStartDate: f.operationStartDate, operationEndDate: f.operationEndDate, logScope: f.logScope,
  });
  const load = async (p = page) => {
    setLoading(true);
    try { const r = await pageReviewRecords(payload(p)); setRows(r.records || []); setTotal(r.total); } catch { setRows([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [refreshTick]);
  const search = () => { const p = { ...page, pageNum: 1 }; setPage(p); load(p); };
  const secondaryOpts = (f.primaryMarkType ? SECONDARY_OPTIONS[f.primaryMarkType] || [] : Object.values(SECONDARY_OPTIONS).flat()).map((v) => ({ value: v, label: v }));
  const cols: TableColumnsType<ReviewRecord> = [
    ...recordCols.slice(0, 5), { title: '备注', dataIndex: 'remark', width: 160, render: dash },
    { title: '城市', dataIndex: 'cityName', width: 70, render: dash }, { title: '城市经理', dataIndex: 'cityManagerName', width: 90, render: dash }, { title: '区域经理', dataIndex: 'regionManagerName', width: 90, render: dash },
    { title: '门店名称', dataIndex: 'storeName', width: 150, render: dash }, { title: '工位', dataIndex: 'workName', width: 90, render: dash },
    { title: '事件ID', dataIndex: 'eventId', width: 170, render: (v) => <span style={{ fontFamily: 'monospace' }}>#{v}</span> },
    { title: '类型', key: 't', width: 90, render: (_, r) => r.serviceType || r.checkType || '-' }, { title: '事件时间', dataIndex: 'eventTime', width: 150, render: fmtTime },
    { title: '截图', dataIndex: 'imageUrl', width: 60, render: (v) => <MediaThumb url={v} /> },
    { title: '操作', key: 'op', fixed: 'right', width: 80, render: (_, r) => <Button type="link" size="small" onClick={() => openDetail(String(r.eventId))}>查看详情</Button> },
  ];
  return (
    <div style={{ padding: 12 }}>
      <h2 style={{ margin: '0 0 8px' }}>核查日志 <span style={{ color: '#999', fontSize: 12, fontWeight: 400 }}>初核、复核、退回及业务处理的完整审计流水</span></h2>
      <div data-testid="records-filter" style={{ background: '#fff', padding: 10, borderRadius: 6, marginBottom: 8 }}>
        <Space size={[8, 8]} wrap>
          <L t="事件ID"><Input data-testid="rec-eventId" allowClear style={{ width: 160 }} placeholder="请输入事件ID" value={f.eventId} onChange={(e) => set({ eventId: e.target.value })} onPressEnter={search} /></L>
          <L t="事件时间"><DatePicker.RangePicker value={range(f.eventStartDate, f.eventEndDate)} onChange={(v) => set({ eventStartDate: fmt(v?.[0]), eventEndDate: fmt(v?.[1]) })} /></L>
          <L t="标记类型"><Select allowClear placeholder="全部" style={{ width: 150 }} value={f.primaryMarkType || undefined} options={opts(PRIMARY_LABELS)} onChange={(v) => set({ primaryMarkType: v || '', secondaryMarkType: '' })} /></L>
          <L t="标记类型二级"><Select allowClear placeholder="全部" style={{ width: 200 }} value={f.secondaryMarkType || undefined} options={secondaryOpts} onChange={(v) => set({ secondaryMarkType: v || '' })} /></L>
          <L t="管理区域"><AreaCascade value={f.area} onChange={(area) => set({ area })} /></L>
          <L t="门店"><Input allowClear style={{ width: 150 }} placeholder="请输入门店名称" value={f.storeName} onChange={(e) => set({ storeName: e.target.value })} onPressEnter={search} /></L>
          <L t="操作人"><Input data-testid="rec-operator" allowClear style={{ width: 120 }} placeholder="请输入操作人" value={f.operatorName} onChange={(e) => set({ operatorName: e.target.value })} onPressEnter={search} /></L>
          <L t="操作时间"><DatePicker.RangePicker value={range(f.operationStartDate, f.operationEndDate)} onChange={(v) => set({ operationStartDate: fmt(v?.[0]), operationEndDate: fmt(v?.[1]) })} /></L>
          <L t="核实状态"><Select allowClear placeholder="全部" style={{ width: 100 }} value={f.reviewStatus || undefined} options={opts(REVIEW_LABELS)} onChange={(v) => set({ reviewStatus: v || '' })} /></L>
          <L t="日志范围"><Select style={{ width: 180 }} value={f.logScope} options={[{ value: 'all', label: '全部' }, { value: 'latest', label: '仅看事件最新操作记录' }]} onChange={(v) => set({ logScope: v })} /></L>
          <Button type="primary" data-testid="rec-search" onClick={search}>查询</Button>
          <Button onClick={() => { setF(EMPTY); setTimeout(search, 0); }}>重置</Button>
        </Space>
      </div>
      <Card size="small" title={<span>核查日志 <span style={{ color: '#999', fontWeight: 400 }}>共 {total} 条</span></span>}
        extra={<Space><Button size="small" onClick={async () => { try { const r = await exportReviewRecords(payload()); message.success('已提交导出任务：' + JSON.stringify(r ?? '')); } catch { /* */ } }}>导出日志</Button><Button size="small" type="link" onClick={() => load()}>刷新</Button></Space>}>
        <Table<ReviewRecord> data-testid="records-table" size="small" rowKey={(r) => String(r.id)} loading={loading} columns={cols} dataSource={rows} scroll={{ x: 2100 }}
          pagination={{ current: page.pageNum, pageSize: page.pageSize, total, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], showTotal: (t) => `共 ${t} 条`,
            onChange: (pn, ps) => { const p = { pageNum: ps !== page.pageSize ? 1 : pn, pageSize: ps }; setPage(p); load(p); } }} />
      </Card>
    </div>
  );
}
