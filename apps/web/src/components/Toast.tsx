import { CloseIcon } from "./CloseIcon";
export function Toast({
  message,
  dismiss,
}: {
  message: string;
  dismiss: () => void;
}) {
  return (
    <div role="status" className="toast">
      <span>{message}</span>
      <button onClick={dismiss} aria-label="Dismiss notification">
        <CloseIcon />
      </button>
    </div>
  );
}
