import { useEffect, useState } from 'react';
import { getNextCodes } from '../../api/items.js';

// M6 top right: "Next code: MP-00127", or "Codes: MP-00127 – MP-00156" for several items.
// Loaded again a moment after the form values change. `version` forces a new load after
// saving, because the next free number has moved on even when the form looks the same.
const DELAY_MS = 300;

export default function NextCodePreview({
  quantity,
  categoryId,
  homeRoomId,
  brandId,
  colourId,
  version,
}) {
  const params = { quantity, categoryId, homeRoomId, brandId, colourId };
  const key = JSON.stringify({ ...params, version });
  const [result, setResult] = useState({ key: null, first: '', last: '' });

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      getNextCodes(params, { signal: controller.signal })
        .then(({ first, last }) => setResult({ key, first, last }))
        // The preview is only a help: when it fails, the old preview stays (or none is shown).
        .catch(() => {});
    }, DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // key already covers every value in params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!result.first) return null;

  return (
    <div aria-live="polite" className={result.key === key ? '' : 'opacity-60'}>
      <p className="font-mono text-base text-ink">
        {result.first === result.last
          ? `Next code: ${result.first}`
          : `Codes: ${result.first} – ${result.last}`}
      </p>
      <p className="mt-1 text-xs text-muted">Code format is set in Settings → Asset codes.</p>
    </div>
  );
}
