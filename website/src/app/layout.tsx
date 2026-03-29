import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gradience Protocol",
  description:
    "A Peer-to-Peer Capability Settlement Protocol for the AI Agent Economy",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
