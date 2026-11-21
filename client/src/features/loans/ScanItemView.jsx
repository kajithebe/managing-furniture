import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Scanner from '../../components/ui/Scanner.jsx';
import { parseScan, SCANNER_VIDEO_CLASSES, useScanner } from '../../hooks/useScanner.js';

// My loans › "Scan an item" (S5 layout): scan an item label with the camera, or type the code.
// Both open the item page /i/<code>. parseScan (MF-12) accepts the label link and plain codes,
// including "/" separators (MF-21); the code is encoded before it goes into the URL.
export default function ScanItemView({ onBack }) {
  const navigate = useNavigate();
  const [typing, setTyping] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function openItem(itemCode) {
    navigate(`/i/${encodeURIComponent(itemCode)}`);
  }

  function handleScan(text) {
    const result = parseScan(text);
    if (result?.type === 'item') openItem(result.code);
    else setError("This QR code isn't an item label");
  }

  const { regionId, error: cameraError } = useScanner({ onScan: handleScan });
  const denied = cameraError === 'denied';

  function handleSubmit(event) {
    event.preventDefault();
    const result = parseScan(code);
    if (result?.type === 'item') openItem(result.code);
    else setError('Type the code from the sticker, e.g. MP-00124.');
  }

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-[28px] font-semibold text-ink">Scan an item</h1>

      {denied ? (
        <p className="mt-4 flex gap-3 rounded-card bg-warn-bg px-4 py-3 text-[15px] text-warn">
          <span aria-hidden="true">!</span>
          <span>Allow camera access in your browser to scan, or type the code instead.</span>
        </p>
      ) : (
        <Scanner className="mt-4" onTypeCode={typing ? undefined : () => setTyping(true)}>
          <div id={regionId} className={SCANNER_VIDEO_CLASSES} />
        </Scanner>
      )}

      {(typing || denied) && (
        <form onSubmit={handleSubmit} noValidate className="mt-4">
          <Input
            id="scan-asset-code"
            label="Asset code"
            mono
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={30}
            placeholder="MP-00123"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setError('');
            }}
          />
          <Button type="submit" fullWidth className="mt-4" disabled={!code.trim()}>
            Open item
          </Button>
        </form>
      )}

      <div className="-mx-5 -mb-5 mt-auto flex flex-col gap-3 border-t border-line bg-surface p-5">
        {error && (
          <p role="alert" className="rounded bg-danger px-4 py-3 text-[15px] text-white">
            ! {error}
          </p>
        )}
        <Button variant="secondary" fullWidth onClick={onBack}>
          Back to my loans
        </Button>
      </div>
    </div>
  );
}
