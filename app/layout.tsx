import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resourceful Plug",
  description: "A Kiswahili-first WebMCP recovery layer for service portals.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
