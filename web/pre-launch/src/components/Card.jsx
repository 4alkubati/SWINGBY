import React from 'react';
import styles from './Card.module.css';

export default function Card({ imageUrl, title, subtitle, meta, actions, onClick, className }) {
  return (
    <div className={`${styles.card} ${className || ''}`} onClick={onClick} role={onClick ? 'button' : undefined}>
      {imageUrl && <img src={imageUrl} alt={title || ''} className={styles.cardImage} />}
      <div className={styles.cardBody}>
        {title && <div className={styles.cardTitle}>{title}</div>}
        {subtitle && <div className={styles.cardSubtitle}>{subtitle}</div>}
        {meta && <div className={styles.cardMeta}>{meta}</div>}
        {actions && <div className={styles.cardActions}>{actions}</div>}
      </div>
    </div>
  );
}
