/**
 * 测试钩子 window.__t：与 docs/wdz-ai/test-hooks.js 同名同语义，组件内真实实现（dev-only）。
 * 所有方法返回可 JSON 序列化的紧凑结果，供 javascript_tool 文本断言。
 */
import { useSession } from '../store/useSession';
import { useFilters } from '../store/useFilters';
import { useDialogs } from '../store/useDialogs';

const norm = (s: string | null | undefined) => (s || '').replace(/\s+/g, '').trim();
const text = (el: Element | null | undefined, max = 1500) => (el ? ((el as HTMLElement).innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, max) : null);
const visible = (el: HTMLElement) => el.offsetParent !== null;
const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
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
  const leaves = $$('body *').filter((e) => e.children.length === 0 && visible(e));
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
/** 只取可见表格（antd Tabs 隐藏页签仍在 DOM 里） */
const visibleTables = () => $$('.ant-table-wrapper').filter(visible);
/** antd Table 的 data-testid 落在内层 .ant-table（非 wrapper），没有的退到最近祖先 */
const tableId = (t: HTMLElement): string => {
  const own = t.querySelector('.ant-table')?.getAttribute('data-testid') || t.getAttribute('data-testid');
  if (own) return own;
  const outer = t.parentElement?.closest<HTMLElement>('.ant-table-wrapper');
  return outer ? `${tableId(outer)}/expanded` : t.closest('[data-testid]')?.getAttribute('data-testid') || '';
};
/** 本表自己的行（排除展开子表的行） */
const ownRows = (t: HTMLElement, sel = 'tbody tr.ant-table-row') => $$(sel, t).filter((r) => r.closest('.ant-table-wrapper') === t);
/** 表格定位：data-testid 或可见表序号 */
const findTable = (sel: string | number = 0) => (typeof sel === 'number' ? visibleTables()[sel] : visibleTables().find((t) => tableId(t) === sel)) || null;
const findRow = (sel: string | number, rowKw: string) => {
  const t = findTable(sel);
  if (!t) return { error: `table not found: ${sel}` } as const;
  // 只匹配数据行：antd 的 measure-row 含全部表头文字，会被关键字误命中
  const tr = ownRows(t).find((r) => r.textContent!.includes(rowKw));
  return tr ? { tr } : { error: `row not found: ${rowKw}` } as const;
};
/** 最上层可见弹层（Modal / Drawer 各取最后一个可见的） */
const topLayer = () => {
  // Modal wrap 是 position:fixed，offsetParent 恒 null，改用尺寸判可见
  const modals = $$('.ant-modal-wrap').filter((w) => w.style.display !== 'none' && w.getBoundingClientRect().height > 0);
  const drawers = $$('.ant-drawer-open .ant-drawer-content-wrapper');
  return { modal: modals[modals.length - 1] || null, drawer: drawers[drawers.length - 1] || null };
};
/** antd RangePicker 赋值：逐个输入框 输入→Enter 提交 */
async function setPickerInput(input: HTMLInputElement, value: string) {
  input.focus();
  input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await sleep(150);
  setInputValue(input, value);
  await sleep(150);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  await sleep(150);
}

