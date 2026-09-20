import { PublicKey } from "@solana/web3.js";

export const COOKIE_RPC =
  process.env.NEXT_PUBLIC_COOKIE_RPC ?? "https://rpc.cookiescan.io";
export const COOKIE_EXPLORER =
  process.env.NEXT_PUBLIC_COOKIE_EXPLORER ?? "https://cookiescan.io";
export const FAIRBAKE_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_FAIRBAKE_PROGRAM_ID ??
    "8ZxnPLAfaSja6MrS6z21QZsohrW515v3cjXA3dMucnuX",
);
export const METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);
export const COOKIE_DECIMALS = 9;
export const COOKIE_LOGO_URL = "https://raw.githubusercontent.com/cookiechain/apps/main/logos/cookiescan.png";
export const COOKIE_GENESIS_HASH_FALLBACK =
  "9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2";

export const STATUS = {
  ACTIVE: 1,
  FINALIZED_SUCCESS: 2,
  FINALIZED_FAILED: 3,
} as const;

export type SaleStatus = "UPCOMING" | "LIVE" | "ENDED_AWAITING_FINALIZATION" | "SUCCESS" | "FAILED";

export function getSaleStatus(status: number, startTime: bigint, endTime: bigint, now = BigInt(Math.floor(Date.now() / 1000))): SaleStatus {
  if (status === STATUS.FINALIZED_SUCCESS) return "SUCCESS";
  if (status === STATUS.FINALIZED_FAILED) return "FAILED";
  if (now < startTime) return "UPCOMING";
  if (now <= endTime) return "LIVE";
  return "ENDED_AWAITING_FINALIZATION";
}
