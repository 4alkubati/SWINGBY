import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './DropdownMenu.module.css';

export default function DropdownMenu({ trigger, items }) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const menuRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleKeyDown = useCallback((e) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
        setFocusIndex(0);
      }
      return;
    }
    const actionItems = items.filter((i) => i.type !== 'separator');
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIndex((p) => Math.min(p + 1, actionItems.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIndex((p) => Math.max(p - 1, 0)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); actionItems[focusIndex]?.onClick?.(); setOpen(false); }
    else if (e.key === 'Escape') { setOpen(false); }
  }, [open, focusIndex, items]);

  let actionIndex = -1;

  return (
    <div className={styles.wrapper} ref={wrapperRef} onKeyDown={handleKeyDown}>
      <button className={styles.trigger} onClick={() => setOpen(!open)} aria-haspopup="true" aria-expanded={open}>
        {trigger} <span>▾</span>
      </button>
      {open && (
        <div className={styles.menu} ref={menuRef} role="menu">
          {items.map((item, i) => {
            if (item.type === 'separator') return <div key={i} className={styles.separator} role="separator" />;
            actionIndex++;
            const idx = actionIndex;
            return (
              <button
                key={i}
                className={`${styles.item} ${item.destructive ? styles.destructive : ''} ${focusIndex === idx ? styles.focused : ''}`}
                role="menuitem"
                onClick={() => { item.onClick?.(); setOpen(false); }}
              >
                {item.icon} {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
