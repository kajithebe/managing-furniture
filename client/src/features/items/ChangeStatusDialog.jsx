import { useState } from 'react';
import { changeItemStatus } from '../../api/items.js';
import Input from '../../components/ui/Input.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Select from '../../components/ui/Select.jsx';
import { CONDITIONS, MAX_REASON } from './itemForm.js';

// M7 "Change status" pop-up (MF-29). Not in the Figma pop-ups: built like P13 (item line,
// one choice, required Reason, Cancel / Save). The reason is saved in the item history as
// "NEEDS_REPAIR: Wobbly leg". Opened only while the item is not on loan.
// onSaved(item) gets the updated item from the server.
export default function ChangeStatusDialog({ item, onSaved, onClose }) {
  const [condition, setCondition] = useState(item.condition);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const reasonError = reasonTouched && !reason.trim() ? 'Enter a reason' : undefined;
  const unchanged = condition === item.condition;

  async function save() {
    if (unchanged || !reason.trim() || saving) {
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
      saveLabel="Save status"
      saveDisabled={unchanged || !reason.trim() || saving}
      onSave={save}
      onClose={onClose}
    >
      <p className="text-[15px] font-semibold text-ink">
        {item.name} <span className="font-mono font-normal">{item.code}</span>
      </p>
      <Select
        id="change-status"
        label="Status"
        required
        options={CONDITIONS}
        value={condition}
        onChange={(event) => setCondition(event.target.value)}
      />
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
