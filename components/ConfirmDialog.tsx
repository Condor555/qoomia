'use client';

import AdaptiveSheet from './AdaptiveSheet';

type ConfirmDialogProps={
  open:boolean;
  title:string;
  message:string;
  confirmLabel?:string;
  cancelLabel?:string;
  busy?:boolean;
  destructive?:boolean;
  onConfirm:()=>void|Promise<void>;
  onClose:()=>void;
};

export default function ConfirmDialog({open,title,message,confirmLabel='Conferma',cancelLabel='Annulla',busy=false,destructive=false,onConfirm,onClose}:ConfirmDialogProps){
  return <AdaptiveSheet open={open} onClose={onClose} title={title} size="compact" busy={busy} showHeader={false}>
    <section className="confirm-sheet">
      <span className={destructive?'danger-icon':'confirm-icon'} aria-hidden="true">!</span>
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="confirm-sheet-actions">
        <button type="button" className="secondary" disabled={busy} onClick={onClose}>{cancelLabel}</button>
        <button type="button" className={destructive?'delete-btn':''} disabled={busy} onClick={()=>void onConfirm()}>{busy?'Attendi…':confirmLabel}</button>
      </div>
    </section>
  </AdaptiveSheet>;
}
