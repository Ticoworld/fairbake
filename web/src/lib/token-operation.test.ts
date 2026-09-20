import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyMintInspection,
  readTokenOperation,
  writeTokenOperation,
  type MintInspection,
  type TokenOperation,
} from "./token-operation.ts";

const creator = "Creator111111111111111111111111111111111111";
const otherCreator = "Other111111111111111111111111111111111111";
const owner = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

function operation(overrides: Partial<TokenOperation> = {}): TokenOperation {
  return {
    operationId: "op-1",
    creator,
    tokenName: "Test",
    symbol: "TST",
    totalSupply: "1000000",
    decimals: 6,
    phase: "MINT_SUBMITTED",
    mint: "Mint111111111111111111111111111111111111111",
    mintTxSignature: "sig-1",
    createdAt: 1,
    lastUpdatedAt: 2,
    ...overrides,
  };
}

function inspection(overrides: Partial<MintInspection> = {}): MintInspection {
  return {
    exists: true,
    owner,
    decimals: 6,
    supply: 0n,
    mintAuthority: creator,
    freezeAuthority: creator,
    creatorBalance: 0n,
    ...overrides,
  };
}

test("operation serializes only public recovery fields", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  writeTokenOperation(storage, operation());
  const raw = [...values.values()][0];
  assert.ok(!raw.includes("secret"));
  assert.ok(!raw.includes("privateKey"));
  assert.deepEqual(readTokenOperation(storage, creator), operation());
});

test("zero-supply mint is recoverable and complete mint is detected after timeout", () => {
  assert.equal(classifyMintInspection(operation(), inspection()), "PARTIAL");
  assert.equal(
    classifyMintInspection(
      operation(),
      inspection({ supply: 1000000n, mintAuthority: null, freezeAuthority: null, creatorBalance: 1000000n }),
    ),
    "COMPLETE",
  );
});

test("unexpected mint state is blocked instead of resumed", () => {
  assert.equal(
    classifyMintInspection(operation(), inspection({ supply: 1n })),
    "UNSAFE",
  );
  assert.equal(
    classifyMintInspection(operation(), inspection({ owner: "11111111111111111111111111111111" })),
    "UNSAFE",
  );
});

test("missing mint is safe to discard and stale creator records do not match", () => {
  assert.equal(classifyMintInspection(operation(), inspection({ exists: false })), "MISSING");
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  writeTokenOperation(storage, operation({ creator: otherCreator }));
  assert.equal(readTokenOperation(storage, creator), null);
});
