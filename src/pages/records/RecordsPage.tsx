import { useEffect, useState } from 'react';
import { Button, Card, DatePicker, Input, Select, Space, Table, message, type TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { exportReviewRecords, getRiskEventDetail, pageReviewRecords } from '../../api/wdz';
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
const EMPTY: F = { eventId: '', eventStartDate: DEFAULT_START_DATE, eventEndDate: DEFAULT_END_DATE, primaryMarkType: '', secondaryMarkType: '', area: {}, storeName: '', operatorName: '', operationStartDate: null, operationEndDate: null, reviewStatus: '', logScope: 'latest' };

/** 核查日志页：初核、复核、退回及业务处理的审计流水；查看详情复用事件详情弹窗 */
export function RecordsPage() {
  const { openDetail, openReview, refreshTick } = useDialogs();
  const [f, setF] = useState<F>(EMPTY);
  const [page, setPage] = useState({ pageNum: 1, pageSize: 20 });
  const [rows, setRows] = useState<ReviewRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<{ key: string | null; order: 'asc' | 'desc' }>({ key: null, order: 'desc' });
  const set = (p: Partial<F>) => setF((x) => ({ ...x, ...p }));
  const payload = (p = page, so = sort): PageReviewRecordReq => ({
    app: APP, pageNum: p.pageNum, pageSize: p.pageSize, eventId: f.eventId.trim().replace(/^#/, '') || null, operatorName: f.operatorName.trim(), reviewStatus: f.reviewStatus,
    storeName: f.storeName.trim(), primaryMarkType: f.primaryMarkType, secondaryMarkType: f.secondaryMarkType, city: f.area.city ?? null, cityManagerId: f.area.cityManagerId ?? null, orgIds: f.area.orgIds ?? null,
    eventStartDate: f.eventStartDate, eventEndDate: f.eventEndDate, operationStartDate: f.operationStartDate, operationEndDate: f.operationEndDate, logScope: f.logScope,
    sortField: so.key || '', sortOrder: so.order,
  });
  const load = async (p = page, so = sort) => {
    setLoading(true);
    try { const r = await pageReviewRecords(payload(p, so)); setRows(r.records || []); setTotal(r.total); } catch { setRows([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [refreshTick]);
  const search = () => { const p = { ...page, pageNum: 1 }; setPage(p); load(p); };
  // 修改标记：取事件最新详情（version + 当前标记回显），沿用原核实类型提交 submitEventReview
  const modifyMark = async (r: ReviewRecord) => {
    try {
      const d = await getRiskEventDetail(String(r.eventId));
      if (!d?.event) { message.error('事件不存在'); return; }
      openReview([d.event], { reviewType: r.actionType === 'SECOND_REVIEW' ? 'SECOND_REVIEW' : 'FIRST_REVIEW', remark: r.remark });
    } catch { /* 拦截器已提示 */ }
  };
  // 表头三态排序同门店排行：无 → 降序 → 升序 → 无
  const onSort = (key: string) => {
    let next: typeof sort;
    if (sort.key !== key) next = { key, order: 'desc' }; else if (sort.order === 'desc') next = { key, order: 'asc' }; else next = { key: null, order: 'desc' };
    const p = { ...page, pageNum: 1 }; setSort(next); setPage(p); load(p, next);
  };
  const th = (label: string, key: string) => { const on = sort.key === key; return <span data-testid={`rec-sort-${key}`} style={{ cursor: 'pointer', color: on ? '#1677ff' : undefined }} onClick={() => onSort(key)}>{label}{on ? (sort.order === 'asc' ? ' ↑' : ' ↓') : ''}</span>; };
  const secondaryOpts = (f.primaryMarkType ? SECONDARY_OPTIONS[f.primaryMarkType] || [] : Object.values(SECONDARY_OPTIONS).flat()).map((v) => ({ value: v, label: v }));
  const cols: TableColumnsType<ReviewRecord> = [
    // 标记次数随当前筛选范围计算，只有分页/导出接口返回，故不放公共 recordCols（详情弹窗无此值）
    ...recordCols.slice(0, 8), { title: th('发型师标记次数', 'craftsmanMarkCount'), dataIndex: 'craftsmanMarkCount', width: 120, align: 'center', render: (v) => (v == null ? '-' : v) }, { title: '备注', dataIndex: 'remark', width: 160, render: dash },
    { title: '城市', dataIndex: 'cityName', width: 70, render: dash }, { title: '城市经理', dataIndex: 'cityManagerName', width: 90, render: dash }, { title: '区域经理', dataIndex: 'regionManagerName', width: 90, render: dash },
    { title: '门店名称', dataIndex: 'storeName', width: 150, render: dash }, { title: '工位', dataIndex: 'workName', width: 90, render: dash },
    { title: '事件ID', dataIndex: 'eventId', width: 170, render: (v) => <span style={{ fontFamily: 'monospace' }}>#{v}</span> },
    { title: '类型', key: 't', width: 90, render: (_, r) => r.serviceType || r.checkType || '-' }, { title: '事件时间', dataIndex: 'eventTime', width: 150, render: fmtTime },
    { title: '截图', dataIndex: 'imageUrl', width: 60, render: (v) => <MediaThumb url={v} /> },
    { title: '操作', key: 'op', fixed: 'right', width: 150, render: (_, r) => <Space size={0}>
      <Button type="link" size="small" onClick={() => openDetail(String(r.eventId))}>查看详情</Button>
      {r.editable && <Button type="link" size="small" data-testid={`rec-modify-${r.id}`} onClick={() => modifyMark(r)}>修改标记</Button>}
    </Space> },
  ];
  return (
    <div style={{ padding: 12 }}>
      <h2 style={{ margin: '0 0 8px' }}>核查日志 <span style={{ color: '#999', fontSize: 12, fontWeight: 400 }}>初核、复核、退回及业务处理的完整审计流水</span></h2>
      <div data-testid="records-filter" style={{ background: '#fff', padding: 10, borderRadius: 6, marginBottom: 8 }}>
        <Space size={[8, 8]} wrap>
          <L t="事件ID"><Input data-testid="rec-eventId" allowClear style={{ width: 160 }} placeholder="请输入事件ID" value={f.eventId} onChange={(e) => set({ eventId: e.target.value })} onPressEnter={search} /></L>
          <L t="事件时间"><DatePicker.RangePicker data-testid="rec-eventRange" value={range(f.eventStartDate, f.eventEndDate)} onChange={(v) => set({ eventStartDate: fmt(v?.[0]), eventEndDate: fmt(v?.[1]) })} /></L>
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
