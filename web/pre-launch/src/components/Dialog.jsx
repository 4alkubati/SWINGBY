import React, { useEffect, useRef } from 'react';
import styles from './Dialog.module.css';

export default function Dialog({ open, onClose, title, children, actions }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open && dialogRef.current) {
      const first = dialogRef.current.querySelector('button, [href], input, select, textarea');
      first?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={styles.dialog} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        {title && <div id="dialog-title" className={styles.title}>{title}</div>}
        <div className={styles.body}>{children}</div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  );
}
