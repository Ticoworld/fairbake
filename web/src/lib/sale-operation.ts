export type SaleCreationPhase =
  | "PREPARED"
  | "SUBMITTED"
  | "COMPLETE"
  | "FAILED_RETRYABLE"
  | "BLOCKED";

export type SaleCreationOperation = {
  operationId: string;

  creator: string;
  mint: string;
  creatorTokenAccount: string;

  expectedSale: string;

  saleSupply: string;
  minimumRaise: string;
  hardCap: string;
  maxPerWallet: string;

  startTime: string;
  endTime: string;

  phase: SaleCreationPhase;

  signature?: string;
  blockhash?: string;
  lastValidBlockHeight?: number;

  createdAt: number;
  lastUpdatedAt: number;
};

export type SaleInspection = {
  exists: boolean;
  owner: string | null;
  creator: string | null;
  mint: string | null;
  creatorTokenAccount: string | null;
  saleSupply: string | null;
  minimumRaise: string | null;
  hardCap: string | null;
  maxPerWallet: string | null;
  startTime: string | null;
  endTime: string | null;
  error?: string;
};

export type SaleRecoveryState =
  | "MISSING"
  | "MATCHING_SALE"
  | "UNSAFE_MISMATCH";

export function classifySaleInspection(
  operation: Pick<
    SaleCreationOperation,
    "creator" | "mint" | "creatorTokenAccount" | "saleSupply" | "minimumRaise" | "hardCap" | "maxPerWallet" | "startTime" | "endTime"
  >,
  inspection: SaleInspection,
): SaleRecoveryState {
  if (!inspection.exists) return "MISSING";

  const safeOwner = inspection.owner === "9GYL8FqGfCzWZ1v6w8F8yJ8QK3FPdBG8W8B1rHEVnzKQ"; // FAIRBAKE_PROGRAM_ID

  if (!safeOwner) return "UNSAFE_MISMATCH";

  const matches =
    inspection.creator === operation.creator &&
    inspection.mint === operation.mint &&
    inspection.creatorTokenAccount === operation.creatorTokenAccount &&
    inspection.saleSupply === operation.saleSupply &&
    inspection.minimumRaise === operation.minimumRaise &&
    inspection.hardCap === operation.hardCap &&
    inspection.maxPerWallet === operation.maxPerWallet &&
    inspection.startTime === operation.startTime &&
    inspection.endTime === operation.endTime;

  return matches ? "MATCHING_SALE" : "UNSAFE_MISMATCH";
}

const STORAGE_PREFIX = "fairbake:sale-create:";
const PHASES: SaleCreationPhase[] = [
  "PREPARED",
  "SUBMITTED",
  "COMPLETE",
  "FAILED_RETRYABLE",
  "BLOCKED",
];

export function saleOperationStorageKey(creator: string): string {
  return `${STORAGE_PREFIX}${creator}`;
}

export function readSaleCreationOperation(
  storage: Pick<Storage, "getItem">,
  creator: string,
): SaleCreationOperation | null {
  try {
    const raw = storage.getItem(saleOperationStorageKey(creator));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SaleCreationOperation>;

    if (
      parsed.creator !== creator ||
      typeof parsed.operationId !== "string" ||
      typeof parsed.mint !== "string" ||
      typeof parsed.creatorTokenAccount !== "string" ||
      typeof parsed.expectedSale !== "string" ||
      typeof parsed.saleSupply !== "string" ||
      typeof parsed.minimumRaise !== "string" ||
      typeof parsed.hardCap !== "string" ||
      typeof parsed.maxPerWallet !== "string" ||
      typeof parsed.startTime !== "string" ||
      typeof parsed.endTime !== "string" ||
      typeof parsed.phase !== "string" ||
      !PHASES.includes(parsed.phase as SaleCreationPhase) ||
      typeof parsed.createdAt !== "number" ||
      typeof parsed.lastUpdatedAt !== "number"
    )
      return null;

    return {
      operationId: parsed.operationId,
      creator: parsed.creator,
      mint: parsed.mint,
      creatorTokenAccount: parsed.creatorTokenAccount,
      expectedSale: parsed.expectedSale,
      saleSupply: parsed.saleSupply,
      minimumRaise: parsed.minimumRaise,
      hardCap: parsed.hardCap,
      maxPerWallet: parsed.maxPerWallet,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      phase: parsed.phase as SaleCreationPhase,
      ...(typeof parsed.signature === "string" ? { signature: parsed.signature } : {}),
      ...(typeof parsed.blockhash === "string" ? { blockhash: parsed.blockhash } : {}),
      ...(typeof parsed.lastValidBlockHeight === "number" ? { lastValidBlockHeight: parsed.lastValidBlockHeight } : {}),
      createdAt: parsed.createdAt,
      lastUpdatedAt: parsed.lastUpdatedAt,
    };
  } catch {
    return null;
  }
}

export function writeSaleCreationOperation(
  storage: Pick<Storage, "setItem">,
  operation: SaleCreationOperation,
) {
  const publicRecord = {
    operationId: operation.operationId,
    creator: operation.creator,
    mint: operation.mint,
    creatorTokenAccount: operation.creatorTokenAccount,
    expectedSale: operation.expectedSale,
    saleSupply: operation.saleSupply,
    minimumRaise: operation.minimumRaise,
    hardCap: operation.hardCap,
    maxPerWallet: operation.maxPerWallet,
    startTime: operation.startTime,
    endTime: operation.endTime,
    phase: operation.phase,
    ...(operation.signature ? { signature: operation.signature } : {}),
    ...(operation.blockhash ? { blockhash: operation.blockhash } : {}),
    ...(operation.lastValidBlockHeight !== undefined ? { lastValidBlockHeight: operation.lastValidBlockHeight } : {}),
    createdAt: operation.createdAt,
    lastUpdatedAt: operation.lastUpdatedAt,
  } satisfies SaleCreationOperation;
  storage.setItem(
    saleOperationStorageKey(operation.creator),
    JSON.stringify(publicRecord),
  );
}

export function clearSaleCreationOperation(
  storage: Pick<Storage, "removeItem">,
  creator: string,
) {
  storage.removeItem(saleOperationStorageKey(creator));
}

export function canClearSaleCreationOperation(
  operation: SaleCreationOperation,
  state: SaleRecoveryState,
): boolean {
  return state === "MISSING" || operation.phase === "COMPLETE";
}
