import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { ENV_PRESETS } from './src/envs';

// 每个环境预设一条 proxy：/env/{key} → target，剥上下行 cookie（避免 localhost 域残留 cookie 污染网关鉴权 50130）。
export default defineConfig(() => {
  const proxy: Record<string, any> = {};
  ENV_PRESETS.forEach((e) => {
    proxy[`/env/${e.key}`] = {
      target: e.target,
      changeOrigin: true,
      secure: false,
      rewrite: (path: string) => {
        const stripped = path.replace(new RegExp(`^/env/${e.key}`), '');
        return e.pathPrefix ? `${e.pathPrefix}${stripped}` : stripped;
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
    };
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
