"use client";

/*
  /quan-tri — WEB QUẢN TRỊ (admin only, env ADMIN_PHONES). ĐỘC LẬP về giao
  diện (app-shell cho khu này thoát khung mobile + dock), CHUNG deploy/DB với
  app ngư dân. Người dùng là STAFF SDVICO — desktop-first, responsive xuống
  tablet/mobile (bổ sung 2026-07-26 theo yêu cầu chủ dự án: search, confirm
  khi nâng premium/xoá bằng dialog trong trang, dải số thống kê).
  Ba tab:
  · Tài khoản — thống kê + tìm kiếm/lọc + danh sách khách, tạo tay, đổi hạng
    (confirm + chọn hạn), xoá (confirm)
  · Dữ liệu  — tình trạng các nguồn (client gọi API sẵn có của app)
  · Hệ thống — env, đếm, migration, nhịp webhook
  Quyền THẬT nằm ở /api/admin/* (requireAdmin) — trang này chỉ là vỏ hiển thị.
*/

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api-base";
import { nextPremiumUntil, resolveTier } from "@/lib/tier";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Tab = "tai-khoan" | "du-lieu" | "he-thong";

/** Vai trò staff — admin (env) toàn quyền; quản lý (DB) chỉ cấp/gia hạn premium */
type StaffRole = "admin" | "manager";

type Health = {
  ok: boolean;
  code?: string;
  me?: { phone: string; role: StaffRole };
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
  premiumActivatedAt: string | null;
  role: string;
  fromSdwork: boolean;
  updatedAt: string | null;
  canLogin: boolean;
};

/** Thống kê theo người cấp premium (log premium_grants) */
type GrantStat = { by: string; managing: number; totalGrants: number };

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

/** So khớp tìm kiếm không dấu, không phân hoa-thường ("Hải" khớp "hai") */
const fold = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    // ̀–ͯ = dấu tổ hợp sau NFD (huyền/sắc/hỏi/ngã/nặng, mũ, móc)
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");

export default function QuanTriPage() {
  const router = useRouter();
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

  async function logout() {
    const supabase = createClient();
    await supabase?.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // ── chưa đủ quyền — nói rõ vì sao, không im lặng trang trắng ────────────
  if (healthErr != null) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-16 text-center">
        <h1 className="display text-[1.5rem] font-bold text-navy">
          Trang quản trị SDFish
        </h1>
        <p className="mt-3 text-[1.0625rem] leading-snug text-foreground/70">
          {healthErr === 401 &&
            "Cần đăng nhập bằng tài khoản quản trị viên để vào trang này."}
          {healthErr === 403 &&
            "Tài khoản đang đăng nhập không có quyền quản trị (không phải admin, cũng chưa được gán làm tài khoản quản lý)."}
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
        {healthErr === 403 && (
          <button
            type="button"
            onClick={logout}
            className="mx-auto mt-5 block min-h-[2.75rem] rounded-xl bg-field px-6 text-[0.9375rem] font-bold text-navy"
          >
            Đăng xuất — vào bằng tài khoản khác
          </button>
        )}
      </div>
    );
  }
  if (!health) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-16 text-center text-[1.0625rem] text-foreground/65">
        Đang kiểm tra quyền quản trị…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-6 md:px-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="display text-[1.5rem] font-bold text-navy md:text-[1.75rem]">
            Quản trị SDFish
          </h1>
          <p className="mt-0.5 text-[0.9375rem] text-foreground/65">
            Theo dõi tài khoản, nguồn dữ liệu và sức khoẻ hệ thống.
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="min-h-[2.5rem] shrink-0 rounded-xl bg-field px-4 text-[0.875rem] font-bold text-navy"
        >
          Đăng xuất
        </button>
      </div>

      <div className="mt-4 flex gap-1.5 md:max-w-[560px]" role="tablist">
        {(
          // QUẢN LÝ chỉ có tab Tài khoản (cấp/gia hạn premium); Dữ liệu +
          // Hệ thống là việc của admin
          (health.me?.role === "manager"
            ? [["tai-khoan", "Tài khoản"]]
            : [
                ["tai-khoan", "Tài khoản"],
                ["du-lieu", "Dữ liệu"],
                ["he-thong", "Hệ thống"],
              ]) as [Tab, string][]
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

      {tab === "tai-khoan" && (
        <AccountsTab me={health.me ?? { phone: "", role: "admin" }} />
      )}
      {tab === "du-lieu" && health.me?.role !== "manager" && <DataTab />}
      {tab === "he-thong" && health.me?.role !== "manager" && (
        <SystemTab health={health} />
      )}
    </div>
  );
}

