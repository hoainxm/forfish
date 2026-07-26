"use client";

/*
  /quan-tri — DASHBOARD QUẢN TRỊ (admin only, SĐT trong env ADMIN_PHONES).
  Cho đội SDVICO, KHÔNG cho ngư dân → không nằm trong dock, không link từ app.
  Ba tab:
  · Tài khoản — danh sách khách, tạo tay, đổi hạng basic/premium (+ hạn), xoá
  · Dữ liệu  — tình trạng các nguồn: dự báo cá (sources/quality), bão, giá dầu,
               giá chợ (client tự gọi API sẵn có của app — không lặp logic nguồn)
  · Hệ thống — env đã cấu hình chưa, số tài khoản/premium, nhịp webhook,
               migration tier đã apply chưa
  Quyền THẬT nằm ở /api/admin/* (requireAdmin) — trang này chỉ là vỏ hiển thị.
*/

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/api-base";

type Tab = "tai-khoan" | "du-lieu" | "he-thong";

type Health = {
  ok: boolean;
  code?: string;
  env?: {
    supabase: boolean;
    serviceRole: boolean;
    webhookSecret: boolean;
    adminPhones: number;
  };
  db?: {
    customers: number | null;
    premiumActive: number | null;
    devices: number | null;
    supplies: number | null;
    tierMigrationApplied: boolean;
    lastIngestAt: string | null;
  } | null;
};

type Account = {
  phone: string;
  name: string | null;
  tier: string;
  premiumUntil: string | null;
  fromSdwork: boolean;
  updatedAt: string | null;
  canLogin: boolean;
};

/** Một nguồn dữ liệu app đang sống nhờ — check bằng chính API của app */
type SourceState =
  | { state: "loading" }
  | { state: "ok"; note: string }
  | { state: "down"; note: string };

const fmtDT = (iso: string | null | undefined): string =>
  iso
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso))
    : "—";

const fmtD = (iso: string | null | undefined): string =>
  iso
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(iso + (iso.length === 10 ? "T00:00:00+07:00" : "")))
    : "—";

