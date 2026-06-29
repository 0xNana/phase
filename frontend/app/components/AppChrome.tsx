"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronsLeft, ChevronsRight, Coins, Eye, Home, Menu, Send, UserCheck, X } from "lucide-react";
import WalletDropdown from "./WalletDropdown";

const navLinks: Array<{
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
}> = [
  {
    href: "/",
    label: "Home",
    description: "Overview",
    icon: Home,
    match: (pathname) => pathname === "/",
  },
  {
    href: "/admin",
    label: "Admin",
    description: "Drops",
    icon: Send,
    match: (pathname) => pathname.startsWith("/admin"),
  },
  {
    href: "/recipient",
    label: "Recipient",
    description: "Claims",
    icon: UserCheck,
    match: (pathname) => pathname.startsWith("/recipient") || pathname.startsWith("/claim"),
  },
  {
    href: "/observer",
    label: "Observer",
    description: "Proofs",
    icon: Eye,
    match: (pathname) => pathname.startsWith("/observer"),
  },
  {
    href: "/faucet",
    label: "Faucet",
    description: "cUSDC",
    icon: Coins,
    match: (pathname) => pathname.startsWith("/faucet"),
  },
];

const footerFaqs = [
  {
    question: "What makes a Phase airdrop private?",
    answer: "Recipient amounts stay sealed by default. Each wallet reveals only its own allocation, while public views use masked recipients and proof hashes.",
  },
  {
    question: "Which airdrop types can teams configure?",
    answer: "Teams can launch claimable, bulk, and vested private airdrops from the same admin workspace.",
  },
  {
    question: "What powers Phase airdrops?",
    answer: "Phase is built on TokenOps SDK for private airdrop creation, recipient claims, and proof-aware campaign flows.",
  },
  {
    question: "Who can reveal an allocation?",
    answer: "Only the matching recipient wallet can reveal the amount attached to its claim.",
  },
  {
    question: "What can observers verify?",
    answer: "Observers can track status, claim activity, masked recipients, and proof hashes without seeing plaintext allocation values.",
  },
];

