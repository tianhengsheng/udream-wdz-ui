import { useEffect, useState } from 'react';
import { Modal, Table, type TableColumnsType } from 'antd';
import { getRiskEventDetail } from '../../api/wdz';
import { ACTION_LABELS, PRIMARY_LABELS } from '../../constants/marks';
import { useDialogs } from '../../store/useDialogs';
import { useFilters } from '../../store/useFilters';
import type { ReviewRecord } from '../../types/wdz';
import { dash, fmtTime } from '../../utils/format';

export const recordCols: TableColumnsType<ReviewRecord> = [
  { title: '操作人', dataIndex: 'operatorName', width: 90, render: dash },
  { title: '操作时间', dataIndex: 'createTime', width: 150, render: fmtTime },
  { title: '核实状态', dataIndex: 'actionType', width: 70, render: (v) => ACTION_LABELS[v] || v || '-' },
  { title: '标记类型一级', dataIndex: 'primaryMarkType', width: 110, render: (v) => PRIMARY_LABELS[v] || '-' },
  { title: '标记类型二级', dataIndex: 'secondaryMarkType', width: 150, render: dash },
  { title: '标记订单', dataIndex: 'markedOrderNo', width: 150, render: dash },
  { title: '标记发型师', dataIndex: 'markedCraftsmanName', width: 90, render: dash },
  { title: '备注', dataIndex: 'remark', render: dash },
];

/** 操作记录弹窗：取详情接口的 records */
export function RecordModal() {
  const { recordsEventId, close } = useDialogs();
  const [rows, setRows] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!recordsEventId) return;
    setLoading(true);
    getRiskEventDetail(recordsEventId, useFilters.getState().ruleId).then((d) => setRows(d?.records || [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, [recordsEventId]);
  return (
    <Modal title={`操作记录 - #${recordsEventId ?? ''}`} open={!!recordsEventId} onCancel={() => close('records')} footer={null} width={1000} destroyOnHidden data-testid="record-modal">
      <Table<ReviewRecord> size="small" rowKey={(r) => String(r.id)} loading={loading} columns={recordCols} dataSource={rows} pagination={false} locale={{ emptyText: '暂无操作记录' }} />
    </Modal>
  );
}
