import { parseUnits } from "viem";
import { safeAddress } from "./format";
import type { RecipientCsvRow } from "./types";

export interface CsvParseResult {
  rows: RecipientCsvRow[];
  errors: string[];
}

export function parseRecipientCsv(input: string): CsvParseResult {
  const errors: string[] = [];
  const rows: RecipientCsvRow[] = [];
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  lines.forEach((line, index) => {
    if (index === 0 && /address/i.test(line) && /amount/i.test(line)) return;

    const [addressValue, amountValue] = line.split(",").map((part) => part?.trim());
    const address = addressValue ? safeAddress(addressValue) : null;
    if (!address) {
      errors.push(`Line ${index + 1}: invalid wallet address`);
      return;
    }

    if (!amountValue || !/^\d+(\.\d{1,6})?$/.test(amountValue)) {
      errors.push(`Line ${index + 1}: amount must use up to 6 decimals`);
      return;
    }

    rows.push({
      address,
      amount: parseUnits(amountValue, 6),
    });
  });

  const seen = new Set<string>();
  for (const row of rows) {
    const key = row.address.toLowerCase();
    if (seen.has(key)) errors.push(`Duplicate recipient: ${row.address}`);
    seen.add(key);
  }

  return { rows, errors };
}
