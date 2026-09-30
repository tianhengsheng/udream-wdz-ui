import { useEffect, useMemo, useState } from 'react';
import { Alert, Input, Modal, Radio, Select, Space, message } from 'antd';
import { getRiskEventDetail, listStoreCraftsmen, submitEventReview } from '../../api/wdz';
import { APP, PRIMARY_LABELS, SECONDARY_OPTIONS } from '../../constants/marks';
import { nextReviewType, useDialogs } from '../../store/useDialogs';
import { useFilters } from '../../store/useFilters';
import type { CraftsmanOption, EventOrder, PrimaryMarkType, RiskEvent } from '../../types/wdz';

const SAFE_TYPES = ['NO_RISK', 'INVALID_EVENT', 'DUPLICATE_EVENT', 'STYLIST_MUTUAL_CUT', 'SHORT_TERM_REWORK', 'STYLIST_NON_COMPLIANT'] as const;

/**
 * 标记核实弹窗（对应 v2 openReviewModal/submitReview）。
 * - 私单：二级类型必选 + 归属二选一（关联订单 / 发型师，只发当前模式一侧）+ 备注必填
 * - 无风险类：六种结论，二级取一级同名文案；均可填备注，只有 NO_RISK 必填
 * - 批量归属只支持同门店同一天；否则两侧不可选、不强校验
 * - 按 nextReviewType 分组提交（初核/复核各一次请求），成功后 bumpRefresh 通知各列表
 */
