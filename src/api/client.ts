import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { message, Modal } from 'antd';
import { useSession } from '../store/useSession';
import { bigIntSafeParse } from './common';

// _skipReauth：登录请求自身带，避免续登递归；_retried：已续登重试过一次；_silent：允许失败不弹全局错误
declare module 'axios' {
  export interface AxiosRequestConfig {
    _skipReauth?: boolean;
    _retried?: boolean;
    _silent?: boolean;
  }
}

export const http = axios.create({
  baseURL: '',
  timeout: 60_000,
  // 19 位 id 一律字符串（eventId 后端已字符串化，storeId/orderId 等靠这里兜底）
  transformResponse: [(data) => (typeof data === 'string' ? (bigIntSafeParse(data) ?? data) : data)],
});

const TOKEN_EXPIRY_CODES = new Set(['50120', '50130', '50131', '000002']);

let tokenExpiredModalOpen = false;
function showTokenExpired(url?: string, status?: number, backendMsg?: string) {
  if (tokenExpiredModalOpen) return;
  tokenExpiredModalOpen = true;
  const acc = useSession.getState().currentUser();
  const hint = !acc
    ? '尚未设置 token：点右上角设置身份（账号密码登录或粘贴 token）。'
    : !acc.password
      ? '当前是「粘贴 token」身份，无法自动续登。请重新粘贴新 token，或改用账号密码登录。'
      : status === 403
        ? '当前 token 对该接口无权限。'
        : '自动续登未成功，请重新登录。';
  Modal.warning({
    title: status === 403 ? '无权限（403）' : 'Token 过期 / 鉴权失败',
    content: `接口：${url || ''}\n${backendMsg ? `后端：${backendMsg}\n` : ''}${hint}`,
    styles: { body: { whiteSpace: 'pre-wrap', fontSize: 13, wordBreak: 'break-all' } },
    onOk: () => { tokenExpiredModalOpen = false; },
  });
}

async function reloginAndRetry(config?: InternalAxiosRequestConfig): Promise<AxiosResponse | null> {
  if (!config || config._retried || config._skipReauth) return null;
  const acc = useSession.getState().currentUser();
  if (!acc?.account || !acc?.password) return null;
  const { silentRelogin } = await import('./auth');
  let newToken: string | null = null;
  try { newToken = await silentRelogin(acc); } catch { newToken = null; }
  if (!newToken) return null;
  config._retried = true;
  config.headers.set('att', newToken);
  return http(config);
}

http.interceptors.request.use(async (cfg) => {
  const s = useSession.getState();
  let acc = s.currentUser();
  // 预判式续登：密码账号 token 临近过期(30s)先静默续登
  if (!cfg._skipReauth && acc?.account && acc?.password && acc.expiresAt && acc.expiresAt < Date.now() + 30_000) {
    try {
      const { silentRelogin } = await import('./auth');
      await silentRelogin(acc);
      acc = useSession.getState().currentUser();
    } catch { /* 留给 401 反应式处理 */ }
  }
  const token = acc?.token || '';
  if (token && cfg.headers) cfg.headers.set('att', token);
  if (cfg.url && !cfg.url.startsWith('/env/') && !/^https?:\/\//.test(cfg.url)) cfg.url = `/env/${s.currentEnv}${cfg.url}`;
  // eslint-disable-next-line no-console
  console.debug('[req]', cfg.method?.toUpperCase(), cfg.url, 'as', acc?.name || 'no-user', cfg.params ?? cfg.data);
  return cfg;
});

http.interceptors.response.use(
  async (res) => {
    const body = res.data;
    if (body && typeof body === 'object') {
      const c = body.retCode ?? body.code;
      const ok = body.success === true || c === '000000' || c === 0 || c === '0' || c === 200 || c === '200';
      if (c !== undefined && !ok) {
        if (TOKEN_EXPIRY_CODES.has(String(c))) {
          const retried = await reloginAndRetry(res.config);
          if (retried) return retried;
          showTokenExpired(res.config?.url, undefined, body.retInfo || body.msg);
          return Promise.reject(body);
        }
        // eslint-disable-next-line no-console
        console.warn('[resp.biz-fail]', res.config.url, body);
        if (!res.config._silent) message.error(`[${c}] ${body.retInfo || body.msg || '业务异常'}`);
        return Promise.reject(body);
      }
    }
    return res;
  },
  async (err) => {
    const status = err?.response?.status;
    // eslint-disable-next-line no-console
    if (!err?.config?._silent) console.error('[resp.err]', err?.config?.url, status, err?.response?.data);
    if (status === 401 || status === 403) {
      if (status === 401) {
        const retried = await reloginAndRetry(err.config);
        if (retried) return retried;
      }
      const body = err?.response?.data;
      showTokenExpired(err?.config?.url, status, body && (body.retInfo || body.msg || body.message));
    } else if (!err?.config?._silent) {
      message.error(`[${status || 'NET'}] ${err?.message || '网络异常'}`);
    }
    return Promise.reject(err);
  },
);
