/**
 * 字段名严格对齐后端 WdzAiV2VO / WdzAiV2Request。
 * 红线：eventId / storeId / orgId / orderId / craftsmanId 等 19 位 id 一律 string，禁 Number()。
 */
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'WARNING' | 'EXCLUDED';
export type ReviewStatus = 'UNVERIFIED' | 'FIRST_REVIEWED' | 'SECOND_REVIEWED';
export type ApplicationScope = 'ALL' | 'DYE' | 'HAIRCUT';
export type PrimaryMarkType =
  | 'PRIVATE_ORDER' | 'NO_RISK' | 'INVALID_EVENT' | 'DUPLICATE_EVENT'
  | 'STYLIST_MUTUAL_CUT' | 'SHORT_TERM_REWORK' | 'STYLIST_NON_COMPLIANT';
export type EventScope = 'HIT_ONLY' | 'ALL';

export interface AreaOption { id: string; name: string }
export interface RuleOption { id: string; ruleCode: string; ruleName: string; isDefault: boolean; applicationScope: ApplicationScope }

export interface RiskSummary {
  totalCount: number; highCount: number; mediumCount: number; lowCount: number; warningCount: number;
  unverifiedCount: number; privateOrderCount: number; safeCount: number; unmarkedCount: number;
  dataUpdateTime?: string;
}

export interface EventOrder {
  reviewId?: string; eventId?: string; matchType?: string;
  orderId: string; orderNo: string; serviceItemName?: string; itemCategory?: number; orderAmount?: number;
  craftsmanId?: string; craftsmanName?: string; orderStatus?: string; queuedNo?: string;
  orderCreateTime?: string; serviceStartTime?: string; correctedStartTime?: string; serviceEndTime?: string;
  serviceDurationSeconds?: number; correctedDurationSeconds?: number; totalDurationSeconds?: number; weightFactor?: number;
  craftsmanEmployeeNo?: string; craftsmanNickName?: string; craftsmanAvatarUrl?: string;
}

export interface RiskEvent {
  matched?: boolean; reviewId?: string; eventId: string;
  cityName?: string; cityManagerId?: string; cityManagerName?: string; regionManagerId?: string; regionManagerName?: string;
  storeId?: string; storeName?: string; eventTime?: string; workName?: string; serviceDurationSeconds?: number;
  serviceType?: string; checkType?: string; deviceId?: string; imageUrl?: string; frameImageUrl?: string; videoUrl?: string; h5Url?: string;
  riskLevel?: RiskLevel; riskScore?: number; excluded?: boolean;
  eventScore?: number; timeCorrelationScore?: number; repeatScore?: number; volumeScore?: number;
  timeCorrelationWeight?: number; repeatEventWeight?: number; volumeCorrectionWeight?: number; betaMultiplier?: number;
  aiEventCount?: number; windowOrderRawCount?: number; windowOrderCount?: number; nearbyOrderCount?: number; nearbyOrderWeightedCount?: number;
  windowDifference?: number; nearbyGap?: number; commonDifference?: number;
  windowDifferenceScore?: number; nearbyGapScore?: number; commonDifferenceScore?: number;
  configVersion?: string; detectedAt?: string;
  primaryMarkType?: PrimaryMarkType; secondaryMarkType?: string; reviewStatus?: ReviewStatus; markCount?: number;
  markedOrderId?: string; markedOrderNo?: string; markedCraftsmanId?: string; markedCraftsmanName?: string;
  followStatus?: string; punishmentStatus?: string; lastOperatorName?: string; lastMarkTime?: string; version?: number;
  dataUpdateTime?: string; orders?: EventOrder[];
}

export interface RiskWindow {
  storeId?: string; storeName?: string; cityName?: string; cityManagerName?: string; regionManagerName?: string;
  windowStart: string; windowEnd: string;
  aiEventCount: number; dyeEventCount: number; normalEventCount: number;
  highCount: number; mediumCount: number; lowCount: number; warningCount: number;
  privateCount: number; safeCount: number; unmarkedCount: number;
  firstReviewedCount: number; secondReviewedCount: number; unverifiedCount: number; matchedCount: number;
  events: RiskEvent[];
}

export interface StoreRanking {
  cityName?: string; cityManagerName?: string; regionManagerName?: string; storeId?: string; storeName?: string;
  totalCount: number; highCount: number; mediumCount: number; lowCount: number; warningCount: number;
  dyeEventCount: number; normalEventCount: number; privateOrderCount: number;
  totalOrderCount: number; normalOrderCount: number; dyeOrderCount: number;
}

