import React from 'react';
import styles from './Button.module.css';

export default function Button({ variant = 'primary', label, onClick, loading, disabled, icon, className, ...props }) {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${className || ''}`}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className={styles.spinner} /> : icon}
      {label}
    </button>
  );
}
