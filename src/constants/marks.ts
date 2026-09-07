/**
 * 值域与 v2.js labels/secondaryOptions 同源；一级标记 7 个须与后端 WdzAiV2Request @Pattern 同步。
 * 剔分口径在后端（只有无效/重复剔分），前端只做展示。
 */
export const APP = 'UDREAM';
export const DEFAULT_START_DATE = '2026-07-01';
export const DEFAULT_END_DATE = '2026-07-07';

export const RISK_LABELS: Record<string, string> = { HIGH: '高风险', MEDIUM: '中风险', LOW: '低风险', WARNING: '预警' };
export const RISK_COLORS: Record<string, string> = { HIGH: 'red', MEDIUM: 'orange', LOW: 'green', WARNING: 'gold' };
export const REVIEW_LABELS: Record<string, string> = { UNVERIFIED: '未核实', FIRST_REVIEWED: '初核', SECOND_REVIEWED: '复核' };
export const REVIEW_COLORS: Record<string, string> = { UNVERIFIED: 'default', FIRST_REVIEWED: 'blue', SECOND_REVIEWED: 'purple' };
export const PRIMARY_LABELS: Record<string, string> = {
  PRIVATE_ORDER: '私单', NO_RISK: '无风险', INVALID_EVENT: '无效事件', DUPLICATE_EVENT: '重复事件',
  STYLIST_MUTUAL_CUT: '发型师互剪', SHORT_TERM_REWORK: '短时重修', STYLIST_NON_COMPLIANT: '发型师操作不合规',
};
export const ACTION_LABELS: Record<string, string> = { FIRST_REVIEW: '初核', SECOND_REVIEW: '复核', FOLLOW: '跟进', PUNISH: '处罚' };
export const RULE_TYPE_LABELS: Record<string, string> = { EVENT: '私单检测', ORDER: '订单规则', DURATION: '时长规则', COMPOSITE: '组合规则' };
export const APPLICATION_SCOPES: Record<string, string> = { ALL: '全部', DYE: '烫染', HAIRCUT: '剪发' };

export const SECONDARY_OPTIONS: Record<string, string[]> = {
  PRIVATE_ORDER: ['发型师撤单（服务后私下收款）', '用户小程序取消订单（服务后私下收款）', '发型师过号（服务后私下收款）', '发型师修改项目（赚取差价）', '顾客未取号，发型师代取号', '未取号直接服务收取现金', '其他'],
  NO_RISK: ['无风险'],
  INVALID_EVENT: ['设备误识别', '图片无效', '服务行为不完整'],
  DUPLICATE_EVENT: ['重复事件'],
  STYLIST_MUTUAL_CUT: ['发型师互剪'],
  SHORT_TERM_REWORK: ['短时重修'],
  STYLIST_NON_COMPLIANT: ['发型师操作不合规'],
};

export const opts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));
/** 库中烫染事件 service_type 实际存「染发」 */
export const isDyeEvent = (item: { serviceType?: string }) => (item.serviceType || '').trim() === '染发';