export interface ReviewRecord {
  id: string; reviewId?: string; eventId: string; actionType?: string; beforeStatus?: string; afterStatus?: string;
  primaryMarkType?: PrimaryMarkType; secondaryMarkType?: string; markedOrderId?: string; markedOrderNo?: string;
  markedCraftsmanId?: string; markedCraftsmanName?: string; remark?: string; operatorId?: string; operatorName?: string; createTime?: string;
  cityName?: string; cityManagerName?: string; regionManagerName?: string; storeId?: string; storeName?: string;
  workName?: string; serviceType?: string; checkType?: string; eventTime?: string; imageUrl?: string; deviceId?: string; deviceName?: string;
}

export interface EventDetail {
  event: RiskEvent; records?: ReviewRecord[]; orders?: EventOrder[]; windowOrders?: EventOrder[]; nearbyOrders?: EventOrder[];
  windowStart?: string; windowEnd?: string; nearbyStart?: string; nearbyEnd?: string;
  windowEvents?: RiskEvent[]; dyeEventCount?: number; normalEventCount?: number;
}

export interface CraftsmanOption { craftsmanId: string; craftsmanName?: string; craftsmanRealName?: string; employeeNo?: string; avatarUrl?: string; isMasterStore?: number; isTransfer?: number }
export interface AttendanceRecord {
  id?: string; eventId?: string; craftsmanId?: string; craftsmanName?: string; employeeNo?: string; nickName?: string;
  attendanceType?: string; attendanceTime?: string; imageUrl?: string; source?: string; syncedAt?: string;
  startTime?: string; endTime?: string; startImageUrl?: string; endImageUrl?: string;
}
export interface BatchReviewResult { requestedCount: number; successCount: number; failedCount: number; failedEventIds?: string[] }
export interface RefreshDetectionResult { scopeCount: number; successCount: number; failedCount: number; eventCount: number; failedScopes?: string[] }
export interface RuleDetectionResult extends RefreshDetectionResult { ruleId: string; ruleName: string; startDate: string; endDate: string }
export interface CleanStoreDayResult {
  dryRun: boolean; eventCount: number; storeNames?: string[]; detailCount: number; detailImageCount: number;
  detectionResultCount: number; reviewCount: number; reviewOrderCount: number; reviewRecordCount: number; detectionRecordCount: number;
}
export interface BehaviorRule {
  id: string; ruleCode: string; ruleName: string; ruleType: string; description?: string; enabled: boolean; isDefault: boolean;
  applicationScope: ApplicationScope; weight?: number; parameters?: Record<string, unknown>; paramsJson?: string; version: number;
  createBy?: string; updateBy?: string; createTime?: string; updateTime?: string;
}
export interface DetectionConfigVersion { id: string; versionName: string; configJson?: string; remark?: string; createTime?: string; isDefault?: boolean }

// ---------- 请求 ----------
export interface PageRiskEventReq {
  app: string; pageNum: number; pageSize: number;
  city?: string | null; cityManagerId?: string | null; orgIds?: string | null;
  storeName?: string | null; ruleId?: string | null; applicationScope?: ApplicationScope | '';
  riskLevels?: RiskLevel[]; reviewStatus?: ReviewStatus | ''; primaryMarkType?: PrimaryMarkType | ''; secondaryMarkType?: string;
  lastOperatorName?: string; eventId?: string | null; orderNo?: string | null;
  startDate?: string | null; endDate?: string | null; lastMarkStartDate?: string | null; lastMarkEndDate?: string | null;
  eventScope?: EventScope; sortField?: string | null; sortOrder?: 'asc' | 'desc';
}
export interface ReviewItem { eventId: string; version?: number }
export interface SubmitReviewReq {
  app: string; items: ReviewItem[]; reviewType: string; primaryMarkType?: PrimaryMarkType; secondaryMarkType?: string; ruleId?: string | null;
  markedOrderId?: string; markedOrderNo?: string; markedCraftsmanId?: string; markedCraftsmanName?: string; remark?: string;
}
export interface UpdateBusinessStatusReq { app: string; items: ReviewItem[]; status: string; remark?: string }
export interface PageReviewRecordReq {
  app: string; pageNum: number; pageSize: number; eventId?: string | null; operatorName?: string; reviewStatus?: string; actionType?: string;
  storeName?: string; primaryMarkType?: string; secondaryMarkType?: string; city?: string | null; cityManagerId?: string | null; orgIds?: string | null;
  eventStartDate?: string | null; eventEndDate?: string | null; operationStartDate?: string | null; operationEndDate?: string | null; logScope?: 'all' | 'latest';
}
export interface PageRuleReq { app: string; pageNum: number; pageSize: number; ruleName?: string; ruleType?: string; enabled?: boolean | null; isDefault?: boolean | null; applicationScope?: string; createStartDate?: string | null; createEndDate?: string | null }
export interface SaveRuleReq { app: string; id?: string | null; ruleCode?: string; ruleName: string; ruleType: string; applicationScope: ApplicationScope; description?: string; enabled?: boolean; weight?: number; parameters?: Record<string, unknown>; paramsJson?: string; version?: number }
