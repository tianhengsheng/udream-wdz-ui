import type { AxiosResponse } from 'axios';
import { http } from './client';
import { decodeAtToken } from '../utils/jwt';
import { useSession, type Account } from '../store/useSession';
import type { Resp } from '../types';

/**
 * PC 后台登录：POST /uc/user/login（account+pwd form body，明文上送、服务端 MD5）。
 * result.token 即完整 att 值，直接作请求头 att。
 * 注意 local 网关档 PC 登录必 50130（did=null），需在 dev/newdev/test 登录后同桶互通。
 */
function extractToken(res: AxiosResponse<Resp<{ token?: string }>>): string {
  const body = res.data;
  const fromBody = (body?.result ?? body?.data)?.token;
  const fromHeader = (res.headers as Record<string, string> | undefined)?.['x-app-token'];
  const token = fromBody || fromHeader;
  if (!token) throw new Error('登录成功但未取到 token');
  return token;
}

export async function loginPc(account: string, pwd: string): Promise<string> {
  const form = new URLSearchParams();
  form.set('account', account);
  form.set('pwd', pwd);
  const res = await http.post<Resp<{ token?: string }>>('/uc/user/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    _skipReauth: true,
  });
  return extractToken(res);
}

const reloginInFlight = new Map<string, Promise<string | null>>();

/** 静默续登（仅密码账号）；同账号并发只发一次登录。成功回写 token。 */
export function silentRelogin(acc: Account): Promise<string | null> {
  if (!acc.account || !acc.password) return Promise.resolve(null);
  const existing = reloginInFlight.get(acc.id);
  if (existing) return existing;
  const run = (async () => {
    const token = await loginPc(acc.account!, acc.password!);
    const v = decodeAtToken(token);
    useSession.getState().upsertUser({ ...acc, name: v.name, type: v.type, token, expiresAt: v.expiresAt });
    return token;
  })().finally(() => reloginInFlight.delete(acc.id));
  reloginInFlight.set(acc.id, run);
  return run;
}
