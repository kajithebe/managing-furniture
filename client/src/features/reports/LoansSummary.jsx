// The Loans summary (01 › Reports): five boxes above the table, for ALL loans that match the
// filters, not only this page. Same box style as the dashboard tiles, but not links. No charts.
// The boxes are at least 10rem wide and move to a second row in a narrow window.
function SummaryBox({ label, children }) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <span className="block text-[13px] text-muted">{label}</span>
      {children}
    </div>
  );
}

function BigNumber({ children }) {
  return (
    <span className="mt-1 block whitespace-nowrap text-[32px] font-semibold leading-tight text-ink">
      {children}
    </span>
  );
}

// "Chair 12", one per line; "—" when the list is empty.
function TopList({ entries }) {
  if (entries.length === 0) {
    return <BigNumber>—</BigNumber>;
  }
  return (
    <ol className="mt-2 space-y-1 text-sm text-ink">
      {entries.map((entry) => (
        <li key={entry.id ?? entry.name} className="flex justify-between gap-2">
          <span>{entry.name}</span>
          <span className="text-muted">{entry.count}</span>
        </li>
      ))}
    </ol>
  );
}

export default function LoansSummary({ summary }) {
  return (
    <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-4">
      <SummaryBox label="Loans">
        <BigNumber>{summary.loans}</BigNumber>
      </SummaryBox>
      <SummaryBox label="Items moved">
        <BigNumber>{summary.itemsMoved}</BigNumber>
      </SummaryBox>
      <SummaryBox label="Returned on time">
        {/* No number until something has been returned. */}
        <BigNumber>{summary.onTimePercent === null ? '—' : `${summary.onTimePercent}%`}</BigNumber>
      </SummaryBox>
      <SummaryBox label="Top categories">
        <TopList entries={summary.topCategories} />
      </SummaryBox>
      <SummaryBox label="Busiest rooms">
        <TopList entries={summary.busiestRooms} />
      </SummaryBox>
    </div>
  );
}
