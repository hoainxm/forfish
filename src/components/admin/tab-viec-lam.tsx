"use client";

/*
  TAB "Việc làm" của /quan-tri — nhóm Khách hàng, ADMIN-ONLY (spec 17 §8, §12.6).

  Hai mục: Báo xấu (gộp theo đích — tin tuyển hoặc hồ sơ tìm tàu — nhiều người báo trước; lọc Mới / Đã xử lý / Bỏ qua)
  · Tin đang ẩn (≥5 người báo thì tự ẩn, hoặc người trực ẩn — Hiện lại ở đây).
  Thao tác: Ẩn · Hiện (tin) · Đã xử lý · Bỏ qua · Cấm đăng 7 ngày (dùng CHUNG /api/admin/kairos/action "ban" — một luật
  banned_until cho cả Kairos lẫn Việc làm). Không SĐT: người đăng = tên Kairos.
  Trạng thái: đang tải · trống · lỗi + Thử lại (market-admin-shared).
*/

import { useCallback, useEffect, useState } from "react";
import { fmtDT } from "@/components/admin/quan-tri-chung";
import { EmptyBox, ErrorBox, FilterChip, LoadingBox, ReasonDialog } from "@/components/admin/market-admin-shared";
import { timeoutSignal } from "@/lib/abort";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";
import { ngheName } from "@/lib/kairos/ho-so";
import { NHAN } from "@/lib/labels";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { tenViTri, type ViecHoSo, type ViecTin } from "@/lib/viec";

type Chu = { profileId: string; ten: string; banned: string | null } | null;
type TinAdmin = ViecTin & { chu: Chu };
type HoSoAdmin = ViecHoSo & { dangHien: boolean; chu: Chu };
type Group = { kind: "post" | "seeker"; id: string; count: number; reasons: string[]; latestAt: string; target: TinAdmin | HoSoAdmin | null };
type Data = { items: Group[]; an: TinAdmin[] };
type Status = "moi" | "da_xu_ly" | "bo_qua";

const PORT = new Map(FISHING_PORTS.map((p) => [p.id, p.name]));

const CODE_TEXT: Record<string, string> = {
  admin_only: "Chỉ quản trị viên làm được việc này.",
  staff_only: "Tài khoản này không có quyền quản trị.",
  login_required: "Phiên đăng nhập đã hết — đăng nhập lại.",
  unavailable: "Chưa tra được kho Việc làm — migration 0079 có thể chưa áp.",
  not_found: "Không tìm thấy — có thể vừa bị xoá.",
  official: "Không cấm được hồ sơ Chính thức.",
  audit_failed: "Chưa ghi được nhật ký nên CHƯA làm — thử lại.",
  reason_required: "Cần ghi lý do.",
};
const errText = (code?: string) => (code && CODE_TEXT[code]) || "Chưa làm được — thử lại.";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(apiUrl(path), {
    cache: "no-store",
    ...init,
    headers: { ...(init.headers ?? {}), ...tokenHeader() },
    signal: timeoutSignal(init.method === "POST" ? 20_000 : 12_000),
  }).catch(() => null);
  if (!r) throw new Error("Không có mạng hoặc máy chủ không trả lời — thử lại.");
  const j = (await r.json().catch(() => null)) as ({ ok?: boolean; code?: string } & T) | null;
  if (!r.ok || !j?.ok) throw new Error(errText(j?.code));
  return j;
}
const post = (path: string, body: unknown) =>
  call(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const isTin = (t: TinAdmin | HoSoAdmin): t is TinAdmin => "soNguoi" in t;

function TargetView({ g }: { g: Group }) {
  const t = g.target;
  if (!t) return <p className="text-[0.875rem] text-muted">Nội dung không còn (đã bị xoá).</p>;
  if (isTin(t)) return <TinView t={t} />;
  return (
    <div className="min-w-0">
      <p className="text-[0.875rem] font-bold text-navy">
        Hồ sơ tìm tàu · {t.ten}{" "}
        <span className={`ml-1 rounded-full px-2 py-0.5 text-[0.75rem] ${t.dangHien ? "bg-ok-bg text-ok" : "bg-field text-muted"}`}>
          {t.dangHien ? "Đang hiện" : "Đang tắt"}
        </span>
      </p>
      <p className="mt-1 text-[0.875rem] text-foreground/85">
        {t.viTri.map(tenViTri).join(", ")} · {t.ports.map((p) => PORT.get(p) ?? p).join(", ")}
      </p>
      {t.ghiChu && <p className="mt-1 whitespace-pre-line break-words text-[0.875rem] text-foreground/85">{t.ghiChu}</p>}
    </div>
  );
}

function TinView({ t }: { t: TinAdmin }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.875rem] font-bold text-navy">
        {ngheName(t.nghe)} · cần {t.soNguoi} người · {PORT.get(t.portId) ?? t.portId}{" "}
        <span className={`ml-1 rounded-full px-2 py-0.5 text-[0.75rem] ${t.status === "an" ? "bg-danger-bg text-danger" : "bg-field text-muted"}`}>
          {t.status === "an" ? "Đang ẩn" : t.status === "du" ? "Đủ người" : "Đang mở"}
        </span>
      </p>
      <p className="mt-0.5 text-[0.8125rem] text-muted">
        Chủ tin: {t.chu?.ten ?? "—"}
        {t.chu?.banned ? ` · đang cấm tới ${fmtDT(t.chu.banned)}` : ""} · đăng {fmtDT(t.createdAt)}
      </p>
      {t.cong && <p className="mt-1 text-[0.875rem] text-foreground/85">Công: {t.cong}</p>}
      {t.ghiChu && <p className="mt-1 whitespace-pre-line break-words text-[0.875rem] text-foreground/85">{t.ghiChu}</p>}
    </div>
  );
}

