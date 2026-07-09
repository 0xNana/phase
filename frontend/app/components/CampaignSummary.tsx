import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { maskAddress } from "@/lib/format";
import type { Campaign } from "@/lib/types";
import Stat from "./Stat";

export default function CampaignSummary({ campaign }: { campaign: Campaign }) {
  return (
    <aside className="grid gap-4">
      <section className="panel overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[var(--primary)] via-[var(--teal)] to-[var(--amber)]" />
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Distribution</span>
              <h1 className="mt-2 text-3xl font-[780] leading-tight">{campaign.name}</h1>
            </div>
            <span className={campaign.status === "live" ? "pill pill-live" : "pill pill-sealed"}>
              {campaign.status}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Private token distribution. Amounts stay sealed.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Stat label="Recipients" value={campaign.recipientCount.toLocaleString()} />
            <Stat label="Claims" value={campaign.claimsCount.toLocaleString()} />
            <Stat label="Total" value="sealed" hidden />
            <Stat label="Token" value={maskAddress(campaign.tokenAddress)} />
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="flex items-center gap-2">
          <LockKeyhole size={17} className="text-[var(--primary)]" aria-hidden="true" />
          <h2 className="font-bold">Privacy</h2>
        </div>
        <div className="mt-4 grid gap-2 text-sm">
          <PrivacyLine label="Admin" value="Setup, counts" />
          <PrivacyLine label="Recipient" value="Own amount" />
          <PrivacyLine label="Observer" value="Proof activity" />
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="font-bold">Open</h2>
        <div className="mt-4 grid gap-2">
          <Link className="button-secondary justify-between" href="/recipient">
            Recipient <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link className="button-secondary justify-between" href={`/observer/${campaign.id}`}>
            Observe <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </aside>
  );
}

function PrivacyLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-phase border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2">
      <span className="text-[var(--muted)]">{label}</span>
      <strong className="text-right text-sm">{value}</strong>
    </div>
  );
}
