/** WdzAiV2Controller 31 个端点一处集中。GET 用 params，POST 用 JSON。 */
import { http } from './client';
import { pick } from './common';
import type { PageResp, Resp } from '../types';
import type * as T from '../types/wdz';
import { APP } from '../constants/marks';

const BASE = '/unified/apiUnified/wdzAi';

async function get<R>(path: string, params?: object): Promise<R> {
  const res = await http.get<Resp<R>>(`${BASE}/${path}`, { params });
  return pick(res.data) as R;
}
async function post<R>(path: string, body: unknown): Promise<R> {
  const res = await http.post<Resp<R>>(`${BASE}/${path}`, body);
  return pick(res.data) as R;
}
export interface Page<R> { records: R[]; total: number; pageNum: number; pageSize: number }
async function postPage<R>(path: string, body: unknown): Promise<Page<R>> {
  const res = await http.post<PageResp<R>>(`${BASE}/${path}`, body);
  const b = res.data;
  const page = b.page || b.pageInfo || {};
  return { records: (b.result ?? b.data ?? []) as R[], total: page.total ?? 0, pageNum: page.pageNum ?? page.current ?? 1, pageSize: page.pageSize ?? 20 };
}

// 区域三级联动 / 规则下拉
export const listAreaCities = () => get<T.AreaOption[]>('listAreaCities');
export const listAreaCityManagers = (cityId: string) => get<T.AreaOption[]>('listAreaCityManagers', { cityId });
export const listAreaOrgs = (cityManagerId: string) => get<T.AreaOption[]>('listAreaOrgs', { cityManagerId });
export const listBehaviorRuleOptions = (applicationScope?: string) => get<T.RuleOption[]>('listBehaviorRuleOptions', { app: APP, applicationScope });

// 私单风险列表 / 排行 / 批量
export const pageRiskEvents = (req: T.PageRiskEventReq) => postPage<T.RiskWindow>('pageRiskEvents', req);
export const pageRiskEventItems = (req: T.PageRiskEventReq) => postPage<T.RiskEvent>('pageRiskEventItems', req);
export const getRiskSummary = (req: T.PageRiskEventReq) => post<T.RiskSummary>('getRiskSummary', req);
export const pageStoreRanking = (req: T.PageRiskEventReq) => postPage<T.StoreRanking>('pageStoreRanking', req);
export const getStoreRankingSummary = (req: T.PageRiskEventReq) => post<T.RiskSummary>('getStoreRankingSummary', req);

// 导出（后端 @AsyncExport 走任务中心，GET 传筛选）
const exportGet = (path: string, req: object) => get<unknown>(path, req as Record<string, unknown>);
export const exportRiskEvents = (req: T.PageRiskEventReq) => exportGet('exportRiskEvents', req );
export const exportStoreRanking = (req: T.PageRiskEventReq) => exportGet('exportStoreRanking', req );
export const exportBatchEvents = (req: T.PageRiskEventReq) => exportGet('exportBatchEvents', req );
export const exportEventQueueEvents = (req: T.PageRiskEventReq) => exportGet('exportEventQueueEvents', req );
export const exportReviewRecords = (req: T.PageReviewRecordReq) => exportGet('exportReviewRecords', req );

// 事件详情 / 订单 / 发型师 / 打卡
export const getRiskEventDetail = (eventId: string, ruleId?: string | null) => get<T.EventDetail>('getRiskEventDetail', { app: APP, eventId, ruleId: ruleId ?? undefined });
export const listStoreDayOrders = (eventId: string, ruleId?: string | null) => get<T.EventOrder[]>('listStoreDayOrders', { app: APP, eventId, ruleId: ruleId ?? undefined });
export const listStoreCraftsmen = (eventId: string, ruleId?: string | null) => get<T.CraftsmanOption[]>('listStoreCraftsmen', { app: APP, eventId, ruleId: ruleId ?? undefined });
export const listEventAttendance = (eventId: string) => get<T.AttendanceRecord[]>('listEventAttendance', { app: APP, eventId });

// 标记 / 处理状态 / 核查日志
export const submitEventReview = (req: T.SubmitReviewReq) => post<T.BatchReviewResult>('submitEventReview', req);
export const updateEventBusinessStatus = (req: T.UpdateBusinessStatusReq) => post<T.BatchReviewResult>('updateEventBusinessStatus', req);
export const pageReviewRecords = (req: T.PageReviewRecordReq) => postPage<T.ReviewRecord>('pageReviewRecords', req);

// 行为权重规则 / 配置版本 / 维护
export const pageBehaviorRules = (req: T.PageRuleReq) => postPage<T.BehaviorRule>('pageBehaviorRules', req);
export const saveBehaviorRule = (req: T.SaveRuleReq) => post<T.BehaviorRule>('saveBehaviorRule', req);
export const updateBehaviorRuleStatus = (id: string, enabled: boolean, version?: number) => post<T.BehaviorRule>('updateBehaviorRuleStatus', { app: APP, id, enabled, version });
export const setDefaultBehaviorRule = (id: string) => post<T.BehaviorRule>('setDefaultBehaviorRule', { app: APP, id });
export const runBehaviorRuleDetection = (ruleId: string, startDate: string, endDate: string, storeName?: string) => post<T.RuleDetectionResult>('runBehaviorRuleDetection', { app: APP, ruleId, startDate, endDate, storeName });
export const saveV2DetectionConfigVersion = (body: { id?: string | null; versionName: string; configJson: string; remark?: string; isDefault?: boolean }) => post<T.DetectionConfigVersion>('saveV2DetectionConfigVersion', { app: APP, ...body });
export const listV2DetectionConfigVersions = () => get<T.DetectionConfigVersion[]>('listV2DetectionConfigVersions', { app: APP });
export const setDefaultV2DetectionConfigVersion = (id: string) => post<T.DetectionConfigVersion>('setDefaultV2DetectionConfigVersion', { app: APP, id });
export const refreshDetectionResults = (startDate: string, endDate: string, storeName?: string) => post<T.RefreshDetectionResult>('refreshDetectionResults', { app: APP, startDate, endDate, storeName });
export const cleanStoreDayData = (cleanDate: string, storeIds: string[], dryRun: boolean) => post<T.CleanStoreDayResult>('cleanStoreDayData', { cleanDate, storeIds, dryRun });

// V1 端点，但 V2 页面「查看监控」也用它：按门店/设备/事件定位到事件前 30 秒的监控 h5 地址
export const getLegacyDeviceVideoUrl = (storeName: string, deviceId?: string, eventId?: string) => get<string>('getLegacyDeviceVideoUrl', { storeName, deviceId, eventId });
