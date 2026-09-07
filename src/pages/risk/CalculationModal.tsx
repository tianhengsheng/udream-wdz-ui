import { useEffect, useState } from 'react';
import { Button, Card, Descriptions, Modal, Space, Table, Tag, type TableColumnsType } from 'antd';
import { getRiskEventDetail } from '../../api/wdz';
import { DyeTag, PrimaryTag, ReviewTag, RiskTag } from '../../components/Tags';
import { MediaThumb } from '../../components/MediaThumb';
import { useFilters } from '../../store/useFilters';
import { useDialogs } from '../../store/useDialogs';
import { openMonitor } from '../../utils/monitor';
import type { EventDetail, EventOrder, RiskEvent } from '../../types/wdz';
import { dash, duration, fmtTime, money, num } from '../../utils/format';

const orderCols: TableColumnsType<EventOrder> = [
  { title: '订单号', dataIndex: 'orderNo', width: 160, render: dash },
  { title: '发型师', dataIndex: 'craftsmanName', width: 80, render: dash },
  { title: '英文名', dataIndex: 'craftsmanNickName', width: 80, render: dash },
  { title: '工号', dataIndex: 'craftsmanEmployeeNo', width: 80, render: dash },
  { title: '头像', dataIndex: 'craftsmanAvatarUrl', width: 50, render: (v) => <MediaThumb url={v} avatar /> },
  { title: '状态', dataIndex: 'orderStatus', width: 80, render: dash },
  { title: '服务项目', dataIndex: 'serviceItemName', width: 160, render: dash },
  { title: '金额', dataIndex: 'orderAmount', width: 80, render: money },
  { title: '创建时间', dataIndex: 'orderCreateTime', width: 150, render: fmtTime },
  { title: '开始时间', dataIndex: 'serviceStartTime', width: 150, render: fmtTime },
  { title: '矫正开始', dataIndex: 'correctedStartTime', width: 150, render: fmtTime },
  { title: '结束时间', dataIndex: 'serviceEndTime', width: 150, render: fmtTime },
  { title: '服务时长', dataIndex: 'serviceDurationSeconds', width: 90, render: duration },
  { title: '矫正时长', dataIndex: 'correctedDurationSeconds', width: 90, render: duration },
  { title: '总时长', dataIndex: 'totalDurationSeconds', width: 90, render: duration },
  { title: '权重系数', dataIndex: 'weightFactor', width: 80, render: (v) => num(v) },
];

