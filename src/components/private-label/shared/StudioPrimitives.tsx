import React from "react";
import Link from "next/link";
import styles from "../styles/PrivateLabel.module.css";

export function SectionEyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`${styles.heroEyebrow} ${className}`}>{children}</span>
  );
}

export function SectionHeading({
  title,
  subtitle,
  align = "left",
  dark = false,
}: {
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  dark?: boolean;
}) {
  return (
    <div
      style={{
        textAlign: align,
        marginBottom: "clamp(32px, 5vw, 48px)",
      }}
    >
      <h2
        style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: "clamp(26px, 3.6vw, 40px)",
          lineHeight: 1.15,
          fontWeight: "normal",
          color: dark ? "#FFFCF7" : "#171713",
          margin: "0 0 12px",
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            fontSize: "clamp(1rem, 1.6vw, 1.125rem)",
            lineHeight: 1.5,
            color: dark ? "#A3B8B0" : "#65746D",
            margin: "0 auto",
            maxWidth: "680px",
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function PreviewNotice({ text }: { text?: string }) {
  return (
    <p
      className={styles.illustrativeDisclosure}
      role="note"
      aria-label={text || "Digital mockup — illustrative only"}
    >
      {text || "Digital mockup — illustrative only"}
    </p>
  );
}
