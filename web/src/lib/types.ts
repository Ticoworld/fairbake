import type { PublicKey } from "@solana/web3.js";
import type { SaleStatus } from "./config";

export type SaleAccount = {
  creator: PublicKey;
  mint: PublicKey;
  creatorTokenAccount: PublicKey;
  saleSupply: bigint;
  minimumRaise: bigint;
  hardCap: bigint;
  maxPerWallet: bigint;
  startTime: bigint;
  endTime: bigint;
  totalCommitted: bigint;
  finalAcceptedRaise: bigint;
  creatorProceeds: bigint;
  refundReserve: bigint;
  refundClaimedTotal: bigint;
  acceptedClaimedTotal: bigint;
  nativeRefundDust: bigint;
  tokenAllocationClaimed: bigint;
  buyerCount: bigint;
  claimedBuyerCount: bigint;
  treasuryRentLamports: bigint;
  status: number;
  bump: number;
  vaultBump: number;
  treasuryBump: number;
  proceedsWithdrawn: boolean;
  inventoryWithdrawn: boolean;
};

export type BuyerPositionAccount = {
  sale: PublicKey;
  buyer: PublicKey;
  buyerTokenAccount: PublicKey;
  contributed: bigint;
  committedBefore: bigint;
  claimed: boolean;
};

export type TokenMetadata = {
  name: string;
  symbol: string;
  uri?: string;
  image?: string;
};

export type SaleRecord = {
  address: PublicKey;
  data: SaleAccount;
  metadata: TokenMetadata | null;
  fetchedAt: number;
};

export type BuyerPositionRecord = {
  address: PublicKey;
  data: BuyerPositionAccount;
};

export type SaleWithStatus = SaleRecord & { computedStatus: SaleStatus };