export default function AppChrome({ children }: { children: React.ReactNode; campaignId?: string }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem("phase_sidebar_collapsed") === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("phase_sidebar_collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <div className={`app-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="mobile-shell-header">
        <div className="mobile-shell-bar">
          <div className="mobile-brand-group">
            <button
              type="button"
              className="icon-button"
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>

            <BrandLink compact={false} />
          </div>

          <div className="mobile-wallet-slot">
            <WalletDropdown />
          </div>
        </div>
      </header>

      <aside className="app-sidebar" aria-label="Primary navigation">
        <div className="sidebar-brand-row">
          <BrandLink compact={sidebarCollapsed} />
          <button
            type="button"
            className="icon-button sidebar-toggle"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={sidebarCollapsed}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            {sidebarCollapsed ? <ChevronsRight size={18} aria-hidden="true" /> : <ChevronsLeft size={18} aria-hidden="true" />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navLinks.map((link) => (
            <SidebarLink
              key={link.href}
              href={link.href}
              label={link.label}
              description={link.description}
              icon={link.icon}
              active={link.match(pathname)}
              collapsed={sidebarCollapsed}
            />
          ))}
        </nav>
      </aside>

      {mobileOpen ? (
        <div className="mobile-nav-overlay">
          <button className="mobile-nav-scrim" type="button" aria-label="Close navigation menu" onClick={() => setMobileOpen(false)} />
          <aside className="mobile-nav-drawer" aria-label="Primary navigation">
            <div className="mobile-drawer-header">
              <BrandLink compact={false} />
              <button type="button" className="icon-button" aria-label="Close navigation menu" onClick={() => setMobileOpen(false)}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <nav className="mobile-nav-list">
              {navLinks.map((link) => (
                <MobileNavLink
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  description={link.description}
                  icon={link.icon}
                  active={link.match(pathname)}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </nav>
          </aside>
        </div>
      ) : null}

      <div className="content-shell">
        <header className="desktop-walletbar">
          <WalletDropdown />
        </header>

        <main id="main-content" className="main-surface">
          {children}
        </main>

        <footer className="app-footer">
          <section className="app-footer-faq" aria-labelledby="footer-faq-title">
            <div className="app-footer-faq-heading">
              <h2 id="footer-faq-title">FAQ</h2>
            </div>
            <div className="app-footer-faq-list">
              {footerFaqs.map((faq) => (
                <details className="app-footer-faq-item" key={faq.question}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <div className="app-footer-content">
            <div className="app-footer-brand">
              <Link className="footer-brand-link" href="/" aria-label="Phase home">
                <Image className="footer-logo" src="/phase-logo.png" alt="" aria-hidden="true" width={34} height={34} />
                <span>Phase</span>
              </Link>
              <p>Private airdrops built on TokenOps SDK.</p>
            </div>

            <nav className="app-footer-nav" aria-label="Footer navigation">
              <span className="footer-column-title">Navigate</span>
              <Link href="/">Home</Link>
              <Link href="/admin">Admin</Link>
              <Link href="/recipient">Recipient</Link>
              <Link href="/observer">Observer</Link>
              <Link href="/faucet">Faucet</Link>
            </nav>

            <div className="app-footer-social" aria-label="Social channels">
              <span className="footer-column-title">Social</span>
              <div className="app-footer-social-row">
                <span className="social-icon" role="img" aria-label="Discord">
                  <DiscordIcon />
                </span>
                <span className="social-icon" role="img" aria-label="X">
                  <XIcon />
                </span>
                <span className="social-icon" role="img" aria-label="Telegram">
                  <TelegramIcon />
                </span>
              </div>
            </div>
          </div>

          <p className="app-footer-legal">© 2026 Phase</p>
        </footer>
      </div>
    </div>
  );
}

function BrandLink({ compact }: { compact: boolean }) {
  return (
    <Link className={`brand-link ${compact ? "is-compact" : ""}`} href="/" aria-label="Phase home" title={compact ? "Phase home" : undefined}>
      <Image className="brand-logo" src="/phase-logo.png" alt="" aria-hidden="true" width={38} height={38} priority />
      <span className="brand-copy">
        <span className="brand-name">Phase</span>
        <span className="brand-subtitle">Private airdrops</span>
      </span>
    </Link>
  );
}

function SidebarLink({
  href,
  label,
  description,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      className={`sidebar-link ${active ? "is-active" : ""} ${collapsed ? "is-compact" : ""}`}
      href={href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
    >
      <span className="sidebar-link-icon">
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="sidebar-link-copy">
        <span className="sidebar-link-label">{label}</span>
        <span className="sidebar-link-description">{description}</span>
      </span>
    </Link>
  );
}

function MobileNavLink({
  href,
  label,
  description,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link className={`mobile-nav-link ${active ? "is-active" : ""}`} href={href} aria-current={active ? "page" : undefined} onClick={onClick}>
      <span className="mobile-nav-link-main">
        <Icon size={18} aria-hidden="true" />
        <span>
          <span className="mobile-nav-link-label">{label}</span>
          <span className="mobile-nav-link-description">{description}</span>
        </span>
      </span>
      <span aria-hidden="true">-&gt;</span>
    </Link>
  );
}

function DiscordIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M19.5 5.6A16.1 16.1 0 0 0 15.6 4l-.5 1.1a14.2 14.2 0 0 0-4.2 0L10.4 4a16.1 16.1 0 0 0-3.9 1.6C4 9.4 3.3 13 3.6 16.6A15.9 15.9 0 0 0 8.4 19l1-1.3a10.3 10.3 0 0 1-1.6-.8l.4-.3a11.6 11.6 0 0 0 7.6 0l.4.3c-.5.3-1 .6-1.6.8l1 1.3a15.9 15.9 0 0 0 4.8-2.4c.4-4.2-.7-7.8-2.9-11ZM9.2 14.3c-.8 0-1.4-.7-1.4-1.6s.6-1.6 1.4-1.6 1.4.7 1.4 1.6-.6 1.6-1.4 1.6Zm5.6 0c-.8 0-1.4-.7-1.4-1.6s.6-1.6 1.4-1.6 1.4.7 1.4 1.6-.6 1.6-1.4 1.6Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M13.7 10.6 20.2 3h-1.6l-5.6 6.5L8.5 3H3.2l6.8 9.8L3.2 21h1.6l5.9-6.9 4.8 6.9h5.3l-7.1-10.4Zm-2.1 2.5-.7-1L5.5 4.2h2.2l4.4 6.3.7 1 5.7 8.3h-2.2l-4.7-6.7Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M21 4.4c.3-1-.6-1.6-1.5-1.2L3.7 9.3c-1 .4-1 1.4-.2 1.7l4 1.2 1.5 4.6c.2.7.4 1 .9 1 .4 0 .6-.2.9-.5l2.2-2.1 4.5 3.3c.8.4 1.4.2 1.6-.8L21 4.4Zm-3.4 3-8.2 7.5-.3 3-1.2-4 9.8-6.2c.4-.3.3-.4-.1-.2Z" />
    </svg>
  );
}
