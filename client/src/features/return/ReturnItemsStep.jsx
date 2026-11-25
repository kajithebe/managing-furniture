import ReturnStep, { LinkButton, SuccessBox } from './ReturnStep.jsx';

// S9 · Return step 2: scan each item. The room from step 1 is confirmed at the top.
export default function ReturnItemsStep({ room, onBack }) {
  return (
    <ReturnStep
      title="Step 2: scan each item"
      footer={<LinkButton onClick={onBack}>Back to my loans</LinkButton>}
    >
      <SuccessBox className="mt-4">In room {room.name} ✓</SuccessBox>
    </ReturnStep>
  );
}
