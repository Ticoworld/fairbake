import type { SaleStatus } from "@/lib/config";

const styles: Record<SaleStatus, { text: string; dot: string }> = {
  UPCOMING: { text: "text-moss", dot: "bg-[#719267]" },
  LIVE: { text: "text-[#4f7547]", dot: "bg-[#4f7547]" },
  ENDED_AWAITING_FINALIZATION: { text: "text-moss", dot: "bg-[#8f9386]" },
  SUCCESS: { text: "text-[#4f7547]", dot: "bg-[#4f7547]" },
  FAILED: { text: "text-[#c34d35]", dot: "bg-[#c34d35]" },
};

const labels: Record<SaleStatus, string> = {
  UPCOMING: "UPCOMING",
  LIVE: "LIVE",
  ENDED_AWAITING_FINALIZATION: "ENDED — AWAITING SETTLEMENT",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
};

export function StatusPill({ status }: { status: SaleStatus }) {
  const style = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] ${style.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {labels[status]}
    </span>
  );
}

export function StatusLabel({ label, tone = "default" }: { label: string; tone?: "default" | "orange" }) {
  return <span className={`inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] ${tone === "orange" ? "text-[#c34d35]" : "text-moss"}`}><span className={`h-1.5 w-1.5 ${tone === "orange" ? "bg-[#c34d35]" : "bg-[#8f9386]"}`} />{label}</span>;
}
