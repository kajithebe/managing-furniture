import { useRef, useState } from 'react';
import { getRoomByQr } from '../../api/rooms.js';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
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
// "Go to one of the home rooms D569, D501" (the server accepts any of them; agreed 26 Nov 2026).
function goToText(names) {
  const where =
    names.length === 1 ? `the home room ${names[0]}` : `one of the home rooms ${names.join(', ')}`;
  return `Go to ${where} and scan the QR sticker next to the door.`;
}

// S8 wrong room: same wording as the server's WRONG_ROOM error (02 › Return).
function wrongRoomText(roomName, names) {
  return `This is ${roomName}. These items belong in ${names.join(' or ')}.`;
}

// Room names are compared without spaces around them and without case: "d569 " = "D569".
function sameName(a, b) {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

// S8 · Return step 1: scan the QR sticker next to the door of the home room,
// or "Type the room instead" (S8 · Manual room).
// onRoom(room, roomRef) is called with the checked room { id, name } and how it was chosen:
// { roomQrToken } after a scan, { roomId } after typing (02 › Return, decided 23 Nov 2026).
// The page sends roomRef with every return call (step 2).
export default function ReturnRoomStep({ loan, onRoom, onBack }) {
  const homeRooms = homeRoomsOf(loan);
  const names = homeRooms.map((room) => room.name);
  const [error, setError] = useState('');
  const [typing, setTyping] = useState(false);
  const [typedName, setTypedName] = useState('');
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
        setError(wrongRoomText(room.name, names));
      }
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      busy.current = false;
    }
  }

  // The typed name is matched against the home rooms of this loan, so no other room can be
  // chosen and no extra API call is needed. The room id is then sent with the return call.
  function handleSubmit(event) {
    event.preventDefault();
    const room = homeRooms.find((home) => sameName(home.name, typedName));
    if (room) {
      onRoom({ id: room.id, name: room.name }, { roomId: room.id });
    } else {
      setError(wrongRoomText(typedName.trim(), names));
    }
  }

  const { regionId, error: cameraError } = useScanner({ onScan: handleScan });
  const denied = cameraError === 'denied';
  const showForm = typing || denied;

  return (
    <ReturnStep
      title="Step 1: scan the room"
      footer={<LinkButton onClick={onBack}>Back to my loans</LinkButton>}
    >
      <p className="mt-3 text-[15px] text-ink">{goToText(names)}</p>

      {denied ? (
        <p className="mt-4 flex gap-3 rounded-card bg-warn-bg px-4 py-3 text-[15px] text-warn">
          <span aria-hidden="true">!</span>
          <span>Allow camera access in your browser to scan, or type the room instead.</span>
        </p>
      ) : (
        <Scanner className="mt-4">
          <div id={regionId} className={SCANNER_VIDEO_CLASSES} />
        </Scanner>
      )}

      {error && <ErrorBox className="mt-4">{error}</ErrorBox>}

      {showForm ? (
        <form onSubmit={handleSubmit} noValidate className="mt-4">
          <Input
            id="return-room"
            label="Room"
            autoFocus={typing}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={60}
            placeholder={names[0]}
            value={typedName}
            onChange={(event) => {
              setTypedName(event.target.value);
              setError('');
            }}
          />
          <Button type="submit" fullWidth className="mt-4" disabled={!typedName.trim()}>
            Continue
          </Button>
        </form>
      ) : (
        <div className="mt-3 text-center">
          <LinkButton onClick={() => setTyping(true)}>Type the room instead</LinkButton>
        </div>
      )}
    </ReturnStep>
  );
}
