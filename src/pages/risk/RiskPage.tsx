import { useState } from 'react';
import { Tabs } from 'antd';
import { RiskListTab } from './RiskListTab';
import { StoreRankingTab } from './StoreRankingTab';
import { BatchReviewTab } from './BatchReviewTab';

/** 私单AI行为检测：三个页签共享应用范围/默认规则（useFilters） */
export function RiskPage() {
  const [tab, setTab] = useState('events');
  return (
    <div style={{ padding: 12 }}>
      <h2 style={{ margin: '0 0 8px' }}>私单AI行为检测 <span style={{ color: '#999', fontSize: 12, fontWeight: 400 }}>按门店和时间窗口汇总 AI 事件，展开后进行核查与标记</span></h2>
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'events', label: '私单风险列表', children: <RiskListTab active={tab === 'events'} /> },
        { key: 'ranking', label: '门店排行', children: <StoreRankingTab active={tab === 'ranking'} /> },
        { key: 'batch', label: '批量核查', children: <BatchReviewTab active={tab === 'batch'} /> },
      ]} />
    </div>
  );
}
