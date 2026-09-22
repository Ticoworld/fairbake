import { BN } from "@anchor-lang/core";
import { AuthorityType, createAssociatedTokenAccountInstruction, createInitializeMintInstruction, createMintToInstruction, createSetAuthorityInstruction, getAssociatedTokenAddress, getMint, MINT_SIZE, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram, Transaction } from "@solana/web3.js";
import { createProgram, type WalletSigner } from "./program";
import { connection } from "./rpc";
import { findBuyerPositionPda, findSalePda, findTreasuryPda, findVaultPda } from "./pda";
import { humanizeError, TransactionStageError } from "./errors";
import type { MintInspection } from "./token-operation";

export type TxResult = { signature: string };
export type SubmittedTransaction = {
  signature: string;
  blockhash: string;
  lastValidBlockHeight: number;
};

function transactionDiagnostic(
  stage: string,
  event: string,
  cause?: unknown,
) {
  if (process.env.NODE_ENV === "production") return;
  const error = cause instanceof Error ? cause : null;
  console.info(`[FairBake transaction] ${stage} ${event}`, {
    exceptionType: cause == null ? null : cause.constructor?.name ?? typeof cause,
    message: error?.message ?? (cause == null ? null : String(cause)),
    stack: error?.stack ?? null,
  });
}

export async function submitTransaction(wallet: WalletSigner, transaction: Transaction, signers: Keypair[] = []): Promise<SubmittedTransaction> {
  let latest;
  transactionDiagnostic("BLOCKHASH_FEE_PAYER", "started");
  try {
    latest = await connection.getLatestBlockhash("confirmed");
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = latest.blockhash;
    if (signers.length) transaction.partialSign(...signers);
    transactionDiagnostic("BLOCKHASH_FEE_PAYER", "completed");
  } catch (cause) {
    transactionDiagnostic("BLOCKHASH_FEE_PAYER", "failed", cause);
    throw new TransactionStageError("BLOCKHASH_FEE_PAYER", cause);
  }
  let signed: Transaction;
  transactionDiagnostic("WALLET_SIGN", "started");
  try {
    signed = await wallet.signTransaction(transaction);
    transactionDiagnostic("WALLET_SIGN", "completed");
  } catch (cause) {
    transactionDiagnostic("WALLET_SIGN", "failed", cause);
    if (cause instanceof TransactionStageError) throw cause;
    throw new TransactionStageError("WALLET_SIGN", cause);
  }
  let signature: string;
  transactionDiagnostic("RPC_SUBMISSION", "started");
  try {
    signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
    transactionDiagnostic("RPC_SUBMISSION", "completed");
  } catch (cause) {
    transactionDiagnostic("RPC_SUBMISSION", "failed", cause);
    throw new TransactionStageError("RPC_SUBMISSION", cause);
  }
  return { signature, ...latest };
}

export async function confirmSubmittedTransaction(
  submitted: SubmittedTransaction,
): Promise<void> {
  transactionDiagnostic("CONFIRMATION", "started");
  try {
    const result = await connection.confirmTransaction(submitted, "confirmed");
    if (result.value.err)
      throw new TransactionStageError(
        "CONFIRMATION",
        new Error(JSON.stringify(result.value.err)),
        submitted.signature,
        "FAILED",
      );
    transactionDiagnostic("CONFIRMATION", "completed");
  } catch (cause) {
    if (cause instanceof TransactionStageError) throw cause;
    transactionDiagnostic("CONFIRMATION", "failed", cause);
    throw new TransactionStageError(
      "CONFIRMATION",
      cause,
      submitted.signature,
      "UNKNOWN",
    );
  }
}

async function send(wallet: WalletSigner, transaction: Transaction, signers: Keypair[] = []): Promise<TxResult> {
  const submitted = await submitTransaction(wallet, transaction, signers);
  await confirmSubmittedTransaction(submitted);
  return { signature: submitted.signature };
}

async function instructionTransaction(wallet: WalletSigner, instruction: Parameters<Transaction["add"]>[0], signers: Keypair[] = []) {
  return send(wallet, new Transaction().add(instruction), signers);
}

export async function buildMintAccountTransaction(wallet: WalletSigner, decimals: number): Promise<{ mint: Keypair; transaction: Transaction }> {
  const mint = Keypair.generate();
  const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  const tx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: wallet.publicKey, newAccountPubkey: mint.publicKey, lamports, space: MINT_SIZE, programId: TOKEN_PROGRAM_ID }),
    createInitializeMintInstruction(mint.publicKey, decimals, wallet.publicKey, wallet.publicKey, TOKEN_PROGRAM_ID),
  );
  return { mint, transaction: tx };
}

export async function createMintAccount(wallet: WalletSigner, decimals: number): Promise<{ mint: PublicKey; signature: string }> {
  const built = await buildMintAccountTransaction(wallet, decimals);
  const result = await send(wallet, built.transaction, [built.mint]);
  return { mint: built.mint.publicKey, signature: result.signature };
}