const __t = {
  /** 顶层菜单：'私单AI行为检测' / '核查日志' / '行为权重配置' */
  nav(label: string) {
    const item = $$('.ant-menu-item').find((e) => norm(e.textContent).includes(norm(label)));
    if (!item) return { ok: false, error: 'menu not found' };
    item.click();
    return { ok: true };
  },
  /** 二级页签：'私单风险列表' / '门店排行' / '批量核查'（弹窗内 Tabs 同样适用，取可见项） */
  tab(label: string) {
    const el = $$('.ant-tabs-tab').filter(visible).find((e) => norm(e.textContent).includes(norm(label)));
    if (!el) return { ok: false, error: `tab not found: ${label}` };
    el.click();
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
    if (!input) input = $$<HTMLInputElement>('input,textarea').find((i) => i.placeholder && i.placeholder.includes(sel) && visible(i)) || null;
    if (!input) return { ok: false, error: `input not found: ${sel}` };
    setInputValue(input, value);
    return { ok: true };
  },
  async select(selBoxText: string, optionText: string) {
    const box = $$('.ant-select').find((s) => {
      const tid = s.getAttribute('data-testid') || '';
      const t = norm(s.querySelector('.ant-select-selection-placeholder')?.textContent) || norm(s.querySelector('.ant-select-selection-item')?.textContent);
      return tid === selBoxText || t.includes(norm(selBoxText));
    });
    if (!box) return { ok: false, error: `select not found: ${selBoxText}` };
    box.querySelector('.ant-select-selector')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(400);
    // 只有 showSearch 的下拉才输入过滤（默认 filterOption 按 value 过滤，非搜索下拉输入会把选项全滤掉）
    const search = document.querySelector<HTMLInputElement>('.ant-select-open.ant-select-show-search .ant-select-selection-search-input');
    if (search) { setInputValue(search, optionText); await sleep(400); }
    const opt = $$('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').find((o) => norm(o.textContent).includes(norm(optionText)));
    if (!opt) return { ok: false, error: `option not found: ${optionText}` };
    opt.click();
    return { ok: true };
  },
  /**
   * 日期区间赋值（'YYYY-MM-DD'）。sel：RangePicker 的 data-testid（如 'ranking-dateRange' / 'detect-range'）或可见序号；
   * 缺省第 0 个可见区间控件。风险列表筛选更快的做法是 setFilter({startDate,endDate})。
   */
  async dates(start: string, end: string, sel: string | number = 0) {
    // RangePicker 的 data-testid 落在它的两个 input 上
    const pickers = $$('.ant-picker-range').filter(visible);
    const picker = typeof sel === 'number' ? pickers[sel] : pickers.find((p) => p.querySelector('input')?.getAttribute('data-testid') === sel);
    if (!picker) return { ok: false, error: `range picker not found: ${sel}`, pickers: pickers.map((p) => p.querySelector('input')?.getAttribute('data-testid') || '') };
    const inputs = $$<HTMLInputElement>('input', picker);
    if (inputs.length < 2) return { ok: false, error: 'range inputs < 2' };
    await setPickerInput(inputs[0], start);
    await setPickerInput(inputs[1], end);
    inputs[1].blur();
    document.body.click();
    await sleep(150);
    return { ok: inputs[0].value === start && inputs[1].value === end, values: [inputs[0].value, inputs[1].value] };
  },
  /** 直接改筛选 store（比操作 UI 快），随后 click('search') */
  setFilter(patch: Record<string, unknown>) { useFilters.getState().setRisk(patch as any); return { ok: true, risk: useFilters.getState().risk }; },
  /** 设置 token（粘贴 token 的编程入口） */
  setToken(token: string) {
    const v = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    useSession.getState().upsertUser({ id: `pc:${v.sub}`, uid: String(v.sub), name: v.obj?.name || '?', type: Number(v.iss), token, expiresAt: v.exp ? v.exp * 1000 : null });
    return { ok: true, uid: String(v.sub) };
  },
  /** 当前快照：环境/账号/页面/页签/弹层/表格/汇总/toast */
  snap() {
    const s = useSession.getState();
    const f = useFilters.getState();
    const { modal, drawer } = topLayer();
    const tables = visibleTables().map((t) => ({ id: tableId(t), rows: ownRows(t).length }));
    const summary = text(document.querySelector('[data-testid="summary"]'), 400);
    return {
      env: s.currentEnv, user: s.currentUser()?.name || null, page: norm(document.querySelector('.ant-menu-item-selected')?.textContent),
      tab: norm($$('.ant-tabs-tab-active').filter(visible)[0]?.textContent) || null, ruleId: f.ruleId, filter: f.risk,
      modal: text(modal?.querySelector('.ant-modal-title'), 80), drawer: text(drawer?.querySelector('.ant-drawer-title'), 80), tables, summary, toasts: toastLog.slice(-5),
    };
  },
  /** 页面状态（对齐旧钩子 state）：菜单/页签/最上层弹层全文/汇总/最后一条 toast/全局弹窗 store */
  state() {
    const { modal, drawer } = topLayer();
    const d = useDialogs.getState();
    return {
      menu: norm(document.querySelector('.ant-menu-item-selected')?.textContent) || null,
      tab: norm($$('.ant-tabs-tab-active').filter(visible)[0]?.textContent) || null,
      summaryText: text(document.querySelector('[data-testid="summary"]'), 400),
      modalText: text(modal?.querySelector('.ant-modal-content')),
      drawerText: text(drawer),
      dialogs: { detail: d.detailEventId, review: d.reviewEvents?.map((e) => String(e.eventId)) ?? null, records: d.recordsEventId, attendance: d.attendanceEventId, orders: d.ordersEventId, refreshTick: d.refreshTick },
      toastLast: toastLog[toastLog.length - 1] || null,
    };
  },
  /** 含关键词的最小可见文本块（按元素自有文本节点匹配，取所在 tr/li/card 整块文本） */
  read(kw: string, n = 3) {
    const hits: HTMLElement[] = [];
    const ownText = (el: HTMLElement) => [...el.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('');
    const walk = (el: HTMLElement) => {
      for (const c of el.children) walk(c as HTMLElement);
      if (visible(el) && ownText(el).includes(kw) && hits.every((h) => !h.contains(el) && !el.contains(h))) hits.push(el);
    };
    walk(document.body);
    return hits.slice(0, n).map((el) => text(el.closest('tr,li,.ant-card,.ant-descriptions-item,div') || el, 300));
  },
  /** 表格文本（sel=data-testid 或可见表序号，含表头） */
  table(sel: string | number = 0, maxRows = 20) {
    const t = findTable(sel);
    if (!t) return { ok: false, error: `table not found: ${sel}`, tables: visibleTables().map(tableId) };
    const all = ownRows(t);
    const rows = all.slice(0, maxRows).map((r) => $$('td', r).filter((c) => c.closest('tr') === r).map((c) => norm(c.textContent)));
    return { head: $$('thead th', t).filter((c) => c.closest('.ant-table-wrapper') === t).map((c) => norm(c.textContent)), rows, total: all.length };
  },
  /** 行内点击：rowClick('event-table', '1046893634', '标记')；btnText 缺省点整行（onRow 行为，如打开排队抽屉） */
  rowClick(sel: string | number, rowKw: string, btnText?: string) {
    const r = findRow(sel, rowKw);
    if ('error' in r) return { ok: false, error: r.error };
    if (!btnText) { r.tr.click(); return { ok: true }; }
    const btns = $$('button,a', r.tr);
    const btn = btns.find((b) => norm(b.textContent).includes(norm(btnText)));
    if (!btn) return { ok: false, error: `btn not found in row: ${btnText}`, rowButtons: btns.map((b) => norm(b.textContent)) };
    btn.click();
    return { ok: true };
  },
  /** 展开/收起表格行（window-table 的窗口行 → 事件子表） */
  expand(rowKw: string, sel: string | number = 'window-table') {
    const r = findRow(sel, rowKw);
    if ('error' in r) return { ok: false, error: r.error };
    const icon = r.tr.querySelector<HTMLElement>('.ant-table-row-expand-icon');
    if (!icon) return { ok: false, error: 'expand icon not found' };
    icon.click();
    return { ok: true, expanded: !icon.classList.contains('ant-table-row-expand-icon-expanded') };
  },
  /** 勾选/取消勾选行（批量核查 / 事件与排队 多选表） */
  check(rowKw: string, sel: string | number = 'event-table') {
    const r = findRow(sel, rowKw);
    if ('error' in r) return { ok: false, error: r.error };
    const box = r.tr.querySelector<HTMLInputElement>('.ant-checkbox-input');
    if (!box) return { ok: false, error: 'checkbox not found' };
    box.click();
    return { ok: true, checked: box.checked };
  },
  /** 关闭弹层：指定 k 只关该全局弹窗；不传=关全部全局弹窗 + 点掉最上层的页面局部 Modal/Drawer（如「查看事件与排队」「规则配置」） */
  closeDialog(k?: 'detail' | 'review' | 'records' | 'attendance' | 'orders') {
    const d = useDialogs.getState();
    if (k) { d.close(k); return { ok: true }; }
    (['detail', 'review', 'records', 'attendance', 'orders'] as const).forEach((x) => d.close(x));
    // 逐层点关闭（多层叠放时全局弹窗关闭动画未结束仍在 DOM，不能只取最上层）
    const closes = [...$$('.ant-drawer-open .ant-drawer-close'), ...$$('.ant-modal-wrap').filter((w) => w.style.display !== 'none').map((w) => w.querySelector<HTMLElement>('.ant-modal-close'))].filter(Boolean) as HTMLElement[];
    closes.forEach((c) => c.click());
    return { ok: true, closedLocal: closes.length };
  },
  toasts: (n = 5) => toastLog.slice(-n),
  sleep,
  /**
   * 门店排行全量（逐页拉、剔除每日合计行）：实时/快照比对用。extra 覆盖默认参数（默认 08-22、私单数降序）。
   * 返回 {total, ms, keys(按返回顺序), rows(key=日期|门店ID或名), totals(每日合计)}，结果可存 window 跨后端重启比对。
   */
  async rankAll(extra: Record<string, unknown> = {}) {
    const { pageStoreRanking } = await import('../api/wdz');
    const req = { app: 'UDREAM', pageSize: 100, applicationScope: 'ALL', sortField: 'privateOrderCount', sortOrder: 'desc', startDate: '2026-08-22', endDate: '2026-08-22', ...extra };
    const t0 = performance.now(); const all: any[] = [];
    for (let pn = 1; ; pn++) {
      const r = await pageStoreRanking({ ...req, pageNum: pn } as any);
      all.push(...(r.records || []));
      if (pn * 100 >= Number(r.total)) break;
    }
    const stores = all.filter((x) => x.isTotal !== 1);
    const key = (x: any) => `${x.statDate}|${x.storeId || x.storeName}`;
    return { total: stores.length, ms: Math.round(performance.now() - t0), keys: stores.map(key),
      rows: Object.fromEntries(stores.map((x) => [key(x), x])), totals: Object.fromEntries(all.filter((x) => x.isTotal === 1).map((x) => [x.statDate, x])) };
  },
  /** 汇总卡（三个页签共用 getRiskSummary）取数，extra 覆盖默认参数（默认 08-22、全部范围）；返回 {ms, s} */
  async summary(extra: Record<string, unknown> = {}) {
    const { getRiskSummary } = await import('../api/wdz');
    const t0 = performance.now();
    const s = await getRiskSummary({ app: 'UDREAM', pageNum: 1, pageSize: 20, applicationScope: 'ALL', startDate: '2026-08-22', endDate: '2026-08-22', ...extra } as any);
    return { ms: Math.round(performance.now() - t0), s };
  },
  /** 比对两次 summary 的全部数值字段（更新时间除外）。 */
  summaryDiff(a: any, b: any) {
    const keys = Object.keys({ ...a.s, ...b.s }).filter((k) => k !== 'dataUpdateTime');
    const diffs = keys.filter((k) => Number(a.s[k] || 0) !== Number(b.s[k] || 0)).map((k) => `${k}: ${a.s[k]}≠${b.s[k]}`);
    return { ms: [a.ms, b.ms], fields: keys.length, diffs: diffs.length, sample: diffs, updateTime: [a.s.dataUpdateTime, b.s.dataUpdateTime] };
  },
  /** 比对两次 rankAll：行集合、19 个数值列、排序顺序、每日合计。 */
  rankDiff(a: any, b: any) {
    const cols = ['totalCount', 'highCount', 'mediumCount', 'lowCount', 'warningCount', 'privateOrderCount', 'detectedCount', 'reviewedCount', 'noRiskCount', 'duplicateEventCount', 'invalidEventCount', 'nonCompliantCount', 'mutualCutCount', 'shortTermReworkCount', 'dyeEventCount', 'normalEventCount', 'totalOrderCount', 'normalOrderCount', 'dyeOrderCount'];
    const diffs: string[] = [];
    new Set([...a.keys, ...b.keys]).forEach((k) => {
      const x = a.rows[k], y = b.rows[k];
      if (!x || !y) { diffs.push(`${k} ${x ? '仅A' : '仅B'}`); return; }
      cols.forEach((c) => { if (Number(x[c] || 0) !== Number(y[c] || 0)) diffs.push(`${k}.${c}: ${x[c]}≠${y[c]}`); });
    });
    Object.keys(a.totals).forEach((d) => cols.forEach((c) => { if (Number(a.totals[d]?.[c] || 0) !== Number(b.totals[d]?.[c] || 0)) diffs.push(`合计${d}.${c}`); }));
    return { rows: [a.total, b.total], ms: [a.ms, b.ms], orderSame: a.keys.join() === b.keys.join(), diffs: diffs.length, sample: diffs.slice(0, 10) };
  },
};

export function installTestHooks() {
  observeToasts();
  (window as any).__t = __t;
}
