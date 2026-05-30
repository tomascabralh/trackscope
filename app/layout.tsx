import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "trackscope",
  description:
    "Reference-track analyzer: BPM, key, loudness, structure, and a local-LLM production-notes breakdown.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <footer
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            color: "#666",
            padding: "1.25rem 2rem",
            borderTop: "1px solid #1f1f1f",
          }}
        >
          made by tch
        </footer>
      </body>
    </html>
  );
}