export async function buildMintSupplyAndRevokeTransaction(wallet: WalletSigner, mint: PublicKey, amount: bigint): Promise<{ tokenAccount: PublicKey; transaction: Transaction }> {
  const tokenAccount = await getAssociatedTokenAddress(mint, wallet.publicKey, false, TOKEN_PROGRAM_ID);
  const tx = new Transaction();
  if (!(await connection.getAccountInfo(tokenAccount, "confirmed"))) {
    tx.add(createAssociatedTokenAccountInstruction(wallet.publicKey, tokenAccount, wallet.publicKey, mint, TOKEN_PROGRAM_ID));
  }
  tx.add(
    createMintToInstruction(mint, tokenAccount, wallet.publicKey, amount, [], TOKEN_PROGRAM_ID),
    createSetAuthorityInstruction(mint, wallet.publicKey, AuthorityType.MintTokens, null, [], TOKEN_PROGRAM_ID),
    createSetAuthorityInstruction(mint, wallet.publicKey, AuthorityType.FreezeAccount, null, [], TOKEN_PROGRAM_ID),
  );
  return { tokenAccount, transaction: tx };
}

export async function mintSupplyAndRevoke(wallet: WalletSigner, mint: PublicKey, amount: bigint): Promise<{ tokenAccount: PublicKey; signature: string }> {
  const built = await buildMintSupplyAndRevokeTransaction(wallet, mint, amount);
  return { tokenAccount: built.tokenAccount, ...(await send(wallet, built.transaction)) };
}

