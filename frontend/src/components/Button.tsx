import { forwardRef, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'danger' | 'ghost';
}

const VARIANT_CLASS: Record<string, string> = {
  default: 'veris-btn-ghost',
  primary: 'veris-btn-primary',
  secondary: 'veris-btn-secondary',
  danger: 'veris-btn-danger',
  ghost: 'veris-btn-ghost',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={[VARIANT_CLASS[variant] || 'veris-btn-ghost', className].filter(Boolean).join(' ').trim()}
      {...props}
    >
      {props.children}
    </button>
  )
);

Button.displayName = 'Button';