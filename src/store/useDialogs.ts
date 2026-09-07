import { create } from 'zustand';
import type { RiskEvent } from '../types/wdz';

/**
 * 全局弹窗状态：详情/标记/操作记录/打卡/排队订单抽屉 由 GlobalDialogs 统一挂载，任何列表只需 open*。
 * refreshTick：标记提交成功后 +1，各列表 effect 订阅它重新拉数（对应 v2 submitReview 后的多处刷新）。
 */
interface DialogState {
  detailEventId: string | null;
  reviewEvents: RiskEvent[] | null;
  recordsEventId: string | null;
  attendanceEventId: string | null;
  ordersEventId: string | null;
  refreshTick: number;
  openDetail: (eventId: string) => void;
  openReview: (events: RiskEvent[]) => void;
  openRecords: (eventId: string) => void;
  openAttendance: (eventId: string) => void;
  openOrders: (eventId: string | null) => void;
  close: (k: 'detail' | 'review' | 'records' | 'attendance' | 'orders') => void;
  bumpRefresh: () => void;
}

export const useDialogs = create<DialogState>()((set) => ({
  detailEventId: null, reviewEvents: null, recordsEventId: null, attendanceEventId: null, ordersEventId: null, refreshTick: 0,
  openDetail: (eventId) => set({ detailEventId: String(eventId) }),
  openReview: (events) => set({ reviewEvents: events }),
  openRecords: (eventId) => set({ recordsEventId: String(eventId) }),
  openAttendance: (eventId) => set({ attendanceEventId: String(eventId) }),
  openOrders: (eventId) => set({ ordersEventId: eventId == null ? null : String(eventId) }),
  close: (k) => set(k === 'detail' ? { detailEventId: null } : k === 'review' ? { reviewEvents: null } : k === 'records' ? { recordsEventId: null } : k === 'attendance' ? { attendanceEventId: null } : { ordersEventId: null }),
  bumpRefresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),
}));

/** 已复核的事件仍可再次复核（修正结论）；未核实→初核 */
export const nextReviewType = (e: RiskEvent) => (!e.reviewStatus || e.reviewStatus === 'UNVERIFIED' ? 'FIRST_REVIEW' : 'SECOND_REVIEW');
