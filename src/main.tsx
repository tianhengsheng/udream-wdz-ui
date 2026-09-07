import ReactDOM from 'react-dom/client';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import App from './App';
import './index.css';
import { installTestHooks } from './test/hooks';

dayjs.locale('zh-cn');
installTestHooks();

// 启动清掉本地域 cookie（与 vite 剥 cookie 双保险，防旧 att cookie 触发 50130）
(function purgeStaleCookies() {
  document.cookie.split(';').forEach((c) => {
    const eq = c.indexOf('=');
    const name = (eq > -1 ? c.substring(0, eq) : c).trim();
    if (!name) return;
    ['/', '/env', ''].forEach((p) =>
      ['', 'localhost', '.localhost'].forEach((d) => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT;${p ? ` path=${p};` : ''}${d ? ` domain=${d};` : ''}`;
      }),
    );
  });
})();

// 不用 StrictMode：dev 下 effect 双调用会让首屏请求发两次，联调时干扰
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
