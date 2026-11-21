import { Navigate, useParams } from 'react-router-dom';
import Card from '../components/ui/Card.jsx';
import InventoryReport from '../features/reports/InventoryReport.jsx';
import ReportsHeader from '../features/reports/ReportsHeader.jsx';
import { REPORT_TABS } from '../features/reports/reportTabs.js';

// /mod/reports/:report – one tab per report (M9).
export default function ReportsPage() {
  const { report } = useParams();

  if (!REPORT_TABS.some((tab) => tab.key === report)) {
    return <Navigate to="/mod/reports/inventory" replace />;
  }

  if (report === 'inventory') {
    return <InventoryReport />;
  }

  // Not yet returned (MF-23), Loans and Item history (MF-32) are Sprint 2 cards.
  return (
    <>
      <ReportsHeader />
      <Card className="mt-4">
        <p className="text-muted">This report is not built yet.</p>
      </Card>
    </>
  );
}
