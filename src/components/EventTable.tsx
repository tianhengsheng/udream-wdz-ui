import { Button, Space, Table, type TableColumnsType } from 'antd';
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
  const storeCols: TableColumnsType<RiskEvent> = withStore ? [
    { title: '城市', dataIndex: 'cityName', width: 70, render: dash }, { title: '城市经理', dataIndex: 'cityManagerName', width: 90, render: dash },
    { title: '区域经理', dataIndex: 'regionManagerName', width: 90, render: dash }, { title: '门店名称', dataIndex: 'storeName', width: 150, render: dash },
  ] : [];
  const cols: TableColumnsType<RiskEvent> = [
    ...storeCols,
    { title: '风险', dataIndex: 'riskLevel', width: 70, render: (v) => <RiskTag v={v} /> },
    { title: '事件ID', dataIndex: 'eventId', width: 170, render: (v) => <span style={{ fontFamily: 'monospace' }}>#{v}</span> },
    { title: '事件时间', dataIndex: 'eventTime', width: 150, render: fmtTime },
    { title: '工位', dataIndex: 'workName', width: 90, render: dash },
    { title: '类型', key: 'type', width: 90, render: (_, e) => e.serviceType || e.checkType || '-' },
    { title: '图片', dataIndex: 'imageUrl', width: 60, render: (v) => <MediaThumb url={v} /> },
    { title: '标记类型一级', dataIndex: 'primaryMarkType', width: 100, render: (v) => <PrimaryTag v={v} /> },
    { title: '标记类型二级', dataIndex: 'secondaryMarkType', width: 140, render: dash },
    { title: '标记次数', dataIndex: 'markCount', width: 70, render: (v) => v || 0 },
    { title: '核实状态', dataIndex: 'reviewStatus', width: 80, render: (v) => <ReviewTag v={v} /> },
    { title: '标记订单', dataIndex: 'markedOrderNo', width: 150, render: dash },
    { title: '标记发型师', dataIndex: 'markedCraftsmanName', width: 90, render: dash },
    { title: '最近标记人', dataIndex: 'lastOperatorName', width: 90, render: dash },
    { title: '最近标记时间', dataIndex: 'lastMarkTime', width: 150, render: fmtTime },
    { title: '操作', key: 'op', fixed: 'right', width: withAttendance ? 300 : 240, render: (_, e) => (
      <Space size={0} split={<span style={{ color: '#ddd' }}>|</span>} onClick={(ev) => ev.stopPropagation()}>
        <Button type="link" size="small" onClick={() => openMonitor(e)}>查看监控</Button>
        <Button type="link" size="small" data-testid={`detail-${e.eventId}`} onClick={() => d.openDetail(String(e.eventId))}>详情</Button>
        <Button type="link" size="small" onClick={() => d.openRecords(String(e.eventId))}>操作记录</Button>
        <Button type="link" size="small" data-testid={`review-${e.eventId}`} onClick={() => d.openReview([e])}>标记</Button>
        {withAttendance && <Button type="link" size="small" onClick={() => d.openAttendance(String(e.eventId))}>查看打卡</Button>}
      </Space>
    ) },
  ];
  return (
    <Table<RiskEvent> data-testid="event-table" size="small" rowKey={(e) => String(e.eventId)} loading={loading} columns={cols} dataSource={events}
      scroll={{ x: withStore ? 2300 : 1900 }}
      rowSelection={{ selectedRowKeys: selected, onChange: (keys) => onSelect(keys.map(String)), columnWidth: 40 }}
      rowClassName={(e) => (String(e.eventId) === activeOrdersEventId ? 'row-current' : '')}
      onRow={(e) => ({ onClick: () => d.openOrders(String(e.eventId)), style: { cursor: 'pointer' } })}
      pagination={{ ...pagination, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], showTotal: (t) => `共 ${t} 条事件` }} />
  );
}
