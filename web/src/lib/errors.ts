const messages: Record<string, string> = {
  SaleNotActive: "This launch is no longer accepting contributions.",
  OutsideSaleWindow: "This contribution is outside the fixed participation window.",
  WalletCapExceeded: "This contribution is above the maximum per-wallet amount.",
  InvalidContribution: "Contribution must be greater than zero.",
  SaleNotEnded: "The participation window has not ended yet.",
  AlreadyFinalized: "This launch has already been finalized.",
  AlreadyClaimed: "This position has already been settled.",
  ClaimsIncomplete: "Every participant must settle before inventory cleanup.",
  MintAuthorityNotRevoked: "The mint authority must be permanently revoked before launch.",
  FreezeAuthorityNotRevoked: "The freeze authority must be permanently revoked before launch.",
  MintSupplyMismatch: "The launch supply must equal the token's full fixed supply.",
  InsufficientInventory: "The creator token account does not hold enough inventory.",
  ProceedsAlreadyWithdrawn: "Creator proceeds have already been withdrawn.",
  InventoryAlreadyWithdrawn: "Sale inventory has already been withdrawn.",
  TreasuryInsufficient: "The sale treasury cannot safely cover this payout yet.",
};

export type TransactionStage =
  | "NETWORK_VERIFICATION"
  | "TRANSACTION_BUILD"
  | "BLOCKHASH_FEE_PAYER"
  | "WALLET_SIGN"
  | "RPC_SUBMISSION"
  | "CONFIRMATION";

export class TransactionStageError extends Error {
  readonly stage: TransactionStage;
  readonly cause: unknown;
  readonly signature?: string;
  readonly confirmation?: "FAILED" | "UNKNOWN";

  constructor(
    stage: TransactionStage,
    cause: unknown,
    signature?: string,
    confirmation?: "FAILED" | "UNKNOWN",
  ) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(message);
    this.name = "TransactionStageError";
    this.stage = stage;
    this.cause = cause;
    this.signature = signature;
    this.confirmation = confirmation;
  }
}

function errorText(error: unknown): string {
  if (error instanceof TransactionStageError)
    return `${error.message} ${errorText(error.cause)}`;
  return error instanceof Error ? error.message : String(error);
}

function logTransactionError(error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    const stageError = error instanceof TransactionStageError ? error : null;
    const cause = stageError?.cause ?? error;
    const original = cause instanceof Error ? cause : null;
    console.error("[FairBake transaction error]", {
      stage: stageError?.stage ?? "UNCLASSIFIED",
      exceptionType:
        cause == null ? null : cause.constructor?.name ?? typeof cause,
      message: original?.message ?? (cause == null ? null : String(cause)),
      stack: original?.stack ?? null,
    });
  }
}

export function humanizeError(error: unknown): string {
  logTransactionError(error);
  const stage = error instanceof TransactionStageError ? error.stage : null;
  const text = errorText(error);
  if (stage === "NETWORK_VERIFICATION")
    return "Switch Nightly to Cookie Chain before continuing.";
  if (stage === "TRANSACTION_BUILD")
    return "FairBake could not prepare this transaction.";
  if (stage === "RPC_SUBMISSION")
    return "Cookie Chain rejected the transaction.";
  if (stage === "CONFIRMATION" && error instanceof TransactionStageError && error.confirmation === "FAILED")
    return "Transaction was submitted, but Cookie Chain reported it failed. Refresh to reconcile safely.";
  if (stage === "CONFIRMATION")
    return "Transaction was submitted, but confirmation is still being checked. Refresh to reconcile safely.";
  if (
    stage === "WALLET_SIGN" &&
    /User rejected|rejected the request|4001|cancel/i.test(text)
  )
    return "Transaction cancelled in Nightly.";
  if (stage === "WALLET_SIGN")
    return "Nightly could not sign the transaction.";
  const match = Object.keys(messages).find((key) => text.includes(key));
  if (match) return messages[match];
  if (/User rejected|rejected the request|4001|cancel/i.test(text)) return "Transaction cancelled in Nightly.";
  if (/insufficient funds|insufficient lamports/i.test(text)) return "This wallet does not have enough COOK for the contribution and network fees.";
  return "The transaction could not be completed. Check Cookie network status and try again.";
}
