import Link from "next/link";
import type { PropsWithChildren } from "react";

type Variant = "gold" | "forest" | "outline";

export function ButtonLink({
  href,
  variant = "gold",
  children,
  className = "",
}: PropsWithChildren<{
  href: string;
  variant?: Variant;
  className?: string;
}>) {
  const variantClass = `tf-button--${variant}`;
  if (href.startsWith("#")) {
    return (
      <a href={href} className={`tf-button ${variantClass} ${className}`.trim()}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={`tf-button ${variantClass} ${className}`.trim()}>
      {children}
    </Link>
  );
}
