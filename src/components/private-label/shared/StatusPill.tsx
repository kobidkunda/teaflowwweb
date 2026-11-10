import React from "react";
import styles from "../styles/PrivateLabel.module.css";

export interface StatusPillProps {
  label: string;
  variant?: "category" | "material" | "moq" | "neutral";
}

export function StatusPill({ label, variant = "neutral" }: StatusPillProps) {
  let variantClass = "";
  if (variant === "category") variantClass = styles.badgeCategory;
  if (variant === "material") variantClass = styles.badgeMaterial;

  return (
    <span
      className={`${styles.badge} ${variantClass}`}
      style={
        variant === "moq"
          ? { backgroundColor: "rgba(20, 60, 49, 0.08)", color: "#143C31" }
          : variant === "neutral"
          ? { backgroundColor: "rgba(101, 116, 109, 0.12)", color: "#4A5650" }
          : undefined
      }
    >
      {label}
    </span>
  );
}
