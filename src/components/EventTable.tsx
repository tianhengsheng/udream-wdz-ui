import { Button, Space, Table, Tooltip, type TableColumnsType } from 'antd';
import { MediaThumb } from './MediaThumb';
import { PrimaryTag, ReviewTag, RiskTag } from './Tags';
import { useDialogs } from '../store/useDialogs';
import { openMonitor } from '../utils/monitor';
import type { RiskEvent } from '../types/wdz';
import { dash, fmtTime } from '../utils/format';

interface Props {
  events: RiskEvent[];
  loading?: boolean;
  withStore?: boolean; // 批量核查带城市/经理/门店四列
  withAttendance?: boolean;
  selected: string[];
  onSelect: (ids: string[]) => void;
  activeOrdersEventId?: string | null;
  pagination: { current: number; pageSize: number; total: number; onChange: (p: number, ps: number) => void };
}

/** 事件行表（批量核查 / 查看事件与排队 共用）：勾选、行点击看排队订单、行内动作。eventId 全程字符串。 */
export function EventTable({ events, loading, withStore, withAttendance, selected, onSelect, activeOrdersEventId, pagination }: Props) {
  const d = useDialogs();
  /** 文本列：固定宽 + 省略，悬浮 Tooltip 看全文 */
  const txt = (title: string, dataIndex: keyof RiskEvent, width: number): TableColumnsType<RiskEvent>[number] => ({
    title, dataIndex, width, ellipsis: { showTitle: false }, render: (v) => <Tooltip title={v || undefined} placement="topLeft"><span>{dash(v)}</span></Tooltip>,
  });
  const storeCols: TableColumnsType<RiskEvent> = withStore ? [txt('城市', 'cityName', 56), txt('城市经理', 'cityManagerName', 96), txt('区域经理', 'regionManagerName', 116), txt('门店名称', 'storeName', 140)] : [];
  const btn = { paddingInline: 4 } as const;
  const cols: TableColumnsType<RiskEvent> = [
    ...storeCols,
    { title: '风险', dataIndex: 'riskLevel', width: 64, render: (v) => <RiskTag v={v} /> },
    { title: '事件ID', dataIndex: 'eventId', width: 112, render: (v) => <span style={{ fontFamily: 'monospace' }}>#{v}</span> },
    { title: '事件时间', dataIndex: 'eventTime', width: 136, render: fmtTime },
    txt('工位', 'workName', 64),
    { title: '类型', key: 'type', width: 64, render: (_, e) => e.serviceType || e.checkType || '-' },
    { title: '图片', dataIndex: 'imageUrl', width: 50, render: (v) => <MediaThumb url={v} /> },
    { title: '一级标记', dataIndex: 'primaryMarkType', width: 88, render: (v) => <PrimaryTag v={v} /> },
    txt('二级标记', 'secondaryMarkType', 120),
    { title: '次数', dataIndex: 'markCount', width: 52, align: 'center', render: (v) => v || 0 },
    { title: '核实', dataIndex: 'reviewStatus', width: 64, render: (v) => <ReviewTag v={v} /> },
    txt('标记订单', 'markedOrderNo', 150),
    txt('标记发型师', 'markedCraftsmanName', 84),
    txt('最近标记人', 'lastOperatorName', 84),
    { title: '最近标记时间', dataIndex: 'lastMarkTime', width: 136, render: fmtTime },
    { title: '操作', key: 'op', fixed: 'right', width: withAttendance ? 306 : 250, render: (_, e) => (
      <Space size={0} split={<span style={{ color: '#ddd' }}>|</span>} onClick={(ev) => ev.stopPropagation()}>
        <Button type="link" size="small" style={btn} data-testid={`orders-${e.eventId}`} onClick={() => d.openOrders(String(e.eventId))}>排队订单</Button>
        <Button type="link" size="small" style={btn} onClick={() => openMonitor(e)}>查看监控</Button>
        <Button type="link" size="small" style={btn} data-testid={`detail-${e.eventId}`} onClick={() => d.openDetail(String(e.eventId))}>详情</Button>
        <Button type="link" size="small" style={btn} onClick={() => d.openRecords(String(e.eventId))}>操作记录</Button>
        <Button type="link" size="small" style={btn} data-testid={`review-${e.eventId}`} onClick={() => d.openReview([e])}>标记</Button>
        {withAttendance && <Button type="link" size="small" style={btn} onClick={() => d.openAttendance(String(e.eventId))}>查看打卡</Button>}
      </Space>
    ) },
  ];
  // 横向滚动基准 = 各列宽之和（含勾选列），宽屏时多余空间由 tableLayout=fixed 均摊不会再撑散
  const totalWidth = 40 + cols.reduce((n, c) => n + (Number(c.width) || 0), 0);
  return (
    <Table<RiskEvent> data-testid="event-table" size="small" rowKey={(e) => String(e.eventId)} loading={loading} columns={cols} dataSource={events}
      tableLayout="fixed" scroll={{ x: totalWidth }}
      rowSelection={{ selectedRowKeys: selected, onChange: (keys) => onSelect(keys.map(String)), columnWidth: 40 }}
      rowClassName={(e) => (String(e.eventId) === activeOrdersEventId ? 'row-current' : '')}
      onRow={(e) => ({ onClick: () => d.openOrders(String(e.eventId)), style: { cursor: 'pointer' } })}
      pagination={{ ...pagination, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], showTotal: (t) => `共 ${t} 条事件` }} />
  );
}
