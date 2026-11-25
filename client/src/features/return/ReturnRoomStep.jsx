import { useRef, useState } from 'react';
import { getRoomByQr } from '../../api/rooms.js';
import Scanner from '../../components/ui/Scanner.jsx';
import { parseScan, SCANNER_VIDEO_CLASSES, useScanner } from '../../hooks/useScanner.js';
import { returnableItems } from '../loans/loanFormat.js';
import ReturnStep, { ErrorBox, LinkButton } from './ReturnStep.jsx';

// Home rooms of the items the student still has (APPROVED, OVERDUE), without repeats.
function homeRoomsOf(loan) {
  const rooms = new Map();
  for (const item of returnableItems(loan.items)) {
    rooms.set(item.homeRoom.id, item.homeRoom);
  }
  return [...rooms.values()];
}

// "Go to the home room D569" or, when the items belong in different rooms,
// "Go to one of the home rooms D569, D501" (the server accepts any of them; needs team agreement).
function goToText(names) {
  const where =
    names.length === 1 ? `the home room ${names[0]}` : `one of the home rooms ${names.join(', ')}`;
  return `Go to ${where} and scan the QR sticker next to the door.`;
}

// S8 wrong room: same wording as the server's WRONG_ROOM error (02 › Return).
function wrongRoomText(room, names) {
  return `This is ${room.name}. These items belong in ${names.join(' or ')}.`;
}

// S8 · Return step 1: scan the QR sticker next to the door of the home room.
// onRoom(room, roomRef) is called with the checked room { id, name } and how it was chosen:
// { roomQrToken } after a scan. The page sends roomRef with every return call (step 2).
export default function ReturnRoomStep({ loan, onRoom, onBack }) {
  const homeRooms = homeRoomsOf(loan);
  const names = homeRooms.map((room) => room.name);
  const [error, setError] = useState('');
  // True while a scanned room is being checked, so more frames of the same QR are ignored.
  const busy = useRef(false);

  async function handleScan(text) {
    if (busy.current) return;
    const result = parseScan(text);
    if (result?.type !== 'room') {
      setError("This QR code isn't a room label.");
      return;
    }

    busy.current = true;
    try {
      const room = await getRoomByQr(result.token);
      if (homeRooms.some((home) => home.id === room.id)) {
        onRoom({ id: room.id, name: room.name }, { roomQrToken: result.token });
      } else {
        setError(wrongRoomText(room, names));
      }
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      busy.current = false;
    }
  }

  const { regionId, error: cameraError } = useScanner({ onScan: handleScan });

  return (
    <ReturnStep
      title="Step 1: scan the room"
      footer={<LinkButton onClick={onBack}>Back to my loans</LinkButton>}
    >
      <p className="mt-3 text-[15px] text-ink">{goToText(names)}</p>

      {cameraError === 'denied' ? (
        <p className="mt-4 flex gap-3 rounded-card bg-warn-bg px-4 py-3 text-[15px] text-warn">
          <span aria-hidden="true">!</span>
          <span>Allow camera access in your browser to scan the room.</span>
        </p>
      ) : (
        <Scanner className="mt-4">
          <div id={regionId} className={SCANNER_VIDEO_CLASSES} />
        </Scanner>
      )}

      {error && <ErrorBox className="mt-4">{error}</ErrorBox>}
    </ReturnStep>
  );
}
