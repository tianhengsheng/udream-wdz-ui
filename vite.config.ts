import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { ENV_PRESETS } from './src/envs';

// 每个环境预设：先注册 serviceOverrides 细粒度规则（/env/{key}{prefix}，http-proxy 按 key 长度长的优先匹配），再注册 catch-all /env/{key}。
// 剥上下行 cookie（避免 localhost 域残留 cookie 污染网关鉴权 50130）。
export default defineConfig(() => {
  const proxy: Record<string, any> = {};
  const build = (e: { key: string; target: string }, pathPrefix: string) => ({
      target: e.target,
      changeOrigin: true,
      secure: false,
      rewrite: (path: string) => {
        const stripped = path.replace(new RegExp(`^/env/${e.key}`), '');
        return pathPrefix ? `${pathPrefix}${stripped}` : stripped;
      },
      configure: (p: any) => {
        p.on('proxyReq', (req: any) => req.removeHeader('cookie'));
        p.on('proxyRes', (res: any) => {
          const sc = res.headers['set-cookie'];
          if (sc) {
            const arr = Array.isArray(sc) ? sc : [sc];
            for (const c of arr) {
              const m = /^\s*att=([^;]+)/i.exec(c);
              if (m && m[1]) { res.headers['x-app-token'] = m[1]; break; }
            }
            delete res.headers['set-cookie'];
          }
        });
      },
  });
  ENV_PRESETS.forEach((e) => {
    (e.serviceOverrides || []).forEach((o) => { proxy[`/env/${e.key}${o.prefix}`] = build(e, o.pathPrefix); });
    proxy[`/env/${e.key}`] = build(e, e.pathPrefix);
  });
  // eslint-disable-next-line no-console
  console.log('[vite] proxy routes:'); Object.keys(proxy).forEach((k) => console.log(`  ${k.padEnd(20)} →  ${proxy[k].target}`));
  return {
    plugins: [react()],
    server: {
      host: true,
      // 与 scanbuy-ui / mqtt-ui 共用 8080 互斥；被占直接报错不漂移
      port: Number(process.env.PORT) || 8080,
      strictPort: true,
      proxy,
    },
  };
});
