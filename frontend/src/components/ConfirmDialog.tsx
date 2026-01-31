import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const { open, title, description, confirmText = 'Confirm', cancelText = 'Cancel', destructive, onConfirm, onClose } = props;

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/40" />
      <div className="fixed inset-0 grid place-items-center p-4">
        <DialogPanel className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
          <DialogTitle className="text-base font-semibold text-slate-900">{title}</DialogTitle>
          {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
          <div className="mt-5 flex items-center justify-end gap-2">
            <button className="rounded-md border px-3 py-1.5 text-sm" onClick={onClose}>
              {cancelText}
            </button>
            <button
              className={`rounded-md px-3 py-1.5 text-sm text-white ${
                destructive ? 'bg-rose-600 hover:bg-rose-500' : 'bg-slate-900 hover:bg-slate-800'
              }`}
              onClick={async () => {
                await onConfirm();
                onClose();
              }}
            >
              {confirmText}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

