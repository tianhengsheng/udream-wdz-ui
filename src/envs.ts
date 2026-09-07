/**
 * 可切换的后端环境预设。vite.config.ts 按 key 注册 proxy：/env/{key}/* → target。
 * 浏览器端 axios 把 `/env/{currentEnv}` 拼到 URL 前缀即命中对应后端。
 *
 * wdz V2 接口前缀 /unified/apiUnified/wdzAi 是网关根路由，pathPrefix 一律 ''。
 * localDirect：直连本地 unified 9002（对应 jar 内 HTML 页面不经网关的用法），
 *   token 仍以 att 头透传，unified 自身不做鉴权，故本地 PC token did=null 的 50130 问题在此档不存在。
 * local：经本地网关 20000，PC 账号密码登录必 50130（见记忆 selftest-ui-guide），需粘贴 newdev/test 正常登录的 token。
 */
export const ENV_PRESETS = [
  { key: 'localDirect', label: '本地直连9002', group: 'devShared', target: 'http://localhost:9002', pathPrefix: '' },
  { key: 'local', label: '本地网关20000', group: 'devShared', target: 'http://localhost:20000', pathPrefix: '' },
  { key: 'dev', label: '开发-newdevi', group: 'devShared', target: 'https://api-newdevi.51yxm.com', pathPrefix: '' },
  { key: 'test', label: '测试', target: 'https://m-test2.51yxm.com', pathPrefix: '' },
  { key: 'newdev', label: '测试-newdev', target: 'https://api-newdev.51yxm.com', pathPrefix: '' },
] as const;

export type EnvKey = (typeof ENV_PRESETS)[number]['key'];

export const DEFAULT_ENV: EnvKey = 'localDirect';

export function getEnv(key: EnvKey) {
  return ENV_PRESETS.find((e) => e.key === key) || ENV_PRESETS[0];
}

/** 账号分桶键：同 group 的环境共用一个账号桶（local/dev 同库互通），未配 group 的按自身 key 隔离。 */
export function bucketKey(key: EnvKey): string {
  const env = getEnv(key) as { group?: string };
  return env.group ?? key;
}
