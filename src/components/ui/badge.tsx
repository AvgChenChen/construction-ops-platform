import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success';
};

export function Badge({ tone = 'neutral', className = '', children, ...props }: BadgeProps) {
  return <span className={`ui-badge ui-badge-${tone} ${className}`.trim()} {...props}>{children}</span>;
}
