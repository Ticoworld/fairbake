import { AnchorProvider, Program } from "@anchor-lang/core";
import { PublicKey, Transaction } from "@solana/web3.js";
import fairbakeIdl from "@/idl/fairbake.json";
import { connection } from "./rpc";

export type WalletSigner = {
  publicKey: PublicKey;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
};

export function createProgram(wallet: WalletSigner) {
  const provider = new AnchorProvider(connection, wallet as never, { commitment: "confirmed", preflightCommitment: "confirmed" });
  return new Program(fairbakeIdl as never, provider);
}
