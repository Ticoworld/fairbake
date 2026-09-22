import { test } from "node:test";
import assert from "node:assert";
import anchorCore from "@anchor-lang/core";
const { BorshAccountsCoder, BN } = anchorCore;
import { PublicKey } from "@solana/web3.js";
import fairbakeIdl from "../idl/fairbake.json" with { type: "json" };
import {
  classifySaleRecovery,
  canRetrySaleCreation,
  canClearSaleCreation,
  type SaleRecoveryCase,
} from "./sale-recovery.ts";
import {
  classifySaleInspection,
  type SaleCreationOperation,
  type SaleInspection,
} from "./sale-operation.ts";

// ---------------------------------------------------------------------------
// Constants.
// ---------------------------------------------------------------------------
const SALE_DISCRIMINATOR = Buffer.from([202, 64, 232, 171, 178, 172, 34, 183]);
const WRONG_DISCRIMINATOR = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
const WRONG_OWNER = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const FAIRBAKE_PROGRAM_ID = "8ZxnPLAfaSja6MrS6z21QZsohrW515v3cjXA3dMucnuX";

// Deterministic fake pubkeys (valid base58, 32 bytes).
const CREATOR_PUBKEY_STR = "11111111111111111111111111111112";
const MINT_PUBKEY_STR = "11111111111111111111111111111113";
const TOKEN_ACCOUNT_STR = "11111111111111111111111111111114";

// ---------------------------------------------------------------------------
// Helper factories.
// ---------------------------------------------------------------------------
function createOperation(overrides?: Partial<SaleCreationOperation>): SaleCreationOperation {
  const base: SaleCreationOperation = {
    operationId: "op-1",
    creator: CREATOR_PUBKEY_STR,
    mint: MINT_PUBKEY_STR,
    creatorTokenAccount: TOKEN_ACCOUNT_STR,
    expectedSale: "11111111111111111111111111111115",
    saleSupply: "1000000000",
    minimumRaise: "100000000000",
    hardCap: "1000000000000",
    maxPerWallet: "100000000000",
    startTime: "1000000",
    endTime: "2000000",
    phase: "PREPARED",
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
  };
  return { ...base, ...overrides };
}

