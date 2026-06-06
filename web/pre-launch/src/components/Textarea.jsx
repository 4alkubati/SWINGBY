import { forwardRef, useRef, useCallback } from 'react'
import styles from './Textarea.module.css'

const Textarea = forwardRef(function Textarea(
  { label, error, maxLength, className, ...props },
  ref
) {
  const innerRef = useRef(null)
  const textareaRef = ref || innerRef

  const handleInput = useCallback((e) => {
    const el = e.target
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
    props.onChange?.(e)
  }, [props])

  const currentLength = props.value?.length || 0

  return (
    <div className={`${styles.wrapper} ${error ? styles.error : ''} ${className || ''}`}>
      {label && <label className={styles.label}>{label}</label>}
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        maxLength={maxLength}
        onInput={handleInput}
        {...props}
      />
      <div className={styles.footer}>
        {error && <span className={styles.helper}>{error}</span>}
        {maxLength && (
          <span className={styles.counter}>{currentLength}/{maxLength}</span>
        )}
      </div>
    </div>
  )
})

export default Textarea
