import { Tag } from 'antd';
import { PRIMARY_LABELS, REVIEW_COLORS, REVIEW_LABELS, RISK_COLORS, RISK_LABELS, isDyeEvent } from '../constants/marks';

/** EXCLUDED 为人工剔除不计分口径，与其他计算列一样展示 "-" */
export const RiskTag = ({ v }: { v?: string }) => (v && v !== 'EXCLUDED' ? <Tag color={RISK_COLORS[v]}>{RISK_LABELS[v] || v}</Tag> : <>-</>);
export const ReviewTag = ({ v }: { v?: string }) => <Tag color={REVIEW_COLORS[v || 'UNVERIFIED']}>{REVIEW_LABELS[v || 'UNVERIFIED'] || v}</Tag>;
export const PrimaryTag = ({ v }: { v?: string }) => (v ? <Tag color={v === 'PRIVATE_ORDER' ? 'red' : v === 'NO_RISK' ? 'green' : 'default'}>{PRIMARY_LABELS[v] || v}</Tag> : <>-</>);
export const DyeTag = ({ item }: { item: { serviceType?: string } }) => (isDyeEvent(item) ? <Tag color="orange">烫染AI事件</Tag> : <Tag>普通AI事件</Tag>);
