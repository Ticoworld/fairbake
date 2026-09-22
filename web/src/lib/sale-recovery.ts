import { Connection, PublicKey } from "@solana/web3.js";
import type { SaleCreationOperation, SaleInspection, SaleRecoveryState } from "./sale-operation.ts";
import { classifySaleInspection } from "./sale-operation.ts";
import type { SaleRecord } from "./types.ts";

/**
 * Inspect the expected Sale PDA from on-chain state.
 * Returns null if the account cannot be fetched or parsed.
 */
export async function inspectSalePda(
  connection: Connection,
  salePda: PublicKey,
  expectedOperation: SaleCreationOperation,
): Promise<SaleInspection> {
  try {
    const account = await connection.getAccountInfo(salePda, "confirmed");

    if (!account) {
      return { exists: false, owner: null, creator: null, mint: null, creatorTokenAccount: null, saleSupply: null, minimumRaise: null, hardCap: null, maxPerWallet: null, startTime: null, endTime: null };
    }

    // Account must be owned by FairBake program
    const FAIRBAKE_PROGRAM_ID = "9GYL8FqGfCzWZ1v6w8F8yJ8QK3FPdBG8W8B1rHEVnzKQ";
    if (account.owner.toBase58() !== FAIRBAKE_PROGRAM_ID) {
      return { exists: true, owner: account.owner.toBase58(), creator: null, mint: null, creatorTokenAccount: null, saleSupply: null, minimumRaise: null, hardCap: null, maxPerWallet: null, startTime: null, endTime: null, error: "Account not owned by FairBake program" };
    }

    // Try to decode the account as a Sale from the IDL
    // This is a simplified representation - in practice you'd use Anchor's decode
    // For now, we'll expect a parsed Sale from the query system
    return { exists: true, owner: account.owner.toBase58(), creator: null, mint: null, creatorTokenAccount: null, saleSupply: null, minimumRaise: null, hardCap: null, maxPerWallet: null, startTime: null, endTime: null };
  } catch (error) {
    return { exists: false, owner: null, creator: null, mint: null, creatorTokenAccount: null, saleSupply: null, minimumRaise: null, hardCap: null, maxPerWallet: null, startTime: null, endTime: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Inspect a fetched Sale record and compare against stored operation intent.
 * Returns true if all immutable fields match the expected operation.
 */
export function inspectSaleRecord(
  saleRecord: SaleRecord | null | undefined,
  operation: SaleCreationOperation,
): boolean {
  if (!saleRecord) return false;

  return (
    saleRecord.data.creator.toBase58() === operation.creator &&
    saleRecord.data.mint.toBase58() === operation.mint &&
    saleRecord.data.creatorTokenAccount.toBase58() === operation.creatorTokenAccount &&
    saleRecord.data.saleSupply.toString() === operation.saleSupply &&
    saleRecord.data.minimumRaise.toString() === operation.minimumRaise &&
    saleRecord.data.hardCap.toString() === operation.hardCap &&
    saleRecord.data.maxPerWallet.toString() === operation.maxPerWallet &&
    saleRecord.data.startTime.toString() === operation.startTime &&
    saleRecord.data.endTime.toString() === operation.endTime
  );
}

/**
 * Check if a transaction signature has confirmed or failed.
 * Returns the status or null if unknown.
 */
export async function checkSignatureStatus(
  connection: Connection,
  signature: string,
): Promise<{ confirmed: boolean; err: unknown } | null> {
  try {
    const statuses = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    if (!statuses.value || statuses.value.length === 0) return null;
    const status = statuses.value[0];
    if (!status) return null;
    return {
      confirmed: status.confirmationStatus !== null && status.confirmationStatus !== "processed",
      err: status.err,
    };
  } catch {
    return null;
  }
}

/**
 * Classify the recovery state based on persisted operation and on-chain PDA state.
 * Follows the recovery rules from the specification.
 */
export function classifySaleRecovery(
  operation: SaleCreationOperation,
  pdaInspection: SaleInspection,
  currentBlockHeight: number,
): { state: string; recovery: "MATCHING_SALE" | "MISSING" | "UNSAFE_MISMATCH" } {
  const recovery = classifySaleInspection(operation, pdaInspection);

  // CASE A: matching sale exists
  if (recovery === "MATCHING_SALE") {
    return { state: "CASE_A_MATCHING_SALE", recovery };
  }

  // CASE B: sale absent + prepared
  if (recovery === "MISSING" && operation.phase === "PREPARED") {
    return { state: "CASE_B_PREPARED_NO_SUBMISSION", recovery };
  }

  // CASE C: sale absent + submitted
  if (recovery === "MISSING" && operation.phase === "SUBMITTED") {
    if (!operation.signature) {
      // CASE E: no signature stored
      if (operation.lastValidBlockHeight && currentBlockHeight <= operation.lastValidBlockHeight) {
        return { state: "CASE_E_WAITING_SIGNATURE_LIVE", recovery };
      }
      return { state: "CASE_E_BLOCKHASH_EXPIRED_FAILED", recovery };
    }
    return { state: "CASE_C_SUBMITTED_NO_SALE", recovery };
  }

  // CASE F: existing sale mismatch
  if (recovery === "UNSAFE_MISMATCH") {
    return { state: "CASE_F_MISMATCH", recovery };
  }

  return { state: "UNKNOWN", recovery };
}

/**
 * Determine if an explicit retry is allowed.
 */
export function canRetrySaleCreation(
  operation: SaleCreationOperation,
  recovery: SaleRecoveryState,
): boolean {
  // Retries only allowed if FAILED_RETRYABLE
  if (operation.phase !== "FAILED_RETRYABLE") return false;

  // And sale is still absent
  if (recovery !== "MISSING") return false;

  return true;
}

/**
 * Determine if a sale creation operation can be cleared/reset.
 * Safe only when complete or definitively failed and absent.
 */
export function canClearSaleCreation(
  operation: SaleCreationOperation,
  recovery: SaleRecoveryState,
): boolean {
  if (operation.phase === "COMPLETE") return true;
  if (operation.phase === "BLOCKED") return false;
  if (operation.phase === "PREPARED") return recovery === "MISSING";
  return false;
}