function createInspection(overrides?: Partial<SaleInspection>): SaleInspection {
  const base: SaleInspection = {
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
  return { ...base, ...overrides };
}

function createMatchingSaleInspection(operation: SaleCreationOperation): SaleInspection {
  return createInspection({
    exists: true,
    owner: FAIRBAKE_PROGRAM_ID,
    creator: operation.creator,
    mint: operation.mint,
    creatorTokenAccount: operation.creatorTokenAccount,
    saleSupply: operation.saleSupply,
    minimumRaise: operation.minimumRaise,
    hardCap: operation.hardCap,
    maxPerWallet: operation.maxPerWallet,
    startTime: operation.startTime,
    endTime: operation.endTime,
  });
}

// ---------------------------------------------------------------------------
// Anchor coder for encoding Sale accounts in tests.
// BorshAccountsCoder.encode() is async and returns Promise<Buffer>.
// ---------------------------------------------------------------------------
const coder = new BorshAccountsCoder(fairbakeIdl as never);

// Minimal BN builder using the real BN class the coder expects.
function buildBN(value: bigint) {
  return new BN(value.toString());
}

// Real PublicKey for the coder.
function buildPubkey(base58Str: string): PublicKey {
  return new PublicKey(base58Str);
}

async function encodeValidSaleAccount(overrides?: Record<string, unknown>): Promise<Buffer> {
  const base: Record<string, unknown> = {
    creator: buildPubkey(CREATOR_PUBKEY_STR),
    mint: buildPubkey(MINT_PUBKEY_STR),
    creator_token_account: buildPubkey(TOKEN_ACCOUNT_STR),
    sale_supply: buildBN(1000000000n),
    minimum_raise: buildBN(100000000000n),
    hard_cap: buildBN(1000000000000n),
    max_per_wallet: buildBN(100000000000n),
    start_time: buildBN(1000000n),
    end_time: buildBN(2000000n),
    total_committed: buildBN(0n),
    final_accepted_raise: buildBN(0n),
    creator_proceeds: buildBN(0n),
    refund_reserve: buildBN(0n),
    refund_claimed_total: buildBN(0n),
    accepted_claimed_total: buildBN(0n),
    native_refund_dust: buildBN(0n),
    token_allocation_claimed: buildBN(0n),
    buyer_count: buildBN(0n),
    claimed_buyer_count: buildBN(0n),
    treasury_rent_lamports: buildBN(0n),
    status: 0,
    bump: 255,
    vault_bump: 254,
    treasury_bump: 253,
    proceeds_withdrawn: false,
    inventory_withdrawn: false,
    ...overrides,
  };
  return Buffer.from(await coder.encode("Sale", base));
}

// ---------------------------------------------------------------------------
// Inline inspection logic for unit testing without a real RPC.
// Mirrors the real inspectSalePda decode pipeline exactly.
// ---------------------------------------------------------------------------
function testInspectAccountData(
  ownerStr: string,
  data: Buffer,
  _expectedOperation: SaleCreationOperation,
): SaleInspection {
  const unsafe = (error: string): SaleInspection => ({
    exists: true,
    owner: ownerStr,
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

  // Guard 1: owner must be FairBake program.
  if (ownerStr !== FAIRBAKE_PROGRAM_ID) {
    return unsafe(`Account owner ${ownerStr} is not the FairBake program`);
  }

  // Guard 2: discriminator check BEFORE decode.
  const disc = Buffer.from([202, 64, 232, 171, 178, 172, 34, 183]);
  if (data.length < disc.length || !data.subarray(0, disc.length).equals(disc)) {
    return unsafe(`Account does not begin with the Sale discriminator`);
  }

  // Guard 3: Borsh decode.
  let decoded: Record<string, unknown>;
  try {
    decoded = coder.decode("Sale", data) as Record<string, unknown>;
  } catch (e) {
    return unsafe(`Sale account failed Borsh decode: ${e instanceof Error ? e.message : String(e)}`);
  }

  const toStr = (v: unknown): string => {
    if (v === null || v === undefined) return "0";
    if (typeof v === "bigint") return v.toString();
    if (typeof v === "number") return v.toString();
    if (typeof (v as { toString?: () => string }).toString === "function")
      return (v as { toString(): string }).toString();
    return String(v);
  };
  const toPubkeyStr = (v: unknown): string => {
    if (v && typeof (v as { toBase58?: () => string }).toBase58 === "function")
      return (v as { toBase58(): string }).toBase58();
    return String(v);
  };

  return {
    exists: true,
    owner: ownerStr,
    creator: toPubkeyStr(decoded.creator),
    mint: toPubkeyStr(decoded.mint),
    creatorTokenAccount: toPubkeyStr(decoded.creator_token_account),
    saleSupply: toStr(decoded.sale_supply),
    minimumRaise: toStr(decoded.minimum_raise),
    hardCap: toStr(decoded.hard_cap),
    maxPerWallet: toStr(decoded.max_per_wallet),
    startTime: toStr(decoded.start_time),
    endTime: toStr(decoded.end_time),
  };
}

// ===========================================================================
// TEST A — Valid FairBake-owned Sale account → fields populated → MATCHING_SALE
// ===========================================================================
test("TEST A: valid FairBake-owned Sale account → inspection fields populated → MATCHING_SALE", async () => {
  const operation = createOperation({
    creator: CREATOR_PUBKEY_STR,
    mint: MINT_PUBKEY_STR,
    creatorTokenAccount: TOKEN_ACCOUNT_STR,
    saleSupply: "1000000000",
    minimumRaise: "100000000000",
    hardCap: "1000000000000",
    maxPerWallet: "100000000000",
    startTime: "1000000",
    endTime: "2000000",
  });
  const encoded = await encodeValidSaleAccount();
  const inspection = testInspectAccountData(FAIRBAKE_PROGRAM_ID, encoded, operation);

  assert.ok(inspection.exists, "exists must be true");
  assert.ok(inspection.creator !== null, "creator must be populated");
  assert.ok(inspection.mint !== null, "mint must be populated");
  assert.ok(inspection.saleSupply !== null, "saleSupply must be populated");
  assert.ok(!inspection.error, `must not have an error: ${inspection.error}`);

  const state = classifySaleInspection(operation, inspection);
  assert.strictEqual(state, "MATCHING_SALE");
});

// ===========================================================================
// TEST B — Wrong owner → UNSAFE_MISMATCH
// ===========================================================================
test("TEST B: wrong account owner → UNSAFE_MISMATCH", async () => {
  const operation = createOperation();
  // Use valid discriminator but wrong owner.
  const data = Buffer.concat([SALE_DISCRIMINATOR, Buffer.alloc(200, 0)]);
  const inspection = testInspectAccountData(WRONG_OWNER, data, operation);

  assert.ok(inspection.exists, "account exists");
  assert.ok(inspection.error, "must carry an error message");
  assert.strictEqual(classifySaleInspection(operation, inspection), "UNSAFE_MISMATCH");
});

// ===========================================================================
// TEST C — Correct owner + wrong discriminator → UNSAFE_MISMATCH
// ===========================================================================
test("TEST C: correct owner + wrong discriminator → UNSAFE_MISMATCH", async () => {
  const operation = createOperation();
  const data = Buffer.concat([WRONG_DISCRIMINATOR, Buffer.alloc(200, 0)]);
  const inspection = testInspectAccountData(FAIRBAKE_PROGRAM_ID, data, operation);

  assert.ok(inspection.error, "must carry an error message");
  assert.strictEqual(classifySaleInspection(operation, inspection), "UNSAFE_MISMATCH");
});

// ===========================================================================
// TEST D — Correct owner + correct discriminator + malformed body → UNSAFE_MISMATCH
// ===========================================================================
test("TEST D: correct owner + correct discriminator + malformed body → UNSAFE_MISMATCH", async () => {
  const operation = createOperation();
  // Discriminator correct but trailing bytes are garbage (too short to decode).
  const data = Buffer.concat([SALE_DISCRIMINATOR, Buffer.alloc(5, 0xff)]);
  const inspection = testInspectAccountData(FAIRBAKE_PROGRAM_ID, data, operation);

  assert.ok(inspection.error, "must carry an error message");
  assert.strictEqual(classifySaleInspection(operation, inspection), "UNSAFE_MISMATCH");
});

// ===========================================================================
// TEST E — Valid decode but one economic field differs → UNSAFE_MISMATCH
// ===========================================================================
test("TEST E: valid decode but one economic field differs → UNSAFE_MISMATCH", async () => {
  const operation = createOperation({
    creator: CREATOR_PUBKEY_STR,
    mint: MINT_PUBKEY_STR,
    creatorTokenAccount: TOKEN_ACCOUNT_STR,
    saleSupply: "1000000000",
    minimumRaise: "100000000000",
    hardCap: "1000000000000",   // stored intent
    maxPerWallet: "100000000000",
    startTime: "1000000",
    endTime: "2000000",
  });
  // Encode with a different hardCap — all other fields match.
  const encoded = await encodeValidSaleAccount({
    hard_cap: buildBN(999999999999n), // intentionally differs
  });
  const inspection = testInspectAccountData(FAIRBAKE_PROGRAM_ID, encoded, operation);

  assert.ok(inspection.exists, "account exists");
  assert.ok(!inspection.error, `should decode cleanly: ${inspection.error}`);
  // hardCap in inspection will be "999999999999", operation.hardCap is "1000000000000".
  assert.strictEqual(classifySaleInspection(operation, inspection), "UNSAFE_MISMATCH");
});

// ===========================================================================
// PHASE BEHAVIOR TESTS (F–I)
// ===========================================================================

test("TEST F: PREPARED phase + sale absent → pre-submission, retry NOT allowed", () => {
  const operation = createOperation({ phase: "PREPARED" });
  const inspection = createInspection({ exists: false });
  const { state, recovery } = classifySaleRecovery(operation, inspection, 100);

  assert.strictEqual(state, "CASE_B_PREPARED_NO_SUBMISSION");
  assert.strictEqual(recovery, "MISSING");
  assert.strictEqual(canRetrySaleCreation(operation, recovery), false);
});

test("TEST G: SUBMITTED + signature present + sale absent → CASE_C, retry NOT allowed", () => {
  const operation = createOperation({
    phase: "SUBMITTED",
    signature: "sig-abc123",
    lastValidBlockHeight: 500,
  });
  const inspection = createInspection({ exists: false });
  const { state, recovery } = classifySaleRecovery(operation, inspection, 100);

  assert.strictEqual(state, "CASE_C_SUBMITTED_NO_SALE");
  assert.strictEqual(recovery, "MISSING");
  // Cannot retry SUBMITTED — tx may still land.
  assert.strictEqual(canRetrySaleCreation(operation, recovery), false);
});

test("TEST H: SUBMITTED + matching PDA found → CASE_A (COMPLETE path)", () => {
  const operation = createOperation({ phase: "SUBMITTED", signature: "sig-xyz" });
  const inspection = createMatchingSaleInspection(operation);
  const { state, recovery } = classifySaleRecovery(operation, inspection, 100);

  assert.strictEqual(state, "CASE_A_MATCHING_SALE");
  assert.strictEqual(recovery, "MATCHING_SALE");
});

test("TEST I: FAILED_RETRYABLE + sale absent → retry permitted", () => {
  const operation = createOperation({ phase: "FAILED_RETRYABLE" });
  const inspection = createInspection({ exists: false });
  const { recovery } = classifySaleRecovery(operation, inspection, 100);

  assert.strictEqual(recovery, "MISSING");
  assert.strictEqual(canRetrySaleCreation(operation, recovery), true);
});

// ===========================================================================
// ORIGINAL TESTS 1–10 — retained, updated to SaleRecoveryCase union type.
// ===========================================================================

test("TEST 1: PREPARED + sale absent → CASE_B", () => {
  const operation = createOperation({ phase: "PREPARED" });
  const inspection = createInspection({ exists: false });
  const { state, recovery } = classifySaleRecovery(operation, inspection, 100);

  const expectedState: SaleRecoveryCase = "CASE_B_PREPARED_NO_SUBMISSION";
  assert.strictEqual(state, expectedState);
  assert.strictEqual(recovery, "MISSING");
});

test("TEST 2: SUBMITTED + matching sale PDA exists → CASE_A", () => {
  const operation = createOperation({ phase: "SUBMITTED" });
  const inspection = createMatchingSaleInspection(operation);
  const { state, recovery } = classifySaleRecovery(operation, inspection, 100);

  const expectedState: SaleRecoveryCase = "CASE_A_MATCHING_SALE";
  assert.strictEqual(state, expectedState);
  assert.strictEqual(recovery, "MATCHING_SALE");
});

test("TEST 3: SUBMITTED + no signature + blockhash live → CASE_E_WAITING", () => {
  const operation = createOperation({
    phase: "SUBMITTED",
    signature: undefined,
    lastValidBlockHeight: 200,
  });
  const inspection = createInspection({ exists: false });
  const { state, recovery } = classifySaleRecovery(operation, inspection, 100);

  const expectedState: SaleRecoveryCase = "CASE_E_WAITING_SIGNATURE_LIVE";
  assert.strictEqual(state, expectedState);
  assert.strictEqual(recovery, "MISSING");
});

test("TEST 4: SUBMITTED + no signature + blockhash expired → CASE_E_EXPIRED", () => {
  const operation = createOperation({
    phase: "SUBMITTED",
    signature: undefined,
    lastValidBlockHeight: 50,
  });
  const inspection = createInspection({ exists: false });
  const { state, recovery } = classifySaleRecovery(operation, inspection, 100);

  const expectedState: SaleRecoveryCase = "CASE_E_BLOCKHASH_EXPIRED_FAILED";
  assert.strictEqual(state, expectedState);
  assert.strictEqual(recovery, "MISSING");
});

test("TEST 5: SUBMITTED + signature present + sale absent → CASE_C", () => {
  const operation = createOperation({
    phase: "SUBMITTED",
    signature: "sig-123",
  });
  const inspection = createInspection({ exists: false });
  const { state, recovery } = classifySaleRecovery(operation, inspection, 100);

  const expectedState: SaleRecoveryCase = "CASE_C_SUBMITTED_NO_SALE";
  assert.strictEqual(state, expectedState);
  assert.strictEqual(recovery, "MISSING");
});

test("TEST 6: sale PDA exists but creator mismatch → CASE_F_MISMATCH", () => {
  const operation = createOperation();
  const inspection = createInspection({
    exists: true,
    owner: FAIRBAKE_PROGRAM_ID,
    creator: "different-creator",
    mint: operation.mint,
    creatorTokenAccount: operation.creatorTokenAccount,
    saleSupply: operation.saleSupply,
    minimumRaise: operation.minimumRaise,
    hardCap: operation.hardCap,
    maxPerWallet: operation.maxPerWallet,
    startTime: operation.startTime,
    endTime: operation.endTime,
  });
  const { state, recovery } = classifySaleRecovery(operation, inspection, 100);

  const expectedState: SaleRecoveryCase = "CASE_F_MISMATCH";
  assert.strictEqual(state, expectedState);
  assert.strictEqual(recovery, "UNSAFE_MISMATCH");
});

test("TEST 7: sale PDA exists but mint mismatch → CASE_F_MISMATCH", () => {
  const operation = createOperation();
  const inspection = createInspection({
    exists: true,
    owner: FAIRBAKE_PROGRAM_ID,
    creator: operation.creator,
    mint: "different-mint",
    creatorTokenAccount: operation.creatorTokenAccount,
    saleSupply: operation.saleSupply,
    minimumRaise: operation.minimumRaise,
    hardCap: operation.hardCap,
    maxPerWallet: operation.maxPerWallet,
    startTime: operation.startTime,
    endTime: operation.endTime,
  });
  const { state, recovery } = classifySaleRecovery(operation, inspection, 100);

  const expectedState: SaleRecoveryCase = "CASE_F_MISMATCH";
  assert.strictEqual(state, expectedState);
  assert.strictEqual(recovery, "UNSAFE_MISMATCH");
});

test("TEST 8: canRetrySaleCreation — requires FAILED_RETRYABLE + MISSING", () => {
  const operation = createOperation({ phase: "FAILED_RETRYABLE" });
  assert.strictEqual(canRetrySaleCreation(operation, "MISSING"), true);
  assert.strictEqual(canRetrySaleCreation(operation, "MATCHING_SALE"), false);
  assert.strictEqual(canRetrySaleCreation(operation, "UNSAFE_MISMATCH"), false);

  const preparedOp = createOperation({ phase: "PREPARED" });
  assert.strictEqual(canRetrySaleCreation(preparedOp, "MISSING"), false);
});

test("TEST 9: canClearSaleCreation — authoritative single policy", () => {
  // COMPLETE: clearable.
  const completeOp = createOperation({ phase: "COMPLETE" });
  assert.strictEqual(canClearSaleCreation(completeOp, "MATCHING_SALE"), true);

  // PREPARED + MISSING: clearable (no tx submitted).
  const preparedOp = createOperation({ phase: "PREPARED" });
  assert.strictEqual(canClearSaleCreation(preparedOp, "MISSING"), true);
  assert.strictEqual(canClearSaleCreation(preparedOp, "MATCHING_SALE"), false);

  // BLOCKED: must not be cleared.
  const blockedOp = createOperation({ phase: "BLOCKED" });
  assert.strictEqual(canClearSaleCreation(blockedOp, "MISSING"), false);

  // SUBMITTED: must not be cleared.
  const submittedOp = createOperation({ phase: "SUBMITTED" });
  assert.strictEqual(canClearSaleCreation(submittedOp, "MISSING"), false);

  // FAILED_RETRYABLE: must not be silently cleared.
  const failedOp = createOperation({ phase: "FAILED_RETRYABLE" });
  assert.strictEqual(canClearSaleCreation(failedOp, "MISSING"), false);
});

test("TEST 10: matching sale in any on-chain lifecycle state → CASE_A_MATCHING_SALE", () => {
  const operation = createOperation({ phase: "COMPLETE" });
  const inspection = createMatchingSaleInspection(operation);
  const { state, recovery } = classifySaleRecovery(operation, inspection, 100);

  const expectedState: SaleRecoveryCase = "CASE_A_MATCHING_SALE";
  assert.strictEqual(state, expectedState);
  assert.strictEqual(recovery, "MATCHING_SALE");
});

// ===========================================================================
// INTEGRATION TESTS (reconcileSaleOperation)
// ===========================================================================

import { reconcileSaleOperation } from "./sale-recovery.ts";
import type { Connection } from "@solana/web3.js";

function mockConnection(overrides: { accountInfo?: any, signatureStatus?: any } = {}) {
  return {
    getAccountInfo: async () => overrides.accountInfo || null,
    getSignatureStatuses: async () => ({ value: [overrides.signatureStatus || null] }),
  } as unknown as Connection;
}

test("INT TEST 1: Persisted PREPARED + sale absent → normal explicit create path", async () => {
  const conn = mockConnection();
  const operation = createOperation({ phase: "PREPARED" });
  const decision = await reconcileSaleOperation(conn, operation, 100);
  
  assert.strictEqual(decision.newPhase, null);
  assert.strictEqual(decision.canRetry, false);
});

test("INT TEST 2: Persisted SUBMITTED + matching Sale PDA → COMPLETE", async () => {
  const operation = createOperation({ phase: "SUBMITTED" });
  const conn = mockConnection({
    accountInfo: {
      owner: buildPubkey(FAIRBAKE_PROGRAM_ID),
      data: await encodeValidSaleAccount(),
    }
  });
  const decision = await reconcileSaleOperation(conn, operation, 100);
  
  assert.strictEqual(decision.newPhase, "COMPLETE");
  assert.strictEqual(decision.canRetry, false);
});

test("INT TEST 3: Persisted FAILED_RETRYABLE + matching Sale PDA → COMPLETE", async () => {
  const operation = createOperation({ phase: "FAILED_RETRYABLE" });
  const conn = mockConnection({
    accountInfo: {
      owner: buildPubkey(FAIRBAKE_PROGRAM_ID),
      data: await encodeValidSaleAccount(),
    }
  });
  const decision = await reconcileSaleOperation(conn, operation, 100);
  
  assert.strictEqual(decision.newPhase, "COMPLETE");
});

test("INT TEST 4: Persisted BLOCKED + matching Sale PDA → COMPLETE", async () => {
  const operation = createOperation({ phase: "BLOCKED" });
  const conn = mockConnection({
    accountInfo: {
      owner: buildPubkey(FAIRBAKE_PROGRAM_ID),
      data: await encodeValidSaleAccount(),
    }
  });
  const decision = await reconcileSaleOperation(conn, operation, 100);
  
  assert.strictEqual(decision.newPhase, "COMPLETE");
});

test("INT TEST 5: SUBMITTED + signature err + sale absent → FAILED_RETRYABLE", async () => {
  const operation = createOperation({ phase: "SUBMITTED", signature: "sig123" });
  const conn = mockConnection({
    signatureStatus: { confirmationStatus: "confirmed", err: { InstructionError: [0, "CustomError"] } }
  });
  const decision = await reconcileSaleOperation(conn, operation, 100);
  
  assert.strictEqual(decision.newPhase, "FAILED_RETRYABLE");
  assert.strictEqual(decision.canRetry, true);
});

test("INT TEST 6: SUBMITTED + signature success + sale absent → BLOCKED", async () => {
  const operation = createOperation({ phase: "SUBMITTED", signature: "sig123" });
  const conn = mockConnection({
    signatureStatus: { confirmationStatus: "confirmed", err: null } // success
  });
  const decision = await reconcileSaleOperation(conn, operation, 100);
  
  assert.strictEqual(decision.newPhase, "BLOCKED");
  assert.strictEqual(decision.isBlocked, true);
  assert.strictEqual(decision.canRetry, false);
});

test("INT TEST 7: SUBMITTED + signature unknown + live blockhash → stays SUBMITTED", async () => {
  const operation = createOperation({ phase: "SUBMITTED", signature: "sig123", lastValidBlockHeight: 150 });
  const conn = mockConnection({
    signatureStatus: null
  });
  const decision = await reconcileSaleOperation(conn, operation, 100); // 100 <= 150
  
  assert.strictEqual(decision.newPhase, null); // Stays SUBMITTED
  assert.strictEqual(decision.canRetry, false);
});

test("INT TEST 8: SUBMITTED + signature unknown + expired blockhash → FAILED_RETRYABLE", async () => {
  const operation = createOperation({ phase: "SUBMITTED", signature: "sig123", lastValidBlockHeight: 50 });
  const conn = mockConnection({
    signatureStatus: null
  });
  const decision = await reconcileSaleOperation(conn, operation, 100); // 100 > 50
  
  assert.strictEqual(decision.newPhase, "FAILED_RETRYABLE");
  assert.strictEqual(decision.canRetry, true);
});

test("INT TEST 9: FAILED_RETRYABLE retry gate → matching sale prevents new transaction", async () => {
  const operation = createOperation({ phase: "FAILED_RETRYABLE" });
  const conn = mockConnection({
    accountInfo: {
      owner: buildPubkey(FAIRBAKE_PROGRAM_ID),
      data: await encodeValidSaleAccount(),
    }
  });
  const decision = await reconcileSaleOperation(conn, operation, 100);
  
  assert.strictEqual(decision.newPhase, "COMPLETE");
});

test("INT TEST 10: FAILED_RETRYABLE retry gate → absent PDA permits explicit retry", async () => {
  const operation = createOperation({ phase: "FAILED_RETRYABLE" });
  const conn = mockConnection(); // absent
  const decision = await reconcileSaleOperation(conn, operation, 100);
  
  assert.strictEqual(decision.newPhase, null); // keeps FAILED_RETRYABLE
  assert.strictEqual(decision.canRetry, true);
});

test("INT TEST 11: UNSAFE_MISMATCH → BLOCKED → retry forbidden", async () => {
  const operation = createOperation({ phase: "PREPARED" });
  const conn = mockConnection({
    accountInfo: {
      owner: buildPubkey(FAIRBAKE_PROGRAM_ID),
      data: Buffer.concat([WRONG_DISCRIMINATOR, Buffer.alloc(200, 0)]),
    }
  });
  const decision = await reconcileSaleOperation(conn, operation, 100);
  
  assert.strictEqual(decision.newPhase, "BLOCKED");
  assert.strictEqual(decision.isBlocked, true);
  assert.strictEqual(decision.canRetry, false);
});

test("INT TEST 12: COMPLETE or matching sale reload → completed sale screen state restored", async () => {
  // Test 12 translates to: does a MATCHING sale properly return COMPLETE and non-blocking?
  const operation = createOperation({ phase: "PREPARED" });
  const conn = mockConnection({
    accountInfo: {
      owner: buildPubkey(FAIRBAKE_PROGRAM_ID),
      data: await encodeValidSaleAccount(),
    }
  });
  const decision = await reconcileSaleOperation(conn, operation, 100);
  
  assert.strictEqual(decision.newPhase, "COMPLETE");
  assert.strictEqual(decision.canRetry, false);
});

// ===========================================================================
// isSaleWindowRetryable TESTS
// ===========================================================================
import { isSaleWindowRetryable } from "./sale-recovery.ts";

test("STALE RETRY TEST 1: startTime > now AND endTime > startTime → retry permitted", () => {
  const operation = createOperation({
    startTime: "1000",
    endTime: "2000",
  });
  // now = 500
  assert.strictEqual(isSaleWindowRetryable(operation, 500), true);
});

test("STALE RETRY TEST 2: startTime === now → exact retry forbidden", () => {
  const operation = createOperation({
    startTime: "1000",
    endTime: "2000",
  });
  // now = 1000
  assert.strictEqual(isSaleWindowRetryable(operation, 1000), false);
});

test("STALE RETRY TEST 3: startTime < now < endTime → exact retry forbidden", () => {
  const operation = createOperation({
    startTime: "1000",
    endTime: "2000",
  });
  // now = 1500
  assert.strictEqual(isSaleWindowRetryable(operation, 1500), false);
});

test("STALE RETRY TEST 4: endTime < now → exact retry forbidden", () => {
  const operation = createOperation({
    startTime: "1000",
    endTime: "2000",
  });
  // now = 2500
  assert.strictEqual(isSaleWindowRetryable(operation, 2500), false);
});
