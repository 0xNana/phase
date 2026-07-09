"use client";

import { useState } from "react";
import { CheckCircle2, Copy } from "lucide-react";

export default function CopyButton({
  value,
  label = "Copy",
  className = "button-secondary",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className={className} type="button" onClick={() => void handleCopy()}>
      {copied ? <CheckCircle2 size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      {copied ? "Copied" : label}
    </button>
  );
}
