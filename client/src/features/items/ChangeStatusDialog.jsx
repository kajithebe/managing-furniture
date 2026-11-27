import { useState } from 'react';
import { changeItemStatus } from '../../api/items.js';
import Input from '../../components/ui/Input.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { MAX_REASON, STATUS_LABELS } from './itemForm.js';

// M7 "Change status" pop-up (P9, MF-29): the five conditions as radio options with a short
// description, and a required Reason. The reason is saved in the item history as
// "NEEDS_REPAIR: Wobbly leg". Opened only while the item is not on loan.
// onSaved(item) gets the updated item from the server.
const OPTIONS = [
  { value: 'GOOD', label: 'Available', text: 'Ready to borrow' },
  { value: 'NEEDS_REPAIR', label: 'Needs repair', text: 'Can still be borrowed' },
  { value: 'BROKEN', label: 'Broken', text: 'Cannot be borrowed' },
  { value: 'IN_REPAIR', label: 'In repair', text: 'Being repaired' },
  { value: 'DISPOSED', label: 'Disposed', text: 'No longer in use' },
];

export default function ChangeStatusDialog({ item, onSaved, onClose }) {
  const [condition, setCondition] = useState(item.condition);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const reasonError = reasonTouched && !reason.trim() ? 'Enter a reason' : undefined;
  const disabled = condition === item.condition || !reason.trim() || saving;

  async function save() {
    if (disabled) {
      setReasonTouched(true);
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      onSaved(await changeItemStatus(item.code, { condition, reason: reason.trim() }));
    } catch (error) {
      setSaveError(error.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title="Change status"
      saveLabel="Change status"
      saveDisabled={disabled}
      onSave={save}
      onClose={onClose}
    >
      <p className="text-[15px] font-semibold text-ink">
        {item.name} <span className="font-mono font-normal">{item.code}</span> · now{' '}
        {STATUS_LABELS[item.status]}
      </p>
      <fieldset>
        {/* P9 shows no heading above the options; screen readers still hear "Status". */}
        <legend className="sr-only">Status</legend>
        {OPTIONS.map((option) => (
          <label key={option.value} className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
            <input
              type="radio"
              name="change-status"
              value={option.value}
              checked={condition === option.value}
              onChange={() => setCondition(option.value)}
              className="mt-1 h-4 w-4 accent-brand"
            />
            <span>
              <span className="block text-[15px] text-ink">{option.label}</span>
              <span className="block text-xs text-muted">{option.text}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Input
        id="change-status-reason"
        label="Reason"
        required
        maxLength={MAX_REASON}
        value={reason}
        error={reasonError}
        onChange={(event) => setReason(event.target.value)}
        onBlur={() => setReasonTouched(true)}
      />
      {saveError && (
        <p role="alert" className="rounded-card bg-danger-bg px-4 py-3 text-sm text-danger">
          ! {saveError}
        </p>
      )}
    </Modal>
  );
}
