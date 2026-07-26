// Tình trạng NGUỒN DỮ LIỆU của app chính — proxy SERVER-SIDE (tránh CORS):
// gọi FORFISH_APP_URL + /api/{fish-forecast,storms,fuel-price,port-prices}.
// /api/fish-forecast bị khoá premium ở middleware app chính → gửi kèm header
// x-admin-key (shared secret ADMIN_API_KEY, set Ở CẢ HAI web) để đi qua.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

type SourceReport =
  | { state: "ok"; note: string; extra?: unknown }
  | { state: "down"; note: string };

const TIMEOUT_MS = 20000;
// lần lạnh fish-forecast có thể ~30s (maxDuration 60 bên app chính)
const FISH_TIMEOUT_MS = 40000;

async function probe(
  base: string,
  path: string,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const r = await fetch(`${base}${path}`, {
    signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
    headers: opts.headers,
    cache: "no-store",
  });
  const json = (await r.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  return { status: r.status, json };
}

function report(
  status: number,
  json: Record<string, unknown> | null,
  okNote: (j: Record<string, unknown>) => string,
): SourceReport {
  if (status >= 200 && status < 300 && json && json.ok !== false) {
    return { state: "ok", note: okNote(json) };
  }
  const code = json && typeof json.code === "string" ? json.code : null;
  return {
    state: "down",
    note: code ? `lỗi: ${code}` : `không trả dữ liệu (HTTP ${status})`,
  };
}

export async function GET() {
  const who = await requireAdmin();
  if (!who.ok) {
    return NextResponse.json(
      { ok: false, code: who.code },
      { status: who.status },
    );
  }
  const base = process.env.FORFISH_APP_URL;
  if (!base) {
    return NextResponse.json({ ok: false, code: "no_app_url" }, { status: 503 });
  }
  const adminKey = process.env.ADMIN_API_KEY;

  const [fish, storms, fuel, prices] = await Promise.all([
    probe(base, "/api/fish-forecast", {
      timeoutMs: FISH_TIMEOUT_MS,
      headers: adminKey ? { "x-admin-key": adminKey } : undefined,
    })
      .then(({ status, json }) => {
        const rep = report(
          status,
          json,
          (j) => `ảnh vệ tinh ngày ${String(j.targetDate ?? "?")}`,
        );
        // kèm lý lịch từng trường (sources) để dashboard vẽ bảng chi tiết
        if (rep.state === "ok" && json?.sources) {
          return {
            ...rep,
            extra: Object.entries(
              json.sources as Record<string, Record<string, unknown>>,
            ).map(([key, s]) => ({
              key,
              id: String(s.id ?? "?"),
              date: String(s.date ?? "?"),
              stale: Boolean(s.stale),
            })),
          };
        }
        return rep;
      })
      .catch(
        (): SourceReport => ({
          state: "down",
          note: "không gọi được (timeout/mạng)",
        }),
      ),
    probe(base, "/api/storms")
      .then(({ status, json }) =>
        report(status, json, (j) => {
          const n = Array.isArray(j.storms) ? j.storms.length : 0;
          return n === 0 ? "không có bão" : `${n} cơn bão/ATNĐ`;
        }),
      )
      .catch(
        (): SourceReport => ({
          state: "down",
          note: "không gọi được (timeout/mạng)",
        }),
      ),
    probe(base, "/api/fuel-price")
      .then(({ status, json }) =>
        report(status, json, () => "có giá dầu DO mới nhất"),
      )
      .catch(
        (): SourceReport => ({
          state: "down",
          note: "không gọi được (timeout/mạng)",
        }),
      ),
    probe(base, "/api/port-prices")
      .then(({ status, json }) =>
        report(
          status,
          json,
          (j) =>
            `nguồn ${String(j.source ?? "?")}${j.province ? ` · ${String(j.province)}` : ""}`,
        ),
      )
      .catch(
        (): SourceReport => ({
          state: "down",
          note: "không gọi được (timeout/mạng)",
        }),
      ),
  ]);

  return NextResponse.json({ ok: true, base, fish, storms, fuel, prices });
}
