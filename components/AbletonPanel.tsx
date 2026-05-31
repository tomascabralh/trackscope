import SectionHeading from "./SectionHeading";
import { WipBadge } from "./Tabs";

const MONO = "var(--font-geist-mono), monospace";
const SANS = "var(--font-geist-sans), system-ui, sans-serif";

export default function AbletonPanel() {
  return (
    <section>
      <SectionHeading title="ableton-mcp" right={<WipBadge />} />
      <div
        style={{
          border: "1px solid #1c1c1c",
          background: "#0c0c0c",
          padding: "2.75rem 1.5rem",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: MONO,
            fontSize: 13,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#888",
            margin: 0,
          }}
        >
          coming soon
        </p>
        <p
          style={{
            fontFamily: SANS,
            fontSize: 13.5,
            lineHeight: 1.65,
            color: "#777",
            maxWidth: 440,
            margin: "0.85rem auto 0",
          }}
        >
          Drive Ableton Live straight from your reference analysis — push detected
          sections as locators, match the project tempo and key, and build a
          starting arrangement from the breakdown.
        </p>
      </div>
    </section>
  );
}
