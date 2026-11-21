import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

// In-app QR scanner (02 › hooks/useScanner), shared by "+ Add item" (MF-12),
// "Scan an item" on My loans (MF-13) and the return flow (MF-27).
//
//   const { regionId, error } = useScanner({ onScan: (text) => … });
//   <Scanner><div id={regionId} className={SCANNER_VIDEO_CLASSES} /></Scanner>
//
// The camera starts when the component mounts (or `active` becomes true) and stops when it
// unmounts. onScan gets the raw QR text; use parseScan() to get the item code or room token.
// error is 'denied' when the camera can't be used (permission refused, no camera, or not HTTPS).

// Same QR seen again within this time is ignored (the camera reads ~10 frames a second).
const REPEAT_DELAY = 2500;

// Makes the camera video fill the UI kit Scanner frame.
// "!" (important) is needed: html5-qrcode sets inline styles when it starts (position: relative
// on this element, and a pixel width on the <video> measured when the element had no width),
// which made the video 0 px wide, so only the empty frame was visible on the phone.
export const SCANNER_VIDEO_CLASSES =
  '!absolute inset-0 [&_video]:!h-full [&_video]:!w-full [&_video]:object-cover';

async function stopScanner(scanner) {
  try {
    if (scanner.isScanning) await scanner.stop();
    scanner.clear();
  } catch {
    // Already stopped: nothing to clean up.
  }
}

export function useScanner({ onScan, active = true }) {
  // useId gives ":r1:"; html5-qrcode finds the element with getElementById, so colons are fine.
  const regionId = `scanner${useId()}`;
  const [error, setError] = useState(null);
  const onScanRef = useRef(onScan);
  const lastScan = useRef({ text: '', at: 0 });
  // The previous camera must be fully stopped before a new one starts (React StrictMode
  // mounts twice in development, and a phone allows only one camera stream).
  const stopped = useRef(Promise.resolve());

  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    let scanner = null;

    function handleText(text) {
      const now = Date.now();
      if (text === lastScan.current.text && now - lastScan.current.at < REPEAT_DELAY) return;
      lastScan.current = { text, at: now };
      onScanRef.current?.(text);
    }

    const started = stopped.current.then(async () => {
      if (cancelled) return;
      scanner = new Html5Qrcode(regionId, { verbose: false });
      try {
        await scanner.start({ facingMode: 'environment' }, { fps: 10 }, handleText, () => {});
      } catch {
        scanner = null;
        if (!cancelled) setError('denied');
      }
    });

    return () => {
      cancelled = true;
      stopped.current = started.then(() => scanner && stopScanner(scanner));
    };
  }, [regionId, active]);

  return { regionId, error };
}

// What a scanned QR means: an item label (BASE_URL/i/<code>), a room door label
// (BASE_URL/r/<qrToken>), or a plain code. Returns null for anything else.
export function parseScan(text) {
  const value = String(text ?? '').trim();
  try {
    const { pathname } = new URL(value);
    const match = pathname.match(/^\/(i|r)\/(.+)$/);
    if (!match) return null;
    const part = decodeURIComponent(match[2]);
    return match[1] === 'i'
      ? { type: 'item', code: part.toUpperCase() }
      : { type: 'room', token: part };
  } catch {
    // Not a link: accept a plain asset code such as "MP-00123".
    return /^[A-Z0-9][A-Z0-9/._-]{0,29}$/i.test(value)
      ? { type: 'item', code: value.toUpperCase() }
      : null;
  }
}
