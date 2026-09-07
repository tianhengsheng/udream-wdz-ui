/**
 * 测试钩子 window.__t：与 docs/wdz-ai/test-hooks.js 同名同语义，组件内真实实现（dev-only）。
 * 所有方法返回可 JSON 序列化的紧凑结果，供 javascript_tool 文本断言。
 */
import { useSession } from '../store/useSession';
import { useFilters } from '../store/useFilters';

const norm = (s: string | null | undefined) => (s || '').replace(/\s+/g, '').trim();
const toastLog: string[] = [];
const observeToasts = () => {
  new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => {
    if (!(n instanceof HTMLElement)) return;
    const list = n.matches('.ant-message-notice') ? [n] : [...n.querySelectorAll('.ant-message-notice')];
    list.forEach((el) => { const t = (el as HTMLElement).innerText.trim(); if (t) toastLog.push(t); });
  }))).observe(document.body, { childList: true, subtree: true });
};
function locate(sel: string): HTMLElement | null {
  const byId = document.querySelector<HTMLElement>(`[data-testid="${sel}"]`);
  if (byId) return byId;
  const want = norm(sel);
  const leaves = [...document.querySelectorAll<HTMLElement>('body *')].filter((e) => e.children.length === 0 && e.offsetParent !== null);
  const exact = leaves.filter((e) => norm(e.textContent) === want);
  const fuzzy = leaves.filter((e) => norm(e.textContent).includes(want));
  const hit = exact[exact.length - 1] || fuzzy[fuzzy.length - 1];
  if (!hit) return null;
  let el: HTMLElement | null = hit;
  for (let i = 0; i < 4 && el; i++) {
    if (getComputedStyle(el).cursor === 'pointer' || el.tagName === 'BUTTON' || el.onclick) return el;
    el = el.parentElement;
  }
  return hit;
}
function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const __t = {
  nav(label: string) {
    const item = [...document.querySelectorAll<HTMLElement>('.ant-menu-item')].find((e) => norm(e.textContent).includes(norm(label)));
    if (!item) return { ok: false, error: 'menu not found' };
    item.click();
    return { ok: true };
  },
  click(sel: string) {
    const el = locate(sel);
    if (!el) return { ok: false, error: `not found: ${sel}` };
    el.click();
    return { ok: true, tag: el.tagName };
  },
  type(sel: string, value: string) {
    let input = document.querySelector<HTMLInputElement>(`[data-testid="${sel}"]`);
    if (input && input.tagName !== 'INPUT' && input.tagName !== 'TEXTAREA') input = input.querySelector('input,textarea');
    if (!input) input = [...document.querySelectorAll<HTMLInputElement>('input,textarea')].find((i) => i.placeholder && i.placeholder.includes(sel) && i.offsetParent !== null) || null;
    if (!input) return { ok: false, error: `input not found: ${sel}` };
    setInputValue(input, value);
    return { ok: true };
  },
  async select(selBoxText: string, optionText: string) {
    const box = [...document.querySelectorAll<HTMLElement>('.ant-select')].find((s) => {
      const tid = s.getAttribute('data-testid') || '';
      const t = norm(s.querySelector('.ant-select-selection-placeholder')?.textContent) || norm(s.querySelector('.ant-select-selection-item')?.textContent);
      return tid === selBoxText || t.includes(norm(selBoxText));
    });
    if (!box) return { ok: false, error: `select not found: ${selBoxText}` };
    box.querySelector('.ant-select-selector')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(400);
    const search = document.querySelector<HTMLInputElement>('.ant-select-open .ant-select-selection-search-input');
    if (search) { setInputValue(search, optionText); await sleep(400); }
    const opt = [...document.querySelectorAll<HTMLElement>('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')].find((o) => norm(o.textContent).includes(norm(optionText)));
    if (!opt) return { ok: false, error: `option not found: ${optionText}` };
    opt.click();
    return { ok: true };
  },
  /** 直接改筛选 store（比操作 UI 快），随后 click('search') */
  setFilter(patch: Record<string, unknown>) { useFilters.getState().setRisk(patch as any); return { ok: true, risk: useFilters.getState().risk }; },
  /** 设置 token（粘贴 token 的编程入口） */
  setToken(token: string) {
    const v = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    useSession.getState().upsertUser({ id: `pc:${v.sub}`, uid: String(v.sub), name: v.obj?.name || '?', type: Number(v.iss), token, expiresAt: v.exp ? v.exp * 1000 : null });
    return { ok: true, uid: String(v.sub) };
  },
  /** 当前快照：环境/账号/页面/弹窗/表格/汇总/toast */
  snap() {
    const s = useSession.getState();
    const f = useFilters.getState();
    const modal = document.querySelector<HTMLElement>('.ant-modal-wrap:not([style*="display: none"]) .ant-modal-title');
    const tables = [...document.querySelectorAll<HTMLElement>('.ant-table-wrapper')].map((t) => ({ rows: t.querySelectorAll('tbody tr.ant-table-row').length }));
    const summary = document.querySelector<HTMLElement>('[data-testid="summary"]')?.innerText.replace(/\s+/g, ' ');
    return { env: s.currentEnv, user: s.currentUser()?.name || null, page: norm(document.querySelector('.ant-menu-item-selected')?.textContent), ruleId: f.ruleId, filter: f.risk, modal: modal?.textContent || null, tables, summary, toasts: toastLog.slice(-5) };
  },
  /** 表格文本（第 n 个表，含表头） */
  table(n = 0) {
    const t = document.querySelectorAll<HTMLElement>('.ant-table-wrapper')[n];
    if (!t) return { ok: false, error: 'table not found' };
    const rows = [...t.querySelectorAll('tbody tr.ant-table-row')].map((r) => [...r.querySelectorAll('td')].map((c) => norm(c.textContent)));
    return { head: [...t.querySelectorAll('thead th')].map((c) => norm(c.textContent)), rows };
  },
  toasts: () => toastLog.slice(),
  sleep,
};

export function installTestHooks() {
  observeToasts();
  (window as any).__t = __t;
}
