import { test } from "node:test";
import assert from "node:assert";
import { classifySaleRecovery, canRetrySaleCreation, canClearSaleCreation } from "./sale-recovery.ts";
import type { SaleCreationOperation, SaleInspection } from "./sale-operation.ts";

function createOperation(overrides?: Partial<SaleCreationOperation>): SaleCreationOperation {
  const base: SaleCreationOperation = {
    operationId: "op-1",
    creator: "creator-addr",
    mint: "mint-addr",
    creatorTokenAccount: "token-account-addr",
    expectedSale: "sale-pda-addr",
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
    owner: "9GYL8FqGfCzWZ1v6w8F8yJ8QK3FPdBG8W8B1rHEVnzKQ",
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

test("TEST 1: PREPARED + sale absent → safe to retry", () => {
  const operation = createOperation({ phase: "PREPARED" });
  const inspection = createInspection({ exists: false });
  const { state, recovery } = classifySaleRecovery(operation, inspection, 100);

  assert.strictEqual(state, "CASE_B_PREPARED_NO_SUBMISSION");
  assert.strictEqual(recovery, "MISSING");
});

test("TEST 2: SUBMITTED + matching sale PDA exists → COMPLETE", () => {
  const operation = createOperation({ phase: "SUBMITTED" });
  const inspection = createMatchingSaleInspection(operation);
  const { state, recovery } = classifySaleRecovery(operation, inspection, 100);

  assert.strictEqual(state, "CASE_A_MATCHING_SALE");
  assert.strictEqual(recovery, "MATCHING_SALE");
});

test("TEST 3: SUBMITTED + no signature yet + blockhash still live → wait", () => {
  const operation = createOperation({
    phase: "SUBMITTED",
    signature: undefined,
    lastValidBlockHeight: 200,
  });
  const inspection = createInspection({ exists: false });
  const { state, recovery } = classifySaleRecovery(operation, inspection, 100);

  assert.strictEqual(state, "CASE_E_WAITING_SIGNATURE_LIVE");
  assert.strictEqual(recovery, "MISSING");
});

test("TEST 4: SUBMITTED + no signature + blockhash expired → FAILED_RETRYABLE", () => {
  const operation = createOperation({
    phase: "SUBMITTED",
    signature: undefined,
    lastValidBlockHeight: 50,
  });
  const inspection = createInspection({ exists: false });
  const { state, recovery } = classifySaleRecovery(operation, inspection, 100);

  assert.strictEqual(state, "CASE_E_BLOCKHASH_EXPIRED_FAILED");
  assert.strictEqual(recovery, "MISSING");
});

test("TEST 5: SUBMITTED + signature but sale absent → check signature status (stored)", () => {
  const operation = createOperation({
    phase: "SUBMITTED",
    signature: "sig-123",
  });
  const inspection = createInspection({ exists: false });
  const { state, recovery } = classifySaleRecovery(operation, inspection, 100);

  assert.strictEqual(state, "CASE_C_SUBMITTED_NO_SALE");
  assert.strictEqual(recovery, "MISSING");
});

test("TEST 6: sale PDA exists but creator mismatch → BLOCKED", () => {
  const operation = createOperation();
  const inspection = createInspection({
    exists: true,
    owner: "9GYL8FqGfCzWZ1v6w8F8yJ8QK3FPdBG8W8B1rHEVnzKQ",
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

  assert.strictEqual(state, "CASE_F_MISMATCH");
  assert.strictEqual(recovery, "UNSAFE_MISMATCH");
});

test("TEST 7: sale PDA exists but mint mismatch → BLOCKED", () => {
  const operation = createOperation();
  const inspection = createInspection({
    exists: true,
    owner: "9GYL8FqGfCzWZ1v6w8F8yJ8QK3FPdBG8W8B1rHEVnzKQ",
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

  assert.strictEqual(state, "CASE_F_MISMATCH");
  assert.strictEqual(recovery, "UNSAFE_MISMATCH");
});

test("TEST 8: canRetrySaleCreation requires FAILED_RETRYABLE + MISSING", () => {
  const operation = createOperation({ phase: "FAILED_RETRYABLE" });
  assert.strictEqual(canRetrySaleCreation(operation, "MISSING"), true);

  assert.strictEqual(canRetrySaleCreation(operation, "MATCHING_SALE"), false);
  assert.strictEqual(canRetrySaleCreation(operation, "UNSAFE_MISMATCH"), false);

  const preparedOp = createOperation({ phase: "PREPARED" });
  assert.strictEqual(canRetrySaleCreation(preparedOp, "MISSING"), false);
});

test("TEST 9: canClearSaleCreation only safe for COMPLETE or prepared+missing", () => {
  const completeOp = createOperation({ phase: "COMPLETE" });
  assert.strictEqual(canClearSaleCreation(completeOp, "MATCHING_SALE"), true);

  const preparedOp = createOperation({ phase: "PREPARED" });
  assert.strictEqual(canClearSaleCreation(preparedOp, "MISSING"), true);
  assert.strictEqual(canClearSaleCreation(preparedOp, "MATCHING_SALE"), false);

  const blockedOp = createOperation({ phase: "BLOCKED" });
  assert.strictEqual(canClearSaleCreation(blockedOp, "MISSING"), false);
});

test("TEST 10: matching sale in LIVE state still classified COMPLETE", () => {
  const operation = createOperation({ phase: "COMPLETE" });
  const inspection = createMatchingSaleInspection(operation);
  const { state, recovery } = classifySaleRecovery(operation, inspection, 100);

  // Matching sale regardless of on-chain status means recovery complete
  assert.strictEqual(state, "CASE_A_MATCHING_SALE");
  assert.strictEqual(recovery, "MATCHING_SALE");
});
