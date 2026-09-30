import { useEffect, useRef, useState } from 'react';
import { Button, Card, Space, Table, Tag, message, type TableColumnsType } from 'antd';
import { exportRiskEvents, getRiskSummary, pageRiskEvents } from '../../api/wdz';
import { RiskFilterForm } from './RiskFilterForm';
import { SummaryStats } from '../../components/SummaryStats';
import { DyeTag, PrimaryTag, ReviewTag, RiskTag } from '../../components/Tags';
import { riskPayload, useFilters } from '../../store/useFilters';
import type { RiskEvent, RiskSummary, RiskWindow } from '../../types/wdz';
import { fmtTime, num } from '../../utils/format';
import { useDialogs } from '../../store/useDialogs';

const windowKey = (w: RiskWindow) => `${w.storeId || w.storeName || ''}|${w.windowStart || ''}`;

/** 窗口行内三类汇总标签（后端聚合字段，与 v2 summaryTags 同口径） */
function SummaryTags({ w, type }: { w: RiskWindow; type: 'risk' | 'mark' | 'review' }) {
  const defs: [number, string, string][] = type === 'risk'
    ? [[w.highCount, '高风险', 'red'], [w.mediumCount, '中风险', 'orange'], [w.lowCount, '低风险', 'green'], [w.warningCount, '预警', 'gold']]
    : type === 'mark'
      ? [[w.privateCount, '私单', 'red'], [w.safeCount, '无风险', 'green'], [w.unmarkedCount, '未标记', 'default']]
      : [[w.firstReviewedCount, '初核', 'blue'], [w.secondReviewedCount, '复核', 'purple'], [w.unverifiedCount, '未核实', 'default']];
  return <>{defs.filter(([c]) => Number(c) > 0).map(([c, l, color]) => <Tag key={l} color={color}>{l} {Number(c)}</Tag>)}</>;
}

const SORTABLE: Record<string, string> = { windowStart: '时间窗口', aiEventCount: 'AI事件数', dyeEventCount: '烫染AI事件数', normalEventCount: '普通AI事件数', riskSummary: '风险等级汇总', markSummary: '标记概况', reviewProgress: '核实进度' };

