import { useEffect, useState } from 'react';
import { getCodeScheme } from '../../api/codeScheme.js';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import LoadError from '../../components/ui/LoadError.jsx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Last changed by Sebastian Lindsten, 5 Nov 2026" (A1). Null before the first save, so the
// line is hidden then (decided 26 Nov 2026).
function lastChangedText(lastChanged) {
  if (!lastChanged) return null;
  const date = new Date(lastChanged.at);
  const day = `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  return `Last changed by ${lastChanged.by.name ?? '—'}, ${day}`;
}

// /admin/settings/codes – A1 Asset codes: the current format, and the builder after Customize.
export default function AssetCodesTab() {
  // A new value loads the format again ("Try again", and after saving in a later step).
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: -1, data: null, failed: false });
  const [customizing, setCustomizing] = useState(false);
  const loading = result.key !== reloadKey;

  useEffect(() => {
    const controller = new AbortController();
    getCodeScheme({ signal: controller.signal })
      .then((data) => setResult({ key: reloadKey, data, failed: false }))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setResult({ key: reloadKey, data: null, failed: true });
        }
      });
    return () => controller.abort();
  }, [reloadKey]);

  if (loading) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  if (result.failed) {
    return (
      <LoadError
        message="Couldn't load the code format. Try again."
        text="We couldn't load the asset code settings."
        onRetry={() => setReloadKey((current) => current + 1)}
      />
    );
  }

  const { format, lastChanged } = result.data;
  const changedText = lastChangedText(lastChanged);

  if (customizing) {
    return (
      <>
        <p className="flex items-baseline gap-12 text-sm text-muted">
          Current format
          <span className="font-mono text-[15px] text-ink">{format}</span>
        </p>
        <Card className="mt-4">
          <h2 className="text-base font-semibold text-ink">Customize code format</h2>
        </Card>
        {changedText && <p className="mt-4 text-xs text-muted">{changedText}</p>}
      </>
    );
  }

  return (
    <>
      <Card>
        <h2 className="text-base font-semibold text-ink">Asset codes</h2>
        <p className="mt-2 text-xs text-muted">Current format</p>
        <p className="mt-1 font-mono text-[32px] leading-tight text-ink">{format}</p>
        <p className="mt-2 text-[15px] text-ink">Existing asset codes never change.</p>
        <Button variant="secondary" className="mt-3" onClick={() => setCustomizing(true)}>
          Customize
        </Button>
      </Card>
      {changedText && <p className="mt-4 text-xs text-muted">{changedText}</p>}
    </>
  );
}
