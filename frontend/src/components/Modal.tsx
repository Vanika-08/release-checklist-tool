import { useEffect, useRef, type ReactNode } from "react";

/** Native <dialog> gives focus trapping, Esc-to-close and a backdrop for free. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="modal"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="modal-title"
    >
      <div className="modal__body">
        <h2 id="modal-title" className="modal__title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
