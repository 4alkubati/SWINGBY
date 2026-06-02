import React, { useState } from 'react';
import styles from './TextField.module.css';

export default function TextField({ label, value, onChange, error, type = 'text', ...props }) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isFloated = focused || (value && value.length > 0);
  const inputType = type === 'password' && showPassword ? 'text' : type;

  return (
    <div className={styles.wrapper}>
      {label && (
        <span className={`${styles.label} ${isFloated ? styles.floated : ''} ${error ? styles.errorLabel : ''}`}>
          {label}
        </span>
      )}
      <input
        className={`${styles.field} ${error ? styles.hasError : ''}`}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        type={inputType}
        {...props}
      />
      {type === 'password' && (
        <button className={styles.togglePassword} onClick={() => setShowPassword(!showPassword)} type="button">
          {showPassword ? 'Hide' : 'Show'}
        </button>
      )}
      {error && <div className={styles.errorText}>{error}</div>}
    </div>
  );
}
