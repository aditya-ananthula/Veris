import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, ...props }, ref) => {
    const inputId = id || 'input-' + Math.random().toString(36).slice(2);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        {label && (
          <label htmlFor={inputId} style={{ fontSize: '0.75rem', color: 'var(--fg-soft)', fontWeight: 500 }}>
            {label}
          </label>
        )}
        <input ref={ref} id={inputId} {...props} />
        {error && <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';