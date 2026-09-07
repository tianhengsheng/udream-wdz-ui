import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_ENV, ENV_PRESETS, bucketKey, type EnvKey } from '../envs';

/**
 * 账号对象（只有 PC 后台一端：wdz V2 接口全是 apiUnified 后台接口）。
 * 来源：账号密码登录（带 account/password，可静默续登）或粘贴 token（仅 token）。
 */
export interface Account {
  id: string; // = `pc:${uid}`
  uid: string; // 19 位雪花 ID 保字符串
  name: string;
  type: number; // payload.iss
  account?: string;
  password?: string; // 明文，仅本地自测用
  token: string;
  expiresAt: number | null;
  savedAt: number;
}

export interface AccountSnapshot {
  accountsByEnv: Record<string, Account[]>;
  activeByEnv: Record<string, string | null>;
}

interface SessionState {
  currentEnv: EnvKey;
  // 源数据：账号按桶键隔离（桶键=env.group ?? env）
  accountsByEnv: Record<string, Account[]>;
  activeByEnv: Record<string, string | null>;
  // 派生镜像：当前 env 视图
  users: Account[];
  activeId: string | null;
  token: string;

  setCurrentEnv: (k: EnvKey) => void;
  upsertUser: (u: Omit<Account, 'savedAt'>) => void;
  removeUser: (id: string) => void;
  setActive: (id: string | null) => void;
  importSnapshot: (snap: AccountSnapshot, merge: boolean) => void;
  currentUser: () => Account | undefined;
}

function derive(accountsByEnv: Record<string, Account[]>, activeByEnv: Record<string, string | null>, env: EnvKey) {
  const bk = bucketKey(env);
  const users = accountsByEnv[bk] || [];
  const activeId = activeByEnv[bk] ?? null;
  const token = (activeId && users.find((u) => u.id === activeId)?.token) || '';
  return { users, activeId, token };
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      currentEnv: DEFAULT_ENV,
      accountsByEnv: {},
      activeByEnv: {},
      users: [],
      activeId: null,
      token: '',

      setCurrentEnv: (k) => set((s) => ({ currentEnv: k, ...derive(s.accountsByEnv, s.activeByEnv, k) })),

      upsertUser: (u) =>
        set((s) => {
          const bk = bucketKey(s.currentEnv);
          const bucket = [...(s.accountsByEnv[bk] || [])];
          const idx = bucket.findIndex((x) => x.id === u.id);
          const now = Date.now();
          if (idx >= 0) bucket[idx] = { ...bucket[idx], ...u, savedAt: now };
          else bucket.push({ ...u, savedAt: now });
          const accountsByEnv = { ...s.accountsByEnv, [bk]: bucket };
          const activeByEnv = { ...s.activeByEnv, [bk]: u.id };
          return { accountsByEnv, activeByEnv, ...derive(accountsByEnv, activeByEnv, s.currentEnv) };
        }),

      removeUser: (id) =>
        set((s) => {
          const bk = bucketKey(s.currentEnv);
          const bucket = (s.accountsByEnv[bk] || []).filter((x) => x.id !== id);
          const accountsByEnv = { ...s.accountsByEnv, [bk]: bucket };
          const activeByEnv = { ...s.activeByEnv, [bk]: s.activeByEnv[bk] === id ? null : s.activeByEnv[bk] };
          return { accountsByEnv, activeByEnv, ...derive(accountsByEnv, activeByEnv, s.currentEnv) };
        }),

      setActive: (id) =>
        set((s) => {
          const bk = bucketKey(s.currentEnv);
          const activeByEnv = { ...s.activeByEnv, [bk]: id };
          return { activeByEnv, ...derive(s.accountsByEnv, activeByEnv, s.currentEnv) };
        }),

      importSnapshot: (snap, merge) =>
        set((s) => {
          let accountsByEnv: Record<string, Account[]>;
          let activeByEnv: Record<string, string | null>;
          if (merge) {
            accountsByEnv = { ...s.accountsByEnv };
            for (const env of Object.keys(snap.accountsByEnv || {})) {
              const map = new Map((accountsByEnv[env] || []).map((u) => [u.id, u] as const));
              (snap.accountsByEnv[env] || []).forEach((u) => map.set(u.id, u));
              accountsByEnv[env] = [...map.values()];
            }
            activeByEnv = { ...s.activeByEnv, ...(snap.activeByEnv || {}) };
          } else {
            accountsByEnv = snap.accountsByEnv || {};
            activeByEnv = snap.activeByEnv || {};
          }
          return { accountsByEnv, activeByEnv, ...derive(accountsByEnv, activeByEnv, s.currentEnv) };
        }),

      currentUser: () => {
        const s = get();
        return s.users.find((u) => u.id === s.activeId);
      },
    }),
    {
      name: 'udream-wdz-ui-session',
      version: 1,
      partialize: (s) => ({ currentEnv: s.currentEnv, accountsByEnv: s.accountsByEnv, activeByEnv: s.activeByEnv }),
      merge: (persisted, current) => {
        const s = { ...current, ...(persisted as Partial<SessionState>) } as SessionState;
        // 已删除的环境 key（如旧 localDirect）回落默认
        if (!ENV_PRESETS.some((e) => e.key === s.currentEnv)) s.currentEnv = DEFAULT_ENV;
        return { ...s, ...derive(s.accountsByEnv || {}, s.activeByEnv || {}, s.currentEnv) };
      },
    },
  ),
);
