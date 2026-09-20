export type TokenOperationPhase =
  | "PREPARED"
  | "MINT_SUBMITTED"
  | "MINT_CONFIRMED"
  | "SUPPLY_SETUP_SUBMITTED"
  | "COMPLETE"
  | "FAILED_RECOVERABLE";

export type TokenOperation = {
  operationId: string;
  creator: string;
  mint?: string;
  tokenAccount?: string;
  tokenName: string;
  symbol: string;
  totalSupply: string;
  decimals: number;
  phase: TokenOperationPhase;
  mintTxSignature?: string;
  supplyTxSignature?: string;
  createdAt: number;
  lastUpdatedAt: number;
};

export type MintInspection = {
  exists: boolean;
  owner: string | null;
  decimals: number | null;
  supply: bigint;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  creatorBalance: bigint;
  tokenAccount?: string;
  error?: string;
};

export type MintRecoveryState =
  | "MISSING"
  | "PARTIAL"
  | "COMPLETE"
  | "UNSAFE";

export function classifyMintInspection(
  operation: Pick<TokenOperation, "creator" | "totalSupply" | "decimals">,
  inspection: MintInspection,
): MintRecoveryState {
  if (!inspection.exists) return "MISSING";
  const expectedSupply = BigInt(operation.totalSupply);
  const expectedDecimals = operation.decimals;
  const safeOwner = inspection.owner === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  const creatorAuthority = inspection.mintAuthority === operation.creator;
  const creatorFreezeAuthority = inspection.freezeAuthority === operation.creator;
  const authoritiesRevoked =
    inspection.mintAuthority === null && inspection.freezeAuthority === null;
  if (!safeOwner || inspection.decimals !== expectedDecimals) return "UNSAFE";
  if (
    inspection.supply === expectedSupply &&
    authoritiesRevoked &&
    inspection.creatorBalance >= expectedSupply
  )
    return "COMPLETE";
  if (
    inspection.supply === 0n &&
    creatorAuthority &&
    creatorFreezeAuthority
  )
    return "PARTIAL";
  return "UNSAFE";
}

const STORAGE_PREFIX = "fairbake:create:";
const PHASES: TokenOperationPhase[] = [
  "PREPARED",
  "MINT_SUBMITTED",
  "MINT_CONFIRMED",
  "SUPPLY_SETUP_SUBMITTED",
  "COMPLETE",
  "FAILED_RECOVERABLE",
];

export function operationStorageKey(creator: string) {
  return `${STORAGE_PREFIX}${creator}`;
}

export function readTokenOperation(
  storage: Pick<Storage, "getItem">,
  creator: string,
): TokenOperation | null {
  try {
    const raw = storage.getItem(operationStorageKey(creator));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TokenOperation>;
    if (
      parsed.creator !== creator ||
      typeof parsed.operationId !== "string" ||
      typeof parsed.tokenName !== "string" ||
      typeof parsed.symbol !== "string" ||
      typeof parsed.totalSupply !== "string" ||
      typeof parsed.decimals !== "number" ||
      typeof parsed.phase !== "string" ||
      !PHASES.includes(parsed.phase as TokenOperationPhase) ||
      typeof parsed.createdAt !== "number" ||
      typeof parsed.lastUpdatedAt !== "number"
    )
      return null;
    return {
      operationId: parsed.operationId,
      creator: parsed.creator,
      ...(typeof parsed.mint === "string" ? { mint: parsed.mint } : {}),
      ...(typeof parsed.tokenAccount === "string" ? { tokenAccount: parsed.tokenAccount } : {}),
      tokenName: parsed.tokenName,
      symbol: parsed.symbol,
      totalSupply: parsed.totalSupply,
      decimals: parsed.decimals,
      phase: parsed.phase as TokenOperationPhase,
      ...(typeof parsed.mintTxSignature === "string" ? { mintTxSignature: parsed.mintTxSignature } : {}),
      ...(typeof parsed.supplyTxSignature === "string" ? { supplyTxSignature: parsed.supplyTxSignature } : {}),
      createdAt: parsed.createdAt,
      lastUpdatedAt: parsed.lastUpdatedAt,
    };
  } catch {
    return null;
  }
}

export function writeTokenOperation(
  storage: Pick<Storage, "setItem">,
  operation: TokenOperation,
) {
  const publicRecord = {
    operationId: operation.operationId,
    creator: operation.creator,
    ...(operation.mint ? { mint: operation.mint } : {}),
    ...(operation.tokenAccount ? { tokenAccount: operation.tokenAccount } : {}),
    tokenName: operation.tokenName,
    symbol: operation.symbol,
    totalSupply: operation.totalSupply,
    decimals: operation.decimals,
    phase: operation.phase,
    ...(operation.mintTxSignature ? { mintTxSignature: operation.mintTxSignature } : {}),
    ...(operation.supplyTxSignature ? { supplyTxSignature: operation.supplyTxSignature } : {}),
    createdAt: operation.createdAt,
    lastUpdatedAt: operation.lastUpdatedAt,
  } satisfies TokenOperation;
  storage.setItem(
    operationStorageKey(operation.creator),
    JSON.stringify(publicRecord),
  );
}

export function clearTokenOperation(
  storage: Pick<Storage, "removeItem">,
  creator: string,
) {
  storage.removeItem(operationStorageKey(creator));
}

export function canClearTokenOperation(
  operation: TokenOperation,
  state: MintRecoveryState,
) {
  return state === "MISSING" || operation.phase === "COMPLETE";
}