/** 私单风险列表页签：筛选 → 汇总卡 → 门店时间窗口表（展开为事件明细）→ 分页 */
export function RiskListTab({ active }: { active: boolean }) {
  const { risk: f, ruleId, setRisk, loadRule } = useFilters();
  const [loading, setLoading] = useState(false);
  const [windows, setWindows] = useState<RiskWindow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const { openDetail, refreshTick } = useDialogs();
  const inited = useRef(false);

  const load = async () => {
    setLoading(true);
    try {
      const { risk, ruleId: rid } = useFilters.getState();
      const payload = riskPayload(risk, rid);
      const [page, sum] = await Promise.all([pageRiskEvents(payload), getRiskSummary(payload)]);
      setWindows(page.records || []);
      setTotal(page.total);
      setSummary(sum);
      // 翻页后只保留仍可见的展开项
      const keys = new Set((page.records || []).map(windowKey));
      setExpanded((e) => e.filter((k) => keys.has(k)));
    } catch { setWindows([]); } finally { setLoading(false); }
  };

  // 首次切入先取规则；之后每次切入都按共用筛选重查（其他页签可能改过条件）
  useEffect(() => {
    if (!active) return;
    if (!inited.current) { inited.current = true; loadRule().then(load); return; }
    load();
  }, [active]);
  // 标记提交后刷新列表（对应 v2 submitReview 后 loadRiskData）
  useEffect(() => { if (inited.current) load(); }, [refreshTick]);

  // 排序：同列三击循环 升→降→取消
  const onSort = (field: string) => {
    let sf: string | null = field; let so: 'asc' | 'desc' = 'asc';
    if (f.sortField === field) { if (f.sortOrder === 'asc') so = 'desc'; else { sf = null; so = 'desc'; } }
    setRisk({ sortField: sf, sortOrder: so, pageNum: 1 });
    setTimeout(load, 0);
  };
  const th = (field: string) => {
    const on = f.sortField === field;
    return <span style={{ cursor: 'pointer', color: on ? '#1677ff' : undefined }} onClick={() => onSort(field)}>{SORTABLE[field]}{on ? (f.sortOrder === 'asc' ? ' ↑' : ' ↓') : ''}</span>;
  };

  const cols: TableColumnsType<RiskWindow> = [
    { title: '城市', dataIndex: 'cityName', width: 80 },
    { title: '城市经理', dataIndex: 'cityManagerName', width: 90 },
    { title: '区域经理', dataIndex: 'regionManagerName', width: 90 },
    { title: '门店名称', dataIndex: 'storeName', width: 160 },
    { title: th('windowStart'), key: 'window', width: 230, render: (_, w) => `${fmtTime(w.windowStart)} ~ ${fmtTime(w.windowEnd)}` },
    { title: '时段类型', key: 'kind', width: 70, render: (_, w) => (w.dyeEventCount && w.normalEventCount ? <Tag color="purple">混合</Tag> : w.dyeEventCount ? <Tag color="orange">烫染</Tag> : <Tag>普通</Tag>) },
    { title: th('aiEventCount'), dataIndex: 'aiEventCount', width: 80 },
    { title: th('dyeEventCount'), dataIndex: 'dyeEventCount', width: 100 },
    { title: th('normalEventCount'), dataIndex: 'normalEventCount', width: 100 },
    { title: th('riskSummary'), key: 'risk', render: (_, w) => <SummaryTags w={w} type="risk" /> },
    { title: th('markSummary'), key: 'mark', render: (_, w) => <SummaryTags w={w} type="mark" /> },
    { title: th('reviewProgress'), key: 'review', render: (_, w) => <SummaryTags w={w} type="review" /> },
  ];

  const eventCols: TableColumnsType<RiskEvent> = [
    { title: '事件ID', dataIndex: 'eventId', width: 170, render: (v) => <span style={{ fontFamily: 'monospace' }}>#{v}</span> },
    { title: '事件时间', dataIndex: 'eventTime', width: 150, render: fmtTime },
    { title: '事件类型', key: 'dye', width: 100, render: (_, e) => <DyeTag item={e} /> },
    // 人工剔除事件不参与计分，计算列一律 "-"
    { title: '窗口订单数/权重', key: 'w', width: 120, render: (_, e) => (e.excluded ? '-' : `${e.windowOrderRawCount ?? '-'} / ${num(e.windowOrderCount)}`) },
    { title: '附近订单数/权重', key: 'n', width: 120, render: (_, e) => (e.excluded ? '-' : `${e.nearbyOrderCount ?? '-'} / ${num(e.nearbyOrderWeightedCount)}`) },
    { title: '共同差异', key: 'c', width: 80, render: (_, e) => (e.excluded ? '-' : num(e.commonDifference)) },
    { title: '评分', key: 's', width: 70, render: (_, e) => (e.excluded ? '-' : num(e.riskScore)) },
    { title: '风险等级', dataIndex: 'riskLevel', width: 80, render: (v) => <RiskTag v={v} /> },
    { title: '标记类型一级', dataIndex: 'primaryMarkType', width: 100, render: (v) => <PrimaryTag v={v} /> },
    { title: '标记类型二级', dataIndex: 'secondaryMarkType', width: 140, render: (v) => v || '-' },
    { title: '核实状态', dataIndex: 'reviewStatus', width: 80, render: (v) => <ReviewTag v={v} /> },
    { title: '标记发型师', dataIndex: 'markedCraftsmanName', width: 90, render: (v) => v || '-' },
    { title: '标记订单ID', dataIndex: 'markedOrderNo', width: 150, render: (v) => v || '-' },
    { title: '标记时间', dataIndex: 'lastMarkTime', width: 150, render: fmtTime },
    { title: '标记人', dataIndex: 'lastOperatorName', width: 80, render: (v) => v || '-' },
    { title: '操作', key: 'op', width: 90, fixed: 'right', render: (_, e) => <Button type="link" size="small" data-testid={`detail-${e.eventId}`} onClick={() => openDetail(String(e.eventId))}>查看/核实</Button> },
  ];

  const doExport = async () => {
    try {
      const { risk, ruleId: rid } = useFilters.getState();
      const r = await exportRiskEvents(riskPayload(risk, rid));
      message.success('已提交导出任务（任务中心）：' + JSON.stringify(r ?? ''));
    } catch { /* 拦截器已提示 */ }
  };

  return (
    <div>
      <RiskFilterForm onSearch={load} onReset={() => setTimeout(load, 0)} />
      <SummaryStats s={summary} />
      <Card size="small" title={<span>门店时间窗口汇总 <span style={{ color: '#999', fontWeight: 400 }}>共 {total} 个时间窗口 · 规则 {ruleId ?? '-'} · 更新时间 {fmtTime(summary?.dataUpdateTime)}</span></span>}
        extra={<Space><Button size="small" onClick={() => setExpanded(windows.map(windowKey))}>全部展开</Button><Button size="small" onClick={() => setExpanded([])}>全部收起</Button><Button size="small" onClick={doExport}>导出</Button><Button size="small" type="link" onClick={load}>刷新</Button></Space>}>
        <Table<RiskWindow> data-testid="window-table" size="small" rowKey={windowKey} loading={loading} columns={cols} dataSource={windows} scroll={{ x: 1500 }}
          expandable={{
            expandedRowKeys: expanded,
            onExpandedRowsChange: (k) => setExpanded(k as string[]),
            expandedRowRender: (w) => {
              const evs = w.events || [];
              const matched = evs.filter((e) => e.matched !== false).length;
              const showAll = f.eventScope === 'ALL' && matched < evs.length;
              return (
                <div style={{ padding: '4px 0 4px 24px' }}>
                  <div style={{ marginBottom: 4, color: '#666' }}>事件信息：共 {evs.length} 条{showAll ? `，命中 ${matched} 条已高亮` : ''}</div>
                  <Table<RiskEvent> size="small" rowKey="eventId" columns={eventCols} dataSource={evs} pagination={false} scroll={{ x: 1900 }}
                    rowClassName={(e) => (showAll && e.matched ? 'row-matched' : '')} />
                </div>
              );
            },
          }}
          pagination={{ current: f.pageNum, pageSize: f.pageSize, total, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], showTotal: (t) => `共 ${t} 个窗口`,
            onChange: (p, ps) => { setRisk({ pageNum: ps !== f.pageSize ? 1 : p, pageSize: ps }); setTimeout(load, 0); } }} />
      </Card>
    </div>
  );
}
