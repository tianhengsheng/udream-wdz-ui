import { useEffect, useState } from 'react';
import { Button, Card, DatePicker, Input, Space, Table, Tooltip, message, type TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { exportStoreRanking, getStoreRankingSummary, pageStoreRanking } from '../../api/wdz';
import { AreaCascade } from '../../components/AreaCascade';
import { L } from '../../components/EventFilterFields';
import { SummaryStats } from '../../components/SummaryStats';
import { APP } from '../../constants/marks';
import { useDialogs } from '../../store/useDialogs';
import { useFilters } from '../../store/useFilters';
import type { RiskSummary, StoreRanking } from '../../types/wdz';
import { fmtTime } from '../../utils/format';
import { EventQueueModal } from './EventQueueModal';

const COLS: [string, keyof StoreRanking][] = [
  ['疑似私单数', 'privateOrderCount'], ['检出数', 'detectedCount'], ['核对数', 'reviewedCount'], ['无风险', 'noRiskCount'], ['重复', 'duplicateEventCount'],
  ['无效', 'invalidEventCount'], ['操作不合规', 'nonCompliantCount'], ['互剪', 'mutualCutCount'], ['重修', 'shortTermReworkCount'],
  ['高风险数', 'highCount'], ['中风险数', 'mediumCount'], ['预警数', 'warningCount'], ['低风险数', 'lowCount'],
  ['AI事件数', 'totalCount'], ['普通AI事件数', 'normalEventCount'], ['烫染AI事件数', 'dyeEventCount'],
  ['订单数', 'totalOrderCount'], ['普通订单数', 'normalOrderCount'], ['烫染订单数', 'dyeOrderCount'],
];

/** 门店排行页签：服务端分页/排序（降→升→取消），事件日期跨度 ≤2 个月（62 天，与后端一致）；订单三列来自后端快照/降级，前端不聚合 */
export function StoreRankingTab({ active }: { active: boolean }) {
  // 区域/门店/日期读写三个页签共用的 useFilters.risk；排行不支持的事件级条件不发送（后端也会忽略）
  const { risk, setRisk, resetRisk } = useFilters();
  const refreshTick = useDialogs((s) => s.refreshTick);
  const area = risk.area, storeName = risk.storeName;
  const dates: [string | null, string | null] = [risk.startDate, risk.endDate];
  const [sort, setSort] = useState<{ key: string | null; order: 'asc' | 'desc' }>({ key: 'privateOrderCount', order: 'desc' });
  const [page, setPage] = useState({ pageNum: 1, pageSize: 10 });
  const [rows, setRows] = useState<StoreRanking[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [queueStore, setQueueStore] = useState<string | null>(null);
  const validRange = () => {
    const { startDate: s, endDate: e } = useFilters.getState().risk; if (!s || !e) return true;
    const days = dayjs(e).diff(dayjs(s), 'day');
    if (days < 0) { message.error('结束日期不能早于开始日期'); return false; }
    if (days > 61) { message.error('事件日期跨度不能超过 2 个月'); return false; }
    return true;
  };
  const payload = (p = page, so = sort) => {
    const { risk: f, ruleId: rid } = useFilters.getState();
    return {
      app: APP, pageNum: p.pageNum, pageSize: p.pageSize, sortField: so.key || '', sortOrder: so.order, ruleId: rid, applicationScope: f.applicationScope,
      city: f.area.city ?? null, cityManagerId: f.area.cityManagerId ?? null, orgIds: f.area.orgIds ?? null, storeName: f.storeName.trim() || null, startDate: f.startDate, endDate: f.endDate,
    };
  };
  const load = async (p = page, so = sort) => {
    if (!validRange()) return;
    setLoading(true);
    try {
      const [r, s] = await Promise.all([pageStoreRanking(payload(p, so)), getStoreRankingSummary(payload(p, so))]);
      setRows(r.records || []); setTotal(r.total); setSummary(s);
    } catch { setRows([]); } finally { setLoading(false); }
  };
  // 每次切入都按共用筛选重查（其他页签可能改过条件）
  useEffect(() => { if (active) load(); }, [active]);
  useEffect(() => { if (active) load(); }, [refreshTick]);

  const onSort = (key: string) => {
    let next: typeof sort;
    if (sort.key !== key) next = { key, order: 'desc' }; else if (sort.order === 'desc') next = { key, order: 'asc' }; else next = { key: null, order: 'desc' };
    const p = { ...page, pageNum: 1 }; setSort(next); setPage(p); load(p, next);
  };
  const th = (label: string, key: string) => { const on = sort.key === key; return <span style={{ cursor: 'pointer', color: on ? '#1677ff' : undefined }} onClick={() => onSort(key)}>{label}{on ? (sort.order === 'asc' ? ' ↑' : ' ↓') : ''}</span>; };
  const cols: TableColumnsType<StoreRanking> = [
    // 文本列固定宽 + 省略，悬浮 Tooltip 看全文；末列不设宽吸收剩余空间（tableLayout=fixed 才不会把多余宽度摊到各列）
    // 1015：排行按 门店×日期 出行，日期列可排序
    { title: th('日期', 'statDate'), dataIndex: 'statDate', width: 96, fixed: 'left' as const, render: (v: string) => v || '-' },
    ...([['城市', 'cityName', 56], ['城市经理', 'cityManagerName', 96], ['区域经理', 'regionManagerName', 116], ['门店名称', 'storeName', 140]] as const).map(([title, dataIndex, width]) => ({
      title, dataIndex, width, ellipsis: { showTitle: false }, render: (v: string) => <Tooltip title={v} placement="topLeft"><span>{v || '-'}</span></Tooltip>,
    })),
    ...COLS.map(([label, key]) => ({ title: th(label, key), dataIndex: key, width: 74, align: 'center' as const, render: (v: unknown) => Number(v) || 0 })),
    { title: '操作', key: 'op', render: (_: unknown, r: StoreRanking) => <Button type="link" size="small" data-testid={`store-events-${r.storeName}`} onClick={() => setQueueStore(r.storeName || null)}>查看事件与排队</Button> },
  ];
  const doExport = async () => {
    if (!total) { message.error('当前没有可导出的数据'); return; }
    if (!validRange()) return;
    try { const r = await exportStoreRanking(payload()); message.success('已提交导出任务（任务中心）：' + JSON.stringify(r ?? '')); } catch { /* 已提示 */ }
  };
  const search = () => { const p = { ...page, pageNum: 1 }; setPage(p); load(p); };
  return (
    <div>
      <div data-testid="ranking-filter" style={{ background: '#fff', padding: 10, borderRadius: 6, marginBottom: 8 }}>
        <Space size={[8, 8]} wrap>
          <L t="管理区域"><AreaCascade value={area} onChange={(a) => setRisk({ area: a })} /></L>
          <L t="门店名称"><Input data-testid="ranking-storeName" allowClear placeholder="请输入门店名称" style={{ width: 150 }} value={storeName} onChange={(e) => setRisk({ storeName: e.target.value })} onPressEnter={search} /></L>
          <L t="事件日期"><DatePicker.RangePicker data-testid="ranking-dateRange" allowClear={false} value={[dates[0] ? dayjs(dates[0]) : null, dates[1] ? dayjs(dates[1]) : null]} onChange={(v) => setRisk({ startDate: v?.[0]?.format('YYYY-MM-DD') ?? null, endDate: v?.[1]?.format('YYYY-MM-DD') ?? null })} /></L>
          <span style={{ color: '#999' }}>跨度不超过 2 个月</span>
          <Button type="primary" data-testid="ranking-search" onClick={search}>查询</Button>
          <Button data-testid="ranking-reset" onClick={() => { resetRisk(); setTimeout(search, 0); }}>重置</Button>
        </Space>
      </div>
      <SummaryStats s={summary} />
      <Card size="small" title={<span>门店排行 <span style={{ color: '#999', fontWeight: 400 }}>共 {total} 家 · 更新时间 {fmtTime(summary?.dataUpdateTime)}</span></span>}
        extra={<Space><Button size="small" onClick={doExport}>导出</Button><Button size="small" type="link" onClick={() => load()}>刷新</Button></Space>}>
        <Table<StoreRanking> data-testid="ranking-table" size="small" rowKey={(r) => `${r.storeId || ''}|${r.storeName || ''}|${r.statDate || ''}`} loading={loading} columns={cols} dataSource={rows} tableLayout="fixed" scroll={{ x: 2100 }}
          pagination={{ current: page.pageNum, pageSize: page.pageSize, total, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], showTotal: (t) => `共 ${t} 条`,
            onChange: (pn, ps) => { const p = { pageNum: ps !== page.pageSize ? 1 : pn, pageSize: ps }; setPage(p); load(p); } }} />
      </Card>
      <EventQueueModal storeName={queueStore} onClose={() => setQueueStore(null)} />
    </div>
  );
}