export function ReviewModal() {
  const { reviewEvents: events, reviewModify: modify, close, bumpRefresh } = useDialogs();
  const ruleId = useFilters((s) => s.ruleId);
  const open = !!events?.length;
  const first = events?.[0];

  const [mode, setMode] = useState<'private' | 'safe' | ''>('');
  const [privateType, setPrivateType] = useState('');
  const [safeType, setSafeType] = useState<string>('');
  const [target, setTarget] = useState<'order' | 'craftsman'>('order');
  const [orders, setOrders] = useState<{ label: string; options: EventOrder[] }[]>([]);
  const [craftsmen, setCraftsmen] = useState<CraftsmanOption[]>([]);
  const [orderKey, setOrderKey] = useState<string | undefined>();
  const [craftsmanId, setCraftsmanId] = useState<string | undefined>();
  const [remark, setRemark] = useState('');
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const scoped = useMemo(() => {
    if (!events?.length) return false;
    const scopes = new Set(events.map((e) => `${e.storeName || ''}|${String(e.eventTime || '').slice(0, 10)}`));
    return scopes.size === 1 && events.every((e) => e.storeName && e.eventTime);
  }, [events]);
  // 修改标记沿用原记录的核实类型，不按事件状态推导
  const typeOf = (e: RiskEvent) => modify?.reviewType ?? nextReviewType(e);
  const reviewTypes = useMemo(() => Array.from(new Set((events || []).map(typeOf))), [events, modify]);

  useEffect(() => {
    if (!open || !first) return;
    // 回填存量标记：一级私单→私单模式；其它一级→无风险模式；归属按存量订单/发型师判定
    const p = first.primaryMarkType;
    setMode(p === 'PRIVATE_ORDER' ? 'private' : p ? 'safe' : '');
    setPrivateType(p === 'PRIVATE_ORDER' ? first.secondaryMarkType || '' : '');
    setSafeType(p && p !== 'PRIVATE_ORDER' ? p : '');
    setTarget(first.markedCraftsmanId && !first.markedOrderId && !first.markedOrderNo ? 'craftsman' : 'order');
    setOrderKey(first.markedOrderId ? `窗口内订单:${first.markedOrderId}` : undefined);
    setCraftsmanId(first.markedCraftsmanId ? String(first.markedCraftsmanId) : undefined);
    setRemark(modify?.remark || '');
    setOrders([]); setCraftsmen([]);
    if (!scoped) return;
    setLoadingOpts(true);
    Promise.all([getRiskEventDetail(String(first.eventId), ruleId), listStoreCraftsmen(String(first.eventId), ruleId)])
      .then(([detail, cs]) => {
        // 窗口/附近的判定只认后端算分口径
        setOrders([{ label: '窗口内订单', options: detail?.windowOrders || [] }, { label: '附近时间订单', options: detail?.nearbyOrders || [] }]);
        setCraftsmen(cs || []);
      })
      .catch(() => message.error('订单/发型师加载失败，请重新打开弹窗'))
      .finally(() => setLoadingOpts(false));
  }, [open, first?.eventId]);

  const allOrders = orders.flatMap((g) => g.options);
  const pickedOrder = allOrders.find((o) => String(o.orderId) === (orderKey || '').split(':').pop());
  const pickedCraftsman = craftsmen.find((c) => String(c.craftsmanId) === craftsmanId);
  const needRemark = mode === 'private' || (mode === 'safe' && safeType === 'NO_RISK');
  const showRemark = mode === 'private' || (mode === 'safe' && !!safeType);

  const submit = async () => {
    if (!events?.length) return;
    if (!mode) { message.error('请选择标记私单或标记无风险'); return; }
    let primaryMarkType: PrimaryMarkType; let secondaryMarkType: string;
    if (mode === 'private') {
      primaryMarkType = 'PRIVATE_ORDER'; secondaryMarkType = privateType;
      if (!secondaryMarkType) { message.error('请选择私单类型'); return; }
      if (!remark.trim()) { message.error('备注信息不能为空'); return; }
      if (scoped) {
        if (target === 'order' && !pickedOrder) { message.error('请选择关联订单'); return; }
        if (target === 'craftsman' && !pickedCraftsman) { message.error('请选择发型师'); return; }
      }
    } else {
      if (!safeType) { message.error('请选择无风险类型'); return; }
      primaryMarkType = safeType as PrimaryMarkType; secondaryMarkType = PRIMARY_LABELS[safeType] || '无风险';
      if (safeType === 'NO_RISK' && !remark.trim()) { message.error('备注信息不能为空'); return; }
    }
    const groups = new Map<string, { eventId: string; version?: number }[]>();
    events.forEach((e) => { const t = typeOf(e); if (!groups.has(t)) groups.set(t, []); groups.get(t)!.push({ eventId: String(e.eventId), version: e.version }); });
    const common = {
      app: APP, primaryMarkType, secondaryMarkType, ruleId,
      markedOrderId: target === 'order' && pickedOrder ? String(pickedOrder.orderId) : undefined,
      markedOrderNo: target === 'order' && pickedOrder ? pickedOrder.orderNo : undefined,
      markedCraftsmanId: target === 'craftsman' && pickedCraftsman ? String(pickedCraftsman.craftsmanId) : undefined,
      markedCraftsmanName: target === 'craftsman' && pickedCraftsman ? pickedCraftsman.craftsmanName : undefined,
      remark: showRemark ? remark.trim() || undefined : undefined,
    };
    setSubmitting(true);
    try {
      let ok = 0, fail = 0;
      for (const [reviewType, items] of groups) { const r = await submitEventReview({ ...common, items, reviewType }); ok += r?.successCount || 0; fail += r?.failedCount || 0; }
      (fail ? message.warning : message.success)(`核查完成：成功 ${ok} 条，失败 ${fail} 条`);
      close('review');
      bumpRefresh();
    } catch { /* 拦截器已提示 */ } finally { setSubmitting(false); }
  };

  return (
    <Modal title={modify ? '修改标记' : events && events.length > 1 ? `批量标记核实（${events.length}条）` : '标记核实'} open={open} onCancel={() => close('review')} onOk={submit} okText="确定" confirmLoading={submitting} width={620} destroyOnHidden data-testid="review-modal">
      {events && (
        <Space direction="vertical" size={10} style={{ display: 'flex' }}>
          <div style={{ color: '#666' }}>已选择 {events.length} 个事件：{events.map((e) => `#${e.eventId}`).join('、')}</div>
          <div>核实类型：<b>{reviewTypes.length === 1 ? (reviewTypes[0] === 'SECOND_REVIEW' ? '复核' : '初核') : '按事件当前状态处理'}</b></div>
          <div>选择标记类型 <span style={{ color: 'red' }}>*</span>　
            <Radio.Group data-testid="review-mode" value={mode} onChange={(e) => setMode(e.target.value)} options={[{ label: '标记私单', value: 'private' }, { label: '标记无风险', value: 'safe' }]} />
          </div>
          {mode === 'private' && (
            <>
              <div>私单类型 <span style={{ color: 'red' }}>*</span>　<Select data-testid="review-private-type" style={{ width: 340 }} placeholder="请选择私单类型" value={privateType || undefined} options={SECONDARY_OPTIONS.PRIVATE_ORDER.map((v) => ({ value: v, label: v }))} onChange={setPrivateType} /></div>
              <div>标记归属 <span style={{ color: 'red' }}>*</span>　
                <Radio.Group value={target} onChange={(e) => { setTarget(e.target.value); setOrderKey(undefined); setCraftsmanId(undefined); }} options={[{ label: '按关联订单', value: 'order' }, { label: '按发型师', value: 'craftsman' }]} />
              </div>
              {!scoped && <Alert type="warning" showIcon message="批量标记归属仅支持同一门店同一天的事件，当前不可选择订单及发型师" />}
              {scoped && target === 'order' && (
                <div>关联订单 <span style={{ color: 'red' }}>*</span>　
                  <Select data-testid="review-order" style={{ width: 440 }} loading={loadingOpts} allowClear placeholder={allOrders.length ? '请选择关联订单' : '暂无可关联订单'} value={orderKey}
                    options={orders.filter((g) => g.options.length).map((g) => ({ label: g.label, options: g.options.map((o) => ({ value: `${g.label}:${o.orderId}`, label: `${o.orderNo || '-'} - ${o.craftsmanName || '-'} - ${o.serviceItemName || '-'}` })) }))}
                    onChange={setOrderKey} />
                </div>
              )}
              {scoped && target === 'craftsman' && (
                <div>发型师 <span style={{ color: 'red' }}>*</span>　
                  <Select data-testid="review-craftsman" style={{ width: 300 }} loading={loadingOpts} allowClear showSearch optionFilterProp="label" placeholder={craftsmen.length ? '请选择发型师' : '该门店暂无可选发型师'} value={craftsmanId}
                    options={craftsmen.map((c) => ({ value: String(c.craftsmanId), label: [c.craftsmanName || c.craftsmanRealName || '-', c.employeeNo].filter(Boolean).join(' - ') }))} onChange={setCraftsmanId} />
                </div>
              )}
            </>
          )}
          {mode === 'safe' && (
            <div>选择类型 <span style={{ color: 'red' }}>*</span>　<Select data-testid="review-safe-type" style={{ width: 220 }} placeholder="请选择" value={safeType || undefined} options={SAFE_TYPES.map((v) => ({ value: v, label: PRIMARY_LABELS[v] }))} onChange={setSafeType} /></div>
          )}
          {showRemark && (
            <div>备注信息 {needRemark && <span style={{ color: 'red' }}>*</span>}<Input.TextArea data-testid="review-remark" rows={3} maxLength={500} showCount placeholder={needRemark ? '请输入备注信息' : '选填'} value={remark} onChange={(e) => setRemark(e.target.value)} /></div>
          )}
        </Space>
      )}
    </Modal>
  );
}
