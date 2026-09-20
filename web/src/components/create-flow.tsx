"use client";

import Link from "next/link";
import {
  Check,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useWallet, useWalletSigner } from "@/lib/wallet";
import { formatUnits, parseUnits, shorten } from "@/lib/format";
import {
  initializeSale,
  createMintAccount,
  mintSupplyAndRevoke,
  validateExistingMint,
  readableTransactionError,
} from "@/lib/transactions";
import { explorer } from "@/lib/explorer";
import { FAIRBAKE_PROGRAM_ID } from "@/lib/config";
import { PublicKey } from "@solana/web3.js";

type Mode = "new" | "existing";
type Operation = {
  mint?: string;
  tokenAccount?: string;
  mintSignature?: string;
  supplySignature?: string;
  sale?: string;
  saleSignature?: string;
};

export function CreateFlow() {
  const { publicKey, state } = useWallet();
  const signer = useWalletSigner();
  const [mode, setMode] = useState<Mode>("new");
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [mintAddress, setMintAddress] = useState("");
  const [supply, setSupply] = useState("1000000");
  const [decimals, setDecimals] = useState("6");
  const [saleSupply, setSaleSupply] = useState("");
  const [minimumRaise, setMinimumRaise] = useState("");
  const [hardCap, setHardCap] = useState("");
  const [maxPerWallet, setMaxPerWallet] = useState("");
  const [startTime, setStartTime] = useState(isoLocal(15));
  const [endTime, setEndTime] = useState(isoLocal(60));
  const [operation, setOperation] = useState<Operation>({});
  const [existingTokenSupply, setExistingTokenSupply] = useState<bigint | null>(null);
  const [existingCreatorBalance, setExistingCreatorBalance] = useState<bigint | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (publicKey) {
      try {
        setOperation(
          JSON.parse(
            localStorage.getItem(`fairbake:create:${publicKey.toBase58()}`) ??
              "{}",
          ),
        );
      } catch {
        setOperation({});
      }
    }
  }, [publicKey]);
  useEffect(() => {
    if (publicKey)
      localStorage.setItem(
        `fairbake:create:${publicKey.toBase58()}`,
        JSON.stringify(operation),
      );
  }, [operation, publicKey]);

  const tokenDecimals = Number(decimals);
  const parsedTokenSupply = useMemo(() => {
    try {
      return parseUnits(supply, tokenDecimals);
    } catch {
      return null;
    }
  }, [supply, tokenDecimals]);
  const parsedSaleSupply = useMemo(() => {
    try {
      return parseUnits(saleSupply, tokenDecimals);
    } catch {
      return null;
    }
  }, [saleSupply, tokenDecimals]);
  const parsedMinimum = useMemo(() => {
    try {
      return parseUnits(minimumRaise, 9);
    } catch {
      return null;
    }
  }, [minimumRaise]);
  const parsedHardCap = useMemo(() => {
    try {
      return parseUnits(hardCap, 9);
    } catch {
      return null;
    }
  }, [hardCap]);
  const parsedWalletCap = useMemo(() => {
    try {
      return parseUnits(maxPerWallet, 9);
    } catch {
      return null;
    }
  }, [maxPerWallet]);
  const termsTokenSupply = mode === "existing"
    ? existingTokenSupply ?? parsedTokenSupply
    : parsedTokenSupply;
  const termsError =
    !parsedSaleSupply || !parsedMinimum || !parsedHardCap || !parsedWalletCap
      ? "Complete every amount with valid decimal values."
      : termsTokenSupply === null || parsedSaleSupply !== termsTokenSupply
        ? "The launch supply must equal the token's full fixed supply."
        : parsedSaleSupply <= 0n
          ? "Launch supply must be positive."
        : parsedMinimum <= 0n
          ? "Minimum raise must be positive."
          : parsedHardCap < parsedMinimum
            ? "Hard cap must be at least the minimum raise."
            : parsedWalletCap <= 0n || parsedWalletCap > parsedHardCap
              ? "Max per wallet must be positive and no greater than the hard cap."
              : mode === "existing" && existingCreatorBalance !== null && parsedSaleSupply > existingCreatorBalance
                ? "Creator does not hold the complete fixed supply for this launch."
                : new Date(endTime).getTime() <= new Date(startTime).getTime()
                  ? "End time must be after start time."
                  : null;

  const requireWallet = () => {
    if (!signer || !publicKey || state !== "CONNECTED_COOKIE") {
      setError(
        "Connect a wallet on Cookie before signing economic transactions.",
      );
      return false;
    }
    return true;
  };

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    setNotice(null);
    if (nextMode === "new") {
      setExistingTokenSupply(null);
      setExistingCreatorBalance(null);
    }
  }

  async function prepareToken() {
    if (!requireWallet()) return;
    setBusy("token");
    setError(null);
      setNotice(null);
    try {
      if (mode === "existing") {
        if (!mintAddress.trim()) throw new Error("Enter a mint address.");
        const mint = new PublicKey(mintAddress.trim());
        const validation = await validateExistingMint(mint, publicKey!);
        if (!validation.valid)
          throw new Error(
            `This mint cannot be used: ${validation.reasons.join(", ")}.`,
          );
        setDecimals(String(validation.decimals));
        setOperation((current) => ({
          ...current,
          mint: mint.toBase58(),
          tokenAccount: validation.tokenAccount.toBase58(),
        }));
        const verifiedSupply = formatInputUnits(validation.supply, validation.decimals);
        setSupply(verifiedSupply);
        setSaleSupply(verifiedSupply);
        setExistingTokenSupply(validation.supply);
        setExistingCreatorBalance(validation.balance);
        setNotice(
          `Verified fixed supply and revoked authorities for ${shorten(mint.toBase58())}.`,
        );
      } else {
        if (
          !name.trim() ||
          !symbol.trim() ||
          !parsedTokenSupply ||
          tokenDecimals < 0 ||
          tokenDecimals > 9
        )
          throw new Error(
            "Enter token name, symbol, supply, and decimals (0–9).",
          );
        let mint = operation.mint ? new PublicKey(operation.mint) : null;
        if (!mint) {
          const created = await createMintAccount(signer!, tokenDecimals);
          mint = created.mint;
          setOperation((current) => ({
            ...current,
            mint: mint!.toBase58(),
            mintSignature: created.signature,
          }));
        }
        if (!operation.supplySignature || !operation.tokenAccount) {
          const minted = await mintSupplyAndRevoke(
            signer!,
            mint,
            parsedTokenSupply,
          );
          setOperation((current) => ({
            ...current,
            mint: mint!.toBase58(),
            tokenAccount: minted.tokenAccount.toBase58(),
            supplySignature: minted.signature,
          }));
        }
        setSaleSupply(formatInputUnits(parsedTokenSupply, tokenDecimals));
        setNotice(
          "Token supply is minted exactly once and both authorities are removed. FairBake launches the entire fixed token supply.",
        );
      }
      setStep(2);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : readableTransactionError(cause),
      );
    } finally {
      setBusy(null);
    }
  }

  async function launch() {
    if (!requireWallet() || termsError) return;
    setBusy("sale");
    setError(null);
    setNotice(null);
    try {
      const mint = new PublicKey(operation.mint ?? mintAddress);
      const tokenAccount = new PublicKey(operation.tokenAccount ?? "");
      if (!termsTokenSupply || parsedSaleSupply !== termsTokenSupply) {
        throw new Error("The launch supply must equal the token's full fixed supply.");
      }
      const start = BigInt(Math.floor(new Date(startTime).getTime() / 1000));
      const end = BigInt(Math.floor(new Date(endTime).getTime() / 1000));
      const result = await initializeSale(signer!, {
        mint,
        creatorTokenAccount: tokenAccount,
        saleSupply: parsedSaleSupply!,
        minimumRaise: parsedMinimum!,
        hardCap: parsedHardCap!,
        maxPerWallet: parsedWalletCap!,
        startTime: start,
        endTime: end,
      });
      setOperation((current) => ({
        ...current,
        sale: result.sale.toBase58(),
        saleSignature: result.signature,
      }));
      setNotice(
        "Sale initialized and inventory escrowed. The terms are now immutable.",
      );
      setStep(4);
    } catch (cause) {
      setError(readableTransactionError(cause));
    } finally {
      setBusy(null);
    }
  }

  if (operation.sale)
    return (
      <main className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="panel p-8 sm:p-12">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sage text-[#506448]">
            <Check />
          </div>
          <p className="eyebrow mt-8">Launch created</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">
            Your launch is live on-chain.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-moss">
            FairBake will read the sale directly from Cookie. Share the
            canonical page with participants.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link className="button-primary" href={`/launch/${operation.sale}`}>
              Open launch
            </Link>
            <a
              className="button-secondary"
              href={explorer.transaction(operation.saleSignature ?? "")}
              target="_blank"
              rel="noreferrer"
            >
              View creation transaction ↗
            </a>
          </div>
        </div>
      </main>
    );

  return (
    <main className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex items-center justify-between gap-4 border-b border-line pb-5">
        <h1 className="text-2xl font-semibold tracking-[-0.04em]">
          Create launch
        </h1>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss">
          On-chain sale
        </span>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_280px]">
        <aside className="h-fit pt-1">
          <p className="eyebrow mb-3">Setup</p>
          <Step number="01" title="Token" active={step === 1} done={step > 1} />
          <Step number="02" title="Terms" active={step === 2} done={step > 2} />
          <Step
            number="03"
            title="Review"
            active={step === 3}
            done={step > 3}
          />
          <Step number="04" title="Complete" active={step === 4} done={false} />
        </aside>
        <section className="border border-line bg-paper p-6 sm:p-9">
          {step === 1 && (
            <TokenStep
              mode={mode}
              setMode={switchMode}
              name={name}
              setName={setName}
              symbol={symbol}
              setSymbol={setSymbol}
              supply={supply}
              setSupply={setSupply}
              decimals={decimals}
              setDecimals={setDecimals}
              mintAddress={mintAddress}
              setMintAddress={setMintAddress}
              operation={operation}
              busy={busy}
              onContinue={() => void prepareToken()}
            />
          )}{" "}
          {step === 2 && (
            <TermsStep
              parsedSaleSupply={parsedSaleSupply}
              minimumRaise={minimumRaise}
              setMinimumRaise={setMinimumRaise}
              hardCap={hardCap}
              setHardCap={setHardCap}
              maxPerWallet={maxPerWallet}
              setMaxPerWallet={setMaxPerWallet}
              startTime={startTime}
              setStartTime={setStartTime}
              endTime={endTime}
              setEndTime={setEndTime}
              totalSupply={termsTokenSupply}
              symbol={symbol}
              decimals={tokenDecimals}
              error={termsError}
              onBack={() => setStep(1)}
              onContinue={() => {
                if (!termsError) setStep(3);
              }}
            />
          )}{" "}
          {step === 3 && (
            <ReviewStep
              name={name || "Existing token"}
              symbol={symbol || "—"}
              mint={operation.mint ?? mintAddress}
              supply={termsTokenSupply}
              saleSupply={parsedSaleSupply}
              minimum={parsedMinimum}
              cap={parsedHardCap}
              maxWallet={parsedWalletCap}
              decimals={tokenDecimals}
              start={startTime}
              end={endTime}
              onBack={() => setStep(2)}
              onLaunch={() => void launch()}
              busy={busy}
            />
          )}{" "}
          {step === 4 && null}
          {error && (
            <div className="mt-6 flex items-start gap-2 rounded-xl border border-orange/30 bg-orange/5 p-4 text-sm leading-6 text-orange">
              <CircleAlert size={17} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
          {notice && (
            <p className="mt-5 rounded-xl bg-sage/70 p-4 text-sm leading-6 text-[#506448]">
              {notice}
            </p>
          )}
        </section>
        <LaunchPreview
          step={step}
          name={name}
          symbol={symbol}
          saleSupply={saleSupply}
          hardCap={hardCap}
          maxPerWallet={maxPerWallet}
        />
      </div>
    </main>
  );
}

function LaunchPreview({
  step,
  name,
  symbol,
  saleSupply,
  hardCap,
  maxPerWallet,
}: {
  step: number;
  name: string;
  symbol: string;
  saleSupply: string;
  hardCap: string;
  maxPerWallet: string;
}) {
  return (
    <aside className="surface-dark relative hidden min-h-[390px] overflow-hidden border border-[#354333] p-6 xl:block">
      <div className="absolute -bottom-10 -right-4 select-none text-[15rem] font-black leading-none tracking-[-0.16em] text-white/[0.045]">
        {(symbol || "T").slice(0, 1)}
      </div>
      <div className="relative z-10 flex min-h-[338px] flex-col justify-between">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#a6b29e]">
            Preview
          </p>
          <span className="font-mono text-[10px] text-[#a6b29e]">
            0{step}/04
          </span>
        </div>
        <div className="mt-16">
          <div className="grid h-12 w-12 place-items-center border border-white/15 bg-white/10 text-lg font-bold text-[#c7f36d]">
            {(symbol || "T").slice(0, 1).toUpperCase()}
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-paper">
            {name || "Your launch"}
          </h2>
          <p className="mt-1 font-mono text-xs text-[#a6b29e]">
            {symbol ? `$${symbol}` : "—"}
          </p>
        </div>
        <div className="grid gap-3 border-t border-white/15 pt-5">
          <PreviewStat label="Launch supply" value={saleSupply || "—"} />
          <PreviewStat label="Hard cap" value={hardCap ? `${hardCap} COOK` : "—"} />
          <PreviewStat label="Per wallet" value={maxPerWallet ? `${maxPerWallet} COOK` : "—"} />
        </div>
      </div>
    </aside>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-[#a6b29e]">{label}</span>
      <span className="font-semibold text-paper">{value}</span>
    </div>
  );
}

function Step({
  number,
  title,
  active,
  done,
}: {
  number: string;
  title: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 border-l-2 px-3 py-3 ${active ? "border-ink bg-cream text-ink" : "border-transparent text-moss"}`}
    >
      <span
        className={`font-mono text-[10px] font-bold ${done ? "text-[#4f7547]" : active ? "text-ink" : "text-moss"}`}
      >
        {done ? "✓" : number}
      </span>
      <span className={`text-sm ${active ? "font-semibold" : "text-moss"}`}>
        {title}
      </span>
    </div>
  );
}

function TokenStep(props: any) {
  const { mode, setMode, operation, busy } = props;
  return (
    <div>
      <p className="eyebrow">Step 1 · Token</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
        Choose the launch asset.
      </h2>
      <div className="mt-7 grid grid-cols-2 border-b border-line">
        <button
          className={`border-b-2 px-1 py-3 text-left text-sm font-semibold ${mode === "new" ? "border-ink text-ink" : "border-transparent text-moss"}`}
          onClick={() => setMode("new")}
        >
          Create new token
        </button>
        <button
          className={`border-b-2 px-1 py-3 text-left text-sm font-semibold ${mode === "existing" ? "border-ink text-ink" : "border-transparent text-moss"}`}
          onClick={() => setMode("existing")}
        >
          Use existing token
        </button>
      </div>
      {mode === "new" ? (
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <Field
            label="Token name"
            value={props.name}
            onChange={props.setName}
            placeholder="e.g. Oven Pass"
          />
          <Field
            label="Symbol"
            value={props.symbol}
            onChange={props.setSymbol}
            placeholder="OVEN"
          />
          <Field
            label="Total supply"
            value={props.supply}
            onChange={props.setSupply}
            placeholder="1000000"
          />
          <Field
            label="Decimals"
            value={props.decimals}
            onChange={props.setDecimals}
            placeholder="6"
          />
          <div className="sm:col-span-2 border border-line bg-cream/50 p-4 text-sm leading-6 text-moss">
            <LockKeyhole size={16} className="mb-2 text-ink" />
            <p>FairBake launches the entire fixed token supply.</p>
            <details className="mt-3 text-xs leading-5">
              <summary className="cursor-pointer font-semibold text-ink">Technical details</summary>
              <p className="mt-2">Creates a standard SPL mint and revokes both authorities in the creation flow.</p>
            </details>
          </div>
        </div>
      ) : (
        <div className="mt-7">
          <Field
            label="Mint address"
            value={props.mintAddress}
            onChange={props.setMintAddress}
            placeholder="Cookie Chain mint address"
          />
          <p className="mt-3 text-xs leading-5 text-moss">
            We verify standard SPL ownership, revoked mint/freeze authorities,
            full supply, decimals, and creator inventory from Cookie RPC.
          </p>
        </div>
      )}{" "}
      {operation.mint && (
        <p className="mt-5 font-mono text-xs text-moss">
          Resuming mint {shorten(operation.mint)}
        </p>
      )}
      <button
        className="button-primary mt-8"
        onClick={props.onContinue}
        disabled={busy === "token"}
      >
        {busy === "token" ? (
          <>
            <LoaderCircle size={16} className="animate-spin" /> Preparing token…
          </>
        ) : (
          <>
            Continue to terms <ChevronRight size={16} />
          </>
        )}
      </button>
    </div>
  );
}

function TermsStep(props: any) {
  return (
    <div>
      <p className="eyebrow">Step 2 · Terms</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
        Set the immutable window.
      </h2>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <ReadOnlyFact
          label="Launch supply"
          value={props.totalSupply ? `${formatUnits(BigInt(props.totalSupply), Number(props.decimals))} ${props.symbol || "tokens"}` : "—"}
        />
        <Field
          label="Minimum raise (COOK)"
          value={props.minimumRaise}
          onChange={props.setMinimumRaise}
          placeholder="100"
        />
        <Field
          label="Hard cap (COOK)"
          value={props.hardCap}
          onChange={props.setHardCap}
          placeholder="1000"
        />
        <Field
          label="Max per wallet (COOK)"
          value={props.maxPerWallet}
          onChange={props.setMaxPerWallet}
          placeholder="100"
        />
        <Field
          label="Starts"
          type="datetime-local"
          value={props.startTime}
          onChange={props.setStartTime}
        />
        <Field
          label="Ends"
          type="datetime-local"
          value={props.endTime}
          onChange={props.setEndTime}
        />
      </div>
      <p className="mt-7 text-sm text-moss">
        FairBake launches the entire fixed token supply.
      </p>
      <div className="mt-5 grid gap-3 border-y border-line py-4 sm:grid-cols-3">
        <Stat
          label="Fixed supply"
          value={
            props.totalSupply
              ? formatUnits(BigInt(props.totalSupply), Number(props.decimals))
              : "—"
          }
        />
        <Stat
          label="Launch supply"
          value={
            props.parsedSaleSupply
              ? formatUnits(
                  BigInt(props.parsedSaleSupply),
                  Number(props.decimals),
                )
              : "—"
          }
        />
        <Stat
          label="Supply entering launch"
          value={props.parsedSaleSupply ? "100%" : "—"}
        />
      </div>
      {props.error && <p className="mt-5 text-sm text-orange">{props.error}</p>}
      <div className="mt-8 flex justify-between gap-3">
        <button className="button-secondary" onClick={props.onBack}>
          Back
        </button>
        <button
          className="button-primary"
          onClick={props.onContinue}
          disabled={Boolean(props.error)}
        >
          Review terms <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function ReviewStep(props: any) {
  return (
    <div>
      <p className="eyebrow">Step 3 · Review</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">Review launch.</h2>
      <div className="mt-7 grid gap-0 border-y border-line">
        <ReviewFact label="Token" value={`${props.name} · ${props.symbol}`} />
        <ReviewFact label="Mint" value={props.mint ? shorten(props.mint, 10, 8) : "—"} />
        <ReviewFact label="Fixed supply" value={props.supply ? `${formatUnits(BigInt(props.supply), Number(props.decimals))} ${props.symbol || "tokens"}` : "—"} />
        <ReviewFact label="Launch supply" value={props.saleSupply ? `${formatUnits(BigInt(props.saleSupply), Number(props.decimals))} ${props.symbol || "tokens"}` : "—"} />
        <ReviewFact label="Supply entering launch" value={props.saleSupply ? "100%" : "—"} />
        <ReviewFact label="Mint authority" value="Removed" />
        <ReviewFact label="Freeze authority" value="Removed" />
        <ReviewFact label="Terms locked" value="Cannot be edited after launch" />
        <ReviewFact label="Minimum raise" value={props.minimum ? `${formatUnits(BigInt(props.minimum), 9)} COOK` : "—"} />
        <ReviewFact label="Hard cap" value={props.cap ? `${formatUnits(BigInt(props.cap), 9)} COOK` : "—"} />
        <ReviewFact label="Wallet limit" value={props.maxWallet ? `${formatUnits(BigInt(props.maxWallet), 9)} COOK` : "—"} />
        <ReviewFact label="Start" value={new Date(props.start).toLocaleString()} />
        <ReviewFact label="End" value={new Date(props.end).toLocaleString()} />
      </div>
      <div className="mt-8 flex justify-between gap-3">
        <button className="button-secondary" onClick={props.onBack}>
          Back
        </button>
        <button
          className="button-primary"
          onClick={props.onLaunch}
          disabled={props.busy === "sale"}
        >
          {props.busy === "sale" ? (
            <>
              <LoaderCircle size={16} className="animate-spin" /> Initializing…
            </>
          ) : (
            <>
              Confirm & initialize <ShieldCheck size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function ReviewFact({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-1 border-b border-line py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm text-moss">{label}</span><span className="text-right text-sm font-semibold">{value}</span></div>;
}
function ReadOnlyFact({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-line py-3 sm:col-span-2"><p className="text-xs font-semibold text-moss">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-moss">
        {label}
      </span>
      <input
        className="field"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-moss">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
function isoLocal(minutesFromNow: number) {
  const date = new Date(Date.now() + minutesFromNow * 60_000);
  date.setSeconds(0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function formatInputUnits(value: bigint, decimals: number) {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
}
