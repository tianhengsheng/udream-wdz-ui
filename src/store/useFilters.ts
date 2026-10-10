import { create } from 'zustand';
import { listBehaviorRuleOptions } from '../api/wdz';
import { APP, DEFAULT_END_DATE, DEFAULT_START_DATE } from '../constants/marks';
import type { ApplicationScope, EventScope, PageRiskEventReq, PrimaryMarkType, ReviewStatus, RiskLevel } from '../types/wdz';
import type { AreaValue } from '../components/AreaCascade';

/** 私单风险三个页签共用的一份筛选参数（1015：切页签保留已选条件）；各页签只发送自己界面上有的字段。 */
export interface RiskFilter {
  applicationScope: ApplicationScope;
  area: AreaValue;
  storeName: string;
  riskLevels: RiskLevel[];
  reviewStatus: ReviewStatus | '';
  primaryMarkType: PrimaryMarkType | '';
  secondaryMarkType: string;
  eventId: string;
  orderNo: string;
  startDate: string | null;
  endDate: string | null;
  eventScope: EventScope;
  /** 批量核查独有字段，共用同一份以便切页签保留 */
  lastOperatorName: string;
  lastMarkStartDate: string | null;
  lastMarkEndDate: string | null;
  sortField: string | null;
  sortOrder: 'asc' | 'desc';
  pageNum: number;
  pageSize: number;
}

export const DEFAULT_RISK_FILTER: RiskFilter = {
  applicationScope: 'ALL', area: {}, storeName: '', riskLevels: ['HIGH', 'MEDIUM'], reviewStatus: '', primaryMarkType: '', secondaryMarkType: '',
  eventId: '', orderNo: '', startDate: DEFAULT_START_DATE, endDate: DEFAULT_END_DATE, eventScope: 'HIT_ONLY',
  lastOperatorName: '', lastMarkStartDate: null, lastMarkEndDate: null,
  sortField: null, sortOrder: 'desc', pageNum: 1, pageSize: 20,
};

interface FilterState {
  risk: RiskFilter;
  /** 当前应用范围下的默认规则 id（listBehaviorRuleOptions 取 isDefault），随范围切换刷新 */
  ruleId: string | null;
  setRisk: (patch: Partial<RiskFilter>) => void;
  resetRisk: () => void;
  changeScope: (scope: ApplicationScope) => Promise<void>;
  loadRule: () => Promise<void>;
}

export const useFilters = create<FilterState>()((set, get) => ({
  risk: DEFAULT_RISK_FILTER,
  ruleId: null,
  setRisk: (patch) => set((s) => ({ risk: { ...s.risk, ...patch } })),
  resetRisk: () => set((s) => ({ risk: { ...DEFAULT_RISK_FILTER, applicationScope: s.risk.applicationScope } })),
  changeScope: async (scope) => {
    set((s) => ({ risk: { ...s.risk, applicationScope: scope, pageNum: 1 } }));
    await get().loadRule();
  },
  loadRule: async () => {
    try {
      const list = (await listBehaviorRuleOptions(get().risk.applicationScope)) || [];
      const target = list.find((r) => r.isDefault) || list[0];
      set({ ruleId: target ? String(target.id) : null });
    } catch {
      set({ ruleId: null });
    }
  },
}));

/** 是否存在事件级筛选：决定「事件展示范围」控件是否可见（无事件筛选时命中数恒等事件数） */
export const hasEventFilter = (f: RiskFilter) =>
  !!(f.eventId.trim() || f.orderNo.trim() || f.reviewStatus || f.primaryMarkType || f.secondaryMarkType || f.riskLevels.length);

export function riskPayload(f: RiskFilter, ruleId: string | null): PageRiskEventReq {
  return {
    app: APP, pageNum: f.pageNum, pageSize: f.pageSize, ruleId, applicationScope: f.applicationScope,
    sortField: f.sortField, sortOrder: f.sortOrder, eventScope: hasEventFilter(f) ? f.eventScope : 'HIT_ONLY',
    city: f.area.city ?? null, cityManagerId: f.area.cityManagerId ?? null, orgIds: f.area.orgIds ?? null,
    storeName: f.storeName.trim() || null, riskLevels: f.riskLevels, reviewStatus: f.reviewStatus,
    primaryMarkType: f.primaryMarkType, secondaryMarkType: f.secondaryMarkType,
    // eventId 保持字符串（后端 Long 反序列化接受数字字符串）
    eventId: f.eventId.trim().replace(/^#/, '') || null, orderNo: f.orderNo.trim() || null,
    startDate: f.startDate, endDate: f.endDate,
  };
}
