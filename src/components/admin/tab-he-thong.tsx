"use client";

/*  Tách nguyên văn khỏi src/app/quan-tri/page.tsx (2026-10-19, rà Codex đợt 3: trang quản trị 6.718 dòng
    — tách theo tab, KHÔNG đổi hành vi; trang chính nạp tab khi mở). */

import { AdminSkeleton } from "@/components/admin/admin-nav";
import { timeoutSignal } from "@/lib/abort";
import { apiUrl } from "@/lib/api-base";
import { type ConfigKey, validateConfigValue } from "@/lib/app-config-keys";
import { tokenHeader } from "@/lib/device-token-store";
import { useCallback, useEffect, useState } from "react";
import { type Health, fmtD, fmtDT } from "@/components/admin/quan-tri-chung";

/** Một nguồn dữ liệu app đang sống nhờ — check bằng chính API của app */
export type SourceState =
  | { state: "loading" }
  | { state: "ok"; note: string }
  | { state: "down"; note: string };

/* ── DỮ LIỆU ───────────────────────────────────────────────────────────── */

/** Sức khoẻ cron + precompute từ /api/admin/crons */
export type CronsReport = {
  ok: boolean;
  fish?:
    | { ok: false; error: string }
    | { ok: true; exists: false }
    | {
        ok: true;
        exists: true;
        targetDate: string | null;
        dataQuality: number | null;
        generatedAt: string | null;
        updatedAt: string | null;
        fresh: boolean;
      };
  weather?:
    | { ok: false; error: string }
    | {
        ok: true;
        keys: number;
        newest?: string;
        oldest?: string;
        fresh?: boolean;
        staleKeys?: string[];
      };
  daily?: Record<
    string,
    | { ok: false; error: string }
    | { ok: true; latest: string | null; rows: number; fresh: boolean | null }
  >;
};

export function CronRow({
  state,
  label,
  note,
}: {
  state: "ok" | "down" | "loading" | "neutral";
  label: string;
  note: string;
}) {
  return (
    <li className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <span
        aria-hidden
        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{
          backgroundColor:
            state === "ok"
              ? "var(--ok)"
              : state === "down"
                ? "var(--danger)"
                : state === "neutral"
                  ? "var(--sea)"
                  : "var(--line)",
        }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-bold text-navy">{label}</p>
        <p className="text-[0.8125rem] leading-snug text-foreground/65">
          {note}
        </p>
      </div>
    </li>
  );
}

