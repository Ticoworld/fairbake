"use client";

import {
  Check,
  ChevronDown,
  Copy,
  LogOut,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { shorten } from "@/lib/format";
import { useWallet } from "@/lib/wallet";

export function WalletButton() {
  const {
    state,
    wallets,
    publicKey,
    connect,
    disconnect,
    switchToCookie,
    error,
  } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const uniqueWallets = Array.from(
    new Map(wallets.map((wallet) => [wallet.name, wallet])).values(),
  );
  if (state === "RESTORING")
    return (
      <span className="inline-flex items-center gap-2 px-2 py-2 text-sm text-moss">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#77936b]" />
        Restoring wallet…
      </span>
    );
  if (!publicKey || state === "DISCONNECTED" || state === "ERROR")
    return (
      <div className="relative">
        <button
          className="button-primary"
          onClick={() => {
            setOpen((value) => !value);
            if (!uniqueWallets.length) void connect();
          }}
        >
          <Wallet size={15} /> Connect wallet
        </button>
        {open && uniqueWallets.length > 0 && (
          <WalletMenu
            wallets={uniqueWallets}
            onPick={(wallet) => {
              setOpen(false);
              void connect(wallet);
            }}
          />
        )}{" "}
        {error && state === "ERROR" && (
          <p className="absolute right-0 top-12 w-64 rounded-xl border border-orange/30 bg-paper p-3 text-xs text-orange">
            {error}
          </p>
        )}
      </div>
    );
  const wrongNetwork = state === "CONNECTED_WRONG_NETWORK";
  return (
    <div className="relative">
      <button
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold ${wrongNetwork ? "border-orange bg-orange/10 text-orange" : "border-line bg-paper"}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className={`h-2 w-2 rounded-full ${wrongNetwork ? "bg-orange" : "bg-[#77936b]"}`}
        />
        {wrongNetwork ? "Switch to Cookie" : shorten(publicKey.toBase58())}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-line bg-paper p-3 shadow-card">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <p className="eyebrow">Wallet</p>
              <p className="mt-1 font-mono text-xs">
                {shorten(publicKey.toBase58(), 8, 6)}
              </p>
            </div>
            <button
              className="rounded-lg p-2 text-moss hover:bg-cream"
              onClick={() => {
                void navigator.clipboard.writeText(publicKey.toBase58());
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
              aria-label="Copy address"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
          {wrongNetwork && (
            <button
              className="mt-3 flex w-full items-center gap-2 rounded-xl bg-orange px-3 py-2.5 text-left text-sm font-semibold text-white"
              onClick={() => void switchToCookie()}
            >
              <RefreshCw size={15} /> Switch wallet to Cookie
            </button>
          )}
          <button
            className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-moss hover:bg-cream"
            onClick={() => {
              setOpen(false);
              void disconnect();
            }}
          >
            <LogOut size={15} /> Disconnect
          </button>
          {error && (
            <p className="mt-2 text-xs leading-5 text-orange">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function WalletMenu({
  wallets,
  onPick,
}: {
  wallets: any[];
  onPick: (wallet: any) => void;
}) {
  return (
    <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-line bg-paper p-2 shadow-card">
      {wallets.map((wallet) => (
        <button
          key={wallet.name}
          className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm hover:bg-cream"
          onClick={() => onPick(wallet)}
        >
          <span>{wallet.name}</span>
          <span className="text-xs text-moss">Connect</span>
        </button>
      ))}
    </div>
  );
}
