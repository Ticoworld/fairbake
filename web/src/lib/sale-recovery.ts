import { BorshAccountsCoder } from "@anchor-lang/core";
import { Connection, PublicKey } from "@solana/web3.js";
import fairbakeIdl from "../idl/fairbake.json" with { type: "json" };
import { FAIRBAKE_PROGRAM_ID } from "./config.ts";
import { toBigInt } from "./format.ts";
import type {
  SaleCreationOperation,
  SaleCreationPhase,
  SaleInspection,
  SaleRecoveryState,
} from "./sale-operation.ts";
import { classifySaleInspection } from "./sale-operation.ts";

// ---------------------------------------------------------------------------
// Discriminator – taken directly from the IDL. Must match exactly.
// Sale account discriminator: [202, 64, 232, 171, 178, 172, 34, 183]
// ---------------------------------------------------------------------------
const SALE_DISCRIMINATOR = Buffer.from([202, 64, 232, 171, 178, 172, 34, 183]);

function hasSaleDiscriminator(data: Buffer): boolean {
  return (
    data.length >= SALE_DISCRIMINATOR.length &&
    data.subarray(0, SALE_DISCRIMINATOR.length).equals(SALE_DISCRIMINATOR)
  );
}

// One coder instance per module – safe to share across calls.
const coder = new BorshAccountsCoder(fairbakeIdl as never);

// ---------------------------------------------------------------------------
// inspectSalePda
//
// Fetches the expected Sale PDA and returns a fully-populated SaleInspection.
//
// Guarantees before any field access:
//   1. Account exists on-chain.
//   2. account.owner === FAIRBAKE_PROGRAM_ID (strict equality on PublicKey).
//   3. Account data begins with the Sale discriminator bytes.
//   4. BorshAccountsCoder successfully decodes the account as "Sale".
//
// If any of these fail the returned inspection is exists:true with
// all field nulls and an error string – classifySaleInspection will
// classify this as UNSAFE_MISMATCH.
// ---------------------------------------------------------------------------
export async function inspectSalePda(
  connection: Connection,
  salePda: PublicKey,
  _expectedOperation: SaleCreationOperation,
): Promise<SaleInspection> {
  const absent: SaleInspection = {
    exists: false,
    owner: null,
    creator: null,
    mint: null,
    creatorTokenAccount: null,
    saleSupply: null,
    minimumRaise: null,
    hardCap: null,
    maxPerWallet: null,
    startTime: null,
    endTime: null,
  };

  const unsafe = (owner: string, error: string): SaleInspection => ({
    exists: true,
    owner,
    creator: null,
    mint: null,
    creatorTokenAccount: null,
    saleSupply: null,
    minimumRaise: null,
    hardCap: null,
    maxPerWallet: null,
    startTime: null,
    endTime: null,
    error,
  });

  try {
    const account = await connection.getAccountInfo(salePda, "confirmed");
    if (!account) return absent;

    const ownerStr = account.owner.toBase58();

    // Step 1 – strict owner check.
    if (!account.owner.equals(FAIRBAKE_PROGRAM_ID)) {
      return unsafe(ownerStr, `Account owner ${ownerStr} is not the FairBake program`);
    }

    // Step 2 – discriminator check (before any BorshAccountsCoder call).
    const data = Buffer.from(account.data);
    if (!hasSaleDiscriminator(data)) {
      return unsafe(
        ownerStr,
        `Account does not begin with the Sale discriminator (first bytes: [${Array.from(data.subarray(0, 8)).join(",")}])`,
      );
    }

    // Step 3 – decode. BorshAccountsCoder.decode() may throw on malformed data.
    let decoded: Record<string, unknown>;
    try {
      decoded = coder.decode("Sale", data) as Record<string, unknown>;
    } catch (decodeError) {
      return unsafe(
        ownerStr,
        `Sale account failed Borsh decode: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}`,
      );
    }

    // Step 4 – extract and normalize the 9 immutable fields that must match the
    // stored intent.  toString() normalises both BN and bigint to a decimal
    // string, consistent with how SaleCreationOperation stores them.
    const creator = decoded.creator as PublicKey;
    const mint = decoded.mint as PublicKey;
    const creatorTokenAccount = decoded.creator_token_account as PublicKey;
    const saleSupply = toBigInt(decoded.sale_supply);
    const minimumRaise = toBigInt(decoded.minimum_raise);
    const hardCap = toBigInt(decoded.hard_cap);
    const maxPerWallet = toBigInt(decoded.max_per_wallet);
    const startTime = toBigInt(decoded.start_time);
    const endTime = toBigInt(decoded.end_time);

    return {
      exists: true,
      owner: ownerStr,
      creator: creator.toBase58(),
      mint: mint.toBase58(),
      creatorTokenAccount: creatorTokenAccount.toBase58(),
      saleSupply: saleSupply.toString(),
      minimumRaise: minimumRaise.toString(),
      hardCap: hardCap.toString(),
      maxPerWallet: maxPerWallet.toString(),
      startTime: startTime.toString(),
      endTime: endTime.toString(),
    };
  } catch (error) {
    return {
      ...absent,
      error: error instanceof Error ? error.message : "Unknown error fetching Sale PDA",
    };
  }
}

