// CHÉP từ app chính: ForFish/src/lib/tier.ts (2026-07-26) — sửa thì sửa CẢ HAI.
// Luật hạng hiệu lực: premium còn hạn (null = không hạn); mọi ca mờ ám → basic.

export type AccountTier = "basic" | "premium";

export function resolveTier(
  tier: string | null | undefined,
  premiumUntil: string | null | undefined,
  nowMs: number,
): AccountTier {
  if (tier !== "premium") return "basic";
  if (premiumUntil == null || premiumUntil === "") return "premium";
  const t = Date.parse(premiumUntil);
  if (!Number.isFinite(t)) return "basic";
  return t >= nowMs ? "premium" : "basic";
}
