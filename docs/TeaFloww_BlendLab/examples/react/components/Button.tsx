import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

type Common = { children: ReactNode; variant?: 'primary' | 'secondary' | 'quiet'; className?: string };
type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: never };
type AnchorProps = Common & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/** Semantic button/link. Replace <a> with project router's Link where appropriate. */
export function Button(props: ButtonProps | AnchorProps) {
  const { children, variant = 'primary', className = '', ...rest } = props;
  const classes = `tl-button tl-button--${variant} ${className}`.trim();
  if ('href' in rest && typeof rest.href === 'string') {
    const anchorProps = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return <a {...anchorProps} className={classes}>{children}</a>;
  }
  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return <button type="button" {...buttonProps} className={classes}>{children}</button>;
}
