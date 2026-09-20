import { Connection, PublicKey } from "@solana/web3.js";
import { METADATA_PROGRAM_ID } from "./config";
import { findMetadataPda } from "./pda";
import type { TokenMetadata } from "./types";

function readString(data: Buffer, offset: number): { value: string; next: number } {
  const length = data.readUInt32LE(offset);
  const next = offset + 4;
  return { value: data.subarray(next, next + length).toString("utf8").replace(/\0/g, "").trim(), next: next + length };
}

export async function fetchTokenMetadata(connection: Connection, mint: PublicKey): Promise<TokenMetadata | null> {
  try {
    const account = await connection.getAccountInfo(findMetadataPda(mint, METADATA_PROGRAM_ID), "confirmed");
    if (!account || account.data.length < 100) return null;
    let offset = 1 + 32 + 32;
    const name = readString(account.data, offset); offset = name.next;
    const symbol = readString(account.data, offset); offset = symbol.next;
    const uri = readString(account.data, offset);
    if (!name.value && !symbol.value) return null;
    const metadata: TokenMetadata = { name: name.value, symbol: symbol.value, uri: uri.value || undefined };
    if (uri.value && /^https?:\/\//i.test(uri.value)) {
      try {
        const response = await fetch(uri.value, { signal: AbortSignal.timeout(3500), cache: "no-store" });
        if (response.ok) {
          const json = (await response.json()) as { image?: unknown };
          if (typeof json.image === "string" && /^https?:\/\//i.test(json.image)) metadata.image = json.image;
        }
      } catch {
        // Metadata HTTP is optional. The on-chain name/symbol remain authoritative.
      }
    }
    return metadata;
  } catch {
    return null;
  }
}
