import { isAddress, type Address, type Hex } from "viem";

export function maskAddress(address: string, head = 6, tail = 4): string {
  if (address.length <= head + tail) return address;
  return `${address.slice(0, head)}...${address.slice(-tail)}`;
}

export function safeAddress(value: string): Address | null {
  const trimmed = value.trim();
  return isAddress(trimmed) ? trimmed : null;
}

export function formatTokenUnits(value: bigint, decimals = 6): string {
  const negative = value < 0n;
  const raw = negative ? -value : value;
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = raw % scale;
  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toLocaleString()}${fractionText ? `.${fractionText}` : ""}`;
}

export function unixToDateInput(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

export function dateInputToUnix(value: string, fallback: number): number {
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : fallback;
}

export function hashish(seed: string): Hex {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0").repeat(8).slice(0, 64);
  return `0x${hex}`;
}

export function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

export function absoluteUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
