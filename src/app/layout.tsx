import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "UBID Platform",
  description: "Unified Business Identifier Platform for Karnataka",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="nav-header">
          <div className="nav-logo" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ backgroundColor: "var(--primary-color)", padding: "0.25rem 0.5rem", borderRadius: "4px", fontWeight: "900", color: "#fff" }}>UBID</span>
            Intelligence
          </div>
          <Navigation />
        </header>
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
