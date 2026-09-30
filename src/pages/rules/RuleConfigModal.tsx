import { useEffect, useState } from 'react';
import { Button, Card, Checkbox, Collapse, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import { listV2DetectionConfigVersions, saveBehaviorRule, saveV2DetectionConfigVersion, setDefaultV2DetectionConfigVersion } from '../../api/wdz';
import { APP, APPLICATION_SCOPES, opts } from '../../constants/marks';
import { ARRAY_KEYS, BETA_SPEC, DEFAULT_PARAMS, SECTIONS, fromParameters, toDetection, type Row } from '../../constants/ruleDefaults';
import type { ApplicationScope, BehaviorRule, DetectionConfigVersion } from '../../types/wdz';
import { fmtTime } from '../../utils/format';
import { EditableRows } from './EditableRows';

const L = ({ t, children }: { t: string; children: React.ReactNode }) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#666', whiteSpace: 'nowrap' }}>{t}</span>{children}</span>;
const N = ({ p, k, set, w = 70, unit }: { p: Record<string, unknown>; k: string; set: (k: string, v: unknown) => void; w?: number; unit?: string }) => (
  <><Input data-testid={`cfg-${k}`} size="small" style={{ width: w }} value={p[k] == null ? '' : String(p[k])} onChange={(e) => set(k, e.target.value)} />{unit && <span style={{ color: '#999' }}>{unit}</span>}</>
);

/**
 * 检测配置弹窗（对应 v2 configModal）：基础信息 → 基础配置（含短时事件三级配置）→ 取样分段 → 评分配置 → 规则A/B → β档位 → 配置版本。
 * 保存 = saveBehaviorRule（parameters=detection）+ saveV2DetectionConfigVersion（configJson 全量，首个版本设默认）。
 */
export function RuleConfigModal({ rule, open, onClose, onSaved }: { rule: BehaviorRule | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ApplicationScope>('ALL');
  const [remark, setRemark] = useState('');
  const [p, setP] = useState<Record<string, unknown>>(DEFAULT_PARAMS);
  const [versions, setVersions] = useState<DetectionConfigVersion[]>([]);
  const [saving, setSaving] = useState(false);
  const [jsonView, setJsonView] = useState<{ title: string; text: string } | null>(null);
  const set = (k: string, v: unknown) => setP((x) => ({ ...x, [k]: v }));
  const rows = (k: string) => (p[k] as Row[]) || [];

  const loadVersions = () => listV2DetectionConfigVersions().then((l) => setVersions(l || [])).catch(() => setVersions([]));
  useEffect(() => {
    if (!open) return;
    setName(rule ? rule.ruleName : '门店私单检测规则');
    setScope(rule ? rule.applicationScope || 'ALL' : 'ALL');
    setRemark(rule ? rule.description || '' : '适用于全部门店的私单行为检测');
    setP(rule?.parameters ? fromParameters(rule.parameters) : { ...DEFAULT_PARAMS });
    loadVersions();
  }, [open, rule?.id]);

  const configObject = () => ({ schemaVersion: 3, ruleName: name || '门店私单检测规则', ruleType: 'EVENT', remark, detection: toDetection(p), rules: { A: '订单时间相关性', B: '服务时间权重' } });
  const save = async () => {
    if (!name.trim()) { message.error('请输入规则名称'); return; }
    setSaving(true);
    try {
      const cfg = configObject();
      await saveBehaviorRule({ app: APP, id: rule ? String(rule.id) : null, ruleCode: rule ? rule.ruleCode : `PRIVATE_ORDER_${Date.now()}`, ruleName: name.trim(), ruleType: 'EVENT', applicationScope: scope,
        description: remark.trim() || undefined, enabled: rule ? rule.enabled : true, weight: rule ? rule.weight ?? 1 : 1, parameters: cfg.detection as unknown as Record<string, unknown>, version: rule ? rule.version : 0 });
      await saveV2DetectionConfigVersion({ versionName: `版本2-${new Date().toISOString().slice(0, 19).replace('T', ' ')}`, configJson: JSON.stringify(cfg), remark: '行为权重配置保存', isDefault: versions.length === 0 });
      message.success('检测配置保存成功');
      onSaved(); onClose();
    } catch { /* 已提示 */ } finally { setSaving(false); }
  };
  const alpha = (r: Row) => { const b = Number(r.betaWeight); return Number.isFinite(b) ? Math.max(0, 1 - b).toFixed(2) : '-'; };
  const versionCols = [
    { title: '版本名称', dataIndex: 'versionName' }, { title: '默认版本', dataIndex: 'isDefault', width: 80, render: (v: boolean) => (v ? <Tag color="green">默认</Tag> : '-') },
    { title: '创建时间', dataIndex: 'createTime', width: 150, render: fmtTime }, { title: '备注', dataIndex: 'remark', render: (v: string) => v || '-' },
    { title: '操作', key: 'op', width: 140, render: (_: unknown, v: DetectionConfigVersion) => (
      <Space size={0} split={<span style={{ color: '#ddd' }}>|</span>}>
        <Button type="link" size="small" onClick={() => { let t = v.configJson || '{}'; try { t = JSON.stringify(JSON.parse(t), null, 2); } catch { /* raw */ } setJsonView({ title: `${v.versionName} - 配置 JSON`, text: t }); }}>查看</Button>
        {!v.isDefault && <Button type="link" size="small" onClick={async () => { try { await setDefaultV2DetectionConfigVersion(String(v.id)); message.success('默认配置版本设置成功'); loadVersions(); } catch { /* */ } }}>设为默认</Button>}
      </Space>) },
  ];
  const sectionItems = SECTIONS.map((s, i) => ({ key: String(i), label: <b>{s.title}{s.hint && <span style={{ color: '#8c8c8c', fontWeight: 400, marginLeft: 8 }}>{s.hint}</span>}</b>,
    children: <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{s.arrays.map((a) => <EditableRows key={a.key} spec={a} rows={rows(a.key)} onChange={(r) => set(a.key, r)} />)}</div> }));

  return (
    <Modal title={rule ? '编辑检测配置' : '新建检测配置'} open={open} onCancel={onClose} width={1200} style={{ top: 16 }} destroyOnHidden data-testid="config-modal"
      footer={<Space><Button onClick={() => setJsonView({ title: '检测配置 JSON', text: JSON.stringify(configObject(), null, 2) })}>查看配置JSON</Button><Button onClick={onClose}>取消</Button><Button type="primary" loading={saving} onClick={save} data-testid="cfg-save">保存</Button></Space>}>
      <Space direction="vertical" size={8} style={{ display: 'flex' }}>
        <Card size="small" title="基础信息"><Space wrap>
          <L t="规则名称"><Input data-testid="cfg-ruleName" size="small" style={{ width: 220 }} maxLength={128} value={name} onChange={(e) => setName(e.target.value)} /></L>
          <L t="规则类型"><Select size="small" style={{ width: 100 }} value="EVENT" options={[{ value: 'EVENT', label: '私单检测' }]} /></L>
          <L t="应用范围"><Select data-testid="cfg-scope" size="small" style={{ width: 90 }} value={scope} options={opts(APPLICATION_SCOPES)} onChange={(v) => setScope(v as ApplicationScope)} /></L>
          <L t="备注"><Input size="small" style={{ width: 300 }} maxLength={500} value={remark} onChange={(e) => setRemark(e.target.value)} /></L>
        </Space></Card>
        <Card size="small" title="基础配置"><Space wrap size={12}>
          <L t="时间窗口"><N p={p} k="timeWindowMinutes" set={set} unit="分" /></L>
          <L t="订单容差"><N p={p} k="orderTimeToleranceMinutes" set={set} unit="分" /></L>
          <L t="去重时间"><N p={p} k="deduplicationMinutes" set={set} unit="分" /></L>
          {/* 理发时长过滤（1015 原型）：事件时长低于该值不参与计算，默认 8 分钟 */}
          <L t="理发时长过滤"><Input data-testid="cfg-shortEventMinutes" size="small" style={{ width: 70 }} value={p.shortEventMinutes == null ? '' : String(p.shortEventMinutes)} onChange={(e) => set('shortEventMinutes', e.target.value)} /><span style={{ color: '#999' }}>分</span></L>
        </Space></Card>
        <Card size="small" title="评分配置"><Space wrap size={12}>
          <Checkbox checked={!!p.enableOrderCountLimit} onChange={(e) => set('enableOrderCountLimit', e.target.checked)}>订单数限制</Checkbox>
          <Checkbox checked={!!p.enableEventBinding} onChange={(e) => set('enableEventBinding', e.target.checked)}>多事件绑定</Checkbox>
          <L t="绑定阈值"><N p={p} k="eventBindingThreshold" set={set} /></L>
          <L t="窗口差异"><N p={p} k="windowDiffPerOrder" set={set} /> <span style={{ color: '#999' }}>/ 最高</span> <N p={p} k="windowDiffMaxScore" set={set} /></L>
          <L t="附近缺口"><N p={p} k="nearbyDiffPerOrder" set={set} /> <span style={{ color: '#999' }}>/ 最高</span> <N p={p} k="nearbyDiffMaxScore" set={set} /></L>
          <L t="共同差异"><N p={p} k="commonDiffPerOrder" set={set} /> <span style={{ color: '#999' }}>/ 最高</span> <N p={p} k="commonDiffMaxScore" set={set} /></L>
          <L t="附近订单范围"><N p={p} k="nearbyMinutes" set={set} unit="分钟" /></L>
          <L t="最小取样"><N p={p} k="minSampleCount" set={set} /></L>
        </Space></Card>
        <Collapse size="small" defaultActiveKey={['0']} items={sectionItems} />
        <Card size="small" title={<span>{BETA_SPEC.title} <span style={{ color: '#8c8c8c', fontWeight: 400 }}>窗口+附近订单共用，服务时长/参考时长 ≥ 比值 → β，α=1-β</span></span>}>
          <EditableRows spec={BETA_SPEC} rows={rows(BETA_SPEC.key)} onChange={(r) => set(BETA_SPEC.key, r)} extraCol={{ label: 'α(规则A权重)', render: alpha }} />
        </Card>
        <Card size="small" title={<span>配置版本 <span style={{ color: '#999', fontWeight: 400 }}>最多展示最近 100 个版本</span></span>}>
          <Table size="small" rowKey={(v: DetectionConfigVersion) => String(v.id)} columns={versionCols as any} dataSource={versions} pagination={false} />
        </Card>
      </Space>
      <Modal title={jsonView?.title} open={!!jsonView} onCancel={() => setJsonView(null)} footer={null} width={720}>
        <pre style={{ maxHeight: '60vh', overflow: 'auto', fontSize: 11, background: '#fafafa', padding: 8 }}>{jsonView?.text}</pre>
      </Modal>
    </Modal>
  );
}
