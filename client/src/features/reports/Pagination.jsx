// Paging row under a report table (M9): "Showing 1–25 of 312" and "Previous 1 2 3 … 13 Next".
const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

// The page numbers to show: the first, the last, and up to three around the current page,
// with "…" where numbers are left out. Page 1 of 13 → [1, 2, 3, '…', 13].
function pageNumbers(page, pageCount) {
  const start = Math.max(1, Math.min(page - 1, pageCount - 2));
  const end = Math.min(pageCount, start + 2);
  const pages = new Set([1, pageCount]);
  for (let number = start; number <= end; number += 1) {
    pages.add(number);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  sorted.forEach((number, index) => {
    if (index > 0 && number - sorted[index - 1] > 1) {
      result.push('…');
    }
    result.push(number);
  });
  return result;
}

function PageButton({ current = false, children, ...rest }) {
  return (
    <button
      type="button"
      aria-current={current ? 'page' : undefined}
      className={`min-w-6 rounded px-1.5 py-1 text-brand disabled:text-muted ${focusRing} ${
        current ? 'font-semibold text-ink' : 'hover:bg-page'
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}

export default function Pagination({ page, pageSize, total, onPageChange }) {
  if (total === 0) {
    return null;
  }

  const pageCount = Math.ceil(total / pageSize);
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <p className="text-muted">
        Showing {first}–{last} of {total}
      </p>
      <nav aria-label="Pages" className="flex items-center gap-1">
        <PageButton disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </PageButton>
        {pageNumbers(page, pageCount).map((number, index) =>
          number === '…' ? (
            <span key={`gap-${index}`} className="px-1 text-muted">
              …
            </span>
          ) : (
            <PageButton key={number} current={number === page} onClick={() => onPageChange(number)}>
              {number}
            </PageButton>
          ),
        )}
        <PageButton disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          Next
        </PageButton>
      </nav>
    </div>
  );
}
