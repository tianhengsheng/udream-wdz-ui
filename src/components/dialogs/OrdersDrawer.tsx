import { useEffect, useState } from 'react';
import { Descriptions, Drawer, Modal, Space, Table, Tag, type TableColumnsType } from 'antd';
import { listStoreDayOrders } from '../../api/wdz';
import { MediaThumb } from '../MediaThumb';
import { useDialogs } from '../../store/useDialogs';
import { useFilters } from '../../store/useFilters';
import type { EventOrder } from '../../types/wdz';
import { dash, duration, fmtTime, money } from '../../utils/format';

/** 排队订单抽屉：事件所在门店 当天 00:00~次日 03:00 全量订单（展示口径含已取消），WINDOW/NEARBY 高亮；点订单号看订单详情 */
export function OrdersDrawer() {
  const { ordersEventId, close } = useDialogs();
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<EventOrder | null>(null);
  useEffect(() => {
    if (!ordersEventId) return;
    setLoading(true); setOrders([]);
    listStoreDayOrders(ordersEventId, useFilters.getState().ruleId).then((l) => setOrders(l || [])).catch(() => setOrders([])).finally(() => setLoading(false));
  }, [ordersEventId]);
  const cols: TableColumnsType<EventOrder> = [
    { title: '订单号', dataIndex: 'orderNo', width: 160, render: (v, o) => <a onClick={() => setDetail(o)}>{v || '-'}</a> },
    { title: '发型师', dataIndex: 'craftsmanName', width: 80, render: dash }, { title: '工号', dataIndex: 'craftsmanEmployeeNo', width: 80, render: dash },
    { title: '英文名', dataIndex: 'craftsmanNickName', width: 80, render: dash }, { title: '头像', dataIndex: 'craftsmanAvatarUrl', width: 50, render: (v) => <MediaThumb url={v} avatar /> },
    { title: '状态', dataIndex: 'orderStatus', width: 80, render: (v) => <Tag color={v === '已完成' ? 'green' : 'blue'}>{v || '-'}</Tag> },
    { title: '服务项目', dataIndex: 'serviceItemName', width: 160, render: dash }, { title: '金额', dataIndex: 'orderAmount', width: 80, render: money },
    { title: '创建时间', dataIndex: 'orderCreateTime', width: 150, render: fmtTime }, { title: '开始时间', dataIndex: 'serviceStartTime', width: 150, render: fmtTime },
    { title: '矫正开始', dataIndex: 'correctedStartTime', width: 150, render: fmtTime }, { title: '结束时间', dataIndex: 'serviceEndTime', width: 150, render: fmtTime },
    { title: '服务时长', dataIndex: 'serviceDurationSeconds', width: 90, render: duration }, { title: '矫正时长', dataIndex: 'correctedDurationSeconds', width: 90, render: duration },
    { title: '总时长', dataIndex: 'totalDurationSeconds', width: 90, render: duration },
  ];
  const w = orders.filter((o) => o.matchType === 'WINDOW').length, n = orders.filter((o) => o.matchType === 'NEARBY').length;
  return (
    <Drawer title={`排队订单 - 事件 #${ordersEventId ?? ''}`} open={!!ordersEventId} onClose={() => close('orders')} width={1100} destroyOnHidden data-testid="orders-drawer"
      extra={<Space><span>共 {orders.length} 条</span><Tag color="gold">窗口订单 {w}</Tag><Tag color="blue">附近订单 {n}</Tag></Space>}>
      <Table<EventOrder> size="small" rowKey={(o) => String(o.orderId)} loading={loading} columns={cols} dataSource={orders} pagination={false} scroll={{ x: 1700 }}
        rowClassName={(o) => (o.matchType === 'WINDOW' ? 'row-matched' : o.matchType === 'NEARBY' ? 'row-current' : '')}
        locale={{ emptyText: loading ? '正在查询该门店当天至次日 03:00 前的订单…' : '该门店当天至次日 03:00 前暂无订单' }} />
      <Modal title="订单详情" open={!!detail} onCancel={() => setDetail(null)} footer={null} width={720}>
        {detail && (
          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="订单号">{dash(detail.orderNo)}</Descriptions.Item><Descriptions.Item label="订单ID">{dash(detail.orderId)}</Descriptions.Item>
            <Descriptions.Item label="服务项目">{dash(detail.serviceItemName)}</Descriptions.Item><Descriptions.Item label="金额">{money(detail.orderAmount)}</Descriptions.Item>
            <Descriptions.Item label="发型师">{dash(detail.craftsmanName)}</Descriptions.Item><Descriptions.Item label="工号 / 英文名">{dash(detail.craftsmanEmployeeNo)} / {dash(detail.craftsmanNickName)}</Descriptions.Item>
            <Descriptions.Item label="排队号">{dash(detail.queuedNo)}</Descriptions.Item><Descriptions.Item label="订单状态">{dash(detail.orderStatus)}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{fmtTime(detail.orderCreateTime)}</Descriptions.Item><Descriptions.Item label="开始时间">{fmtTime(detail.serviceStartTime)}</Descriptions.Item>
            <Descriptions.Item label="矫正开始">{fmtTime(detail.correctedStartTime)}</Descriptions.Item><Descriptions.Item label="结束时间">{fmtTime(detail.serviceEndTime)}</Descriptions.Item>
            <Descriptions.Item label="服务时长">{duration(detail.serviceDurationSeconds)}</Descriptions.Item><Descriptions.Item label="矫正时长">{duration(detail.correctedDurationSeconds)}</Descriptions.Item>
            <Descriptions.Item label="总时长">{duration(detail.totalDurationSeconds)}</Descriptions.Item><Descriptions.Item label="匹配类型">{dash(detail.matchType)}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </Drawer>
  );
}
