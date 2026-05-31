import type { ReactNode } from "react";

interface SectionHeadingProps {
  title: string;
  right?: ReactNode;
}

export default function SectionHeading({ title, right }: SectionHeadingProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "1rem",
        margin: "0 0 1.1rem",
        paddingBottom: "0.65rem",
        borderBottom: "1px solid #1c1c1c",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: 12,
          fontWeight: 400,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#888",
          margin: 0,
        }}
      >
        {title}
      </h2>
      {right}
    </div>
  );
}
