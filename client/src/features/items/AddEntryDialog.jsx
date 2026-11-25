import { useEffect, useState } from 'react';
import { createLookupEntry, suggestShortCode } from '../../api/lookups.js';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Toggle from '../../components/ui/Toggle.jsx';

// "+ Add new" pop-ups P1–P6 (design-screens › pop-ups). One component for all six lists:
// category, brand, colour and campus have a short code (P1–P4; category also "Approve
// automatically"); building and room have only a name and show where they are added (P5, P6).
const ENTRY_KINDS = {
  category: { title: 'Add new category', button: 'Add category', hasCode: true },
  brand: { title: 'Add new brand', button: 'Add brand', hasCode: true },
  colour: { title: 'Add new colour', button: 'Add colour', hasCode: true },
  campus: { title: 'Add new campus', button: 'Add campus', hasCode: true },
  building: { title: 'Add new building', button: 'Add building', nameLabel: 'Building name' },
  room: { title: 'Add new room', button: 'Add room', nameLabel: 'Room name' },
};

const CODE_PATTERN = /^[A-Z0-9]{2,5}$/;
const SUGGEST_DELAY_MS = 300;

// kind: a key of ENTRY_KINDS. parent (building, room): { id, text } with text such as
// "Campus: Karaportti" or "Karaportti · Building D". onAdded(entry) gets the new entry,
// onUse(entry) the existing one ("Use Chair").
export default function AddEntryDialog({ kind, parent, onAdded, onUse, onClose }) {
  const config = ENTRY_KINDS[kind];
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [code, setCode] = useState('');
  // Once the user types a code, the suggestion no longer replaces it.
  const [codeEdited, setCodeEdited] = useState(false);
  const [suggested, setSuggested] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  const [saving, setSaving] = useState(false);
  // { field: 'name' | 'code' | 'form', message, existing? }
  const [serverError, setServerError] = useState(null);

  // Suggested short code ("Suggested: CHR · you can change it"), a moment after typing stops.
  const trimmedName = name.trim();
  useEffect(() => {
    if (!config.hasCode || !trimmedName) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      suggestShortCode(kind, trimmedName, { signal: controller.signal })
        .then((result) => {
          setSuggested(result.code);
          if (!codeEdited) setCode(result.code);
        })
        .catch(() => {});
    }, SUGGEST_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [kind, config.hasCode, trimmedName, codeEdited]);

  const nameError = nameTouched && !trimmedName ? `Enter a ${kind} name` : undefined;
  const valid = trimmedName && (!config.hasCode || CODE_PATTERN.test(code));

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setServerError(null);
    const body = { name: trimmedName };
    if (config.hasCode) body.code = code;
    if (kind === 'category') body.autoApprove = autoApprove;
    if (kind === 'building') body.campusId = parent.id;
    if (kind === 'room') body.buildingId = parent.id;
    try {
      onAdded(await createLookupEntry(kind, body));
    } catch (error) {
      setSaving(false);
      if (error.code === 'DUPLICATE_NAME') {
        setServerError({ field: 'name', message: error.message, existing: error.details.existing });
      } else if (error.code === 'DUPLICATE_CODE') {
        setServerError({ field: 'code', message: error.message });
      } else {
        setServerError({ field: 'form', message: "Couldn't save. Try again." });
      }
    }
  }

  // P6 "saving": the pop-up cannot be closed while the request runs.
  function close() {
    if (!saving) onClose();
  }

  return (
    <Modal
      open
      title={config.title}
      onClose={close}
      onSave={save}
      saveLabel={saving ? 'Saving…' : config.button}
      saveDisabled={!valid || saving || serverError?.field === 'name'}
    >
      {parent && <p className="text-[15px] text-muted">{parent.text}</p>}

      <div className="flex flex-col items-start gap-2">
        <div className="w-full">
          <Input
            id={`add-${kind}-name`}
            label={config.nameLabel ?? 'Name'}
            required
            maxLength={60}
            value={name}
            error={serverError?.field === 'name' ? serverError.message : nameError}
            onChange={(event) => {
              setName(event.target.value);
              if (serverError?.field !== 'form') setServerError(null);
            }}
            onBlur={() => setNameTouched(true)}
          />
        </div>
        {serverError?.existing && (
          <Button variant="secondary" onClick={() => onUse(serverError.existing)}>
            Use {serverError.existing.name}
          </Button>
        )}
      </div>

      {config.hasCode && (
        <div>
          <Input
            id={`add-${kind}-code`}
            label="Short code"
            required
            mono
            maxLength={5}
            value={code}
            hint={suggested ? `Suggested: ${suggested} · you can change it` : undefined}
            error={serverError?.field === 'code' ? serverError.message : undefined}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase());
              setCodeEdited(true);
              if (serverError?.field === 'code') setServerError(null);
            }}
          />
          <p className="mt-3 text-xs text-muted">
            2–5 characters · capital letters and digits only · unique in this list
          </p>
        </div>
      )}

      {kind === 'category' && (
        <div>
          <Toggle
            id="add-category-auto-approve"
            label="Approve automatically"
            checked={autoApprove}
            onChange={setAutoApprove}
          />
          <p className="text-xs text-muted">
            On: borrow requests for this category are approved without a moderator
          </p>
        </div>
      )}

      {serverError?.field === 'form' && (
        <p role="alert" className="rounded-card bg-danger-bg px-4 py-3 text-sm text-danger">
          ! {serverError.message}
        </p>
      )}
      {saving && (
        <p role="status" className="text-xs text-muted">
          Saving… This pop-up cannot be closed.
        </p>
      )}
    </Modal>
  );
}
