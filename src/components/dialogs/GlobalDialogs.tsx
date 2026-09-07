import { CalculationModal } from '../../pages/risk/CalculationModal';
import { ReviewModal } from './ReviewModal';
import { RecordModal } from './RecordModal';
import { AttendanceModal } from './AttendanceModal';
import { OrdersDrawer } from './OrdersDrawer';

/** 全局挂载一次；各列表通过 useDialogs.open* 打开 */
export function GlobalDialogs() {
  return (<><CalculationModal /><ReviewModal /><RecordModal /><AttendanceModal /><OrdersDrawer /></>);
}
