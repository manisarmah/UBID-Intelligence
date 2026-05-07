"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Master Data" },
    { href: "/upload-events", label: "Event Streams" },
    { href: "/review", label: "Master Review" },
    { href: "/review-events", label: "Event Review" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/audit", label: "Audit / Undo" },
    { href: "/query", label: "Ask AI (NLQ)" }
  ];

  return (
    <nav className="nav-links" style={{ display: "flex", gap: "0.5rem" }}>
      {links.map((link) => {
        const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link ${isActive ? "active" : ""}`}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              fontWeight: isActive ? "600" : "500",
              color: isActive ? "white" : "var(--text-secondary)",
              backgroundColor: isActive ? "rgba(255,255,255,0.1)" : "transparent",
              transition: "all 0.2s ease",
              textDecoration: "none"
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
