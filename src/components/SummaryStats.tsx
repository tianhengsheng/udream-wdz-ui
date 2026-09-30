import { Card, Space } from 'antd';
import type { RiskSummary } from '../types/wdz';

const Item = ({ label, value, color }: { label: string; value: unknown; color?: string }) => (
  <span style={{ marginRight: 14 }}>{label}：<b style={{ color, fontSize: 14 }}>{Number(value) || 0}</b></span>
);

/** 风险分布 + 检出概况（1015：右侧改检出概况，三个页签同一实时口径） */
export function SummaryStats({ s, extra }: { s?: RiskSummary | null; extra?: React.ReactNode }) {
  const v = s || ({} as RiskSummary);
  return (
    <Space size={8} wrap style={{ marginBottom: 8 }} data-testid="summary">
      {extra}
      <Card size="small" title="风险分布" style={{ minWidth: 420 }}>
        <Item label="高风险" value={v.highCount} color="#cf1322" /><Item label="中风险" value={v.mediumCount} color="#d46b08" />
        <Item label="低风险" value={v.lowCount} color="#389e0d" /><Item label="预警" value={v.warningCount} color="#d4b106" />
        <Item label="事件总数" value={v.totalCount} />
      </Card>
      <Card size="small" title="检出概况" style={{ minWidth: 520 }} data-testid="detect-summary">
        <Item label="检出数" value={v.detectedCount} color="#cf1322" /><Item label="核对数" value={v.reviewedCount} color="#1677ff" />
        <Item label="无风险" value={v.noRiskCount} color="#389e0d" /><Item label="私单" value={v.privateOrderCount} color="#d46b08" />
        <Item label="重复" value={v.duplicateEventCount} /><Item label="无效" value={v.invalidEventCount} /><Item label="操作不合规" value={v.nonCompliantCount} /><Item label="互剪" value={v.mutualCutCount} /><Item label="重修" value={v.shortTermReworkCount} />
      </Card>
    </Space>
  );
}
