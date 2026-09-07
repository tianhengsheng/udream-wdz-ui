import { Button, DatePicker, Input, Segmented, Select, Space } from 'antd';
import dayjs from 'dayjs';
import { AreaCascade } from '../../components/AreaCascade';
import { APPLICATION_SCOPES, PRIMARY_LABELS, REVIEW_LABELS, RISK_LABELS, SECONDARY_OPTIONS, opts } from '../../constants/marks';
import { hasEventFilter, useFilters } from '../../store/useFilters';
import type { ApplicationScope } from '../../types/wdz';

const L = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#666', whiteSpace: 'nowrap' }}>{t}</span>{children}</span>
);

/** 私单风险列表筛选区（对应 index.html #riskFilterForm）。查询=重置页码后触发 onSearch。 */
export function RiskFilterForm({ onSearch, onReset }: { onSearch: () => void; onReset: () => void }) {
  const { risk: f, setRisk, changeScope, resetRisk } = useFilters();
  const secondaryOpts = (f.primaryMarkType ? SECONDARY_OPTIONS[f.primaryMarkType] || [] : Object.values(SECONDARY_OPTIONS).flat()).map((v) => ({ value: v, label: v }));
  return (
    <div data-testid="risk-filter" style={{ background: '#fff', padding: 10, borderRadius: 6, marginBottom: 8 }}>
      <Space size={[8, 8]} wrap>
        <L t="应用范围"><Select data-testid="scope" style={{ width: 90 }} value={f.applicationScope} options={opts(APPLICATION_SCOPES)} onChange={(v) => changeScope(v as ApplicationScope).then(onSearch)} /></L>
        <L t="管理区域"><AreaCascade value={f.area} onChange={(area) => setRisk({ area })} /></L>
        <L t="门店名称"><Input data-testid="storeName" allowClear placeholder="请输入门店名称" style={{ width: 150 }} value={f.storeName} onChange={(e) => setRisk({ storeName: e.target.value })} onPressEnter={onSearch} /></L>
        <L t="风险等级"><Select data-testid="riskLevels" mode="multiple" allowClear maxTagCount="responsive" placeholder="全部" style={{ width: 170 }} value={f.riskLevels} options={opts(RISK_LABELS)} onChange={(v) => setRisk({ riskLevels: v })} /></L>
        <L t="核实状态"><Select data-testid="reviewStatus" allowClear placeholder="全部" style={{ width: 100 }} value={f.reviewStatus || undefined} options={opts(REVIEW_LABELS)} onChange={(v) => setRisk({ reviewStatus: (v as any) || '' })} /></L>
        <L t="标记类型"><Select data-testid="primaryMarkType" allowClear placeholder="全部" style={{ width: 150 }} value={f.primaryMarkType || undefined} options={opts(PRIMARY_LABELS)} onChange={(v) => setRisk({ primaryMarkType: (v as any) || '', secondaryMarkType: '' })} /></L>
        <L t="标记类型二级"><Select data-testid="secondaryMarkType" allowClear placeholder="全部" style={{ width: 200 }} value={f.secondaryMarkType || undefined} options={secondaryOpts} onChange={(v) => setRisk({ secondaryMarkType: v || '' })} /></L>
        <L t="事件ID"><Input data-testid="eventId" allowClear placeholder="请输入事件ID" style={{ width: 170 }} value={f.eventId} onChange={(e) => setRisk({ eventId: e.target.value })} onPressEnter={onSearch} /></L>
        <L t="标记订单ID"><Input data-testid="orderNo" allowClear placeholder="请输入标记订单ID" style={{ width: 170 }} value={f.orderNo} onChange={(e) => setRisk({ orderNo: e.target.value })} onPressEnter={onSearch} /></L>
        <L t="时间区间">
          <DatePicker.RangePicker data-testid="dateRange" allowClear={false} value={[f.startDate ? dayjs(f.startDate) : null, f.endDate ? dayjs(f.endDate) : null]}
            onChange={(v) => setRisk({ startDate: v?.[0]?.format('YYYY-MM-DD') ?? null, endDate: v?.[1]?.format('YYYY-MM-DD') ?? null })} />
        </L>
        {hasEventFilter(f) && (
          <L t="事件展示范围"><Segmented data-testid="eventScope" size="small" value={f.eventScope} options={[{ label: '仅命中事件', value: 'HIT_ONLY' }, { label: '全部事件', value: 'ALL' }]} onChange={(v) => { setRisk({ eventScope: v as any, pageNum: 1 }); setTimeout(onSearch, 0); }} /></L>
        )}
        <Button type="primary" data-testid="search" onClick={() => { setRisk({ pageNum: 1 }); onSearch(); }}>查询</Button>
        <Button data-testid="reset" onClick={() => { resetRisk(); onReset(); }}>重置</Button>
      </Space>
    </div>
  );
}