const NUT = "min-h-[2.5rem] rounded-xl px-3 text-[0.8125rem] font-bold disabled:opacity-50";

export function ViecLamTab() {
  const [status, setStatus] = useState<Status>("moi");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cam, setCam] = useState<{ profileId: string; ten: string } | null>(null);

  const load = useCallback(() => {
    setData(null);
    setError(null);
    call<Data>(`/api/admin/viec?status=${status}`)
      .then((j) => setData({ items: j.items, an: j.an }))
      .catch((e: Error) => setError(e.message));
  }, [status]);
  useEffect(load, [load]);

  const lam = async (key: string, fn: () => Promise<unknown>, xong: string) => {
    setBusy(key);
    setNotice(null);
    try {
      await fn();
      setNotice(xong);
      load();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const act = (action: string, kind: "post" | "seeker", id: string) => post("/api/admin/viec/action", { action, kind, id });

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <FilterChip label="Mới" active={status === "moi"} onClick={() => setStatus("moi")} />
        <FilterChip label="Đã xử lý" active={status === "da_xu_ly"} onClick={() => setStatus("da_xu_ly")} />
        <FilterChip label="Bỏ qua" active={status === "bo_qua"} onClick={() => setStatus("bo_qua")} />
      </div>
      {notice && <p className="rounded-xl bg-field px-3 py-2 text-[0.875rem] font-semibold text-navy">{notice}</p>}

      {error ? (
        <ErrorBox text={error} onRetry={load} />
      ) : !data ? (
        <LoadingBox what="báo xấu việc làm" />
      ) : (
        <>
          <section>
            <h3 className="mb-2 text-[1rem] font-bold text-navy">Báo xấu</h3>
            {data.items.length === 0 ? (
              <EmptyBox text="Không có báo xấu nào ở mục này." />
            ) : (
              <ul className="space-y-3">
                {data.items.map((g) => {
                  const key = `${g.kind}:${g.id}`;
                  const t = g.target;
                  return (
                    <li key={key} className="surface p-4">
                      <p className="mb-2 text-[0.8125rem] font-semibold text-warn">
                        {g.count} người báo · gần nhất {fmtDT(g.latestAt)}
                      </p>
                      <TargetView g={g} />
                      {g.reasons.length > 0 && (
                        <ul className="mt-2 list-disc pl-5 text-[0.8125rem] text-muted">
                          {g.reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {t && (!isTin(t) ? t.dangHien : t.status !== "an") && (
                          <button type="button" disabled={busy === key} onClick={() => lam(key, () => act("an", g.kind, g.id), "Đã ẩn.")} className={`${NUT} bg-danger-bg text-danger`}>
                            {NHAN.an}
                          </button>
                        )}
                        {t && isTin(t) && t.status === "an" && (
                          <button type="button" disabled={busy === key} onClick={() => lam(key, () => act("hien", "post", g.id), "Đã hiện lại.")} className={`${NUT} bg-ok-bg text-ok`}>
                            Hiện lại
                          </button>
                        )}
                        {status === "moi" && (
                          <>
                            <button type="button" disabled={busy === key} onClick={() => lam(key, () => act("xu-ly", g.kind, g.id), "Đã đánh dấu xử lý.")} className={`${NUT} bg-field text-navy`}>
                              Đã xử lý
                            </button>
                            <button type="button" disabled={busy === key} onClick={() => lam(key, () => act("bo-qua", g.kind, g.id), "Đã bỏ qua.")} className={`${NUT} bg-field text-navy`}>
                              Bỏ qua
                            </button>
                          </>
                        )}
                        {t?.chu && !t.chu.banned && (
                          <button type="button" disabled={busy === key} onClick={() => setCam({ profileId: t.chu!.profileId, ten: t.chu!.ten })} className={`${NUT} bg-danger-bg text-danger`}>
                            {NHAN.camDang}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-[1rem] font-bold text-navy">Tin đang ẩn</h3>
            {data.an.length === 0 ? (
              <EmptyBox text="Không có tin nào đang ẩn." />
            ) : (
              <ul className="space-y-3">
                {data.an.map((t) => (
                  <li key={t.id} className="surface p-4">
                    <TinView t={t} />
                    <button
                      type="button"
                      disabled={busy === `an:${t.id}`}
                      onClick={() => lam(`an:${t.id}`, () => act("hien", "post", t.id), "Đã hiện lại.")}
                      className={`${NUT} mt-3 bg-ok-bg text-ok`}
                    >
                      Hiện lại
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {cam && (
        <ReasonDialog
          title={`Cấm ${cam.ten} đăng 7 ngày?`}
          message="Cấm chung cả Kairos lẫn Việc làm (cùng luật cấm đăng)."
          confirmLabel={NHAN.camDang}
          placeholder="Lý do cấm (bắt buộc)"
          suggestions={["Đòi tiền đặt cọc người đi bạn", "Tin giả, gọi không được", "Môi giới thu phí"]}
          onCancel={() => setCam(null)}
          onConfirm={(reason) => {
            const p = cam;
            setCam(null);
            void lam(`ban:${p.profileId}`, () => post("/api/admin/kairos/action", { action: "ban", profileId: p.profileId, until: "7d", reason }), `Đã cấm ${p.ten} 7 ngày.`);
          }}
        />
      )}
    </div>
  );
}
