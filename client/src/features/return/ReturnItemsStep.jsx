import { useRef, useState } from 'react';
import { returnItems } from '../../api/loans.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Scanner from '../../components/ui/Scanner.jsx';
import { parseScan, SCANNER_VIDEO_CLASSES, useScanner } from '../../hooks/useScanner.js';
import { returnListItems, scannedText } from './returnFormat.js';
import ReturnStep, { ErrorBox, LinkButton, SuccessBox } from './ReturnStep.jsx';

// S9 · Return step 2: scan each item, or "Type the code instead" (S9 · Manual entry).
// Every item is saved at once with its own POST /loans/:id/return (suggested in 02 › Return),
// so items scanned before the student leaves still count. The reply is the whole loan, and
// onLoanChange(loan) gives it to the page: the ticks and "3 of 5 scanned" come from it.
// roomRef is how the room was chosen in step 1: { roomQrToken } or { roomId }.
export default function ReturnItemsStep({ loan, room, roomRef, onLoanChange, onBack }) {
  const [error, setError] = useState('');
  const [typing, setTyping] = useState(false);
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  // True while one item is being saved, so more frames of the same QR are ignored.
  const busy = useRef(false);
  const listItems = returnListItems(loan.items);

  // Returns one item; true when it was saved, so the typed code can be cleared.
  async function saveCode(itemCode) {
    if (busy.current) return false;
    busy.current = true;
    setSaving(true);
    try {
      const updated = await returnItems(loan.id, { ...roomRef, itemCodes: [itemCode] });
      setError('');
      onLoanChange(updated);
      return true;
    } catch (apiError) {
      // S9 wording comes from the server: "MP-00456 is not part of this loan",
      // "MP-03015 belongs in D512, not D569" (02 › Return).
      setError(apiError.message);
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  function handleScan(text) {
    if (busy.current) return;
    const result = parseScan(text);
    if (result?.type === 'item') saveCode(result.code);
    else setError("This QR code isn't an item label.");
  }

  // Same check of the typed text as "Scan an item" on My loans (MF-13).
  async function handleSubmit(event) {
    event.preventDefault();
    const result = parseScan(code);
    if (result?.type !== 'item') {
      setError('Type the code from the sticker, e.g. MP-00124.');
      return;
    }
    if (await saveCode(result.code)) setCode('');
  }

  const { regionId, error: cameraError } = useScanner({ onScan: handleScan });
  const denied = cameraError === 'denied';

  return (
    <ReturnStep
      title="Step 2: scan each item"
      footer={
        <>
          {!typing && !denied && (
            <LinkButton onClick={() => setTyping(true)}>Type the code instead</LinkButton>
          )}
          <LinkButton onClick={onBack}>Back to my loans</LinkButton>
        </>
      }
    >
      <SuccessBox className="mt-4">In room {room.name} ✓</SuccessBox>

      {denied ? (
        <p className="mt-4 flex gap-3 rounded-card bg-warn-bg px-4 py-3 text-[15px] text-warn">
          <span aria-hidden="true">!</span>
          <span>Allow camera access in your browser to scan, or type the code instead.</span>
        </p>
      ) : (
        <Scanner className="mt-4">
          <div id={regionId} className={SCANNER_VIDEO_CLASSES} />
        </Scanner>
      )}

      {(typing || denied) && (
        <form onSubmit={handleSubmit} noValidate className="mt-4">
          <Input
            id="return-asset-code"
            label="Asset code"
            mono
            autoFocus={typing}
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
          <Button type="submit" fullWidth className="mt-4" disabled={!code.trim() || saving}>
            Add
          </Button>
        </form>
      )}

      {error && <ErrorBox className="mt-4">{error}</ErrorBox>}

      <p role="status" className="mt-6 text-[15px] font-semibold text-ink">
        {scannedText(listItems)}
      </p>
      <ul className="mt-2">
        {listItems.map((item) => (
          <li key={item.id} className="border-b border-line py-4 last:border-b-0">
            <p className="text-[15px] text-ink">
              <span className="font-semibold">{item.name}</span>{' '}
              <span className="font-mono text-sm">{item.code}</span>
            </p>
            <Badge
              className="mt-2"
              status={item.status === 'RETURNED' ? 'returned' : 'notScanned'}
            />
          </li>
        ))}
      </ul>
    </ReturnStep>
  );
}
