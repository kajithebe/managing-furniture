import Button from '../../components/ui/Button.jsx';
import ItemNames from './ItemNames.jsx';
import { doneText, notReturnedItems, notYetReturnedText, returnListItems } from './returnFormat.js';
import ReturnStep from './ReturnStep.jsx';

// S10 · Return done: "Loan closed" when every item is back, otherwise "Partly returned" with
// the items the student still has. Everything comes from the loan of the last return call.
export default function ReturnDoneStep({ loan, room, onBack }) {
  const listItems = returnListItems(loan.items);
  const left = notReturnedItems(listItems);
  const backCount = listItems.length - left.length;
  const warn = notYetReturnedText(left.length, loan.dueAt);

  return (
    <ReturnStep
      title="Return done"
      footer={
        <Button fullWidth onClick={onBack}>
          Back to my loans
        </Button>
      }
    >
      <p aria-hidden="true" className="mt-4 text-5xl leading-none text-brand">
        ✓
      </p>
      <p role="status" className="mt-6 text-xl font-semibold text-ink">
        {doneText(backCount, left.length === 0, room.name)}
      </p>

      {left.length > 0 && (
        <p className="mt-4 flex gap-3 rounded-card bg-warn-bg px-4 py-3 text-[15px] text-warn">
          <span aria-hidden="true">!</span>
          <span>
            {warn.before}
            <ItemNames items={left} />
            {warn.after}
          </span>
        </p>
      )}
    </ReturnStep>
  );
}