export default function QuanTriPage() {
  const [tab, setTab] = useState<Tab>("tai-khoan");
  const [health, setHealth] = useState<Health | null>(null);
  const [healthErr, setHealthErr] = useState<number | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/admin/health"))
      .then(async (r) => {
        if (!r.ok) {
          setHealthErr(r.status);
          return;
        }
        setHealth((await r.json()) as Health);
      })
      .catch(() => setHealthErr(0));
  }, []);

  // ── chưa đủ quyền — nói rõ vì sao, không im lặng trang trắng ────────────
  if (healthErr != null) {
    return (
      <main className="mx-auto max-w-[640px] px-4 py-16 text-center">
        <h1 className="display text-[1.5rem] font-bold text-navy">
          Trang quản trị SDFish
        </h1>
        <p className="mt-3 text-[1.0625rem] leading-snug text-foreground/70">
          {healthErr === 401 &&
            "Cần đăng nhập bằng tài khoản quản trị viên để vào trang này."}
          {healthErr === 403 &&
            "Tài khoản đang đăng nhập không có quyền quản trị (SĐT chưa nằm trong ADMIN_PHONES)."}
          {healthErr === 503 &&
            "Hệ thống chưa cấu hình Supabase — trang quản trị cần DB thật, không chạy ở demo mode."}
          {healthErr === 0 && "Không gọi được máy chủ — kiểm tra mạng rồi tải lại."}
        </p>
        {healthErr === 401 && (
          <Link
            href="/login"
            className="display mx-auto mt-5 flex min-h-[3.25rem] w-full max-w-[280px] items-center justify-center rounded-full bg-trim text-[1.0625rem] font-bold text-white"
          >
            Đăng nhập
          </Link>
        )}
      </main>
    );
  }
  if (!health) {
    return (
      <main className="mx-auto max-w-[640px] px-4 py-16 text-center text-[1.0625rem] text-foreground/65">
        Đang kiểm tra quyền quản trị…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[840px] px-4 pb-16 pt-6">
      <h1 className="display text-[1.5rem] font-bold text-navy">
        Quản trị SDFish
      </h1>
      <p className="mt-0.5 text-[0.9375rem] text-foreground/65">
        Theo dõi tài khoản, nguồn dữ liệu và sức khoẻ hệ thống.
      </p>

      <div className="mt-4 flex gap-1.5" role="tablist">
        {(
          [
            ["tai-khoan", "Tài khoản"],
            ["du-lieu", "Dữ liệu"],
            ["he-thong", "Hệ thống"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-[2.75rem] flex-1 rounded-xl text-[0.9375rem] font-bold transition ${
              tab === id
                ? "bg-navy text-white shadow-sm"
                : "bg-field text-foreground/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "tai-khoan" && <AccountsTab />}
      {tab === "du-lieu" && <DataTab />}
      {tab === "he-thong" && <SystemTab health={health} />}
    </main>
  );
}

/* ── TÀI KHOẢN ─────────────────────────────────────────────────────────── */

function AccountsTab() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyPhone, setBusyPhone] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetch(apiUrl("/api/admin/accounts"))
      .then(async (r) => {
        const j = (await r.json()) as {
          ok: boolean;
          code?: string;
          accounts?: Account[];
        };
        if (!j.ok) throw new Error(j.code ?? "load");
        setAccounts(j.accounts ?? []);
      })
      // thiếu service-role thì nói THẲNG thiếu gì — "thử lại" vô ích
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Thiếu SUPABASE_SERVICE_ROLE_KEY trong env — copy từ Supabase Dashboard (Settings → API → service_role) rồi restart/redeploy."
            : "Chưa tải được danh sách — thử lại.",
        ),
      );
  }, []);
  useEffect(load, [load]);

  async function changeTier(a: Account) {
    const toPremium = a.tier !== "premium";
    let premiumUntil: string | null = null;
    if (toPremium) {
      const raw = window.prompt(
        `Nâng ${a.phone} lên PREMIUM.\nHạn premium (YYYY-MM-DD), để trống = không hạn:`,
        "",
      );
      if (raw === null) return; // bấm Huỷ
      const t = raw.trim();
      if (t) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
          window.alert("Hạn phải theo dạng YYYY-MM-DD (vd 2027-01-31).");
          return;
        }
        premiumUntil = `${t}T23:59:59+07:00`;
      }
    } else if (
      !window.confirm(`Hạ ${a.phone} về tài khoản THƯỜNG (mất dự báo cá + 16 ngày)?`)
    ) {
      return;
    }
    setBusyPhone(a.phone);
    const r = await fetch(apiUrl("/api/admin/accounts"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phone: a.phone,
        tier: toPremium ? "premium" : "basic",
        premiumUntil,
      }),
    }).catch(() => null);
    setBusyPhone(null);
    if (!r?.ok) {
      window.alert("Đổi hạng chưa được — thử lại.");
      return;
    }
    load();
  }

  async function remove(a: Account) {
    if (
      !window.confirm(
        `XOÁ tài khoản ${a.phone}${a.name ? ` (${a.name})` : ""}?\nKhách sẽ không đăng nhập được nữa. Không hoàn tác được.`,
      )
    )
      return;
    setBusyPhone(a.phone);
    const r = await fetch(
      apiUrl(`/api/admin/accounts?phone=${encodeURIComponent(a.phone)}`),
      { method: "DELETE" },
    ).catch(() => null);
    setBusyPhone(null);
    if (!r?.ok) {
      window.alert("Xoá chưa được — thử lại.");
      return;
    }
    load();
  }

  return (
    <div className="mt-4 space-y-4">
      <CreateAccountForm onCreated={load} />

      {error && (
        <div className="surface px-4 py-6 text-center">
          <p className="text-[1rem] text-danger">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 min-h-[2.75rem] rounded-xl bg-navy px-6 text-[0.9375rem] font-bold text-white"
          >
            Thử lại
          </button>
        </div>
      )}
      {!accounts && !error && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Đang tải danh sách tài khoản…
        </p>
      )}
      {accounts && accounts.length === 0 && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Chưa có tài khoản nào — webhook SDWork chưa đẩy khách sang, hoặc tạo
          tay bằng form trên.
        </p>
      )}
      {accounts && accounts.length > 0 && (
        <ul className="surface overflow-hidden">
          {accounts.map((a) => (
            <li
              key={a.phone}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[1rem] font-bold tabular-nums text-navy">
                  {a.phone}
                  {a.name && (
                    <span className="ml-2 font-semibold text-foreground/70">
                      {a.name}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[0.8125rem] text-foreground/60">
                  {a.fromSdwork ? "Từ SDWork" : "Tạo tay"} ·{" "}
                  {a.canLogin ? "đăng nhập được" : "CHƯA đăng nhập được"} · cập
                  nhật {fmtDT(a.updatedAt)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-[0.8125rem] font-bold ${
                  a.tier === "premium"
                    ? "bg-ok-bg text-ok"
                    : "bg-field text-foreground/65"
                }`}
              >
                {a.tier === "premium"
                  ? a.premiumUntil
                    ? `Premium đến ${fmtD(a.premiumUntil)}`
                    : "Premium"
                  : "Thường"}
              </span>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  disabled={busyPhone === a.phone}
                  onClick={() => changeTier(a)}
                  className="min-h-[2.5rem] rounded-lg bg-navy px-3 text-[0.8125rem] font-bold text-white disabled:opacity-50"
                >
                  {a.tier === "premium" ? "Về thường" : "Lên premium"}
                </button>
                <button
                  type="button"
                  disabled={busyPhone === a.phone}
                  onClick={() => remove(a)}
                  className="min-h-[2.5rem] rounded-lg bg-danger-bg px-3 text-[0.8125rem] font-bold text-danger disabled:opacity-50"
                >
                  Xoá
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateAccountForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [tier, setTier] = useState<"basic" | "premium">("basic");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch(apiUrl("/api/admin/accounts"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phone,
        name,
        password,
        tier,
        premiumUntil: until ? `${until}T23:59:59+07:00` : null,
      }),
    }).catch(() => null);
    setBusy(false);
    const j = (await r?.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
      provisioned?: boolean;
    } | null;
    if (!r?.ok || !j?.ok) {
      setMsg(
        j?.code === "bad_phone"
          ? "SĐT chưa hợp lệ."
          : j?.code === "bad_password"
            ? "Mật khẩu tối thiểu 6 ký tự."
            : "Tạo chưa được — thử lại.",
      );
      return;
    }
    setMsg(
      j.provisioned
        ? "Đã tạo. Báo khách đăng nhập bằng SĐT + mật khẩu tạm (lần đầu app bắt đổi)."
        : "Đã lưu khách nhưng TẠO ĐĂNG NHẬP LỖI — kiểm tra lại.",
    );
    setPhone("");
    setName("");
    setPassword("");
    setUntil("");
    setTier("basic");
    onCreated();
  }

  const field =
    "min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-3 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea";

  return (
    <div className="surface px-4 py-3.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-[1rem] font-bold text-navy"
        aria-expanded={open}
      >
        Tạo tài khoản tay
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <form onSubmit={submit} className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <input
            required
            inputMode="numeric"
            placeholder="SĐT (0901234567)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={field}
          />
          <input
            placeholder="Tên khách (tuỳ chọn)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
          />
          <input
            required
            type="text"
            placeholder="Mật khẩu tạm (≥6 ký tự)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
          <div className="flex gap-2.5">
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as "basic" | "premium")}
              className={field}
              aria-label="Hạng tài khoản"
            >
              <option value="basic">Thường</option>
              <option value="premium">Premium</option>
            </select>
            {tier === "premium" && (
              <input
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className={field}
                aria-label="Hạn premium (để trống = không hạn)"
              />
            )}
          </div>
          <button
            type="submit"
            disabled={busy}
            className="min-h-[2.75rem] rounded-xl bg-trim text-[0.9375rem] font-bold text-white disabled:opacity-50 sm:col-span-2"
          >
            {busy ? "Đang tạo…" : "Tạo tài khoản"}
          </button>
          {msg && (
            <p className="text-[0.875rem] font-semibold text-foreground/75 sm:col-span-2">
              {msg}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

/* ── DỮ LIỆU ───────────────────────────────────────────────────────────── */

function DataTab() {
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
          signal: AbortSignal.timeout(timeoutMs),
        });
        const j = (await r.json()) as Record<string, unknown>;
        if (!r.ok || j.ok === false) {
          set({
            state: "down",
            note:
              typeof j.code === "string"
                ? `lỗi: ${j.code}`
                : `không trả dữ liệu (HTTP ${r.status})`,
          });
          return;
        }
        set({ state: "ok", note: okNote(j) });
        if (path === "/api/fish-forecast" && j.sources) {
          setFishSources(
            Object.entries(j.sources as Record<string, Record<string, unknown>>).map(
              ([key, s]) => ({
                key,
                id: String(s.id ?? "?"),
                date: String(s.date ?? "?"),
                stale: Boolean(s.stale),
              }),
            ),
          );
        }
      } catch {
        set({ state: "down", note: "không gọi được (timeout/mạng)" });
      }
    };

    // dự báo cá lần lạnh có thể ~30s (maxDuration 60) — timeout rộng hơn
    check(
      "/api/fish-forecast",
      setFish,
      (j) => `ảnh ngày ${fmtD(String(j.targetDate ?? ""))} · tính lúc ${fmtDT(String(j.generatedAt ?? ""))}`,
      40000,
    );
    check("/api/storms", setStorms, (j) => {
      const n = Array.isArray(j.storms) ? j.storms.length : 0;
      return `${n === 0 ? "không có bão" : `${n} cơn bão/ATNĐ`} · kiểm tra ${fmtDT(String(j.checkedAt ?? ""))}`;
    });
    check("/api/fuel-price", setFuel, () => "có giá dầu DO mới nhất");
    check("/api/port-prices", setPrices, (j) =>
      `nguồn ${String(j.source ?? "?")}${j.province ? ` · ${String(j.province)}` : ""}`,
    );
  }, []);

  const rows: [string, string, SourceState][] = [
    ["Dự báo cá (vệ tinh NOAA/Copernicus/HYCOM)", "/api/fish-forecast", fish],
    ["Tin bão Biển Đông", "/api/storms", storms],
    ["Giá dầu DO", "/api/fuel-price", fuel],
    ["Giá thủy sản (VASEP)", "/api/port-prices", prices],
  ];

  return (
    <div className="mt-4 space-y-4">
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
                {s.state === "loading" ? "đang kiểm tra…" : s.note}
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
                <span className="w-[72px] font-bold uppercase text-foreground/70">
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

function Row({
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

function SystemTab({ health }: { health: Health }) {
  const env = health.env;
  const db = health.db;

  return (
    <div className="mt-4 space-y-4">
      <ul className="surface overflow-hidden">
        <Row
          ok={env?.supabase ?? false}
          label="Supabase (DB + Auth)"
          note={env?.supabase ? "đã cấu hình" : "THIẾU env — app đang demo mode"}
        />
        <Row
          ok={env?.serviceRole ?? false}
          label="Service role key"
          note={
            env?.serviceRole
              ? "đã cấu hình (webhook + admin ghi được)"
              : "THIẾU — webhook SDWork và trang này không ghi được DB"
          }
        />
        <Row
          ok={env?.webhookSecret ?? false}
          label="Webhook SDWork (HMAC secret)"
          note={
            env?.webhookSecret
              ? "đã cấu hình"
              : "THIẾU SDWORK_WEBHOOK_SECRET — khách mới bên CRM không tự sang app"
          }
        />
        <Row
          ok={(env?.adminPhones ?? 0) > 0}
          label={`Quản trị viên: ${env?.adminPhones ?? 0} SĐT`}
          note="đổi trong env ADMIN_PHONES (phẩy ngăn cách) rồi redeploy"
        />
        <Row
          ok={db ? db.tierMigrationApplied : null}
          label="Migration phân hạng (0003_account_tier)"
          note={
            db == null
              ? "chưa kiểm tra được (thiếu service role)"
              : db.tierMigrationApplied
                ? "đã apply — cột tier/premium_until sẵn sàng"
                : "CHƯA APPLY — mọi tài khoản đang bị coi là hạng thường"
          }
        />
      </ul>

      {db && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {(
            [
              ["Tài khoản", db.customers],
              ["Premium hiệu lực", db.premiumActive],
              ["Thiết bị", db.devices],
              ["Vật tư", db.supplies],
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
