import { useRef, useState } from 'react';
import { getItem } from '../../api/items.js';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Scanner from '../../components/ui/Scanner.jsx';
import { parseScan, SCANNER_VIDEO_CLASSES, useScanner } from '../../hooks/useScanner.js';
import { dueText } from '../items/itemText.js';
import { addDraftItem, isInDraft } from './borrowDraft.js';

// S5 · Scan another item: "+ Add item" on the borrow request. Scan an item label with the
// camera, or type the code. A borrowable item is added and the view closes (onAdded).

const STATUS_WORDS = { BROKEN: 'Broken', IN_REPAIR: 'In repair', DISPOSED: 'Disposed' };

// S5 · Scan error texts.
function notBorrowableText(item) {
  if (item.onLoan) {
    return item.currentLoan
      ? `${item.code} is on loan until ${dueText(item.currentLoan.dueAt)}`
      : `${item.code} is on loan`;
  }
  return `${item.code} can't be borrowed right now (${STATUS_WORDS[item.status]})`;
}

export default function AddItemView({ onAdded, onBack }) {
  const [typing, setTyping] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // The camera can report a scan while the previous code is still being checked.
  const busyRef = useRef(false);

  async function addCode(rawCode) {
    const value = rawCode.trim().toUpperCase();
    if (!value || busyRef.current) return;
    if (isInDraft(value)) {
      setError('This item is already in your request');
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const item = await getItem(value);
      if (item.borrowable) {
        addDraftItem(item);
        onAdded(item);
      } else {
        setError(notBorrowableText(item));
      }
    } catch (err) {
      setError(
        err.status === 404 || err.status === 400 ? `No item with code ${value}` : err.message,
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function handleScan(text) {
    const result = parseScan(text);
    if (result?.type === 'item') addCode(result.code);
    else setError("This QR code isn't an item label");
  }

  const { regionId, error: cameraError } = useScanner({ onScan: handleScan });
  const denied = cameraError === 'denied';

  function handleSubmit(event) {
    event.preventDefault();
    addCode(code);
  }

  return (
    <>
      <h1 className="text-[28px] font-semibold leading-tight text-ink">Scan another item</h1>

      {denied ? (
        <p className="mt-5 flex gap-3 rounded-card bg-warn-bg px-4 py-3 text-[15px] text-warn">
          <span aria-hidden="true">!</span>
          <span>Allow camera access in your browser to scan, or type the code instead.</span>
        </p>
      ) : (
        <div className="mt-5">
          <Scanner onTypeCode={typing ? undefined : () => setTyping(true)}>
            <div id={regionId} className={SCANNER_VIDEO_CLASSES} />
          </Scanner>
        </div>
      )}

      {(typing || denied) && (
        <form noValidate onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <Input
            id="asset-code"
            label="Asset code"
            mono
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setError('');
            }}
            placeholder="MP-00123"
            maxLength={30}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
          />
          <Button type="submit" fullWidth disabled={busy || !code.trim()}>
            Add
          </Button>
        </form>
      )}

      <div className="sticky bottom-0 -mx-5 -mb-5 mt-auto flex flex-col gap-3 border-t border-line bg-surface px-5 py-4">
        {error && (
          <p role="alert" className="rounded bg-danger px-4 py-3 text-[15px] text-white">
            ! {error}
          </p>
        )}
        {busy && (
          <p role="status" className="text-sm text-muted">
            Checking item…
          </p>
        )}
        <Button variant="secondary" fullWidth onClick={onBack}>
          Back to request
        </Button>
      </div>
    </>
  );
}
