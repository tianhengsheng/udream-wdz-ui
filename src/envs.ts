/**
 * 可切换的后端环境预设。vite.config.ts 按 key 注册 proxy：/env/{key}/* → target。
 * 浏览器端 axios 把 `/env/{currentEnv}` 拼到 URL 前缀即命中对应后端。
 *
 * 路径前缀（经网关时）：
 *  - /uc/user/login 等是网关根路由，pathPrefix ''。
 *  - unified-service 在网关的路由是 Paths=/mgt/**,/mgt/unified/** + StripPrefix=1 + AesAuthFilter（本地网关 actuator 实测，
 *    /unified/... 直打网关 404），故 serviceOverrides 把 /unified 前缀补成 /mgt/unified/...。
 *  - localDirect：直连本地 unified 9002，不经网关、unified 自身不鉴权（读接口不需 token；写接口从 att 取操作人，仍需有效 token）。
 *  - local：本地网关 20000，PC 账号密码登录必 50130（did=null，见记忆 selftest-ui-guide），需在 dev/newdev/test 登录后同桶互通。
 */
interface Env { key: string; label: string; group?: string; target: string; pathPrefix: string; serviceOverrides?: { prefix: string; pathPrefix: string }[] }
const gw = (key: string, label: string, target: string, group?: string): Env => ({
  key, label, group, target, pathPrefix: '', serviceOverrides: [{ prefix: '/unified', pathPrefix: '/mgt' }],
});
export const ENV_PRESETS = [
  { key: 'localDirect', label: '本地直连9002', group: 'devShared', target: 'http://localhost:9002', pathPrefix: '' } as Env,
  gw('local', '本地网关20000', 'http://localhost:20000', 'devShared'),
  gw('dev', '开发-newdevi', 'https://api-newdevi.51yxm.com', 'devShared'),
  gw('test', '测试', 'https://m-test2.51yxm.com'),
  gw('newdev', '测试-newdev', 'https://api-newdev.51yxm.com'),
] as const;

export type EnvKey = (typeof ENV_PRESETS)[number]['key'];

export const DEFAULT_ENV: EnvKey = 'localDirect';

export function getEnv(key: EnvKey) {
  return ENV_PRESETS.find((e) => e.key === key) || ENV_PRESETS[0];
}

/** 账号分桶键：同 group 的环境共用一个账号桶（local/dev 同库互通），未配 group 的按自身 key 隔离。 */
export function bucketKey(key: EnvKey): string {
  return getEnv(key).group ?? key;
}
