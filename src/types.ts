// udream Resp 真实字段：{ success, retCode, subCode, retMsg(部分服务 retInfo), result }；兼容旧 { code, msg, data }
export interface Resp<T> {
  success?: boolean;
  retCode?: string;
  subCode?: string;
  retInfo?: string;
  retMsg?: string;
  result?: T;
  code?: string | number;
  msg?: string;
  data?: T;
}

/** 分页返回：result 为数组，分页信息在 page（PageInfo）。 */
export interface PageInfo {
  pageNum?: number;
  pageSize?: number;
  current?: number;
  pages?: number;
  total?: number;
}
export interface PageResp<T> extends Resp<T[]> {
  page?: PageInfo;
  pageInfo?: PageInfo;
}
