import { homeRoomNames, returnableItems } from '../loans/loanFormat.js';
import ReturnStep, { LinkButton } from './ReturnStep.jsx';

// "Go to the home room D569" or, when the items belong in different rooms,
// "Go to one of the home rooms D569, D501" (the server accepts any of them; needs team agreement).
function goToText(rooms) {
  const where =
    rooms.length === 1 ? `the home room ${rooms[0]}` : `one of the home rooms ${rooms.join(', ')}`;
  return `Go to ${where} and scan the QR sticker next to the door.`;
}

// S8 · Return step 1: scan the room.
// Only items the student still has (APPROVED, OVERDUE) decide which home room is asked for.
export default function ReturnRoomStep({ loan, onBack }) {
  const rooms = homeRoomNames(returnableItems(loan.items));

  return (
    <ReturnStep
      title="Step 1: scan the room"
      footer={<LinkButton onClick={onBack}>Back to my loans</LinkButton>}
    >
      <p className="mt-3 text-[15px] text-ink">{goToText(rooms)}</p>
    </ReturnStep>
  );
}
