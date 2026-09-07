import { message } from 'antd';
import { getLegacyDeviceVideoUrl } from '../api/wdz';
import type { RiskEvent } from '../types/wdz';

/** 查看监控：优先后端按事件定位的 h5 地址，失败回落事件自带 h5Url/videoUrl，新窗口打开 */
export async function openMonitor(item?: RiskEvent | null) {
  if (!item) { message.error('事件数据不存在，请刷新后重试'); return; }
  const stored = item.h5Url || item.videoUrl;
  let url: string | undefined;
  try {
    if (item.storeName) url = await getLegacyDeviceVideoUrl(item.storeName, item.deviceId, String(item.eventId));
  } catch { if (!stored) return; }
  url = url || stored;
  if (!url) { message.error('无法确定门店或监控设备'); return; }
  window.open(url, '_blank', 'noopener,noreferrer');
}
