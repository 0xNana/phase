import type { ReactNode } from "react";
import { ShieldCheck, Users } from "lucide-react";

import { explorerAddressUrl } from "@/lib/env";
import { maskAddress } from "@/lib/format";
import type { Campaign, PublicRecipientPreview } from "@/lib/types";

export default function ObserverView({ campaign }: { campaign: Campaign }) {
  const isBatch = campaign.kind === "batch";
  const progress = progressPercent(campaign.claimsCount, campaign.recipientCount);
  const proofRows = campaign.previews;
  const statusLabel = observerStatusLabel(campaign);
  const distributionHref = campaign.airdropAddress ? explorerAddressUrl(campaign.airdropAddress) : undefined;

  if (isBatch) {
    return (
      <section className="observer-detail panel overflow-hidden">
        <div className="observer-detail-header">
          <div>
            <h1>{campaign.name}</h1>
          </div>
          <div className="observer-detail-status" aria-label="Observer status">
            <span className={observerStatusPillClass(campaign)}>{statusLabel}</span>
            <strong>{statusLabel}</strong>
          </div>
        </div>

        <div className="observer-detail-stats" aria-label="Batch facts">
          <DetailStat icon={<Users size={18} aria-hidden="true" />} label="Recipients" value={campaign.recipientCount.toLocaleString()} />
        </div>

        <div className="observer-batch-note">
          <ShieldCheck size={17} aria-hidden="true" />
          <span>Private batch disperse. Recipient list and amounts sealed.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="observer-detail panel overflow-hidden">
      <div className="observer-detail-header">
        <div>
          <h1>{campaign.name}</h1>
        </div>
        <div className="observer-detail-status" aria-label="Observer status">
          <span className={observerStatusPillClass(campaign)}>{statusLabel}</span>
          <strong>{`${progress}% claimed`}</strong>
        </div>
      </div>

      <div className="observer-detail-stats" aria-label="Observer campaign facts">
        <DetailStat icon={<Users size={18} aria-hidden="true" />} label="Events" value={proofRows.length.toLocaleString()} />
        <DetailStat icon={<ShieldCheck size={18} aria-hidden="true" />} label="Distribution" value={campaign.airdropAddress ? maskAddress(campaign.airdropAddress) : "Not created"} href={distributionHref} />
      </div>

      <section className="observer-detail-table">
        <div className="observer-detail-table-header">
          <div>
            <h2>Proofs</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead className="border-b border-[var(--line)] bg-[var(--surface-soft)] text-left text-xs font-bold uppercase text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3">Event</th>
                <th className="px-5 py-3">Recipient</th>
                <th className="px-5 py-3">Proof</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {proofRows.length > 0 ? (
                proofRows.map((preview, index) => <ProofRow key={preview.proofHash} preview={preview} index={index} />)
              ) : (
                <tr>
                  <td className="px-5 py-6 text-[var(--muted)]" colSpan={4}>
                    No proofs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function observerStatusLabel(campaign: Campaign): string {
  if (campaign.kind !== "batch") return campaign.status;
  if (campaign.status === "ended") return "dispersed";
  if (campaign.status === "deploying") return "preparing";
  if (campaign.status === "live") return "active disperse";
  return "disperse setup";
}

function observerStatusPillClass(campaign: Campaign): string {
  if (campaign.kind === "batch") {
    if (campaign.status === "ended" || campaign.status === "live") return "pill pill-live";
    return "pill pill-watch";
  }
  return campaign.status === "live" ? "pill pill-live" : "pill pill-sealed";
}

function DetailStat({ icon, label, value, href }: { icon: ReactNode; label: string; value: string; href?: string }) {
  return (
    <div className="observer-detail-stat">
      <span className="observer-detail-stat-icon">{icon}</span>
      <div>
        <span>{label}</span>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer">
            {value}
          </a>
        ) : (
          <strong>{value}</strong>
        )}
      </div>
    </div>
  );
}

function ProofRow({ preview, index }: { preview: PublicRecipientPreview; index: number }) {
  return (
    <tr className="bg-white transition-colors hover:bg-[var(--surface-soft)]">
      <td className="px-5 py-4 text-sm text-[var(--muted)]">#{index + 1}</td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="mono text-sm">{preview.maskedAddress}</span>
        </div>
      </td>
      <td className="mono max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap px-5 py-4 text-sm text-[var(--muted)]">{preview.proofHash}</td>
      <td className="px-5 py-4">
        <span className={preview.status === "claimed" ? "pill pill-live" : preview.status === "revealed" ? "pill pill-watch" : "pill pill-sealed"}>
          {preview.status === "claimed" ? "Verified" : preview.status}
        </span>
      </td>
    </tr>
  );
}

function progressPercent(claims: number, recipients: number): number {
  if (recipients === 0) return 0;
  return Math.min(100, Math.round((claims / recipients) * 100));
}
