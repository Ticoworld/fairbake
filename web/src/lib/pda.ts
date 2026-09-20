import { PublicKey } from "@solana/web3.js";
import { FAIRBAKE_PROGRAM_ID } from "./config";

const seed = (value: string) => Buffer.from(value);

export function findSalePda(creator: PublicKey, mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([seed("sale"), creator.toBuffer(), mint.toBuffer()], FAIRBAKE_PROGRAM_ID);
}

export function findVaultPda(sale: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([seed("sale-vault"), sale.toBuffer()], FAIRBAKE_PROGRAM_ID);
}

export function findTreasuryPda(sale: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([seed("treasury"), sale.toBuffer()], FAIRBAKE_PROGRAM_ID);
}

export function findBuyerPositionPda(sale: PublicKey, buyer: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([seed("buyer-position"), sale.toBuffer(), buyer.toBuffer()], FAIRBAKE_PROGRAM_ID);
}

export function findMetadataPda(mint: PublicKey, metadataProgram: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([seed("metadata"), metadataProgram.toBuffer(), mint.toBuffer()], metadataProgram)[0];
}
