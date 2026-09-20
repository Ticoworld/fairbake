import { BorshAccountsCoder } from "@anchor-lang/core";
import { Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import fairbakeIdl from "@/idl/fairbake.json";
import { COOKIE_RPC, FAIRBAKE_PROGRAM_ID } from "./config";
import { toBigInt } from "./format";
import { fetchTokenMetadata } from "./metadata";
import type { BuyerPositionAccount, BuyerPositionRecord, SaleAccount, SaleRecord } from "./types";

export const connection = new Connection(COOKIE_RPC, { commitment: "confirmed" });
const coder = new BorshAccountsCoder(fairbakeIdl as never);
const saleDiscriminator = bs58.encode(Buffer.from([202, 64, 232, 171, 178, 172, 34, 183]));
const positionDiscriminator = bs58.encode(Buffer.from([232, 163, 167, 95, 170, 210, 214, 83]));
const saleDiscriminatorBytes = Buffer.from(bs58.decode(saleDiscriminator));
const positionDiscriminatorBytes = Buffer.from(bs58.decode(positionDiscriminator));

function hasDiscriminator(data: Buffer, discriminator: Buffer) {
  return data.subarray(0, discriminator.length).equals(discriminator);
}

async function fetchProgramAccounts() {
  // Cookie RPC currently rejects web3.js memcmp filters even though the base RPC methods work.
  // Read the small FairBake account set once and filter by discriminator locally.
  return connection.getProgramAccounts(FAIRBAKE_PROGRAM_ID, { commitment: "confirmed" });
}

function normalizeSale(value: Record<string, unknown>): SaleAccount {
  return {
    creator: value.creator as PublicKey,
    mint: value.mint as PublicKey,
    creatorTokenAccount: value.creator_token_account as PublicKey,
    saleSupply: toBigInt(value.sale_supply),
    minimumRaise: toBigInt(value.minimum_raise),
    hardCap: toBigInt(value.hard_cap),
    maxPerWallet: toBigInt(value.max_per_wallet),
    startTime: toBigInt(value.start_time),
    endTime: toBigInt(value.end_time),
    totalCommitted: toBigInt(value.total_committed),
    finalAcceptedRaise: toBigInt(value.final_accepted_raise),
    creatorProceeds: toBigInt(value.creator_proceeds),
    refundReserve: toBigInt(value.refund_reserve),
    refundClaimedTotal: toBigInt(value.refund_claimed_total),
    acceptedClaimedTotal: toBigInt(value.accepted_claimed_total),
    nativeRefundDust: toBigInt(value.native_refund_dust),
    tokenAllocationClaimed: toBigInt(value.token_allocation_claimed),
    buyerCount: toBigInt(value.buyer_count),
    claimedBuyerCount: toBigInt(value.claimed_buyer_count),
    treasuryRentLamports: toBigInt(value.treasury_rent_lamports),
    status: Number(value.status),
    bump: Number(value.bump),
    vaultBump: Number(value.vaultBump),
    treasuryBump: Number(value.treasuryBump),
    proceedsWithdrawn: Boolean(value.proceeds_withdrawn),
    inventoryWithdrawn: Boolean(value.inventory_withdrawn),
  };
}

function normalizePosition(value: Record<string, unknown>): BuyerPositionAccount {
  return {
    sale: value.sale as PublicKey,
    buyer: value.buyer as PublicKey,
    buyerTokenAccount: value.buyer_token_account as PublicKey,
    contributed: toBigInt(value.contributed),
    committedBefore: toBigInt(value.committed_before),
    claimed: Boolean(value.claimed),
  };
}

async function withMetadata(address: PublicKey, data: SaleAccount): Promise<SaleRecord> {
  return { address, data, metadata: await fetchTokenMetadata(connection, data.mint), fetchedAt: Date.now() };
}

export async function fetchAllSales(): Promise<SaleRecord[]> {
  const accounts = (await fetchProgramAccounts()).filter(({ account }) => hasDiscriminator(account.data, saleDiscriminatorBytes));
  const decoded = accounts.map(({ pubkey, account }) => ({ address: pubkey, data: normalizeSale(coder.decode("Sale", account.data) as Record<string, unknown>) }));
  return Promise.all(decoded.map(({ address, data }) => withMetadata(address, data)));
}

export async function fetchSale(address: PublicKey): Promise<SaleRecord | null> {
  const account = await connection.getAccountInfo(address, "confirmed");
  if (!account) return null;
  return withMetadata(address, normalizeSale(coder.decode("Sale", account.data) as Record<string, unknown>));
}

export async function fetchBuyerPosition(sale: PublicKey, buyer: PublicKey): Promise<BuyerPositionRecord | null> {
  const [address] = PublicKey.findProgramAddressSync([Buffer.from("buyer-position"), sale.toBuffer(), buyer.toBuffer()], FAIRBAKE_PROGRAM_ID);
  const account = await connection.getAccountInfo(address, "confirmed");
  if (!account) return null;
  return { address, data: normalizePosition(coder.decode("BuyerPosition", account.data) as Record<string, unknown>) };
}

export async function fetchPositionsForBuyer(buyer: PublicKey): Promise<BuyerPositionRecord[]> {
  const buyerBytes = buyer.toBytes();
  const accounts = (await fetchProgramAccounts()).filter(({ account }) => hasDiscriminator(account.data, positionDiscriminatorBytes) && account.data.subarray(8 + 32, 8 + 32 + buyerBytes.length).equals(Buffer.from(buyerBytes)));
  return accounts.map(({ pubkey, account }) => ({ address: pubkey, data: normalizePosition(coder.decode("BuyerPosition", account.data) as Record<string, unknown>) }));
}

export async function fetchSalesCreatedBy(creator: PublicKey): Promise<SaleRecord[]> {
  const creatorBytes = creator.toBytes();
  const accounts = (await fetchProgramAccounts()).filter(({ account }) => hasDiscriminator(account.data, saleDiscriminatorBytes) && account.data.subarray(8, 8 + creatorBytes.length).equals(Buffer.from(creatorBytes)));
  return Promise.all(accounts.map(({ pubkey, account }) => withMetadata(pubkey, normalizeSale(coder.decode("Sale", account.data) as Record<string, unknown>))));
}

export async function fetchChainTime(): Promise<number> {
  const slot = await connection.getSlot("confirmed");
  const blockTime = await connection.getBlockTime(slot);
  return blockTime ?? Math.floor(Date.now() / 1000);
}
