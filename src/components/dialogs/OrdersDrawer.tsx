import { useEffect, useMemo, useState } from 'react';
import { Button, Descriptions, Drawer, Input, Modal, Segmented, Select, Space, Table, Tag, type TableColumnsType } from 'antd';
import { getRiskEventDetail, listStoreDayOrders } from '../../api/wdz';
import { MediaThumb } from '../MediaThumb';
import { openMonitor } from '../../utils/monitor';
import { OrdersTimeline } from './OrdersTimeline';
import { PrimaryTag, ReviewTag, RiskTag } from '../Tags';
import { END_TIME_TITLE, endTimeCell } from '../EndTimeCell';
import { useDialogs } from '../../store/useDialogs';
import { useFilters } from '../../store/useFilters';
import type { EventOrder, RiskEvent } from '../../types/wdz';
import { dash, duration, fmtDate, fmtTime, money } from '../../utils/format';

/** 排队订单抽屉：事件所在门店 当天 00:00~次日 03:00 全量订单（展示口径含已取消），WINDOW/NEARBY 高亮；点订单号看订单详情 */
/** 计算口径状态（后端 CALC_QUEUED_STATUSES 的文案），其余状态只展示、置灰 */
const isCalcStatus = (v?: string) => ['服务中', '待支付', '已支付', '已撤单'].includes(v || '');
/** 排队状态全集（与后端 orderStatus 文案 / QueuedMapper 展示白名单同源），筛选在前端做 */
const ORDER_STATUSES = ['未支付', '排队中', '叫号中', '服务中', '待支付', '已过号', '已支付', '已撤单', '已取消', '已转让', '系统过号'];

