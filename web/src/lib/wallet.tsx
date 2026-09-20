"use client";

import { getWallets } from "@wallet-standard/app";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { COOKIE_GENESIS_HASH_FALLBACK, COOKIE_RPC } from "./config";
import { connection } from "./rpc";
import { TransactionStageError } from "./errors";
import type { WalletSigner } from "./program";

export type WalletState =
  | "DISCONNECTED"
  | "RESTORING"
  | "CONNECTING"
  | "CONNECTED_WRONG_NETWORK"
  | "SWITCHING_NETWORK"
  | "CONNECTED_COOKIE"
  | "SIGNING"
  | "TRANSACTION_SUBMITTED"
  | "CONFIRMING"
  | "CONFIRMED"
  | "ERROR";
type WalletLike = any;

type WalletContextValue = {
  state: WalletState;
  wallet: WalletLike | null;
  wallets: WalletLike[];
  publicKey: PublicKey | null;
  error: string | null;
  connect: (wallet?: WalletLike) => Promise<void>;
  disconnect: () => Promise<void>;
  switchToCookie: () => Promise<void>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
  setState: (state: WalletState) => void;
};

type ConnectOptions = {
  silent?: boolean;
  restoring?: boolean;
};

const WalletContext = createContext<WalletContextValue | null>(null);
const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111";
const SELECTED_WALLET_KEY = "fairbake:selected-wallet";
const LAST_PUBLIC_ADDRESS_KEY = "fairbake:last-public-address";

function walletAddress(wallet: WalletLike): PublicKey | null {
  const browserWallets = window as any;
  const addresses = [
    wallet?.accounts?.[0]?.address,
    browserWallets.phantom?.solana?.publicKey?.toString?.(),
    browserWallets.solana?.publicKey?.toString?.(),
    window.nightly?.solana?.publicKey?.toString?.(),
    window.nightly?.publicKey?.toString?.(),
    wallet?.publicKey?.toString?.(),
    wallet?.adapter?.publicKey?.toString?.(),
    wallet?.standardWallet?.accounts?.[0]?.address,
  ];

  for (const address of addresses) {
    try {
      if (address && address !== SYSTEM_PROGRAM_ADDRESS)
        return new PublicKey(address);
    } catch {
      // Keep checking the other wallet address shapes.
    }
  }

  return null;
}

function features(wallet: WalletLike) {
  return wallet?.features ?? {};
}

function diagnosticAddress(address: string | undefined) {
  return address ? `${address.slice(0, 8)}…${address.slice(-6)}` : null;
}

function walletFeatureKeys(wallet: WalletLike) {
  return Object.keys(features(wallet));
}

function readSelectedWallet(): string | null {
  try {
    return window.localStorage.getItem(SELECTED_WALLET_KEY);
  } catch {
    return null;
  }
}

