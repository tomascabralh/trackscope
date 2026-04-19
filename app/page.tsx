import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        fontFamily: "monospace",
        padding: "2rem",
        maxWidth: 480,
      }}
    >
      <h1>bois</h1>
      <p>A family of web tools for electronic music producers.</p>
      <ul>
        <li>
          <Link href="/refboi">refboi</Link> — reference track analysis
        </li>
      </ul>
    </main>
  );
}