export function OrdersDrawer() {
  const { ordersEventId, close } = useDialogs();
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<EventOrder | null>(null);
  const [event, setEvent] = useState<RiskEvent | null>(null);
  // 筛选为前端过滤（接口无筛选参数，与正式后台一致）；draft=输入中，applied=点查询后生效
  const [draft, setDraft] = useState<{ status: string; orderNo: string }>({ status: '', orderNo: '' });
  const [applied, setApplied] = useState(draft);
  // 列表 / 时间轴（只读辅助视图，人工初筛用），保留上次选择
  const [view, setView] = useState<'list' | 'timeline'>('list');
  useEffect(() => {
    if (!ordersEventId) return;
    setLoading(true); setOrders([]); setEvent(null); setDraft({ status: '', orderNo: '' }); setApplied({ status: '', orderNo: '' });
    const ruleId = useFilters.getState().ruleId;
    listStoreDayOrders(ordersEventId, ruleId).then((l) => setOrders(l || [])).catch(() => setOrders([])).finally(() => setLoading(false));
    getRiskEventDetail(ordersEventId, ruleId).then((d) => setEvent(d?.event || null)).catch(() => setEvent(null));
  }, [ordersEventId]);
  const shown = useMemo(() => orders.filter((o) => (!applied.status || o.orderStatus === applied.status) && (!applied.orderNo || String(o.orderNo || '').includes(applied.orderNo.trim()))), [orders, applied]);
  const eventDate = fmtDate(event?.eventTime);
  const cols: TableColumnsType<EventOrder> = [
    { title: '订单号', dataIndex: 'orderNo', width: 160, render: (v, o) => <a onClick={() => setDetail(o)}>{v || '-'}</a> },
    { title: '发型师', dataIndex: 'craftsmanName', width: 80, render: dash }, { title: '工号', dataIndex: 'craftsmanEmployeeNo', width: 80, render: dash },
    { title: '英文名', dataIndex: 'craftsmanNickName', width: 80, render: dash }, { title: '头像', dataIndex: 'craftsmanAvatarUrl', width: 50, render: (v) => <MediaThumb url={v} avatar /> },
    { title: '状态', dataIndex: 'orderStatus', width: 80, render: (v) => <Tag color={v === '已完成' ? 'green' : 'blue'}>{v || '-'}</Tag> },
    { title: '服务项目', dataIndex: 'serviceItemName', width: 160, render: dash }, { title: '金额', dataIndex: 'orderAmount', width: 80, render: money },
    { title: '创建时间', dataIndex: 'orderCreateTime', width: 150, render: fmtTime }, { title: '支付时间', dataIndex: 'payTime', width: 150, render: fmtTime }, { title: '开始时间', dataIndex: 'serviceStartTime', width: 150, render: fmtTime },
    { title: '矫正开始', dataIndex: 'correctedStartTime', width: 150, render: fmtTime }, { title: END_TIME_TITLE, dataIndex: 'serviceEndTime', width: 170, render: (_, o) => endTimeCell(o) },
    { title: '服务时长', dataIndex: 'serviceDurationSeconds', width: 90, render: duration }, { title: '矫正时长', dataIndex: 'correctedDurationSeconds', width: 90, render: duration },
    { title: '总时长', dataIndex: 'totalDurationSeconds', width: 90, render: duration },
  ];
  const w = orders.filter((o) => o.matchType === 'WINDOW').length, n = orders.filter((o) => o.matchType === 'NEARBY').length;
  return (
    <Drawer title={`排队订单 - 事件 #${ordersEventId ?? ''}`} open={!!ordersEventId} onClose={() => close('orders')} width={1100} destroyOnHidden data-testid="orders-drawer"
      extra={<Space><span>共 {orders.length} 条{shown.length !== orders.length ? `（筛出 ${shown.length}）` : ''}</span><Tag color="gold">窗口订单 {w}</Tag><Tag color="blue">附近订单 {n}</Tag></Space>}>
      <Table<RiskEvent> data-testid="orders-event" size="small" rowKey="eventId" pagination={false} dataSource={event ? [event] : []} loading={!event && loading} style={{ marginBottom: 8 }} scroll={{ x: 1000 }} columns={[
        { title: '门店名称', dataIndex: 'storeName', width: 160, render: dash }, { title: '风险', dataIndex: 'riskLevel', width: 80, render: (v) => <RiskTag v={v} /> },
        { title: '事件时间', dataIndex: 'eventTime', width: 150, render: fmtTime }, { title: '工位', dataIndex: 'workName', width: 80, render: dash },
        { title: '类型', key: 'type', width: 70, render: (_, e) => e.serviceType || e.checkType || '-' }, { title: '图片', dataIndex: 'imageUrl', width: 130, render: (v, e) => <Space size={4}><MediaThumb url={v} /><Button type="link" size="small" style={{ padding: 0 }} onClick={() => openMonitor(e)}>查看监控</Button></Space> },
        { title: '标记类型一级', dataIndex: 'primaryMarkType', width: 110, render: (v) => <PrimaryTag v={v} /> }, { title: '标记类型二级', dataIndex: 'secondaryMarkType', width: 130, render: dash },
        { title: '标记次数', dataIndex: 'markCount', width: 80, align: 'center', render: (v) => v || 0 }, { title: '核实状态', dataIndex: 'reviewStatus', width: 80, render: (v) => <ReviewTag v={v} /> },
      ]} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, whiteSpace: 'nowrap' }}>
        <span style={{ color: '#666' }}>事件 #{ordersEventId} · {eventDate === '-' ? '' : `${eventDate} 00:00 ~ 次日 03:00`}</span>
        <Tag color="gold" style={{ marginLeft: 8 }}>窗口内订单</Tag><Tag color="blue">附近时间订单</Tag>
        <Segmented data-testid="orders-view" size="small" value={view} onChange={(v) => setView(v as 'list' | 'timeline')} options={[{ label: '列表', value: 'list' }, { label: '时间轴', value: 'timeline' }]} />
        <span style={{ marginLeft: 'auto' }}>订单状态</span>
        <Select data-testid="orders-status" allowClear placeholder="全部" style={{ width: 120 }} value={draft.status || undefined} options={ORDER_STATUSES.map((v) => ({ value: v, label: v }))} onChange={(v) => setDraft({ ...draft, status: v || '' })} />
        <span>订单号</span>
        <Input data-testid="orders-orderNo" allowClear style={{ width: 200 }} value={draft.orderNo} onChange={(e) => setDraft({ ...draft, orderNo: e.target.value })} onPressEnter={() => setApplied(draft)} />
        <Button type="primary" data-testid="orders-search" onClick={() => setApplied(draft)}>查询</Button>
        <Button data-testid="orders-reset" onClick={() => { const empty = { status: '', orderNo: '' }; setDraft(empty); setApplied(empty); }}>重置</Button>
      </div>
      {view === 'timeline' && <OrdersTimeline orders={shown} ordersLoading={loading} event={event} onOrderClick={setDetail} />}
      {view === 'list' && <Table<EventOrder> size="small" rowKey={(o) => `${o.orderId}|${o.orderStatus || ''}|${o.queuedNo || ''}`} loading={loading} columns={cols} dataSource={shown} pagination={false} scroll={{ x: 1700 }}
        rowClassName={(o) => (o.matchType === 'WINDOW' ? 'row-matched' : o.matchType === 'NEARBY' ? 'row-current' : isCalcStatus(o.orderStatus) ? '' : 'row-nocalc')}
        locale={{ emptyText: loading ? '正在查询该门店当天至次日 03:00 前的订单…' : '该门店当天至次日 03:00 前暂无订单' }} />}
      <Modal title="订单详情" open={!!detail} onCancel={() => setDetail(null)} footer={null} width={720}>
        {detail && (
          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="订单号">{dash(detail.orderNo)}</Descriptions.Item><Descriptions.Item label="订单ID">{dash(detail.orderId)}</Descriptions.Item>
            <Descriptions.Item label="服务项目">{dash(detail.serviceItemName)}</Descriptions.Item><Descriptions.Item label="金额">{money(detail.orderAmount)}</Descriptions.Item>
            <Descriptions.Item label="发型师">{dash(detail.craftsmanName)}</Descriptions.Item><Descriptions.Item label="工号 / 英文名">{dash(detail.craftsmanEmployeeNo)} / {dash(detail.craftsmanNickName)}</Descriptions.Item>
            <Descriptions.Item label="排队号">{dash(detail.queuedNo)}</Descriptions.Item><Descriptions.Item label="订单状态">{dash(detail.orderStatus)}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{fmtTime(detail.orderCreateTime)}</Descriptions.Item><Descriptions.Item label="开始时间">{fmtTime(detail.serviceStartTime)}</Descriptions.Item>
            <Descriptions.Item label="矫正开始">{fmtTime(detail.correctedStartTime)}</Descriptions.Item><Descriptions.Item label={END_TIME_TITLE}>{endTimeCell(detail)}</Descriptions.Item>
            <Descriptions.Item label="服务时长">{duration(detail.serviceDurationSeconds)}</Descriptions.Item><Descriptions.Item label="矫正时长">{duration(detail.correctedDurationSeconds)}</Descriptions.Item>
            <Descriptions.Item label="总时长">{duration(detail.totalDurationSeconds)}</Descriptions.Item><Descriptions.Item label="匹配类型">{dash(detail.matchType)}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </Drawer>
  );
}