/**
 * Inspect a fetched Sale record and compare against stored operation intent.
 * Returns true if all immutable fields match the expected operation.
 */
export function inspectSaleRecord(
  saleRecord: import("./types.ts").SaleRecord | null | undefined,
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

// ---------------------------------------------------------------------------
// Recovery case union – exhaustive, strongly typed.
// ---------------------------------------------------------------------------
export type SaleRecoveryCase =
  | "CASE_A_MATCHING_SALE"
  | "CASE_B_PREPARED_NO_SUBMISSION"
  | "CASE_C_SUBMITTED_NO_SALE"
  | "CASE_E_WAITING_SIGNATURE_LIVE"
  | "CASE_E_BLOCKHASH_EXPIRED_FAILED"
  | "CASE_F_MISMATCH"
  | "UNKNOWN";

/**
 * Classify the recovery state based on persisted operation and on-chain PDA state.
 * Follows the recovery rules from the specification.
 */
export function classifySaleRecovery(
  operation: SaleCreationOperation,
  pdaInspection: SaleInspection,
  currentBlockHeight: number,
): { state: SaleRecoveryCase; recovery: SaleRecoveryState } {
  const recovery = classifySaleInspection(operation, pdaInspection);

  // CASE A: matching sale exists – regardless of operation phase or on-chain lifecycle state.
  if (recovery === "MATCHING_SALE") {
    return { state: "CASE_A_MATCHING_SALE", recovery };
  }

  // CASE B: sale absent + prepared (no submission has occurred).
  if (recovery === "MISSING" && operation.phase === "PREPARED") {
    return { state: "CASE_B_PREPARED_NO_SUBMISSION", recovery };
  }

  // CASE C / E: sale absent + submitted.
  if (recovery === "MISSING" && operation.phase === "SUBMITTED") {
    if (!operation.signature) {
      // No signature persisted yet – distinguish by blockhash liveness.
      if (operation.lastValidBlockHeight && currentBlockHeight <= operation.lastValidBlockHeight) {
        return { state: "CASE_E_WAITING_SIGNATURE_LIVE", recovery };
      }
      return { state: "CASE_E_BLOCKHASH_EXPIRED_FAILED", recovery };
    }
    // Signature recorded but sale still absent – must inspect signature status.
    return { state: "CASE_C_SUBMITTED_NO_SALE", recovery };
  }

  // CASE F: existing sale but fields differ.
  if (recovery === "UNSAFE_MISMATCH") {
    return { state: "CASE_F_MISMATCH", recovery };
  }

  return { state: "UNKNOWN", recovery };
}

/**
 * Determine if an explicit retry is allowed.
 * Only safe when operation is FAILED_RETRYABLE AND the expected PDA is absent.
 */
export function canRetrySaleCreation(
  operation: SaleCreationOperation,
  recovery: SaleRecoveryState,
): boolean {
  // Retries only allowed if FAILED_RETRYABLE.
  if (operation.phase !== "FAILED_RETRYABLE") return false;

  // And sale is still absent.
  if (recovery !== "MISSING") return false;

  return true;
}

/**
 * Authoritative clearing policy for a SaleCreationOperation.
 *
 * COMPLETE  – clearable (only via the intentional "Create another token" path).
 * PREPARED  – clearable only if the expected PDA is confirmed absent (no tx was submitted).
 * SUBMITTED – MUST NOT be cleared (tx may still land).
 * FAILED_RETRYABLE – MUST NOT be silently cleared; explicit retry is available.
 * BLOCKED   – MUST NOT be cleared automatically.
 *
 * This is the single authoritative policy. The earlier canClearSaleCreationOperation
 * helper in sale-operation.ts is superseded by this function.
 */
export function canClearSaleCreation(
  operation: SaleCreationOperation,
  recovery: SaleRecoveryState,
): boolean {
  if (operation.phase === "COMPLETE") return true;
  if (operation.phase === "BLOCKED") return false;
  if (operation.phase === "SUBMITTED") return false;
  if (operation.phase === "FAILED_RETRYABLE") return false;
  // PREPARED: only safe to abandon if no sale exists on-chain.
  if (operation.phase === "PREPARED") return recovery === "MISSING";
  return false;
}

// ---------------------------------------------------------------------------
// ReconcileDecision — the typed result returned by reconcileSaleOperation.
//
// newPhase: the phase the operation should transition to, or null if no
//   transition is needed (e.g. PREPARED + absent, or SUBMITTED + live blockhash).
// message: user-visible status string (always present).
// isBlocked: true only for the inconsistent SUCCESS+ABSENT case – no retry.
// ---------------------------------------------------------------------------
export type ReconcileDecision = {
  /** Phase to write to localStorage + React state. null = no change. */
  newPhase: SaleCreationPhase | null;
  /** Short, human-readable status for display in the UI. */
  message: string;
  /** True when the operation is in an inconsistent/irrecoverable state. */
  isBlocked: boolean;
  /** True when an explicit retry is safe. Derived from canRetrySaleCreation. */
  canRetry: boolean;
  /** The raw recovery state classification from the PDA inspection. */
  pdaState: SaleRecoveryState;
  /** The full case classification. */
  recoveryCase: SaleRecoveryCase;
};

/**
 * Pure orchestration function – no React state, no side-effects.
 *
 * Wiring order (spec §2, §4, §5):
 *  1. Inspect expected Sale PDA first.
 *  2. If MATCHING_SALE   → COMPLETE regardless of local phase.
 *  3. If UNSAFE_MISMATCH → BLOCKED.
 *  4. If MISSING + PREPARED → no change (keep PREPARED, allow explicit launch).
 *  5. If MISSING + SUBMITTED + signature:
 *       a. confirmed + err null (SUCCESS) + absent  → BLOCKED (inconsistent).
 *       b. confirmed + err non-null (FAILED) + absent → FAILED_RETRYABLE.
 *       c. unknown/null                              → check blockhash liveness.
 *  6. If MISSING + SUBMITTED + no signature:
 *       live blockhash  → SUBMITTED stays (CASE_E_WAITING).
 *       expired blockhash → FAILED_RETRYABLE.
 *  7. MISSING + any other terminal phase (FAILED_RETRYABLE, BLOCKED):
 *       FAILED_RETRYABLE → canRetry=true.
 *       BLOCKED           → canRetry=false.
 */
export async function reconcileSaleOperation(
  connection: Connection,
  operation: SaleCreationOperation,
  currentBlockHeight: number,
): Promise<ReconcileDecision> {
  // Step 1: inspect the expected Sale PDA.
  const salePda = new PublicKey(operation.expectedSale);
  const pdaInspection = await inspectSalePda(connection, salePda, operation);
  const pdaState = classifySaleInspection(operation, pdaInspection);

  // Step 2: MATCHING_SALE always wins, regardless of local phase.
  if (pdaState === "MATCHING_SALE") {
    return {
      newPhase: "COMPLETE",
      message: "Sale confirmed on Cookie. Your sale is live.",
      isBlocked: false,
      canRetry: false,
      pdaState,
      recoveryCase: "CASE_A_MATCHING_SALE",
    };
  }

  // Step 3: UNSAFE_MISMATCH → BLOCKED.
  if (pdaState === "UNSAFE_MISMATCH") {
    return {
      newPhase: "BLOCKED",
      message: `FairBake found an inconsistent sale-creation state: ${pdaInspection.error ?? "the expected sale PDA contains mismatched fields"}.`,
      isBlocked: true,
      canRetry: false,
      pdaState,
      recoveryCase: "CASE_F_MISMATCH",
    };
  }

  // From here: pdaState === MISSING.

  // Step 4: PREPARED + absent → normal create path, no transition needed.
  if (operation.phase === "PREPARED") {
    return {
      newPhase: null,
      message: "Ready to create your sale.",
      isBlocked: false,
      canRetry: false,
      pdaState,
      recoveryCase: "CASE_B_PREPARED_NO_SUBMISSION",
    };
  }

  // Step 5: SUBMITTED + absent → check signature or blockhash liveness.
  if (operation.phase === "SUBMITTED") {
    if (operation.signature) {
      // A signature was persisted. Query its status.
      const sigStatus = await checkSignatureStatus(connection, operation.signature);

      if (sigStatus !== null) {
        if (sigStatus.err === null && sigStatus.confirmed) {
          // 5a. SUCCESS + PDA absent → inconsistent, BLOCKED.
          return {
            newPhase: "BLOCKED",
            message:
              "Sale creation appears confirmed on Cookie but the expected sale account was not found. " +
              "This is an inconsistent state — do not retry.",
            isBlocked: true,
            canRetry: false,
            pdaState,
            recoveryCase: "CASE_C_SUBMITTED_NO_SALE",
          };
        }

        if (sigStatus.err !== null) {
          // 5b. FAILED + PDA absent → FAILED_RETRYABLE.
          return {
            newPhase: "FAILED_RETRYABLE",
            message: "Previous sale creation did not land on Cookie. You may retry.",
            isBlocked: false,
            canRetry: true,
            pdaState,
            recoveryCase: "CASE_C_SUBMITTED_NO_SALE",
          };
        }
      }

      // 5c. Signature unknown (sigStatus null or not yet confirmed/finalized).
      // Check blockhash liveness as a secondary signal.
      if (operation.lastValidBlockHeight && currentBlockHeight <= operation.lastValidBlockHeight) {
        return {
          newPhase: null,
          message:
            "Sale creation was submitted. FairBake is still checking Cookie for confirmation.",
          isBlocked: false,
          canRetry: false,
          pdaState,
          recoveryCase: "CASE_E_WAITING_SIGNATURE_LIVE",
        };
      }

      // Blockhash expired and signature still unknown → FAILED_RETRYABLE.
      return {
        newPhase: "FAILED_RETRYABLE",
        message: "Previous sale creation did not land on Cookie. You may retry.",
        isBlocked: false,
        canRetry: true,
        pdaState,
        recoveryCase: "CASE_E_BLOCKHASH_EXPIRED_FAILED",
      };
    }

    // No signature persisted — distinguish by blockhash liveness only.
    if (operation.lastValidBlockHeight && currentBlockHeight <= operation.lastValidBlockHeight) {
      return {
        newPhase: null,
        message:
          "Sale creation was submitted. FairBake is still checking Cookie for confirmation.",
        isBlocked: false,
        canRetry: false,
        pdaState,
        recoveryCase: "CASE_E_WAITING_SIGNATURE_LIVE",
      };
    }

    return {
      newPhase: "FAILED_RETRYABLE",
      message: "Previous sale creation did not land on Cookie. You may retry.",
      isBlocked: false,
      canRetry: true,
      pdaState,
      recoveryCase: "CASE_E_BLOCKHASH_EXPIRED_FAILED",
    };
  }

  // Step 6: FAILED_RETRYABLE + MISSING → stay FAILED_RETRYABLE, expose retry.
  if (operation.phase === "FAILED_RETRYABLE") {
    return {
      newPhase: null,
      message: "Previous sale creation did not land on Cookie. You may retry.",
      isBlocked: false,
      canRetry: canRetrySaleCreation(operation, pdaState),
      pdaState,
      recoveryCase: "UNKNOWN",
    };
  }

  // Step 7: BLOCKED + MISSING → remain blocked, no retry.
  if (operation.phase === "BLOCKED") {
    return {
      newPhase: null,
      message: "FairBake found an inconsistent sale-creation state. Do not retry.",
      isBlocked: true,
      canRetry: false,
      pdaState,
      recoveryCase: "UNKNOWN",
    };
  }

  // COMPLETE + MISSING → unusual (was COMPLETE, PDA now absent — possibly pruned or wrong network).
  return {
    newPhase: null,
    message: "",
    isBlocked: false,
    canRetry: false,
    pdaState,
    recoveryCase: "UNKNOWN",
  };
}
