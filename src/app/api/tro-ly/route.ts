import "server-only";

// POST /api/tro-ly — TRỢ LÝ MẠNG (14 §6.1, §8; 13 §7).
//
// Thứ tự: cổng danh tính (KHÔNG anonymous — trợ lý mạng cần tài khoản; SĐT
// CHỈ từ cổng, không từ body) → validate (400 invalid | 400 bad_snapshot: từ
// chối trường nhạy cảm, không lặng lẽ bỏ) → quota (429 + Retry-After tới 0h VN)
// → mode (mock | live | 503 no_key) → trả `{ok, reply, remaining}`.
//
// Không cache (`cache-control: no-store`); `/api/tro-ly` không nằm trong
// API_CACHE_ALLOW của sw.js. Không log câu nói/snapshot — chỉ mã lỗi, ms, 4 số
// cuối SĐT (14 §9.7).

import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { AssistantServerError, askClaude } from "@/lib/assistant/server/claude";
import { getAssistantDailyLimit, resolveMode } from "@/lib/assistant/server/key";
import { askQwen } from "@/lib/assistant/server/qwen";
import { mockReply } from "@/lib/assistant/server/mock";
import { takeQuota } from "@/lib/assistant/server/quota";
import { hydrateQuotaFromFile, persistQuotaToFile } from "@/lib/assistant/server/quota-file";
import { validateAssistantRequest } from "@/lib/assistant/validate";
import type { AssistantErrorCode, AssistantResponse } from "@/lib/assistant/types";

export const dynamic = "force-dynamic";
export const maxDuration = 25; // > 20 s tổng của claude.ts + đệm

const STATUS: Record<AssistantErrorCode, number> = {
  invalid: 400, bad_snapshot: 400, no_token: 401, unknown_token: 401, token_revoked: 401,
  quota: 429, no_key: 503, unavailable: 503, upstream: 502, timeout: 504, refused: 200,
};

const NO_STORE = { "cache-control": "no-store" };

function fail(code: AssistantErrorCode, extra: Record<string, string> = {}): NextResponse {
  const body: AssistantResponse = { ok: false, code };
  return NextResponse.json(body, { status: STATUS[code], headers: { ...NO_STORE, ...extra } });
}

const mask = (phone: string) => `…${phone.slice(-4)}`;

export async function POST(req: Request) {
  const t0 = Date.now();
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;

  const raw = await req.text().catch(() => "");
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const v = validateAssistantRequest(parsed, raw.length);
  if (!v.ok) return fail(v.code);

  await hydrateQuotaFromFile(t0);
  const q = takeQuota(who.phone, await getAssistantDailyLimit(), t0);
  void persistQuotaToFile(t0);
  if (!q.ok) {
    const retry = Math.max(1, Math.ceil((q.resetAt - t0) / 1000));
    return fail("quota", { "retry-after": String(retry) });
  }

  const { mode, engine, key, qwen } = await resolveMode();
  if (mode === "no_key") return fail("no_key");

  try {
    const reply =
      mode === "mock"
        ? await mockReply(v.body)
        : engine === "qwen"
          ? await askQwen(v.body, who.phone, qwen!, t0)
          : await askClaude(v.body, who.phone, key as string, t0);
    const body: AssistantResponse = { ok: true, reply, remaining: q.remaining };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (e) {
    const code: AssistantErrorCode = e instanceof AssistantServerError ? e.code : "upstream";
    console.error("[tro-ly]", code, `${Date.now() - t0}ms`, mask(who.phone), e instanceof AssistantServerError ? e.message : (e as Error)?.message);
    return fail(code);
  }
}