export function CronsPanel() {
  const [report, setReport] = useState<CronsReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/admin/crons"), { headers: tokenHeader() })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        setReport((await r.json()) as CronsReport);
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <div className="surface px-4 py-4">
        <p className="text-[0.9375rem] font-bold text-navy">
          Cron tự động & bản tính sẵn
        </p>
        <p className="mt-1 text-[0.875rem] text-danger">
          Chưa kiểm tra được — thiếu SUPABASE_SERVICE_ROLE_KEY hoặc lỗi mạng.
        </p>
      </div>
    );
  }

  const f = report?.fish;
  const w = report?.weather;
  const d = report?.daily ?? {};
  const dailyRow = (
    key: string,
    label: string,
    noteWhenNeutral?: string,
  ): { state: "ok" | "down" | "loading" | "neutral"; note: string } => {
    const t = d[key];
    if (!report) return { state: "loading", note: "đang rà soát dữ liệu…" };
    if (!t) return { state: "down", note: "hệ thống không trả về kết quả" };
    if (!t.ok) return { state: "down", note: `lỗi trong quá trình truy xuất: ${t.error}` };
    const base = t.latest
      ? `bản cập nhật ${fmtD(t.latest)} · tổng ${t.rows} bản ghi`
      : "chưa ghi nhận bản lưu nào";
    if (t.fresh === null)
      return { state: "neutral", note: `${base}${noteWhenNeutral ? ` — ${noteWhenNeutral}` : ""}` };
    return t.fresh
      ? { state: "ok", note: `${base} — đúng tiến độ cập nhật` }
      : {
          state: "down",
          note: `${base} — TRỄ (không có dữ liệu mới): Trình thu thập dữ liệu có thể đang bị treo.`,
        };
  };

  const seaR = dailyRow("sea_daily", "");
  const fdR = dailyRow("fish_forecast_daily", "");
  const stR = dailyRow("storm_events", "", "chỉ cập nhật khi có tin bão/ATNĐ — không xét tiến độ");

  return (
    <div className="surface overflow-hidden">
      <p className="border-b border-line px-4 py-3 text-[0.9375rem] font-bold text-navy">
        Cron tự động & bản tính sẵn (precompute)
      </p>
      <ul>
        <CronRow
          state={
            !report ? "loading" : !f || !f.ok ? "down" : !f.exists ? "down" : f.fresh ? "ok" : "down"
          }
          label="Bản lưu dự báo cá (Snapshots) — tiến trình tự động refresh-fish (Vercel chạy lúc 02:00 UTC/ngày + GitHub Actions 6h/lần)"
          note={
            !report
              ? "đang rà soát…"
              : !f || !f.ok
                ? `lỗi trong quá trình truy xuất: ${!f ? "?" : (f as { error: string }).error}`
                : !f.exists
                  ? "CHƯA CÓ bản lưu nào — tiến trình tự động chưa từng chạy (cần kiểm tra tiến trình migration 0005)"
                  : `tính lúc ${fmtDT(f.generatedAt)} · ảnh vệ tinh ${fmtD(f.targetDate)} · chất lượng ${f.dataQuality != null ? Math.round(f.dataQuality * 100) + "%" : "—"}${
                      f.fresh
                        ? " — dữ liệu được cập nhật mới"
                        : " — QUÁ 30 GIỜ: Trình tự động (cron) có thể đang bị treo, ứng dụng đang phải tự tính toán bù (sẽ chậm hơn). Cần kiểm tra lại cấu hình hệ thống."
                    }`
          }
        />
        <CronRow
          state={
            !report ? "loading" : !w || !w.ok ? "down" : w.keys === 0 ? "down" : w.fresh ? "ok" : "down"
          }
          label="Bản lưu thời tiết (Snapshots) — tiến trình tự động refresh-weather (chạy lúc 02:30 UTC/ngày để dự phòng trường hợp API Open-Meteo gặp sự cố)"
          note={
            !report
              ? "đang rà soát…"
              : !w || !w.ok
                ? `lỗi trong quá trình truy xuất: ${!w ? "?" : (w as { error: string }).error}`
                : w.keys === 0
                  ? "CHƯA CÓ khóa xác thực nào — tiến trình tự động chưa từng chạy"
                  : `${w.keys} khoá (10 cảng + lưới) · mới nhất ${fmtDT(w.newest)}${
                      w.fresh ? " — dữ liệu được cập nhật mới" : " — QUÁ 30 GIỜ: Trình tự động (cron) đang bị treo."
                    }${
                      w.staleKeys && w.staleKeys.length > 0 && w.fresh
                        ? ` · Có ${w.staleKeys.length} khóa xác thực cũ chưa được xóa: ${w.staleKeys.join(", ")}`
                        : ""
                    }`
          }
        />
        <CronRow
          state={seaR.state}
          label="sea_daily — trình lấy dữ liệu biển hàng ngày (đặt ngoài dự án chính)"
          note={seaR.note}
        />
        <CronRow
          state={fdR.state}
          label="fish_forecast_daily — trình lấy bản đồ cá hàng ngày (đặt ngoài dự án chính)"
          note={fdR.note}
        />
        <CronRow
          state={stR.state}
          label="storm_events — trình thu thập cảnh báo bão (đặt ngoài dự án chính)"
          note={stR.note}
        />
      </ul>
      <p className="border-t border-line px-4 py-2.5 text-[0.75rem] leading-snug text-foreground/55">
        Trạng thái đo bằng TUỔI bản ghi trong DB so với nhịp kỳ vọng — cron chết
        thì tuổi phình, không cần tra log Vercel/GitHub. Snapshot cá quá 30 giờ
        thì app tự tính live nên bà con không mất dự báo, chỉ chậm hơn.
      </p>
    </div>
  );
}