/* ── TÀI KHOẢN ─────────────────────────────────────────────────────────── */

type TierFilter = "all" | "premium" | "basic";

function AccountsTab({ me }: { me: { phone: string; role: StaffRole } }) {
  const isAdmin = me.role === "admin";
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [grantStats, setGrantStats] = useState<GrantStat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyPhone, setBusyPhone] = useState<string | null>(null);
  // tìm kiếm + lọc hạng (client-side — vài trăm hàng, không cần server)
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  // dialog xác nhận — thay window.prompt/confirm (yêu cầu 2026-07-26).
  // Hạn xem trước tính LÚC BẤM NÚT (không gọi Date.now() trong render)
  const [toGrant, setToGrant] = useState<{
    a: Account;
    active: boolean;
    until: string;
  } | null>(null);
  const [toDowngrade, setToDowngrade] = useState<Account | null>(null);
  const [toDelete, setToDelete] = useState<Account | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetch(apiUrl("/api/admin/accounts"))
      .then(async (r) => {
        const j = (await r.json()) as {
          ok: boolean;
          code?: string;
          accounts?: Account[];
          grantStats?: GrantStat[];
        };
        if (!j.ok) throw new Error(j.code ?? "load");
        setAccounts(j.accounts ?? []);
        setGrantStats(j.grantStats ?? []);
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

  // hạng HIỆU LỰC (premium hết hạn tính là thường) — cùng luật resolveTier
  const effTier = useCallback(
    (a: Account) => resolveTier(a.tier, a.premiumUntil, Date.now()),
    [],
  );

  // ── số thống kê nhanh trên đầu tab ──────────────────────────────────────
  const stats = useMemo(() => {
    if (!accounts) return null;
    return {
      total: accounts.length,
      premium: accounts.filter((a) => effTier(a) === "premium").length,
      canLogin: accounts.filter((a) => a.canLogin).length,
      manual: accounts.filter((a) => !a.fromSdwork).length,
    };
  }, [accounts, effTier]);

  const visible = useMemo(() => {
    if (!accounts) return null;
    const q = fold(query.trim());
    const qDigits = query.replace(/\D/g, "");
    return accounts.filter((a) => {
      if (tierFilter !== "all" && effTier(a) !== tierFilter) return false;
      if (!q && !qDigits) return true;
      // SĐT khớp theo chuỗi số; tên khớp không dấu
      if (qDigits && a.phone.includes(qDigits)) return true;
      if (q && a.name && fold(a.name).includes(q)) return true;
      return false;
    });
  }, [accounts, query, tierFilter, effTier]);

  /** grant = kích hoạt/gia hạn 1 năm (server tự tính hạn + ghi log);
   *  downgrade = hạ về thường (admin) */
  async function patchAction(a: Account, action: "grant" | "downgrade") {
    setBusyPhone(a.phone);
    const r = await fetch(apiUrl("/api/admin/accounts"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: a.phone, action }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as {
      ok?: boolean;
      logged?: boolean;
    } | null;
    setBusyPhone(null);
    if (!r?.ok || !j?.ok) {
      setError(
        action === "grant"
          ? "Kích hoạt/gia hạn chưa được — thử lại."
          : "Hạ hạng chưa được — thử lại.",
      );
      return;
    }
    if (j.logged === false) {
      // thao tác THÀNH CÔNG nhưng ghi log hỏng — nói thật để đối soát tay
      setError(
        "Đã đổi hạng nhưng GHI LOG LỖI (bảng premium_grants) — thống kê theo người cấp sẽ thiếu lần này.",
      );
    }
    load();
  }

  async function remove(a: Account) {
    setBusyPhone(a.phone);
    const r = await fetch(
      apiUrl(`/api/admin/accounts?phone=${encodeURIComponent(a.phone)}`),
      { method: "DELETE" },
    ).catch(() => null);
    setBusyPhone(null);
    if (!r?.ok) {
      setError("Xoá chưa được — thử lại.");
      return;
    }
    load();
  }

  const chip = (id: TierFilter, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTierFilter(id)}
      aria-pressed={tierFilter === id}
      className={`min-h-[2.5rem] shrink-0 rounded-full px-4 text-[0.875rem] font-bold transition ${
        tierFilter === id
          ? "bg-navy text-white"
          : "bg-field text-foreground/70"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-4 space-y-4">
      {/* dải THỐNG KÊ — nhìn một phát biết sức khoẻ tệp khách */}
      {stats && (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {(
            [
              ["Tổng tài khoản", stats.total],
              ["Premium hiệu lực", stats.premium],
              ["Đăng nhập được", stats.canLogin],
              ["Tạo tay", stats.manual],
            ] as [string, number][]
          ).map(([label, v]) => (
            <div key={label} className="surface px-3 py-3 text-center">
              <p className="display text-[1.625rem] font-bold tabular-nums text-navy">
                {v}
              </p>
              <p className="text-[0.8125rem] font-semibold text-foreground/65">
                {label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* tìm kiếm + lọc hạng */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <input
          type="search"
          inputMode="search"
          placeholder="Tìm theo SĐT hoặc tên khách…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Tìm tài khoản"
          className="min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-4 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea sm:flex-1"
        />
        <div className="flex gap-1.5">
          {chip("all", "Tất cả")}
          {chip("premium", "Premium")}
          {chip("basic", "Thường")}
        </div>
      </div>

      {/* tạo tài khoản (khách / QUẢN LÝ) — chỉ admin */}
      {isAdmin && <CreateAccountForm onCreated={load} />}

      {/* THỐNG KÊ THEO NGƯỜI CẤP premium (log premium_grants): quản lý thấy
          dòng của mình; admin thấy cả bảng — biết ai đang quản bao nhiêu */}
      {grantStats.length > 0 && (
        <div className="surface px-4 py-3.5">
          <p className="text-[0.9375rem] font-bold text-navy">
            Premium theo người cấp
          </p>
          <ul className="mt-2 space-y-1">
            {grantStats
              .filter((g) => isAdmin || g.by === me.phone)
              .map((g) => {
                const acc = accounts?.find((a) => a.phone === g.by);
                return (
                  <li
                    key={g.by}
                    className="flex flex-wrap items-baseline gap-x-2 text-[0.875rem]"
                  >
                    <span className="font-bold tabular-nums text-navy">
                      {g.by}
                      {g.by === me.phone && " (bạn)"}
                    </span>
                    {acc?.name && (
                      <span className="text-foreground/60">{acc.name}</span>
                    )}
                    <span className="text-foreground/70">
                      đang quản <b className="text-ok">{g.managing}</b> premium
                      · {g.totalGrants} lượt cấp/gia hạn
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}

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
      {visible && accounts && accounts.length > 0 && (
        <>
          <p className="px-1 text-[0.8125rem] font-semibold text-foreground/55">
            {visible.length === accounts.length
              ? `${accounts.length} tài khoản`
              : `${visible.length}/${accounts.length} tài khoản khớp`}
          </p>
          {visible.length === 0 ? (
            <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
              Không tài khoản nào khớp tìm kiếm/bộ lọc.
            </p>
          ) : (
            <ul className="surface overflow-hidden">
              {visible.map((a) => (
                <li
                  key={a.phone}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1 basis-[220px]">
                    <p className="text-[1rem] font-bold tabular-nums text-navy">
                      {a.phone}
                      {a.name && (
                        <span className="ml-2 font-semibold text-foreground/70">
                          {a.name}
                        </span>
                      )}
                      {a.role === "manager" && (
                        <span className="ml-2 rounded-full bg-t1-bg px-2 py-0.5 text-[0.75rem] font-bold text-t1">
                          Quản lý
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[0.8125rem] text-foreground/60">
                      {a.fromSdwork ? "Từ SDWork" : "Tạo tay"} ·{" "}
                      {a.canLogin ? "đăng nhập được" : "CHƯA đăng nhập được"} ·
                      cập nhật {fmtDT(a.updatedAt)}
                      {a.premiumActivatedAt &&
                        ` · premium kích hoạt ${fmtD(a.premiumActivatedAt)}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-[0.8125rem] font-bold ${
                      effTier(a) === "premium"
                        ? "bg-ok-bg text-ok"
                        : a.tier === "premium"
                          ? "bg-warn-bg text-warn"
                          : "bg-field text-foreground/65"
                    }`}
                  >
                    {effTier(a) === "premium"
                      ? a.premiumUntil
                        ? `Premium đến ${fmtD(a.premiumUntil)}`
                        : "Premium"
                      : a.tier === "premium"
                        ? `HẾT HẠN ${fmtD(a.premiumUntil)}`
                        : "Thường"}
                  </span>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      disabled={busyPhone === a.phone}
                      onClick={() => {
                        const active = effTier(a) === "premium";
                        setToGrant({
                          a,
                          active,
                          // xem trước hạn mới bằng ĐÚNG luật server
                          until: nextPremiumUntil(
                            active ? a.premiumUntil : null,
                            Date.now(),
                          ),
                        });
                      }}
                      className="min-h-[2.5rem] rounded-lg bg-navy px-3 text-[0.8125rem] font-bold text-white disabled:opacity-50"
                    >
                      {effTier(a) === "premium"
                        ? "Gia hạn +1 năm"
                        : "Kích hoạt premium"}
                    </button>
                    {isAdmin && effTier(a) === "premium" && (
                      <button
                        type="button"
                        disabled={busyPhone === a.phone}
                        onClick={() => setToDowngrade(a)}
                        className="min-h-[2.5rem] rounded-lg bg-field px-3 text-[0.8125rem] font-bold text-foreground/70 disabled:opacity-50"
                      >
                        Về thường
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={busyPhone === a.phone}
                        onClick={() => setToDelete(a)}
                        className="min-h-[2.5rem] rounded-lg bg-danger-bg px-3 text-[0.8125rem] font-bold text-danger disabled:opacity-50"
                      >
                        Xoá
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* ── DIALOG xác nhận (không dùng prompt/confirm trình duyệt) ───────── */}
      {toGrant && (
        <ConfirmDialog
          title={
            toGrant.active
              ? `Gia hạn premium +1 năm cho ${toGrant.a.phone}?`
              : `Kích hoạt premium 1 năm cho ${toGrant.a.phone}?`
          }
          message={`${toGrant.a.name ?? "Khách"} sẽ có premium đến ${fmtD(toGrant.until)}. Lần cấp này được ghi log dưới tên bạn.`}
          confirmLabel={toGrant.active ? "Gia hạn +1 năm" : "Kích hoạt 1 năm"}
          cancelLabel="Không"
          danger={false}
          onCancel={() => setToGrant(null)}
          onConfirm={() => {
            const a = toGrant.a;
            setToGrant(null);
            patchAction(a, "grant");
          }}
        />
      )}
      {toDowngrade && (
        <ConfirmDialog
          title={`Hạ ${toDowngrade.phone} về tài khoản thường?`}
          message="Khách sẽ mất dự báo cá và dự báo 16 ngày ngay lập tức."
          confirmLabel="Hạ về thường"
          cancelLabel="Không"
          danger
          onCancel={() => setToDowngrade(null)}
          onConfirm={() => {
            const a = toDowngrade;
            setToDowngrade(null);
            patchAction(a, "downgrade");
          }}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          title={`Xoá tài khoản ${toDelete.phone}?`}
          message={`${toDelete.name ? `${toDelete.name} — ` : ""}khách sẽ không đăng nhập được nữa. Không hoàn tác được.`}
          confirmLabel="Xoá luôn"
          cancelLabel="Không"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            const a = toDelete;
            setToDelete(null);
            remove(a);
          }}
        />
      )}
    </div>
  );
}

function CreateAccountForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"customer" | "manager">("customer");
  const [activatePremium, setActivatePremium] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch(apiUrl("/api/admin/accounts"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      // premium khi tạo = một lần KÍCH HOẠT chuẩn (1 năm, server tính hạn + log)
      body: JSON.stringify({ phone, name, password, role, activatePremium }),
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
        ? "Đã tạo. Báo người dùng đăng nhập bằng SĐT + mật khẩu tạm (lần đầu app bắt đổi)."
        : "Đã lưu nhưng TẠO ĐĂNG NHẬP LỖI — kiểm tra lại.",
    );
    setPhone("");
    setName("");
    setPassword("");
    setRole("customer");
    setActivatePremium(false);
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
        Tạo tài khoản (khách / quản lý)
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <form
          onSubmit={submit}
          className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
        >
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
          {/* loại tài khoản: 2 nút phân đoạn (select gốc bị bóp nhỏ khó nhìn
              — user 2026-07-26) */}
          <div
            className="grid grid-cols-2 gap-1.5 sm:col-span-2 lg:col-span-2"
            role="group"
            aria-label="Loại tài khoản"
          >
            {(
              [
                ["customer", "Khách"],
                ["manager", "Quản lý — được cấp premium"],
              ] as ["customer" | "manager", string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRole(id)}
                aria-pressed={role === id}
                className={`min-h-[2.75rem] rounded-xl px-3 text-[0.875rem] font-bold transition ${
                  role === id
                    ? "bg-navy text-white shadow-sm"
                    : "bg-field text-foreground/70"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-2.5 rounded-xl bg-field px-3.5 text-[0.875rem] font-bold text-foreground/80 sm:col-span-2 lg:col-span-2">
            <input
              type="checkbox"
              checked={activatePremium}
              onChange={(e) => setActivatePremium(e.target.checked)}
              className="h-5 w-5 accent-[var(--ok)]"
            />
            Kích hoạt premium 1 năm ngay khi tạo
          </label>
          <button
            type="submit"
            disabled={busy}
            className="min-h-[2.75rem] rounded-xl bg-trim text-[0.9375rem] font-bold text-white disabled:opacity-50 sm:col-span-2 lg:col-span-4"
          >
            {busy ? "Đang tạo…" : "Tạo tài khoản"}
          </button>
          {msg && (
            <p className="text-[0.875rem] font-semibold text-foreground/75 sm:col-span-2 lg:col-span-4">
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
        set({ state: "down", note: "không gọi được (timeout/mạng)" });
      }
    };

    // dự báo cá lần lạnh có thể ~30s (maxDuration 60) — timeout rộng hơn
    check(
      "/api/fish-forecast",
      setFish,
      (j) =>
        `ảnh ngày ${fmtD(String(j.targetDate ?? ""))} · tính lúc ${fmtDT(String(j.generatedAt ?? ""))}`,
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
              ? "đã cấu hình (webhook + trang này ghi được)"
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
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
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
