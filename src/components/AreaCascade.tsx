import { useEffect, useState } from 'react';
import { Select, Space } from 'antd';
import { listAreaCities, listAreaCityManagers, listAreaOrgs } from '../api/wdz';
import type { AreaOption } from '../types/wdz';

export interface AreaValue { city?: string | null; cityManagerId?: string | null; orgIds?: string | null }

/**
 * 管理区域三级联动：城市 → 城市经理 → 区域机构（第三级是 orgId，筛选标签叫「区域」，表格列仍显示区域经理）。
 * id 全部字符串下传（19 位雪花，Number 会丢精度）。
 */
export function AreaCascade({ value, onChange }: { value: AreaValue; onChange: (v: AreaValue) => void }) {
  const [cities, setCities] = useState<AreaOption[]>([]);
  const [managers, setManagers] = useState<AreaOption[]>([]);
  const [orgs, setOrgs] = useState<AreaOption[]>([]);

  useEffect(() => { listAreaCities().then((l) => setCities(l || [])).catch(() => setCities([])); }, []);
  useEffect(() => {
    setManagers([]);
    if (!value.city) return;
    listAreaCityManagers(value.city).then((l) => setManagers(l || [])).catch(() => setManagers([]));
  }, [value.city]);
  useEffect(() => {
    setOrgs([]);
    if (!value.cityManagerId) return;
    listAreaOrgs(value.cityManagerId).then((l) => setOrgs(l || [])).catch(() => setOrgs([]));
  }, [value.cityManagerId]);

  const toOpts = (l: AreaOption[]) => l.map((o) => ({ value: String(o.id), label: o.name || o.id }));
  return (
    <Space size={6} wrap>
      <Select data-testid="area-city" allowClear showSearch optionFilterProp="label" placeholder="全部城市" style={{ width: 130 }} options={toOpts(cities)} value={value.city ?? undefined} onChange={(v) => onChange({ city: v ?? null, cityManagerId: null, orgIds: null })} />
      <Select data-testid="area-manager" allowClear showSearch optionFilterProp="label" placeholder={value.city ? '全部城市经理' : '请先选择城市'} disabled={!value.city} style={{ width: 130 }} options={toOpts(managers)} value={value.cityManagerId ?? undefined} onChange={(v) => onChange({ ...value, cityManagerId: v ?? null, orgIds: null })} />
      <Select data-testid="area-org" allowClear showSearch optionFilterProp="label" placeholder={value.cityManagerId ? '全部区域' : '请先选择城市经理'} disabled={!value.cityManagerId} style={{ width: 130 }} options={toOpts(orgs)} value={value.orgIds ?? undefined} onChange={(v) => onChange({ ...value, orgIds: v ?? null })} />
    </Space>
  );
}
