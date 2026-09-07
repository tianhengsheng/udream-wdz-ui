import { Card, Space } from 'antd';
import type { RiskSummary } from '../types/wdz';

const Item = ({ label, value, color }: { label: string; value: unknown; color?: string }) => (
  <span style={{ marginRight: 14 }}>{label}：<b style={{ color, fontSize: 14 }}>{Number(value) || 0}</b></span>
);

/** 风险分布 + 标记概况（与 v2 statsMarkup 同口径） */
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
      <Card size="small" title="标记概况" style={{ minWidth: 300 }}>
        <Item label="人工标记无风险" value={v.safeCount} color="#389e0d" /><Item label="人工标记私单" value={v.privateOrderCount} color="#cf1322" /><Item label="未标记" value={v.unmarkedCount} />
      </Card>
    </Space>
  );
}
