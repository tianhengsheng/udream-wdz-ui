import { Button, Input, Table } from 'antd';
import type { ArraySpec, Row } from '../../constants/ruleDefaults';

/** 配置数组的可编辑小表：首列为序号或时间字段；addable 时可增删行（至少保留 1 行） */
export function EditableRows({ spec, rows, onChange, extraCol }: { spec: ArraySpec; rows: Row[]; onChange: (r: Row[]) => void; extraCol?: { label: string; render: (r: Row) => string } }) {
  const set = (i: number, k: string, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const cols: any[] = [
    { title: spec.first === 'index' ? '段' : '时间字段', key: 'f', width: 90, render: (_: unknown, r: Row, i: number) => (spec.first === 'index' ? i + 1 : String(r.timeField ?? '')) },
    ...spec.cols.map((c) => ({ title: c.label, key: c.key, render: (_: unknown, r: Row, i: number) => <Input size="small" style={{ width: 70 }} value={r[c.key] == null ? '' : String(r[c.key])} onChange={(e) => set(i, c.key, e.target.value)} /> })),
  ];
  if (extraCol) cols.push({ title: extraCol.label, key: 'x', width: 70, render: (_: unknown, r: Row) => extraCol.render(r) });
  if (spec.addable) cols.push({ title: '操作', key: 'op', width: 50, render: (_: unknown, __: Row, i: number) => <Button type="link" size="small" danger disabled={rows.length <= 1} onClick={() => onChange(rows.filter((_, j) => j !== i))}>×</Button> });
  return (
    <div style={{ flex: 1, minWidth: 320 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <b>{spec.title}</b>
        {spec.addable && <Button size="small" onClick={() => onChange([...rows, { ...rows[rows.length - 1] }])}>+ 增加分段</Button>}
      </div>
      <Table size="small" rowKey={(_, i) => String(i)} columns={cols} dataSource={rows} pagination={false} />
    </div>
  );
}
