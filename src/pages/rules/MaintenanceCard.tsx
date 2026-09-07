import { useState } from 'react';
import { Alert, Button, Card, Checkbox, DatePicker, Input, Modal, Space, message } from 'antd';
import dayjs from 'dayjs';
import { cleanStoreDayData, refreshDetectionResults } from '../../api/wdz';
import { DEFAULT_START_DATE } from '../../constants/marks';
import { useDialogs } from '../../store/useDialogs';
import type { CleanStoreDayResult, RefreshDetectionResult } from '../../types/wdz';

const L = ({ t, children }: { t: string; children: React.ReactNode }) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#666', whiteSpace: 'nowrap' }}>{t}</span>{children}</span>;

/** 维护区（React 版新增入口，接口为 V2 既有）：门店×日期重算 refreshDetectionResults；清理门店日数据 cleanStoreDayData（默认 dryRun） */
export function MaintenanceCard() {
  const bump = useDialogs((s) => s.bumpRefresh);
  const [rr, setRr] = useState<[string, string]>([DEFAULT_START_DATE, DEFAULT_START_DATE]);
  const [rStore, setRStore] = useState('');
  const [rRes, setRRes] = useState<RefreshDetectionResult | null>(null);
  const [rBusy, setRBusy] = useState(false);
  const [cDate, setCDate] = useState(DEFAULT_START_DATE);
  const [cStores, setCStores] = useState('');
  const [dry, setDry] = useState(true);
  const [cRes, setCRes] = useState<CleanStoreDayResult | null>(null);
  const [cBusy, setCBusy] = useState(false);

  const refresh = async () => {
    setRBusy(true);
    try { const r = await refreshDetectionResults(rr[0], rr[1], rStore.trim() || undefined); setRRes(r); message.success('重算完成'); bump(); } catch { /* */ } finally { setRBusy(false); }
  };
  const clean = async () => {
    const ids = cStores.split(/[\s,，]+/).map((s) => s.trim()).filter(Boolean);
    if (!ids.length) { message.error('请输入万店掌门店ID（wdz_ai_detail.store_id 短id）'); return; }
    const go = async () => { setCBusy(true); try { const r = await cleanStoreDayData(cDate, ids, dry); setCRes(r); message.success(dry ? '试运行完成（未删除）' : '清理完成'); if (!dry) bump(); } catch { /* */ } finally { setCBusy(false); } };
    if (dry) return go();
    Modal.confirm({ title: '确认真实删除？', content: `将删除 ${cDate} 这些门店的事件/明细/检测结果/核查单/记录，不可恢复。建议先勾选试运行核对数量。`, okText: '确认删除', okButtonProps: { danger: true }, onOk: go });
  };
  return (
    <Card size="small" title="维护" data-testid="maintenance">
      <Space direction="vertical" size={10} style={{ display: 'flex' }}>
        <Space wrap>
          <b>门店×日期重算</b>
          <L t="日期"><DatePicker.RangePicker data-testid="mt-refresh-range" allowClear={false} value={[dayjs(rr[0]), dayjs(rr[1])]} onChange={(v) => v?.[0] && v?.[1] && setRr([v[0].format('YYYY-MM-DD'), v[1].format('YYYY-MM-DD')])} /></L>
          <L t="门店名"><Input data-testid="mt-refresh-store" allowClear style={{ width: 160 }} placeholder="空=全部门店" value={rStore} onChange={(e) => setRStore(e.target.value)} /></L>
          <Button type="primary" loading={rBusy} onClick={refresh} data-testid="mt-refresh">重算</Button>
          <span style={{ color: '#999' }}>用默认规则按门店×事件日期重跑检测结果并联动刷新日快照；规则改参后存量需重算才生效</span>
        </Space>
        {rRes && <Alert type={rRes.failedCount ? 'warning' : 'success'} showIcon message={`重算：范围 ${rRes.scopeCount}，成功 ${rRes.successCount}，失败 ${rRes.failedCount}，事件 ${rRes.eventCount}`} description={rRes.failedScopes?.length ? rRes.failedScopes.join('，') : undefined} />}
        <Space wrap>
          <b>清理门店日数据</b>
          <L t="日期"><DatePicker data-testid="mt-clean-date" allowClear={false} value={dayjs(cDate)} onChange={(v) => v && setCDate(v.format('YYYY-MM-DD'))} /></L>
          <L t="万店掌门店ID"><Input data-testid="mt-clean-stores" style={{ width: 260 }} placeholder="逗号分隔，wdz_ai_detail.store_id 短id" value={cStores} onChange={(e) => setCStores(e.target.value)} /></L>
          <Checkbox checked={dry} onChange={(e) => setDry(e.target.checked)}>试运行（只统计不删）</Checkbox>
          <Button danger={!dry} loading={cBusy} onClick={clean} data-testid="mt-clean">{dry ? '统计' : '删除'}</Button>
        </Space>
        {cRes && <Alert type={cRes.dryRun ? 'info' : 'warning'} showIcon message={`${cRes.dryRun ? '试运行' : '已删除'}：事件 ${cRes.eventCount}，明细 ${cRes.detailCount}，图片 ${cRes.detailImageCount}，检测结果 ${cRes.detectionResultCount}，核查单 ${cRes.reviewCount}，关联订单 ${cRes.reviewOrderCount}，流转记录 ${cRes.reviewRecordCount}，检测缓存 ${cRes.detectionRecordCount}`} description={cRes.storeNames?.length ? `门店：${cRes.storeNames.join('、')}` : undefined} />}
      </Space>
    </Card>
  );
}