export function DataTab() {
  const [fish, setFish] = useState<SourceState>({ state: "loading" });
  const [storms, setStorms] = useState<SourceState>({ state: "loading" });
  const [fuel, setFuel] = useState<SourceState>({ state: "loading" });
  const [prices, setPrices] = useState<SourceState>({ state: "loading" });
  const [fishSources, setFishSources] = useState<
    { key: string; id: string; date: string; stale: boolean }[]
  >([]);

  useEffect(() => {
    const check = async (
      path: string,
      set: (s: SourceState) => void,
      okNote: (j: Record<string, unknown>) => string,
      timeoutMs = 20000,
    ) => {
      try {
        const r = await fetch(apiUrl(path), {
          signal: timeoutSignal(timeoutMs),
        });
        const j = (await r.json()) as Record<string, unknown>;
        if (!r.ok || j.ok === false) {
          set({
            state: "down",
            note:
              typeof j.code === "string"
                ? `mã lỗi: ${j.code}`
                : `API không trả dữ liệu (Mã HTTP ${r.status})`,
          });
          return;
        }
        set({ state: "ok", note: okNote(j) });
        if (path === "/api/fish-forecast" && j.sources) {
          setFishSources(
            Object.entries(
              j.sources as Record<string, Record<string, unknown>>,
            ).map(([key, s]) => ({
              key,
              id: String(s.id ?? "?"),
              date: String(s.date ?? "?"),
              stale: Boolean(s.stale),
            })),
          );
        }
      } catch {
        set({ state: "down", note: "không thể kết nối tới nguồn dữ liệu (lỗi timeout/mạng)" });
      }
    };

    // dự báo cá lần lạnh có thể ~30s (maxDuration 60) — timeout rộng hơn
    check(
      "/api/fish-forecast",
      setFish,
      (j) =>
        `dữ liệu ngày ${fmtD(String(j.targetDate ?? ""))} · được tổng hợp lúc ${fmtDT(String(j.generatedAt ?? ""))}`,
      40000,
    );
    check("/api/storms", setStorms, (j) => {
      const n = Array.isArray(j.storms) ? j.storms.length : 0;
      return `${n === 0 ? "không có tin bão" : `${n} cơn bão/ATNĐ`} · kiểm tra gần nhất lúc ${fmtDT(String(j.checkedAt ?? ""))}`;
    });
    check("/api/fuel-price", setFuel, () => "đã cập nhật giá dầu DO mới nhất");
    check("/api/port-prices", setPrices, (j) =>
      `nguồn tham khảo ${String(j.source ?? "?")}${j.province ? ` · ${String(j.province)}` : ""}`,
    );
  }, []);

  const rows: [string, string, SourceState][] = [
    ["Dữ liệu dự báo cá (từ vệ tinh NOAA/Copernicus/HYCOM)", "/api/fish-forecast", fish],
    ["Thông tin cảnh báo bão khu vực Biển Đông", "/api/storms", storms],
    ["Bảng giá dầu DO", "/api/fuel-price", fuel],
    ["Bảng giá thủy sản (theo VASEP)", "/api/port-prices", prices],
  ];

  return (
    <div className="mt-4 space-y-4">
      {/* cron chạy hay chết + precompute theo ngày có lỗi không */}
      <CronsPanel />
      <ul className="surface overflow-hidden">
        {rows.map(([label, path, s]) => (
          <li
            key={path}
            className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0"
          >
            <span
              aria-hidden
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                backgroundColor:
                  s.state === "ok"
                    ? "var(--ok)"
                    : s.state === "down"
                      ? "var(--danger)"
                      : "var(--line)",
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-bold text-navy">{label}</p>
              <p className="text-[0.8125rem] text-foreground/65">
                {s.state === "loading" ? "đang rà soát trạng thái…" : s.note}
                <span className="text-foreground/40"> · {path}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>

      {fishSources.length > 0 && (
        <div className="surface px-4 py-3.5">
          <p className="text-[0.9375rem] font-bold text-navy">
            Nguồn từng trường của bản đồ cá
          </p>
          <ul className="mt-2 space-y-1.5">
            {fishSources.map((s) => (
              <li
                key={s.key}
                className="flex flex-wrap items-baseline gap-x-2 text-[0.8125rem]"
              >
                <span className="w-[4.5rem] font-bold uppercase text-foreground/70">
                  {s.key}
                </span>
                <span className="text-foreground/65">{s.id}</span>
                <span className="tabular-nums text-foreground/65">
                  ảnh {fmtD(s.date)}
                </span>
                {s.stale && (
                  <span className="rounded-full bg-warn-bg px-2 py-0.5 font-bold text-warn">
                    ảnh cũ
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.75rem] leading-snug text-foreground/55">
            Trường vắng mặt = mọi nguồn của trường đó đang hỏng (dự báo vẫn chạy
            nếu SST + phù du còn; chi tiết luật ở lib/source-registry.ts).
          </p>
        </div>
      )}
    </div>
  );
}

/* ── HỆ THỐNG ──────────────────────────────────────────────────────────── */

export function Row({
  ok,
  label,
  note,
}: {
  ok: boolean | null;
  label: string;
  note?: string;
}) {
  return (
    <li className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <span
        aria-hidden
        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{
          backgroundColor:
            ok == null ? "var(--line)" : ok ? "var(--ok)" : "var(--danger)",
        }}
      />
      <div>
        <p className="text-[0.9375rem] font-bold text-navy">{label}</p>
        {note && <p className="text-[0.8125rem] text-foreground/65">{note}</p>}
      </div>
    </li>
  );
}

// Cấu hình ứng dụng lưu DB (app_config) — thay lệ thuộc env máy chủ deploy.
export type ConfigRow = {
  key: string;
  label: string;
  secret: boolean;
  help?: string;
  source: "db" | "env" | "none";
  set: boolean;
  value: string | null;
  generate?: "hex32";
  risk: string;
};

/** 32 byte ngẫu nhiên → 64 hex, sinh ngay trên máy admin (khoá dữ liệu bản đồ). */
export function randomHex32(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function AppConfigCard() {
  const [rows, setRows] = useState<ConfigRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  /*  BƯỚC XÁC NHẬN (2026-09-17, chủ dự án: "thao tác cái là chết hệ thống mà
      không cảnh báo"): bấm Lưu lần một chỉ mở hộp nói HẬU QUẢ của khoá đó,
      bấm "Lưu thật" mới ghi. Giá trị sai dạng thì chặn từ lúc gõ, không tới
      được bước này. */
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetch(apiUrl("/api/admin/app-config"), { headers: tokenHeader() })
      .then(async (r) => {
        const j = (await r.json()) as {
          ok: boolean;
          code?: string;
          keys?: ConfigRow[];
        };
        if (!j.ok) throw new Error(j.code ?? "load");
        setRows(j.keys ?? []);
      })
      .catch((e: Error) =>
        setError(
          e.message === "admin_only"
            ? "Tính năng cấu hình chỉ dành cho Quản trị viên (Admin)."
            : "Chưa tải được dữ liệu cấu hình. Vui lòng thử lại.",
        ),
      );
  }, []);
  useEffect(load, [load]);

  async function save(key: string) {
    const value = drafts[key] ?? "";
    if (!value.trim()) return;
    /*  CẶP VAPID (2026-10-07): server chặn khoá công khai lệch khoá bí mật (409).
        Đổi cả cặp = dán CẢ HAI ô rồi Lưu một ô — ô kia đi kèm làm `pairValue`,
        server ghi hai khoá trong một lệnh. */
    const pairKey =
      key === "vapid_public_key" ? "vapid_private_key" : key === "vapid_private_key" ? "vapid_public_key" : null;
    const pairValue = pairKey ? (drafts[pairKey] ?? "").trim() : "";
    setConfirm(null);
    setBusy(key);
    setSaved(null);
    setError(null);
    try {
      const r = await fetch(apiUrl("/api/admin/app-config"), {
        method: "PATCH",
        headers: { "content-type": "application/json", ...tokenHeader() },
        body: JSON.stringify(pairValue ? { key, value, pairValue } : { key, value }),
      });
      const j = (await r.json()) as { ok: boolean; code?: string };
      if (j.code === "vapid_pair_mismatch") {
        setError(
          "Khoá công khai và khoá bí mật VAPID không cùng một cặp — chưa lưu gì. Muốn đổi cặp khoá: dán CẢ HAI ô (lấy từ cùng một lần tạo khoá) rồi bấm Lưu ở một ô.",
        );
        return;
      }
      if (!j.ok) throw new Error();
      setDrafts((d) => ({ ...d, [key]: "", ...(pairValue && pairKey ? { [pairKey]: "" } : {}) }));
      setSaved(key);
      load();
    } catch {
      setError("Không thể lưu cài đặt. Vui lòng thử lại.");
    } finally {
      setBusy(null);
    }
  }

  const badge = (s: ConfigRow["source"]) =>
    s === "db"
      ? { t: "DB ✓", c: "bg-ok-bg text-ok" }
      : s === "env"
        ? { t: "env (host)", c: "bg-field text-foreground/70" }
        : { t: "chưa thiết lập", c: "bg-danger-bg text-danger" };

  return (
    <div className="surface p-4">
      <p className="display text-[1.125rem] font-bold text-navy">
        Cấu hình ứng dụng
      </p>
      <p className="mt-0.5 text-[0.875rem] text-foreground/70">
        Dán khoá/cấu hình vào đây (lưu DB) để KHÔNG lệ thuộc env máy chủ deploy —
        áp dụng ngay, không cần redeploy. DB đè lên env cùng tên.
      </p>
      {error && (
        <p className="mt-2 text-[0.875rem] font-semibold text-danger">{error}</p>
      )}
      {rows === null && !error && (
        <div className="mt-3">
          <AdminSkeleton label="Đang tải thông tin…" rows={2} />
        </div>
      )}
      <div className="mt-3 space-y-3">
        {rows?.map((row) => {
          const b = badge(row.source);
          const draft = drafts[row.key] ?? "";
          const bad = !!draft.trim() && !validateConfigValue(row.key as ConfigKey, draft);
          return (
            <div key={row.key} className="rounded-xl bg-field/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.9375rem] font-bold text-navy">
                  {row.label}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[0.75rem] font-semibold ${b.c}`}
                >
                  {b.t}
                </span>
              </div>
              {row.help && (
                <p className="mt-0.5 text-[0.8125rem] text-foreground/60">
                  {row.help}
                </p>
              )}
              {!row.secret && row.value && (
                <p className="mt-1 truncate text-[0.8125rem] text-foreground/70">
                  Hiện tại: {row.value}
                </p>
              )}
              {row.secret && row.set && (
                <p className="mt-1 text-[0.8125rem] text-foreground/60">
                  Đã đặt (ẩn) — nhập mới để thay.
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <input
                  type={row.secret ? "password" : "text"}
                  /*  CHẶN TỰ ĐIỀN (2026-09-17, ảnh từ prod): trình duyệt coi cặp ô
                      chữ + ô mật khẩu là form đăng nhập, tự điền SĐT vào VAPID
                      Public Key và mật khẩu đã lưu vào Private Key — bấm nhầm Lưu
                      là khoá Web Push bị đè, thông báo chết. `new-password` là
                      giá trị duy nhất Chrome/Safari tôn trọng cho ô mật khẩu;
                      tên ô không giống "username/password" để hết bị đoán. */
                  name={`cfg-${row.key}`}
                  autoComplete={row.secret ? "new-password" : "off"}
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore=""
                  value={drafts[row.key] ?? ""}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [row.key]: e.target.value }))
                  }
                  placeholder={
                    row.source === "none"
                      ? "Nhập giá trị mới…"
                      : "Nhập giá trị mới để thay thế…"
                  }
                  className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-[0.875rem]"
                />
                {row.generate === "hex32" && (
                  <button
                    type="button"
                    disabled={busy === row.key}
                    onClick={() => setDrafts((d) => ({ ...d, [row.key]: randomHex32() }))}
                    className="shrink-0 rounded-lg border border-line bg-card px-3 py-2 text-[0.875rem] font-bold text-navy disabled:opacity-50"
                  >
                    Tạo ngẫu nhiên
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy === row.key || !draft.trim() || bad}
                  onClick={() => setConfirm(row.key)}
                  className="shrink-0 rounded-lg bg-sea px-4 py-2 text-[0.875rem] font-bold text-white disabled:opacity-50"
                >
                  {busy === row.key
                    ? "Đang lưu cấu hình…"
                    : saved === row.key
                      ? "Cấu hình đã được lưu ✓"
                      : "Lưu cấu hình"}
                </button>
              </div>
              {bad && (
                <p role="alert" className="mt-1 text-[0.875rem] font-semibold text-danger">
                  Không đúng dạng {row.label}. Nếu ô tự hiện số điện thoại hay mật khẩu
                  thì là trình duyệt điền nhầm — xoá đi, đừng lưu.
                </p>
              )}
              {confirm === row.key && !bad && (
                <div role="alertdialog" className="mt-2 rounded-xl bg-danger-bg p-3">
                  <p className="text-[0.9375rem] font-bold text-danger">
                    Sắp thay {row.label}. {row.risk}
                  </p>
                  <p className="mt-1 text-[0.875rem] text-foreground/80">
                    Áp dụng ngay cho mọi máy, không hoàn tác được ở đây. Đã kiểm kỹ giá trị chưa?
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => save(row.key)}
                      className="rounded-lg bg-danger px-4 py-2 text-[0.875rem] font-bold text-white"
                    >
                      Lưu thật
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm(null)}
                      className="rounded-lg border border-line bg-card px-4 py-2 text-[0.875rem] font-bold text-navy"
                    >
                      Huỷ
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SystemTab({ health }: { health: Health }) {
  const env = health.env;
  const db = health.db;

  return (
    <div className="mt-4 space-y-4">
      <AppConfigCard />
      <ul className="surface overflow-hidden">
        <Row
          ok={env?.supabase ?? false}
          label="Supabase (DB + Auth)"
          note={env?.supabase ? "đã được cấu hình" : "THIẾU khóa môi trường (env) — ứng dụng đang chạy ở chế độ dùng thử"}
        />
        <Row
          ok={env?.serviceRole ?? false}
          label="Service role key"
          note={
            env?.serviceRole
              ? "đã cấu hình (chức năng gửi tin và ghi dữ liệu hoạt động bình thường)"
              : "THIẾU cấu hình — liên kết với hệ thống SDWork hiện chưa ghi được dữ liệu"
          }
        />
        <Row
          ok={env?.webhookSecret ?? false}
          label="Webhook SDWork (HMAC secret)"
          note={
            env?.webhookSecret
              ? "đã được cấu hình đầy đủ"
              : "THIẾU khoá SDWORK_WEBHOOK_SECRET — dữ liệu khách mới bên CRM sẽ không tự đồng bộ sang app"
          }
        />
        <Row
          ok={(env?.adminPhones ?? 0) > 0}
          label={`Số lượng Quản trị viên: ${env?.adminPhones ?? 0}`}
          note="vui lòng cập nhật trong biến môi trường ADMIN_PHONES (cách nhau bởi dấu phẩy) rồi khởi động lại hệ thống"
        />
        <Row
          ok={db ? db.tierMigrationApplied : null}
          label="Khởi tạo bảng dữ liệu phân hạng (0003_account_tier)"
          note={
            db == null
              ? "chưa thể rà soát (hệ thống thiếu khóa service role)"
              : db.tierMigrationApplied
                ? "đã được áp dụng — sẵn sàng sử dụng các cột phân hạng/thời hạn premium"
                : "CHƯA ÁP DỤNG — tất cả tài khoản đang được mặc định là hạng thường."
          }
        />
      </ul>

      {db && (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {(
            [
              ["Tài khoản người dùng", db.customers],
              ["Gói Premium đang hiệu lực", db.premiumActive],
              ["Danh sách thiết bị", db.devices],
              ["Quản lý vật tư", db.supplies],
            ] as [string, number | null][]
          ).map(([label, v]) => (
            <div key={label} className="surface px-3 py-3 text-center">
              <p className="display text-[1.75rem] font-bold tabular-nums text-navy">
                {v ?? "—"}
              </p>
              <p className="text-[0.8125rem] font-semibold text-foreground/65">
                {label}
              </p>
            </div>
          ))}
        </div>
      )}

      {db && (
        <p className="surface px-4 py-3 text-[0.875rem] leading-snug text-foreground/70">
          Webhook SDWork đẩy bản ghi khách gần nhất lúc{" "}
          <b className="tabular-nums">{fmtDT(db.lastIngestAt)}</b>. Lâu bất
          thường (khách mới bên CRM mà bên này không thấy) → kiểm tra outbox
          webhook bên SDWork và secret ở trên.
        </p>
      )}
    </div>
  );
}
