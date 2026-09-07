import { useEffect, useState } from 'react';
import { Alert, DatePicker, Modal, message } from 'antd';
import dayjs from 'dayjs';
import { runBehaviorRuleDetection } from '../../api/wdz';
import { DEFAULT_START_DATE } from '../../constants/marks';
import { useDialogs } from '../../store/useDialogs';
import type { BehaviorRule, RuleDetectionResult } from '../../types/wdz';

/** 执行规则监测：按规则重算区间内已入库事件（门店×日期串行，一天约 5 分钟，默认单日）；完成后 bumpRefresh 刷新列表 */
export function RuleDetectionModal({ rule, onClose }: { rule: BehaviorRule | null; onClose: () => void }) {
  const [range, setRange] = useState<[string, string]>([DEFAULT_START_DATE, DEFAULT_START_DATE]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RuleDetectionResult | null>(null);
  const bump = useDialogs((s) => s.bumpRefresh);
  useEffect(() => { if (rule) { setRange([DEFAULT_START_DATE, DEFAULT_START_DATE]); setResult(null); } }, [rule?.id]);
  const run = async () => {
    if (!rule) return;
    if (range[0] > range[1]) { message.error('开始日期不能晚于结束日期'); return; }
    setRunning(true);
    try {
      const r = await runBehaviorRuleDetection(String(rule.id), range[0], range[1]);
      setResult(r);
      (r?.failedCount ? message.warning : message.success)('规则监测完成');
      bump();
    } catch { /* */ } finally { setRunning(false); }
  };
  return (
    <Modal title="执行规则监测" open={!!rule} onCancel={onClose} onOk={run} okText={running ? '监测中...' : '开始监测'} confirmLoading={running} destroyOnHidden data-testid="detect-modal">
      <p>当前规则：<b>{rule?.ruleName}</b></p>
      <p>监测数据时间：<DatePicker.RangePicker data-testid="detect-range" allowClear={false} value={[dayjs(range[0]), dayjs(range[1])]} onChange={(v) => v?.[0] && v?.[1] && setRange([v[0].format('YYYY-MM-DD'), v[1].format('YYYY-MM-DD')])} /></p>
      <p style={{ color: '#999' }}>按所选规则重新计算该日期范围内已入库的事件；单次最多 31 天。重算是门店×日期串行，一天约 400 家门店要 5 分钟。</p>
      {result && <Alert type={result.failedCount ? 'warning' : 'success'} showIcon message={`监测完成：共 ${result.scopeCount || 0} 个门店日期范围，成功 ${result.successCount || 0} 个，失败 ${result.failedCount || 0} 个，生成或更新 ${result.eventCount || 0} 条事件规则评分。`} description={result.failedScopes?.length ? result.failedScopes.join('，') : undefined} />}
    </Modal>
  );
}