function persistWalletPreference(wallet: WalletLike, address: PublicKey) {
  try {
    window.localStorage.setItem(
      SELECTED_WALLET_KEY,
      wallet?.name?.toString() || "Nightly",
    );
    window.localStorage.setItem(LAST_PUBLIC_ADDRESS_KEY, address.toBase58());
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

function clearWalletPreference() {
  try {
    window.localStorage.removeItem(SELECTED_WALLET_KEY);
    window.localStorage.removeItem(LAST_PUBLIC_ADDRESS_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

function clearLastPublicAddress() {
  try {
    window.localStorage.removeItem(LAST_PUBLIC_ADDRESS_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

function addSubscriptionCleanup(cleanups: Array<() => void>, subscription: any) {
  if (typeof subscription === "function") {
    cleanups.push(subscription);
  } else if (typeof subscription?.unsubscribe === "function") {
    cleanups.push(() => subscription.unsubscribe());
  } else if (typeof subscription?.off === "function") {
    cleanups.push(() => subscription.off());
  }
}

function diagnostic(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    // `console.info` is intentional here: Chrome commonly hides `debug` output
    // behind a console filter, which made the original wallet failure invisible.
    console.info(`[FairBake wallet] ${event}`, details);
    (window as any).__FAIRBAKE_WALLET_DIAGNOSTICS__ = {
      event,
      details,
      recordedAt: new Date().toISOString(),
    };
  }
}

function readNightlyGenesis(nightly: any): string | null {
  try {
    const chainInfo = nightly?.chainInfo;
    const candidates = [
      nightly?.genesisHash,
      nightly?.network?.genesisHash,
      nightly?.activeNetwork?.genesisHash,
      nightly?.networkInfo?.genesisHash,
      typeof chainInfo === "string" ? chainInfo : null,
      chainInfo?.genesisHash,
      chainInfo?.genesis_hash,
      chainInfo?.network?.genesisHash,
      chainInfo?.network?.genesis_hash,
    ];
    const direct = candidates.find(
      (value) => typeof value === "string" && value.length > 0,
    );
    if (direct) return direct;

    // Nightly builds have exposed the same network record with different
    // nesting over time. Only fields explicitly named genesisHash are read;
    // arbitrary network names or RPC URLs are never treated as proof.
    const findNested = (value: any, depth: number): string | null => {
      if (!value || typeof value !== "object" || depth > 3) return null;
      for (const [key, nested] of Object.entries(value)) {
        if (
          (key === "genesisHash" || key === "genesis_hash") &&
          typeof nested === "string" &&
          nested.length > 0
        )
          return nested;
        const found = findNested(nested, depth + 1);
        if (found) return found;
      }
      return null;
    };
    return findNested(chainInfo, 0);
  } catch {
    return null;
  }
}

function nightlySnapshot(nightly: any) {
  const chainInfo = nightly?.chainInfo;
  return {
    present: Boolean(nightly),
    ownKeys: nightly ? Object.getOwnPropertyNames(nightly) : [],
    featureKeys: Object.keys(nightly?.features ?? {}),
    activeGenesisHash: readNightlyGenesis(nightly),
    directGenesisHash: nightly?.genesisHash ?? null,
    chainInfoKeys:
      chainInfo && typeof chainInfo === "object"
        ? Object.keys(chainInfo)
        : [],
    chainInfoGenesisHash:
      typeof chainInfo === "string"
        ? chainInfo
        : chainInfo?.genesisHash ?? chainInfo?.genesis_hash ?? null,
    changeNetworkAvailable: typeof nightly?.changeNetwork === "function",
  };
}

async function waitForNightlyGenesis(nightly: any, expected: string, timeoutMs = 3000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const active = readNightlyGenesis(nightly);
    if (active === expected) return active;
    await new Promise((resolve) => window.setTimeout(resolve, 150));
  }
  return readNightlyGenesis(nightly);
}

async function waitForWalletAddress(
  wallet: WalletLike,
  timeoutMs = 5000,
): Promise<PublicKey> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const key = walletAddress(wallet);
    if (key) return key;

    // Wallet extensions can resolve the connect request before they publish
    // the authorized account back to the Wallet Standard object.
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  throw new Error("Wallet connected, but no account was returned.");
}

async function standardSign(
  wallet: WalletLike,
  transaction: Transaction,
): Promise<Transaction> {
  const nightly = window.nightly?.solana;
  const nightlyStandardSign =
    nightly?.features?.["standard:signTransaction"];
  const nightlySolanaSign = nightly?.features?.["solana:signTransaction"];
  const walletSolanaSign = features(wallet)["solana:signTransaction"];
  const signFeature =
    nightlyStandardSign ?? nightlySolanaSign ?? walletSolanaSign;
  const sign = signFeature?.signTransaction?.bind(signFeature);
  if (!sign)
    throw new Error(
      "This wallet does not expose Wallet Standard transaction signing",
    );
  const account = wallet.accounts?.[0] ?? nightly?.accounts?.[0];
  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  diagnostic("signing method selected", {
    method: nightlyStandardSign?.signTransaction
      ? "nightly standard:signTransaction"
      : nightlySolanaSign?.signTransaction
        ? "nightly solana:signTransaction"
        : "wallet standard solana:signTransaction",
    account: diagnosticAddress(account?.address),
    serializedBytes: serialized.length,
    chainArgument: "omitted; Cookie is verified via genesisHash",
  });
  const result = await sign({ account, transaction: serialized });
  const output = Array.isArray(result) ? result[0] : result;
  const signed = output?.signedTransaction ?? output?.signedTransactions?.[0];
  const signedBytes =
    signed instanceof Uint8Array
      ? signed
      : ArrayBuffer.isView(signed)
        ? new Uint8Array(signed.buffer, signed.byteOffset, signed.byteLength)
        : null;
  if (!signedBytes)
    throw new Error("Wallet returned no signed transaction bytes");
  return Transaction.from(signedBytes);
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<WalletLike[]>([]);
  const [wallet, setWallet] = useState<WalletLike | null>(null);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [state, setState] = useState<WalletState>("RESTORING");
  const [error, setError] = useState<string | null>(null);
  const walletRef = useRef<WalletLike | null>(null);
  const restoreAttemptedRef = useRef(false);

  const updateWalletState = useCallback(
    (nextWallet: WalletLike | null, nextPublicKey: PublicKey | null) => {
      walletRef.current = nextWallet;
      setWallet(nextWallet);
      setPublicKey(nextPublicKey);
    },
    [],
  );

  useEffect(() => {
    const standard = getWallets();
    const refresh = () => setWallets([...standard.get()]);
    refresh();
    const offRegister = standard.on("register", refresh);
    const offUnregister = standard.on("unregister", refresh);
    return () => {
      offRegister();
      offUnregister();
    };
  }, []);

  const verifyNetwork = useCallback(async (candidate: WalletLike) => {
    try {
      const expected = await connection.getGenesisHash();
      const nightly = window.nightly?.solana;
      const nightlyGenesis = readNightlyGenesis(nightly);
      const reported =
        nightlyGenesis ??
        candidate?.genesisHash ??
        candidate?.standardWallet?.genesisHash;
      const isNightly = Boolean(nightly) || candidate?.name?.toLowerCase().includes("nightly");
      diagnostic("network check", {
        expectedCookieGenesis: expected,
        ...nightlySnapshot(nightly),
        reportedGenesis: reported ?? null,
        result: reported === expected ? "PASS" : "MISMATCH_OR_UNREPORTED",
      });
      if (reported && reported !== expected) {
        setState("CONNECTED_WRONG_NETWORK");
        return false;
      }
      if (isNightly && !reported) {
        throw new TransactionStageError(
          "NETWORK_VERIFICATION",
          new Error("Nightly did not report an active genesis hash"),
        );
      }
      setState("CONNECTED_COOKIE");
      return true;
    } catch (cause) {
      setState("CONNECTED_WRONG_NETWORK");
      setError(
        cause instanceof TransactionStageError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "Could not verify Cookie network",
      );
      return false;
    }
  }, []);

  const connect = useCallback(
    async (requested?: WalletLike, options: ConnectOptions = {}) => {
      const restoring = options.restoring === true;
      const silent = options.silent === true;
      setState("CONNECTING");
      setError(null);
      try {
        const candidate =
          requested ??
          wallets.find((item) =>
            item.name?.toLowerCase().includes("nightly"),
          ) ??
          wallets[0] ??
          window.nightly?.standardWallet;
        if (!candidate)
          throw new Error(
            "No compatible wallet found. Install Nightly or another Wallet Standard wallet.",
          );
        const nightlyConnectFeature =
          window.nightly?.solana?.features?.["standard:connect"];
        const walletConnectFeature = features(candidate)["standard:connect"];
        const connectFeature =
          walletConnectFeature?.connect ?? nightlyConnectFeature?.connect;
        const connect = connectFeature?.bind(
          walletConnectFeature?.connect ? walletConnectFeature : nightlyConnectFeature,
        );
        const result = connect
          ? silent
            ? await connect({ silent: true })
            : await connect()
          : null;
        if (
          silent &&
          result &&
          Array.isArray(result.accounts) &&
          result.accounts.length === 0
        ) {
          throw new Error("No authorized wallet account was returned.");
        }
        const connectedWallet =
          Array.isArray(result?.accounts)
            ? { ...candidate, accounts: result.accounts }
            : candidate;
        const key = await waitForWalletAddress(connectedWallet);
        const account = connectedWallet.accounts?.[0];
        diagnostic("wallet connected", {
          wallet: connectedWallet.name ?? "unknown",
          address: diagnosticAddress(key.toBase58()),
          chains: account?.chains ?? connectedWallet.chains ?? [],
          accountFeatures: account?.features ?? [],
          walletFeatures: walletFeatureKeys(connectedWallet),
          nightlyFeatureKeys: Object.keys(window.nightly?.solana?.features ?? {}),
          connectMode: connect
            ? silent
              ? walletConnectFeature?.connect
                ? "wallet standard:connect({ silent: true })"
                : "nightly injected standard:connect({ silent: true })"
              : walletConnectFeature?.connect
                ? "wallet standard:connect()"
                : "nightly injected standard:connect()"
            : "adapter/injected fallback",
        });
        updateWalletState(connectedWallet, key);
        persistWalletPreference(connectedWallet, key);
        await verifyNetwork(connectedWallet);
      } catch (cause) {
        if (restoring) {
          diagnostic("silent restore unavailable", {
            wallet: requested?.name ?? readSelectedWallet(),
            reason: cause instanceof Error ? cause.message : "unknown error",
          });
          clearLastPublicAddress();
          updateWalletState(null, null);
          setError(null);
          setState("DISCONNECTED");
        } else {
          setState("ERROR");
          setError(
            cause instanceof Error ? cause.message : "Wallet connection failed",
          );
        }
      }
    },
    [updateWalletState, verifyNetwork, wallets],
  );

  const disconnect = useCallback(async () => {
    try {
      await features(wallet)["standard:disconnect"]?.disconnect();
    } finally {
      clearWalletPreference();
      updateWalletState(null, null);
      setState("DISCONNECTED");
    }
  }, [updateWalletState, wallet]);

  useEffect(() => {
    if (restoreAttemptedRef.current) return;
    const selectedWallet = readSelectedWallet();
    if (!selectedWallet) {
      restoreAttemptedRef.current = true;
      setState("DISCONNECTED");
      return;
    }

    const candidate = wallets.find(
      (item) => item.name?.toLowerCase() === selectedWallet.toLowerCase(),
    );
    if (!candidate) {
      setState("RESTORING");
      const timeout = window.setTimeout(() => {
        restoreAttemptedRef.current = true;
        setState("DISCONNECTED");
      }, 2500);
      return () => window.clearTimeout(timeout);
    }

    restoreAttemptedRef.current = true;
    setState("RESTORING");
    void connect(candidate, { silent: true, restoring: true });
  }, [connect, wallets]);

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    const handleChange = (change: any) => {
      if (cancelled) return;
      const accounts = Array.isArray(change?.accounts)
        ? change.accounts
        : Array.isArray(change)
          ? change
          : null;
      const nextWallet = accounts
        ? { ...walletRef.current, accounts }
        : walletRef.current;
      const nextKey = nextWallet ? walletAddress(nextWallet) : null;
      if (!nextWallet || !nextKey) {
        clearLastPublicAddress();
        updateWalletState(null, null);
        setError(null);
        setState("DISCONNECTED");
        return;
      }
      persistWalletPreference(nextWallet, nextKey);
      updateWalletState(nextWallet, nextKey);
      setError(null);
      void verifyNetwork(nextWallet);
    };

    const nightlyEvents = window.nightly?.solana?.features?.["standard:events"];
    const standardEvents = features(wallet)["standard:events"] ?? nightlyEvents;
    if (typeof standardEvents?.on === "function") {
      const off = standardEvents.on("change", handleChange);
      addSubscriptionCleanup(cleanups, off);
    }

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) cleanup();
    };
  }, [updateWalletState, verifyNetwork, wallet]);

  const switchToCookie = useCallback(async () => {
    setState("SWITCHING_NETWORK");
    setError(null);
    try {
      const genesisHash = await connection
        .getGenesisHash()
        .catch(() => COOKIE_GENESIS_HASH_FALLBACK);
      const nightly = window.nightly?.solana;
      diagnostic("network switch requested", {
        expectedCookieGenesis: genesisHash,
        ...nightlySnapshot(nightly),
        walletFeatureKeys: walletFeatureKeys(wallet),
      });
      const injectedChange = nightly?.changeNetwork;
      const standardChange =
        features(wallet)["nightly:changeNetwork"]?.changeNetwork ??
        features(wallet)["solana:changeNetwork"]?.changeNetwork;
      if (typeof injectedChange === "function") {
        await injectedChange.call(nightly, { genesisHash, url: COOKIE_RPC });
      } else {
        if (typeof standardChange !== "function")
          throw new Error(
            "Open your wallet network settings and add Cookie manually.",
          );
        await standardChange({ genesisHash, url: COOKIE_RPC });
      }
      const active = await waitForNightlyGenesis(nightly, genesisHash);
      diagnostic("network switch result", {
        expectedCookieGenesis: genesisHash,
        ...nightlySnapshot(nightly),
        result: active === genesisHash ? "PASS" : "UNVERIFIED",
      });
      if (active !== genesisHash) {
        throw new TransactionStageError(
          "NETWORK_VERIFICATION",
          new Error(
            "Nightly accepted the switch request but did not expose the active Cookie genesis hash. Reload FairBake after accepting the switch in Nightly.",
          ),
        );
      }
      if (wallet) await verifyNetwork(wallet);
    } catch (cause) {
      setState("CONNECTED_WRONG_NETWORK");
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not switch wallet to Cookie",
      );
    }
  }, [verifyNetwork, wallet]);

  const signTransaction = useCallback(
    async (transaction: Transaction) => {
      if (!wallet || !publicKey) throw new Error("Connect a wallet first");
      setState("SIGNING");
      try {
        const nightly = window.nightly?.solana;
        if (nightly) {
          const expected = await connection.getGenesisHash();
          const active = readNightlyGenesis(nightly);
          diagnostic("pre-sign network check", {
            expectedCookieGenesis: expected,
            ...nightlySnapshot(nightly),
            result: active === expected ? "PASS" : "FAIL",
          });
          if (!active || active !== expected)
            throw new TransactionStageError(
              "NETWORK_VERIFICATION",
              new Error("Nightly is not currently connected to Cookie Chain"),
            );
          diagnostic("transaction built", {
            feePayer: diagnosticAddress(transaction.feePayer?.toBase58()),
            recentBlockhash: transaction.recentBlockhash ? "present" : "missing",
            blockhashSource: "Cookie RPC",
          });
          return await standardSign(wallet, transaction);
        }
        const browserWallets = window as any;
        const legacy = browserWallets.phantom?.solana ?? browserWallets.solana;
        if (legacy?.signTransaction)
          return await legacy.signTransaction(transaction);
        return await standardSign(wallet, transaction);
      } catch (cause) {
        setState("ERROR");
        if (cause instanceof TransactionStageError) throw cause;
        throw new TransactionStageError("WALLET_SIGN", cause);
      }
    },
    [publicKey, wallet],
  );

  const signAllTransactions = useCallback(
    async (transactions: Transaction[]) => {
      const signed: Transaction[] = [];
      for (const transaction of transactions)
        signed.push(await signTransaction(transaction));
      return signed;
    },
    [signTransaction],
  );

  const value = useMemo(
    () => ({
      state,
      wallet,
      wallets,
      publicKey,
      error,
      connect,
      disconnect,
      switchToCookie,
      signTransaction,
      signAllTransactions,
      setState,
    }),
    [
      connect,
      disconnect,
      error,
      publicKey,
      signAllTransactions,
      signTransaction,
      state,
      switchToCookie,
      wallet,
      wallets,
    ],
  );
  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}

export function useWalletSigner(): WalletSigner | null {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  return publicKey ? { publicKey, signTransaction, signAllTransactions } : null;
}
