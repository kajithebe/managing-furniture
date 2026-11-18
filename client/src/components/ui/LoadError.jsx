import Button from './Button.jsx';
import Card from './Card.jsx';

// Shared "Error table" state (design-screens: Shared · Error table). Shown instead of a list
// when it could not be loaded; used by Dashboard panels, Requests, Not yet returned, Items,
// Reports, Settings and Users. "Try again" loads the list again with the same filters.
export default function LoadError({
  message = "Couldn't load items. Try again.",
  text = "We couldn't load this list. Your filters are kept.",
  onRetry,
  className = '',
}) {
  return (
    <Card className={className}>
      <p role="alert" className="rounded-card bg-danger-bg px-4 py-3 text-sm text-danger">
        ! {message}
      </p>
      <p className="mt-4 text-[15px] text-ink">{text}</p>
      <Button className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </Card>
  );
}