export async function inspectMint(
  mint: PublicKey,
  creator: PublicKey,
  expectedDecimals: number,
): Promise<MintInspection> {
  const account = await connection.getAccountInfo(mint, "confirmed");
  if (!account)
    return {
      exists: false,
      owner: null,
      decimals: null,
      supply: 0n,
      mintAuthority: null,
      freezeAuthority: null,
      creatorBalance: 0n,
    };
  if (!account.owner.equals(TOKEN_PROGRAM_ID))
    return {
      exists: true,
      owner: account.owner.toBase58(),
      decimals: null,
      supply: 0n,
      mintAuthority: null,
      freezeAuthority: null,
      creatorBalance: 0n,
      error: `Mint account is owned by ${account.owner.toBase58()}, not the legacy SPL Token Program.`,
    };
  try {
    const info = await getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID);
    const tokenAccount = await getAssociatedTokenAddress(mint, creator, false, TOKEN_PROGRAM_ID);
    const balance = await connection
      .getTokenAccountBalance(tokenAccount, "confirmed")
      .then((result) => BigInt(result.value.amount))
      .catch(() => 0n);
    return {
      exists: true,
      owner: account.owner.toBase58(),
      decimals: info.decimals,
      supply: BigInt(info.supply.toString()),
      mintAuthority: info.mintAuthority?.toBase58() ?? null,
      freezeAuthority: info.freezeAuthority?.toBase58() ?? null,
      creatorBalance: balance,
      tokenAccount: tokenAccount.toBase58(),
      error: info.decimals === expectedDecimals ? undefined : `Mint decimals are ${info.decimals}, expected ${expectedDecimals}.`,
    };
  } catch (cause) {
    return {
      exists: true,
      owner: account.owner.toBase58(),
      decimals: null,
      supply: 0n,
      mintAuthority: null,
      freezeAuthority: null,
      creatorBalance: 0n,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

export async function validateExistingMint(mint: PublicKey, wallet: PublicKey) {
  const info = await getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID);
  const tokenAccount = await getAssociatedTokenAddress(mint, wallet, false, TOKEN_PROGRAM_ID);
  const tokenAccountInfo = await connection.getTokenAccountBalance(tokenAccount).catch(() => null);
  const balance = tokenAccountInfo ? BigInt(tokenAccountInfo.value.amount) : 0n;
  const reasons: string[] = [];
  if (info.mintAuthority) reasons.push("mint authority is still active");
  if (info.freezeAuthority) reasons.push("freeze authority is still active");
  const supply = BigInt(info.supply.toString());
  if (balance < supply) reasons.push("connected creator does not hold the complete fixed supply");
  return {
    valid: reasons.length === 0,
    reasons,
    decimals: info.decimals,
    supply,
    balance,
    tokenAccount,
  };
}

export async function initializeSale(wallet: WalletSigner, input: { mint: PublicKey; creatorTokenAccount: PublicKey; saleSupply: bigint; minimumRaise: bigint; hardCap: bigint; maxPerWallet: bigint; startTime: bigint; endTime: bigint }): Promise<{ sale: PublicKey; signature: string; blockhash?: string; lastValidBlockHeight?: number }> {
  const [sale] = findSalePda(wallet.publicKey, input.mint);
  const [saleVault] = findVaultPda(sale);
  const [treasury] = findTreasuryPda(sale);
  const program = createProgram(wallet);
  const instruction = await program.methods.initializeSale(new BN(input.saleSupply.toString()), new BN(input.minimumRaise.toString()), new BN(input.hardCap.toString()), new BN(input.maxPerWallet.toString()), new BN(input.startTime.toString()), new BN(input.endTime.toString())).accounts({ creator: wallet.publicKey, sale, mint: input.mint, creatorTokenAccount: input.creatorTokenAccount, saleVault, treasury, systemProgram: SystemProgram.programId, tokenProgram: TOKEN_PROGRAM_ID, rent: SYSVAR_RENT_PUBKEY }).instruction();
  const submitted = await submitTransaction(wallet, new Transaction().add(instruction));
  await confirmSubmittedTransaction(submitted);
  return { sale, signature: submitted.signature, blockhash: submitted.blockhash, lastValidBlockHeight: submitted.lastValidBlockHeight };
}

export async function buy(wallet: WalletSigner, sale: PublicKey, mint: PublicKey, contribution: bigint): Promise<TxResult> {
  const buyerTokenAccount = await getAssociatedTokenAddress(mint, wallet.publicKey, false, TOKEN_PROGRAM_ID);
  const [buyerPosition] = findBuyerPositionPda(sale, wallet.publicKey);
  const [treasury] = findTreasuryPda(sale);
  const program = createProgram(wallet);
  const tx = new Transaction();
  if (!(await connection.getAccountInfo(buyerTokenAccount, "confirmed"))) tx.add(createAssociatedTokenAccountInstruction(wallet.publicKey, buyerTokenAccount, wallet.publicKey, mint, TOKEN_PROGRAM_ID));
  tx.add(await program.methods.buy(new BN(contribution.toString())).accounts({ buyer: wallet.publicKey, sale, buyerPosition, treasury, buyerTokenAccount, mint, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).instruction());
  return send(wallet, tx);
}

export async function finalizeSale(wallet: WalletSigner, sale: PublicKey): Promise<TxResult> {
  transactionDiagnostic("TRANSACTION_BUILD", "started");
  try {
    const program = createProgram(wallet);
    const instruction = await program.methods
      .finalizeSale()
      .accounts({ keeper: wallet.publicKey, sale })
      .instruction();
    transactionDiagnostic("TRANSACTION_BUILD", "completed");
    return send(wallet, new Transaction().add(instruction));
  } catch (cause) {
    transactionDiagnostic("TRANSACTION_BUILD", "failed", cause);
    if (cause instanceof TransactionStageError) throw cause;
    throw new TransactionStageError("TRANSACTION_BUILD", cause);
  }
}

export async function claim(wallet: WalletSigner, sale: PublicKey, position: { buyerTokenAccount: PublicKey; buyer: PublicKey }, mint: PublicKey): Promise<TxResult> {
  const [buyerPosition] = findBuyerPositionPda(sale, wallet.publicKey);
  const [treasury] = findTreasuryPda(sale);
  const [saleVault] = findVaultPda(sale);
  const program = createProgram(wallet);
  return send(wallet, new Transaction().add(await program.methods.claim().accounts({ sale, buyerPosition, buyer: wallet.publicKey, treasury, saleVault, buyerTokenAccount: position.buyerTokenAccount, mint, tokenProgram: TOKEN_PROGRAM_ID }).instruction()));
}

export async function claimFor(wallet: WalletSigner, sale: PublicKey, buyer: PublicKey, buyerTokenAccount: PublicKey, mint: PublicKey): Promise<TxResult> {
  const [buyerPosition] = findBuyerPositionPda(sale, buyer);
  const [treasury] = findTreasuryPda(sale);
  const [saleVault] = findVaultPda(sale);
  const program = createProgram(wallet);
  return send(wallet, new Transaction().add(await program.methods.claimFor().accounts({ sale, buyerPosition, buyer, caller: wallet.publicKey, treasury, saleVault, buyerTokenAccount, mint, tokenProgram: TOKEN_PROGRAM_ID }).instruction()));
}

export async function withdrawProceeds(wallet: WalletSigner, sale: PublicKey): Promise<TxResult> {
  const [treasury] = findTreasuryPda(sale);
  const program = createProgram(wallet);
  return send(wallet, new Transaction().add(await program.methods.withdrawProceeds().accounts({ sale, creator: wallet.publicKey, treasury }).instruction()));
}

export async function withdrawInventory(wallet: WalletSigner, sale: PublicKey, mint: PublicKey, creatorTokenAccount: PublicKey): Promise<TxResult> {
  const [saleVault] = findVaultPda(sale);
  const program = createProgram(wallet);
  return send(wallet, new Transaction().add(await program.methods.withdrawInventory().accounts({ sale, creator: wallet.publicKey, mint, creatorTokenAccount, saleVault, tokenProgram: TOKEN_PROGRAM_ID }).instruction()));
}

export function readableTransactionError(error: unknown) { return humanizeError(error); }
