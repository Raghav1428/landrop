import { useEffect, useRef, useId, type ReactNode } from "react";
import { CloseIcon } from "./CloseIcon";
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby={titleId}
    >
      <div className="panel-head">
        <h2 id={titleId}>{title}</h2>
        <button onClick={onClose} aria-label="Dismiss dialog">
          <CloseIcon />
        </button>
      </div>
      {children}
    </dialog>
  );
}
