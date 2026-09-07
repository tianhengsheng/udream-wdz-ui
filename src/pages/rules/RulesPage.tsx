import { useEffect, useState } from 'react';
import { Button, Card, DatePicker, Input, Select, Space, Table, Tag, message, type TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { pageBehaviorRules, setDefaultBehaviorRule, updateBehaviorRuleStatus } from '../../api/wdz';
import { APP, APPLICATION_SCOPES, opts } from '../../constants/marks';
import { useDialogs } from '../../store/useDialogs';
import { useFilters } from '../../store/useFilters';
import type { BehaviorRule } from '../../types/wdz';
import { dash, fmtTime } from '../../utils/format';
import { MaintenanceCard } from './MaintenanceCard';
import { RuleConfigModal } from './RuleConfigModal';
import { RuleDetectionModal } from './RuleDetectionModal';

const L = ({ t, children }: { t: string; children: React.ReactNode }) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#666', whiteSpace: 'nowrap' }}>{t}</span>{children}</span>;

/** 行为权重配置页：规则表 + 编辑/监测/设为默认/启停 + 底部维护区 */
export function RulesPage() {
  const refreshTick = useDialogs((s) => s.refreshTick);
  const [f, setF] = useState<{ ruleName: string; applicationScope: string; enabled: string; isDefault: string; createStart: string | null; createEnd: string | null }>({ ruleName: '', applicationScope: '', enabled: '', isDefault: '', createStart: null, createEnd: null });
  const [page, setPage] = useState({ pageNum: 1, pageSize: 20 });
  const [rows, setRows] = useState<BehaviorRule[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<{ open: boolean; rule: BehaviorRule | null }>({ open: false, rule: null });
  const [detecting, setDetecting] = useState<BehaviorRule | null>(null);
  const [updatedAt, setUpdatedAt] = useState('');

  const load = async (p = page) => {
    setLoading(true);
    try {
      const r = await pageBehaviorRules({ app: APP, pageNum: p.pageNum, pageSize: p.pageSize, ruleName: f.ruleName.trim(), ruleType: 'EVENT', applicationScope: f.applicationScope || undefined,
        enabled: f.enabled === '' ? null : f.enabled === 'true', isDefault: f.isDefault === '' ? null : f.isDefault === 'true', createStartDate: f.createStart, createEndDate: f.createEnd });
      setRows(r.records || []); setTotal(r.total); setUpdatedAt(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    } catch { setRows([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [refreshTick]);
  const search = () => { const p = { ...page, pageNum: 1 }; setPage(p); load(p); };
  const toggle = async (r: BehaviorRule) => { try { await updateBehaviorRuleStatus(String(r.id), !r.enabled, r.version); message.success(`规则已${r.enabled ? '禁用' : '启用'}`); load(); } catch { /* */ } };
  const setDefault = async (r: BehaviorRule) => {
    try {
      await setDefaultBehaviorRule(String(r.id));
      message.success(`“${r.ruleName}”已设为默认规则`);
      // 默认规则变了：列表页的应用范围/规则跟随（对应 v2 setDefaultRule 后 loadRiskData）
      await useFilters.getState().changeScope(r.applicationScope || 'ALL');
      load();
    } catch { /* */ }
  };
  const cols: TableColumnsType<BehaviorRule> = [
    { title: '规则名称', dataIndex: 'ruleName', width: 220, render: (v, r) => <>{v}{r.isDefault && <Tag color="blue" style={{ marginLeft: 6 }}>默认</Tag>}</> },
    { title: '规则类型', key: 't', width: 80, render: () => '私单检测' },
    { title: '应用范围', dataIndex: 'applicationScope', width: 80, render: (v) => <Tag color="purple">{APPLICATION_SCOPES[v] || v}</Tag> },
    { title: '状态', dataIndex: 'enabled', width: 70, render: (v) => (v ? <Tag color="green">已启用</Tag> : <Tag>已禁用</Tag>) },
    { title: '默认规则', dataIndex: 'isDefault', width: 70, render: (v) => (v ? <Tag color="blue">是</Tag> : '否') },
    { title: '规则ID', dataIndex: 'id', width: 60 }, { title: '版本', dataIndex: 'version', width: 50 },
    { title: '创建人', dataIndex: 'createBy', width: 80, render: dash }, { title: '创建时间', dataIndex: 'createTime', width: 150, render: fmtTime },
    { title: '最近修改人', dataIndex: 'updateBy', width: 80, render: dash }, { title: '最近修改时间', dataIndex: 'updateTime', width: 150, render: fmtTime },
    { title: '操作', key: 'op', fixed: 'right', width: 260, render: (_, r) => (
      <Space size={0} split={<span style={{ color: '#ddd' }}>|</span>}>
        <Button type="link" size="small" data-testid={`rule-edit-${r.id}`} onClick={() => setEditing({ open: true, rule: r })}>编辑</Button>
        {r.enabled && <Button type="link" size="small" data-testid={`rule-detect-${r.id}`} onClick={() => setDetecting(r)}>监测</Button>}
        {!r.isDefault && <Button type="link" size="small" onClick={() => setDefault(r)}>设为默认</Button>}
        {!r.isDefault && <Button type="link" size="small" onClick={() => toggle(r)}>{r.enabled ? '禁用' : '启用'}</Button>}
      </Space>) },
  ];
  return (
    <div style={{ padding: 12 }}>
      <h2 style={{ margin: '0 0 8px' }}>行为权重配置 <span style={{ color: '#999', fontSize: 12, fontWeight: 400 }}>管理私单检测规则，点击新建或编辑进入检测配置详情</span></h2>
      <div data-testid="rules-filter" style={{ background: '#fff', padding: 10, borderRadius: 6, marginBottom: 8 }}>
        <Space size={[8, 8]} wrap>
          <L t="规则名称"><Input data-testid="rule-name" allowClear style={{ width: 160 }} placeholder="请输入规则名称" value={f.ruleName} onChange={(e) => setF({ ...f, ruleName: e.target.value })} onPressEnter={search} /></L>
          <L t="规则类型"><Select style={{ width: 100 }} value="EVENT" options={[{ value: 'EVENT', label: '私单检测' }]} /></L>
          <L t="应用范围"><Select allowClear placeholder="不限" style={{ width: 90 }} value={f.applicationScope || undefined} options={opts(APPLICATION_SCOPES)} onChange={(v) => setF({ ...f, applicationScope: v || '' })} /></L>
          <L t="状态"><Select allowClear placeholder="全部" style={{ width: 90 }} value={f.enabled || undefined} options={[{ value: 'true', label: '已启用' }, { value: 'false', label: '已禁用' }]} onChange={(v) => setF({ ...f, enabled: v || '' })} /></L>
          <L t="默认规则"><Select allowClear placeholder="全部" style={{ width: 80 }} value={f.isDefault || undefined} options={[{ value: 'true', label: '是' }, { value: 'false', label: '否' }]} onChange={(v) => setF({ ...f, isDefault: v || '' })} /></L>
          <L t="创建时间"><DatePicker.RangePicker value={[f.createStart ? dayjs(f.createStart) : null, f.createEnd ? dayjs(f.createEnd) : null]} onChange={(v) => setF({ ...f, createStart: v?.[0]?.format('YYYY-MM-DD') ?? null, createEnd: v?.[1]?.format('YYYY-MM-DD') ?? null })} /></L>
          <Button type="primary" data-testid="rule-search" onClick={search}>查询</Button>
          <Button onClick={() => { setF({ ruleName: '', applicationScope: '', enabled: '', isDefault: '', createStart: null, createEnd: null }); setTimeout(search, 0); }}>重置</Button>
        </Space>
      </div>
      <Card size="small" title={<span>规则列表 <span style={{ color: '#999', fontWeight: 400 }}>共 {total} 条 · 更新时间 {updatedAt || '-'}</span></span>}
        extra={<Space><Button size="small" type="primary" data-testid="rule-new" onClick={() => setEditing({ open: true, rule: null })}>+ 新建</Button><Button size="small" type="link" onClick={() => load()}>刷新</Button></Space>} style={{ marginBottom: 8 }}>
        <Table<BehaviorRule> data-testid="rules-table" size="small" rowKey={(r) => String(r.id)} loading={loading} columns={cols} dataSource={rows} scroll={{ x: 1400 }}
          pagination={{ current: page.pageNum, pageSize: page.pageSize, total, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`, onChange: (pn, ps) => { const p = { pageNum: ps !== page.pageSize ? 1 : pn, pageSize: ps }; setPage(p); load(p); } }} />
      </Card>
      <MaintenanceCard />
      <RuleConfigModal rule={editing.rule} open={editing.open} onClose={() => setEditing({ open: false, rule: null })} onSaved={() => load()} />
      <RuleDetectionModal rule={detecting} onClose={() => setDetecting(null)} />
    </div>
  );
}