/** 事件详情 / 计算过程弹窗（对应 v2 openDetail → openCalculationModal）：数据收集 → 统计分析 → 评分计算过程 */
export function CalculationModal() {
  const { detailEventId: eventId, close, refreshTick, openReview, openRecords, openAttendance } = useDialogs();
  const onClose = () => close('detail');
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(false);
  // 标记后不关弹窗：refreshTick 变化按当前事件重拉详情原位重渲染（评分/标记为重算后结果）
  useEffect(() => {
    if (!eventId) { setDetail(null); return; }
    setLoading(true);
    getRiskEventDetail(eventId, useFilters.getState().ruleId).then(setDetail).catch(() => setDetail(null)).finally(() => setLoading(false));
  }, [eventId, refreshTick]);

  const item = detail?.event;
  const ex = !!item?.excluded;
  const v = (x: unknown) => (ex ? '-' : num(x));
  const aiCount = ex ? '-' : dash(item?.aiEventCount);
  const windowEvents = detail?.windowEvents?.length ? detail.windowEvents : item ? [item] : [];
  const windowText = detail?.windowStart ? `${fmtTime(detail.windowStart).slice(11, 16)} - ${fmtTime(detail.windowEnd).slice(11, 16)}` : '-';

  const evCols: TableColumnsType<RiskEvent> = [
    { title: '风险', dataIndex: 'riskLevel', width: 70, render: (x) => <RiskTag v={x} /> },
    { title: '事件ID', dataIndex: 'eventId', width: 170, render: (x) => <span style={{ fontFamily: 'monospace' }}>#{x}</span> },
    { title: '事件类型', key: 'dye', width: 100, render: (_, e) => <DyeTag item={e} /> },
    { title: '时间', dataIndex: 'eventTime', width: 150, render: fmtTime },
    { title: '工位', dataIndex: 'workName', width: 90, render: dash },
    { title: '类型', key: 'type', width: 90, render: (_, e) => e.serviceType || e.checkType || '-' },
    { title: '图片', dataIndex: 'imageUrl', width: 60, render: (x) => <MediaThumb url={x} /> },
    { title: '标记记录', key: 'mk', width: 70, render: (_, e) => (e.primaryMarkType ? '已标记' : '未标记') },
    { title: '标记次数', dataIndex: 'markCount', width: 70, render: (x) => x || 0 },
    { title: '核实类型', dataIndex: 'reviewStatus', width: 80, render: (x) => <ReviewTag v={x} /> },
    { title: '标记类型一级', dataIndex: 'primaryMarkType', width: 100, render: (x) => <PrimaryTag v={x} /> },
    { title: '标记类型二级', dataIndex: 'secondaryMarkType', width: 140, render: dash },
    { title: '标记订单', dataIndex: 'markedOrderNo', width: 150, render: dash },
    { title: '标记发型师', dataIndex: 'markedCraftsmanName', width: 90, render: dash },
    { title: '操作', key: 'op', fixed: 'right', width: 280, render: (_, e) => (
      <Space size={0} split={<span style={{ color: '#ddd' }}>|</span>}>
        <Button type="link" size="small" onClick={() => openMonitor(e)}>查看监控</Button>
        <Button type="link" size="small" onClick={() => document.querySelector('[data-testid="calc-score"]')?.scrollIntoView({ behavior: 'smooth' })}>查看评分</Button>
        <Button type="link" size="small" data-testid={`calc-review-${e.eventId}`} onClick={() => openReview([e])}>标记私单/无风险</Button>
        <Button type="link" size="small" onClick={() => openRecords(String(e.eventId))}>操作记录</Button>
      </Space>
    ) },
  ];

  return (
    <Modal title={`事件详情 / 计算过程${item ? ` - #${item.eventId}` : ''}`} open={!!eventId} onCancel={onClose} footer={null} width={1280} destroyOnHidden loading={loading} data-testid="calc-modal">
      {item && (
        <Space direction="vertical" size={8} style={{ display: 'flex' }}>
          <Card size="small" title="数据收集 · 基础信息">
            <Descriptions size="small" column={3}>
              <Descriptions.Item label="门店名称">{dash(item.storeName)}</Descriptions.Item>
              <Descriptions.Item label="时间窗口">{windowText}</Descriptions.Item>
              <Descriptions.Item label="窗口开始时间">{fmtTime(detail?.windowStart || item.eventTime)}</Descriptions.Item>
              <Descriptions.Item label="普通AI事件数">{dash(detail?.normalEventCount)}</Descriptions.Item>
              <Descriptions.Item label="烫染AI事件数">{dash(detail?.dyeEventCount)}</Descriptions.Item>
              <Descriptions.Item label="风险等级"><RiskTag v={item.riskLevel} /></Descriptions.Item>
            </Descriptions>
          </Card>
          <Card size="small" title={`AI事件详情（${item.primaryMarkType ? '已标记' : '未标记'}）· 评分按整个窗口计算，当前事件高亮`} extra={<Button size="small" onClick={() => openAttendance(String(item.eventId))}>查询当天打卡记录</Button>}>
            <Table<RiskEvent> size="small" rowKey="eventId" columns={evCols} dataSource={windowEvents} pagination={false} scroll={{ x: 1800 }}
              rowClassName={(e) => (String(e.eventId) === String(item.eventId) ? 'row-current' : '')} />
          </Card>
          <Card size="small" title={<span>窗口内订单 <Tag>实时查询</Tag></span>}>
            <Table<EventOrder> size="small" rowKey={(o) => String(o.orderId)} columns={orderCols} dataSource={detail?.windowOrders || []} pagination={false} scroll={{ x: 1800 }} locale={{ emptyText: '实时订单库未匹配到窗口内订单' }} />
          </Card>
          <Card size="small" title={<span>附近时间订单 <Tag>实时查询</Tag></span>}>
            <Table<EventOrder> size="small" rowKey={(o) => String(o.orderId)} columns={orderCols} dataSource={detail?.nearbyOrders || []} pagination={false} scroll={{ x: 1800 }} locale={{ emptyText: '实时订单库未匹配到附近时间订单' }} />
          </Card>
          <Card size="small" title="数据统计分析">
            <Descriptions size="small" column={4}>
              <Descriptions.Item label="窗口内事件数">{aiCount} 个</Descriptions.Item>
              <Descriptions.Item label="共同差异">{v(item.commonDifference)}</Descriptions.Item>
              <Descriptions.Item label="评分">{v(item.riskScore)} 分</Descriptions.Item>
              <Descriptions.Item label="窗口内订单数">{detail?.windowOrders?.length ?? 0} 个</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card size="small" title="评分计算过程" data-testid="calc-score">
            <Descriptions size="small" column={4} style={{ marginBottom: 8 }}>
              <Descriptions.Item label="AI事件数">{aiCount}</Descriptions.Item>
              <Descriptions.Item label="窗口订单数">{v(item.windowOrderCount)}</Descriptions.Item>
              <Descriptions.Item label="附近订单（加权）">{v(item.nearbyOrderWeightedCount)}</Descriptions.Item>
              <Descriptions.Item label="共同差异">{v(item.commonDifference)}</Descriptions.Item>
            </Descriptions>
            <div style={{ fontFamily: 'monospace', lineHeight: 1.8, background: '#fafafa', padding: 8, borderRadius: 4 }}>
              {ex ? (
                <div>该事件已被人工标记为无效/重复，不参与计分，窗口总分已剔除此事件</div>
              ) : (
                <>
                  <div>AI事件数={aiCount}，窗口订单数={v(item.windowOrderCount)}，附近订单加权={v(item.nearbyOrderWeightedCount)}</div>
                  <div>窗口差异=max(0, {aiCount}-{v(item.windowOrderCount)})={v(item.windowDifference)}</div>
                  <div>附近缺口=max(0, {aiCount}-{v(item.nearbyOrderWeightedCount)})={v(item.nearbyGap)}</div>
                  <div>共同差异=min({v(item.windowDifference)}, {v(item.nearbyGap)})={v(item.commonDifference)}</div>
                  <div>窗口差异得分={v(item.windowDifferenceScore)}　附近缺口得分={v(item.nearbyGapScore)}　共同差异得分={v(item.commonDifferenceScore)}</div>
                  <div>总分={v(item.windowDifferenceScore)}+{v(item.nearbyGapScore)}+{v(item.commonDifferenceScore)}=<b>{v(item.riskScore)}</b></div>
                </>
              )}
            </div>
            <div style={{ marginTop: 8 }}>总评分：<b>{ex ? '-' : `${num(item.riskScore)}分`}</b>　风险等级：<RiskTag v={item.riskLevel} />　配置版本：{dash(item.configVersion)}　检测时间：{fmtTime(item.detectedAt)}</div>
          </Card>
        </Space>
      )}
    </Modal>
  );
}
