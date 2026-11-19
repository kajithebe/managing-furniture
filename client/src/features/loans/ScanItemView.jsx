import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Scanner from '../../components/ui/Scanner.jsx';

// Letters, digits and "-" only (e.g. MP-00124), so the code is safe to put in the URL.
const CODE_PATTERN = /^[A-Z0-9-]{1,40}$/;

// My loans › "Scan an item": the scanner frame, or type the asset code instead (S5 layout).
// The camera inside the frame comes in the next commit (useScanner, needs team agreement).
export default function ScanItemView({ onBack }) {
  const navigate = useNavigate();
  const inputId = useId();
  const [typing, setTyping] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function openItem(event) {
    event.preventDefault();
    const value = code.trim().toUpperCase();
    if (!CODE_PATTERN.test(value)) {
      setError('Type the code from the sticker, e.g. MP-00124.');
      return;
    }
    navigate(`/i/${encodeURIComponent(value)}`);
  }

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-[28px] font-semibold text-ink">Scan an item</h1>

      <Scanner className="mt-4" onTypeCode={typing ? undefined : () => setTyping(true)} />

      {typing && (
        <form onSubmit={openItem} noValidate className="mt-4">
          <Input
            id={inputId}
            label="Asset code"
            mono
            autoFocus
            autoComplete="off"
            value={code}
            error={error}
            onChange={(event) => {
              setCode(event.target.value);
              setError('');
            }}
          />
          <Button type="submit" fullWidth className="mt-4">
            Open item
          </Button>
        </form>
      )}

      <div className="-mx-5 -mb-5 mt-auto border-t border-line bg-surface p-5">
        <Button variant="secondary" fullWidth onClick={onBack}>
          Back to my loans
        </Button>
      </div>
    </div>
  );
}
