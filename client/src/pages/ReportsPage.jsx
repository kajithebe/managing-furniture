import { Navigate, useParams } from 'react-router-dom';
import InventoryReport from '../features/reports/InventoryReport.jsx';
import ItemHistoryReport from '../features/reports/ItemHistoryReport.jsx';
import LoansReport from '../features/reports/LoansReport.jsx';
import OverdueReport from '../features/reports/OverdueReport.jsx';
import { REPORT_TABS } from '../features/reports/reportTabs.js';

// /mod/reports/:report – one tab per report (M9).
const REPORTS = {
  inventory: InventoryReport,
  overdue: OverdueReport,
  loans: LoansReport,
  'item-history': ItemHistoryReport,
};

export default function ReportsPage() {
  const { report } = useParams();

  if (!REPORT_TABS.some((tab) => tab.key === report)) {
    return <Navigate to="/mod/reports/inventory" replace />;
  }

  const Report = REPORTS[report];
  // `key` starts the tab fresh (empty filters) when another tab is opened.
  return <Report key={report} />;
}
