import { useEffect, useState } from 'react';
import { Modal, Table, Tag, type TableColumnsType } from 'antd';
import { listEventAttendance } from '../../api/wdz';
import { MediaThumb } from '../MediaThumb';
import { useDialogs } from '../../store/useDialogs';
import type { AttendanceRecord } from '../../types/wdz';
import { dash, fmtTime } from '../../utils/format';

interface Row { key: string; craftsmanName?: string; employeeNo?: string; nickName?: string; isOut: boolean; time?: string; imageUrl?: string }

/** 当天打卡记录：一条快照可拆成上班/下班两行（对应 v2 openAttendanceModal） */
export function AttendanceModal() {
  const { attendanceEventId, close } = useDialogs();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!attendanceEventId) return;
    setLoading(true);
    listEventAttendance(attendanceEventId).then((list) => {
      const out: Row[] = [];
      (list || []).forEach((r: AttendanceRecord, i) => {
        const base = { craftsmanName: r.craftsmanName, employeeNo: r.employeeNo, nickName: r.nickName };
        if (r.attendanceTime) out.push({ key: `${i}-a`, ...base, isOut: r.attendanceType === 'CLOCK_OUT', time: r.attendanceTime, imageUrl: r.imageUrl });
        if (r.startTime) out.push({ key: `${i}-s`, ...base, isOut: false, time: r.startTime, imageUrl: r.startImageUrl });
        if (r.endTime) out.push({ key: `${i}-e`, ...base, isOut: true, time: r.endTime, imageUrl: r.endImageUrl });
      });
      setRows(out);
    }).catch(() => setRows([])).finally(() => setLoading(false));
  }, [attendanceEventId]);
  const cols: TableColumnsType<Row> = [
    { title: '发型师', dataIndex: 'craftsmanName', render: dash }, { title: '工号', dataIndex: 'employeeNo', render: dash }, { title: '英文名', dataIndex: 'nickName', render: dash },
    { title: '类型', dataIndex: 'isOut', render: (v) => (v ? <Tag color="green">下班打卡</Tag> : <Tag color="blue">上班打卡</Tag>) },
    { title: '时间', dataIndex: 'time', render: fmtTime }, { title: '照片', dataIndex: 'imageUrl', render: (v) => <MediaThumb url={v} /> },
  ];
  return (
    <Modal title={`当天打卡记录 - #${attendanceEventId ?? ''}`} open={!!attendanceEventId} onCancel={() => close('attendance')} footer={null} width={800} destroyOnHidden data-testid="attendance-modal">
      <Table<Row> size="small" rowKey="key" loading={loading} columns={cols} dataSource={rows} pagination={false} />
    </Modal>
  );
}
