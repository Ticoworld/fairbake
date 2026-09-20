export type Settlement = { accepted: bigint; refund: bigint; allocation: bigint };

export function settlementWithPrefix(
  contribution: bigint,
  saleSupply: bigint,
  hardCap: bigint,
  totalCommitted: bigint,
  committedBefore: bigint,
): Settlement {
  if (committedBefore >= totalCommitted || committedBefore + contribution > totalCommitted) {
    throw new Error("Invalid settlement prefix");
  }
  if (totalCommitted <= hardCap) {
    return { accepted: contribution, refund: 0n, allocation: (contribution * saleSupply) / hardCap };
  }
  const acceptedBefore = (committedBefore * hardCap) / totalCommitted;
  const acceptedEnd = ((committedBefore + contribution) * hardCap) / totalCommitted;
  const accepted = acceptedEnd - acceptedBefore;
  return { accepted, refund: contribution - accepted, allocation: (accepted * saleSupply) / hardCap };
}
