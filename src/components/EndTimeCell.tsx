import { Tag } from 'antd';
import type { EventOrder } from '../types/wdz';
import { fmtTime } from '../utils/format';

export const END_TIME_TITLE = '结束时间';

/** 结束时间列：后端对已撤单且无结束时间的单已把 serviceEndTime 填为撤单申请时间（与计算同源），协议不变，前端只按状态打标识 */
export const endTimeCell = (o: EventOrder) => (o.orderStatus === '已撤单'
  ? <span><Tag color="red" style={{ marginRight: 4 }}>撤单</Tag>{fmtTime(o.serviceEndTime)}</span>
  : fmtTime(o.serviceEndTime));
