import { useMemo, useRef, useState } from 'react';
import { Alert, Button, Descriptions, Input, Modal, Popover, Radio, Space, Tabs, Tag, message } from 'antd';
import dayjs from 'dayjs';
import { DeleteOutlined, DownloadOutlined, GlobalOutlined, PlusOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons';
import { useSession, type Account, type AccountSnapshot } from '../store/useSession';
import { useDialogs } from '../store/useDialogs';
import { useFilters } from '../store/useFilters';
import { ENV_PRESETS } from '../envs';
import { decodeAtToken, isAtTokenExpired, type DecodedAtToken } from '../utils/jwt';
import { loginPc } from '../api/auth';

const isExpired = (u?: Account) => !!u?.expiresAt && u.expiresAt < Date.now();

/** 顶栏：环境切换 + PC 身份（账号密码登录 / 粘贴 token），账号按环境分桶持久化，可导出导入。 */
export function TopBar() {
  const { currentEnv, setCurrentEnv, users, activeId, upsertUser, removeUser, setActive, importSnapshot } = useSession();
  const activeU = users.find((u) => u.id === activeId);
  const currentEnvPreset = ENV_PRESETS.find((e) => e.key === currentEnv) || ENV_PRESETS[0];

  const fileRef = useRef<HTMLInputElement>(null);
  const doExport = () => {
    const s = useSession.getState();
    const blob = new Blob([JSON.stringify({ accountsByEnv: s.accountsByEnv, activeByEnv: s.activeByEnv }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wdz-accounts-${dayjs().format('YYYYMMDDHHmmss')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const snap = JSON.parse(await file.text()) as AccountSnapshot;
      if (!snap || typeof snap.accountsByEnv !== 'object') throw new Error('文件格式不对（缺 accountsByEnv）');
      importSnapshot(snap, true);
      message.success('已导入（合并）');
    } catch (err) {
      message.error('导入失败：' + (err as Error).message);
    }
  };

  const [idOpen, setIdOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<'login' | 'paste'>('paste');
  const [draft, setDraft] = useState('');
  const [account, setAccount] = useState('');
  const [pwd, setPwd] = useState('');
  const [logging, setLogging] = useState(false);
  const decoded = useMemo<{ ok: true; v: DecodedAtToken } | { ok: false; err: string } | null>(() => {
    if (!draft.trim()) return null;
    try { return { ok: true, v: decodeAtToken(draft) }; } catch (e) { return { ok: false, err: (e as Error).message }; }
  }, [draft]);

  const saveIdentity = (token: string, creds?: { account: string; password: string }) => {
    const v = decodeAtToken(token);
    upsertUser({ id: `pc:${v.uid}`, uid: v.uid, name: v.name, type: v.type, token, expiresAt: v.expiresAt, account: creds?.account, password: creds?.password });
    setAddOpen(false);
    message.success(`已设为当前身份：${v.name}`);
  };
  const doLogin = async () => {
    if (!account.trim() || !pwd) { message.error('请输入账号和密码'); return; }
    setLogging(true);
    try {
      const token = await loginPc(account.trim(), pwd);
      saveIdentity(token, { account: account.trim(), password: pwd });
    } catch (e) {
      if (e instanceof Error && e.message && !/^\[/.test(e.message)) message.error(e.message);
    } finally { setLogging(false); }
  };

  const envContent = (
    <Radio.Group value={currentEnv} onChange={(e) => {
      // 事件ID只在各自环境有效：切环境时关掉事件相关的弹窗/抽屉，并让当前列表按新环境重查，避免拿旧环境的事件去新环境查
      useDialogs.setState({ detailEventId: null, reviewEvents: null, reviewModify: null, recordsEventId: null, attendanceEventId: null, ordersEventId: null });
      setCurrentEnv(e.target.value);
      // 默认规则ID各环境不同（本地 2 / 生产 1…），先按新环境重取再刷新，否则详情/排队订单按旧 ruleId 查不到
      useFilters.getState().loadRule().finally(() => useDialogs.getState().bumpRefresh()); message.success(`已切到 ${ENV_PRESETS.find((p) => p.key === e.target.value)?.label}`); }}>
      <Space direction="vertical" size={4}>
        {ENV_PRESETS.map((e) => (
          <Radio key={e.key} value={e.key}><Space size={6}><strong>{e.label}</strong><span style={{ color: '#999', fontSize: 12 }}>{e.target}</span></Space></Radio>
        ))}
      </Space>
    </Radio.Group>
  );

  return (
    <div data-testid="topbar" style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0', background: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
      <Popover content={envContent} title="切换环境" trigger="click" placement="bottomLeft">
        <Button size="small" icon={<GlobalOutlined />} data-testid="env-btn">{currentEnvPreset.label}</Button>
      </Popover>
      <span style={{ color: '#999', fontSize: 12 }}>{currentEnvPreset.target}</span>
      <Button size="small" icon={<UserOutlined />} danger={isExpired(activeU)} style={{ marginLeft: 'auto' }} onClick={() => setIdOpen(true)} data-testid="identity-btn">
        <Tag color="geekblue" style={{ marginRight: 4 }}>PC</Tag>
        {activeU ? <>{activeU.name}{isExpired(activeU) && <span style={{ marginLeft: 4 }}>⚠</span>}</> : <span style={{ color: '#999' }}>未设置 token</span>}
      </Button>

      <Modal title="身份（PC 后台 token）" open={idOpen} onCancel={() => setIdOpen(false)} footer={null} width={460} destroyOnHidden>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <Button size="small" icon={<DownloadOutlined />} onClick={doExport}>导出</Button>
          <Button size="small" icon={<UploadOutlined />} onClick={() => fileRef.current?.click()}>导入</Button>
          <span style={{ color: '#999', fontSize: 12 }}>按环境分桶，含明文密码，妥善保管</span>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={onImportFile} />
        </div>
        {users.length === 0 ? (
          <Alert type="info" showIcon message="当前环境桶未添加账号" style={{ marginBottom: 8 }} />
        ) : (
          <Radio.Group value={activeId ?? undefined} style={{ display: 'block', width: '100%' }} onChange={(e) => { setActive(e.target.value); message.success(`已切到：${users.find((u) => u.id === e.target.value)?.name ?? ''}`); }}>
            <Space direction="vertical" size={8} style={{ display: 'flex' }}>
              {users.map((u) => {
                const active = activeId === u.id;
                return (
                  <div key={u.id} style={{ border: `1px solid ${active ? '#1677ff' : '#f0f0f0'}`, background: active ? '#f0f7ff' : '#fff', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <Radio value={u.id} style={{ marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0, lineHeight: 1.6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <b style={{ fontSize: 13 }}>{u.name}</b>
                        {active && <Tag color="blue">当前</Tag>}
                        {isExpired(u) && <Tag color="warning">过期</Tag>}
                      </div>
                      <div style={{ color: '#999', fontSize: 11, fontFamily: 'monospace' }}>{u.uid}</div>
                      {u.account && <div style={{ color: '#999', fontSize: 12 }}>账号：{u.account}{u.password ? '　密码：' + u.password : ''}</div>}
                    </div>
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeUser(u.id)} />
                  </div>
                );
              })}
            </Space>
          </Radio.Group>
        )}
        <Button type="dashed" icon={<PlusOutlined />} block style={{ marginTop: 10 }} onClick={() => { setDraft(''); setAccount(''); setPwd(''); setAddOpen(true); }}>新增账号</Button>
      </Modal>

      <Modal title="设置 PC 身份" open={addOpen} onCancel={() => setAddOpen(false)} footer={null} width={560} destroyOnHidden>
        <Tabs activeKey={addTab} onChange={(k) => setAddTab(k as 'login' | 'paste')} items={[
          {
            key: 'paste', label: '粘贴 token',
            children: (
              <div>
                <Alert type="info" showIcon style={{ marginBottom: 12 }} message="从 PC 管理后台登录态抓 att header 的值粘贴（本地网关档必须用 newdev/test 登录的 token）。只 decode payload 展示，不验签。" />
                <Input.TextArea rows={4} placeholder="xxx.yyy.zzz" value={draft} onChange={(e) => setDraft(e.target.value)} data-testid="token-input" />
                {decoded && decoded.ok === false && <Alert type="error" style={{ marginTop: 12 }} message="解析失败" description={decoded.err} />}
                {decoded && decoded.ok === true && (
                  <Descriptions size="small" column={2} bordered style={{ marginTop: 12 }} title="解析结果">
                    <Descriptions.Item label="uid">{decoded.v.uid}</Descriptions.Item>
                    <Descriptions.Item label="name">{decoded.v.name}</Descriptions.Item>
                    <Descriptions.Item label="type">{decoded.v.type}</Descriptions.Item>
                    <Descriptions.Item label="过期时间">{decoded.v.expiresAt ? dayjs(decoded.v.expiresAt).format('YYYY-MM-DD HH:mm:ss') + (isAtTokenExpired(draft) ? ' ⚠️ 已过期' : '') : '—'}</Descriptions.Item>
                  </Descriptions>
                )}
                <Button type="primary" block style={{ marginTop: 12 }} disabled={!decoded || !decoded.ok} onClick={() => decoded?.ok && saveIdentity(draft.trim())} data-testid="token-save">保存为当前身份</Button>
              </div>
            ),
          },
          {
            key: 'login', label: '账号密码登录',
            children: (
              <div>
                <Alert type="info" showIcon style={{ marginBottom: 12 }} message="调用 /uc/user/login。注意：本地网关档 PC 登录必 50130（did=null），请用 dev/newdev/test 环境登录后再切回本地，同桶 token 互通。" />
                <Space direction="vertical" size={10} style={{ display: 'flex' }}>
                  <Input placeholder="账号" value={account} onChange={(e) => setAccount(e.target.value)} onPressEnter={doLogin} allowClear autoFocus />
                  <Input.Password placeholder="密码" value={pwd} onChange={(e) => setPwd(e.target.value)} onPressEnter={doLogin} />
                  <Button type="primary" block loading={logging} onClick={doLogin}>登录并设为当前身份</Button>
                </Space>
              </div>
            ),
          },
        ]} />
      </Modal>
    </div>
  );
}
