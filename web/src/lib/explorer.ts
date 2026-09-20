import { COOKIE_EXPLORER } from "./config";

const clean = (value: string) => value.replace(/\/$/, "");

export const explorer = {
  transaction: (signature: string) => `${clean(COOKIE_EXPLORER)}/tx/${signature}`,
  address: (address: string) => `${clean(COOKIE_EXPLORER)}/address/${address}`,
  mint: (mint: string) => `${clean(COOKIE_EXPLORER)}/token/${mint}`,
  program: (program: string) => `${clean(COOKIE_EXPLORER)}/address/${program}`,
};
