import type { ReactNode } from "react";
import { CheckCircle2, EyeOff, FileCheck2, LockKeyhole, ShieldCheck, Users } from "lucide-react";

import { maskAddress } from "@/lib/format";
import type { Campaign, PublicRecipientPreview } from "@/lib/types";

export default function ObserverView({ campaign }: { campaign: Campaign }) {
  const isBatch = campaign.kind === "batch";
  const progress = progressPercent(campaign.claimsCount, campaign.recipientCount);
  const proofRows = campaign.previews.slice(0, 12);
  const statusLabel = observerStatusLabel(campaign);

  return (
    <section className="observer-detail panel overflow-hidden">
      <div className="observer-detail-header">
        <div>
          <h1>{campaign.name}</h1>
        </div>
        <div className="observer-detail-status" aria-label="Observer status">
          <span className={observerStatusPillClass(campaign)}>{statusLabel}</span>
          <strong>{isBatch ? statusLabel : `${progress}% claimed`}</strong>
          <small>{isBatch ? "Rows sealed" : campaign.claimsCount.toLocaleString() + " proofs"}</small>
        </div>
      </div>

      <div className="observer-detail-stats" aria-label="Observer campaign facts">
        <DetailStat icon={<Users size={18} aria-hidden="true" />} label="Recipients" value={campaign.recipientCount.toLocaleString()} />
        <DetailStat icon={<FileCheck2 size={18} aria-hidden="true" />} label={isBatch ? "Mode" : "Proofs"} value={isBatch ? "Direct" : campaign.claimsCount.toLocaleString()} />
        <DetailStat icon={<ShieldCheck size={18} aria-hidden="true" />} label={isBatch ? "Campaign" : "Airdrop"} value={campaign.airdropAddress ? maskAddress(campaign.airdropAddress) : isBatch ? "Batch disperse" : "Not created"} />
        <DetailStat icon={<LockKeyhole size={18} aria-hidden="true" />} label="Token" value={maskAddress(campaign.tokenAddress)} />
      </div>

      <section className="observer-detail-table">
        <div className="observer-detail-table-header">
          <div>
            <h2>{isBatch ? "Distribution" : "Proofs"}</h2>
          </div>
          <div className="observer-detail-boundary">
            <EyeOff size={16} aria-hidden="true" />
            <span>Sealed</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="border-b border-[var(--line)] bg-[var(--surface-soft)] text-left text-xs font-bold uppercase text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3">{isBatch ? "Batch" : "Event"}</th>
                <th className="px-5 py-3">Recipient</th>
                <th className="px-5 py-3">Allocation</th>
                <th className="px-5 py-3">Proof</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {proofRows.length > 0 ? (
                proofRows.map((preview, index) => <ProofRow key={preview.proofHash} preview={preview} index={index} />)
              ) : (
                <tr>
                  <td className="px-5 py-6 text-[var(--muted)]" colSpan={6}>
                    {isBatch ? "No public rows yet." : "No proofs yet."}
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

function DetailStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="observer-detail-stat">
      <span className="observer-detail-stat-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function ProofRow({ preview, index }: { preview: PublicRecipientPreview; index: number }) {
  return (
    <tr className="bg-white transition-colors hover:bg-[var(--surface-soft)]">
      <td className="px-5 py-4 text-sm text-[var(--muted)]">Public event #{index + 1}</td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="mono text-sm">{preview.maskedAddress}</span>
          <span className="rounded bg-[rgba(15,118,110,0.08)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--teal)]">MASKED</span>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="observer-sealed-amount"><LockKeyhole size={14} aria-hidden="true" /> Sealed</span>
      </td>
      <td className="mono max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap px-5 py-4 text-sm text-[var(--muted)]">{preview.proofHash}</td>
      <td className="px-5 py-4">
        <span className={preview.status === "claimed" ? "pill pill-live" : preview.status === "revealed" ? "pill pill-watch" : "pill pill-sealed"}>
          {preview.status === "claimed" ? "Verified" : preview.status}
        </span>
      </td>
      <td className="px-5 py-4 text-right">
        <CheckCircle2 size={18} className="ml-auto text-[var(--green)]" aria-hidden="true" />
      </td>
    </tr>
  );
}

function progressPercent(claims: number, recipients: number): number {
  if (recipients === 0) return 0;
  return Math.min(100, Math.round((claims / recipients) * 100));
}
