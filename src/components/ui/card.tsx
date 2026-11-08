import type { HTMLAttributes, ReactNode } from 'react';

export type CardProps = HTMLAttributes<HTMLElement> & { children: ReactNode };

export function Card({ className = '', children, ...props }: CardProps) {
  return <section className={`ui-card ${className}`.trim()} {...props}>{children}</section>;
}

export function CardHeader({ className = '', children, ...props }: CardProps) {
  return <div className={`ui-card-header ${className}`.trim()} {...props}>{children}</div>;
}

export function CardContent({ className = '', children, ...props }: CardProps) {
  return <div className={`ui-card-content ${className}`.trim()} {...props}>{children}</div>;
}
