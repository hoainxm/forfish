import "server-only";
// Vụn dùng chung của /api/ban-hang/* — KHÔNG chứa luật nghiệp vụ (luật ở
// lib/market/validate.ts + order-state.ts). Tên file bắt đầu bằng `_` nên
// Next không coi là route.
import { NextResponse } from "next/server";

/** Body sai JSON ⇒ 400 `bad_body` (12 §7 quy ước chung). */
export async function readJsonBody(
  req: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; res: NextResponse }> {
  try {
    const raw = (await req.json()) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, res: NextResponse.json({ ok: false, code: "bad_body" }, { status: 400 }) };
    }
    return { ok: true, body: raw as Record<string, unknown> };
  } catch {
    return { ok: false, res: NextResponse.json({ ok: false, code: "bad_body" }, { status: 400 }) };
  }
}

/** 400 `invalid` + câu tiếng Việt của validate (client hiện dưới ô). */
export const invalid = (message: string, status = 400) =>
  NextResponse.json({ ok: false, code: "invalid", message }, { status });

export const notFound = () => NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });

export const badTransition = () =>
  NextResponse.json({ ok: false, code: "bad_transition" }, { status: 409 });

/** Chuỗi tuỳ chọn từ body — chỉ nhận string, trim; "" giữ nguyên để xoá trường. */
export function str(v: unknown): string | undefined {
  return typeof v === "string" ? v.trim() : undefined;
}

/** Số nguyên từ body (client có thể gửi chuỗi số của ô tiền). */
export function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Math.trunc(Number(v));
  return undefined;
}

/** `?page` — từ 1. */
export function pageOf(url: URL): number {
  const n = Number(url.searchParams.get("page") ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
