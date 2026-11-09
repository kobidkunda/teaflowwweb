"use client";

export function ProductAvailabilitySwitch({ enabled, pending, disabled, name, onChange }: {
  enabled: boolean;
  pending: boolean;
  disabled?: boolean;
  name: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`Enable ${name}`}
      aria-busy={pending}
      disabled={pending || disabled}
      onClick={onChange}
      className="button button-outline"
      style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, whiteSpace: "nowrap" }}
    >
      <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", width: 34, height: 20, borderRadius: 20, padding: 3, background: enabled ? "#23483a" : "#6a6e64" }}>
        <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", marginLeft: enabled ? 14 : 0 }} />
      </span>
      {pending ? "Saving…" : enabled ? "Enabled" : "Disabled"}
    </button>
  );
}
