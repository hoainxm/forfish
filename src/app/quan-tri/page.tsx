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
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api-base";
import {
  countPoints,
  parseUploadedGeoJSON,
  validateZoneDraft,
  VMS_ZONE_STYLES,
  type VmsZoneStyle,
} from "@/lib/vms-zones";
import {
  SELL_KINDS,
  SELL_KIND_LABEL,
  validateSellContactDraft,
  type SellKind,
  type SellContactDraft,
} from "@/lib/sell-contacts";
import { nextPremiumUntil, resolveTier } from "@/lib/tier";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatCccd, isValidCccd } from "@/lib/crew";
import { isValidVnPhone } from "@/lib/phone";
import {
  crewReportCategoryLabel,
  CREW_REPORT_CATEGORIES,
  CREW_REPORT_CATEGORY_LABELS,
  type CrewReportCategory,
} from "@/lib/crew-report";

type Tab =
  | "tai-khoan"
  | "canh-bao"
  | "san-pham"
  | "yeu-cau"
  | "vung-bien"
  | "cho-ban"
  | "thong-bao"
  | "du-lieu"
  | "he-thong";

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
  premiumUsed: boolean;
  contacted: boolean;
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

      {/* Nhãn ngang hàng ĐỒNG BỘ (03-design-system): mọi tab đúng 2 chữ,
          1 dòng (nowrap); >4 tab → hàng cuộn ngang theo pattern ui/tabs.tsx,
          KHÔNG flex-1 ép 7 tab vào một hàng làm nhãn gãy dòng lung tung. */}
      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1" role="tablist">
        {(
          // QUẢN LÝ: Tài khoản (cấp premium) + Thuyền viên (kiểm duyệt cảnh
          // báo); Dữ liệu + Hệ thống là việc của admin
          (health.me?.role === "manager"
            ? [
                ["tai-khoan", "Tài khoản"],
                ["canh-bao", "Thuyền viên"],
                ["san-pham", "Sản phẩm"],
                ["yeu-cau", "Yêu cầu"],
                ["vung-bien", "Vùng biển"],
                ["cho-ban", "Chỗ bán"],
                ["thong-bao", "Thông báo"],
              ]
            : [
                ["tai-khoan", "Tài khoản"],
                ["canh-bao", "Thuyền viên"],
                ["san-pham", "Sản phẩm"],
                ["yeu-cau", "Yêu cầu"],
                ["vung-bien", "Vùng biển"],
                ["cho-ban", "Chỗ bán"],
                ["thong-bao", "Thông báo"],
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
            className={`min-h-[2.75rem] shrink-0 whitespace-nowrap rounded-xl px-4 text-[0.9375rem] font-bold transition ${
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
      {tab === "canh-bao" && <CrewReportsTab />}
      {tab === "san-pham" && <ProductsTab />}
      {tab === "yeu-cau" && <InquiriesTab />}
      {tab === "vung-bien" && <VmsZonesTab />}
      {tab === "cho-ban" && <SellContactsTab />}
      {tab === "thong-bao" && <PushNotificationsTab />}
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
  const [toReset, setToReset] = useState<Account | null>(null);
  // thông báo thành công (đặt lại mật khẩu…) — tách khỏi error để không đỏ oan
  const [notice, setNotice] = useState<string | null>(null);

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
    setNotice(null);
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

  /** NV2 (ba-spec 10) — đảo cờ CHĂM KHÁCH (premium_used | contacted). Lưu ngay,
   *  cập nhật local optimistic cho mượt; thất bại thì hoàn lại + báo. */
  async function setFlag(a: Account, flag: "premium_used" | "contacted") {
    const key = flag === "premium_used" ? "premiumUsed" : "contacted";
    const next = !a[key];
    const flip = (v: boolean) =>
      setAccounts((prev) =>
        prev
          ? prev.map((x) => (x.phone === a.phone ? { ...x, [key]: v } : x))
          : prev,
      );
    flip(next);
    const r = await fetch(apiUrl("/api/admin/accounts"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: a.phone, action: "set_flag", flag, value: next }),
    }).catch(() => null);
    if (!r?.ok) {
      flip(!next);
      setError("Chưa đổi được trạng thái chăm khách — thử lại.");
    }
  }

  /** reset-password = mật khẩu về tạm sd123456, khách bị bắt tự đổi khi
   *  đăng nhập lại (chỉ admin — server chặn bằng requireAdmin) */
  async function resetPassword(a: Account) {
    setBusyPhone(a.phone);
    setNotice(null);
    const r = await fetch(apiUrl("/api/admin/accounts"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: a.phone, action: "reset-password" }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
      tempPassword?: string;
    } | null;
    setBusyPhone(null);
    if (!r?.ok || !j?.ok) {
      setError(
        j?.code === "not_provisioned"
          ? "Tài khoản này chưa đăng nhập được (chưa provision) — không có mật khẩu để đặt lại."
          : "Đặt lại mật khẩu chưa được — thử lại.",
      );
      return;
    }
    setNotice(
      `Đã đặt lại mật khẩu cho ${a.phone}${a.name ? ` (${a.name})` : ""} — báo khách đăng nhập bằng mật khẩu tạm ${j.tempPassword ?? "sd123456"}, vào xong app sẽ bắt tự đổi.`,
    );
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
      {notice && (
        <div className="surface flex items-start justify-between gap-3 bg-ok-bg px-4 py-3.5">
          <p className="text-[0.9375rem] font-semibold text-ok">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Đóng thông báo"
            className="shrink-0 text-[0.875rem] font-bold text-ok/70"
          >
            Đóng
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
                    {/* NV2 (ba-spec 10) — chip chăm khách, bấm đổi ngay */}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFlag(a, "premium_used")}
                        aria-pressed={a.premiumUsed}
                        className={`min-h-[2rem] rounded-full px-2.5 text-[0.75rem] font-bold transition ${
                          a.premiumUsed
                            ? "bg-ok-bg text-ok"
                            : "bg-field text-foreground/55"
                        }`}
                      >
                        {a.premiumUsed ? "✓ Đã dùng" : "Chưa dùng"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFlag(a, "contacted")}
                        aria-pressed={a.contacted}
                        className={`min-h-[2rem] rounded-full px-2.5 text-[0.75rem] font-bold transition ${
                          a.contacted
                            ? "bg-t1-bg text-t1"
                            : "bg-field text-foreground/55"
                        }`}
                      >
                        {a.contacted ? "✓ Đã liên hệ" : "Chưa liên hệ"}
                      </button>
                    </div>
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
                    {isAdmin && a.canLogin && (
                      <button
                        type="button"
                        disabled={busyPhone === a.phone}
                        onClick={() => setToReset(a)}
                        className="min-h-[2.5rem] rounded-lg bg-field px-3 text-[0.8125rem] font-bold text-foreground/70 disabled:opacity-50"
                      >
                        Đặt lại mật khẩu
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
      {toReset && (
        <ConfirmDialog
          title={`Đặt lại mật khẩu cho ${toReset.phone}?`}
          message={`${toReset.name ? `${toReset.name} — ` : ""}mật khẩu về tạm sd123456, mật khẩu cũ hết dùng được. Khách đăng nhập lại sẽ bị bắt tự đổi mật khẩu mới.`}
          confirmLabel="Đặt lại"
          cancelLabel="Không"
          danger={false}
          onCancel={() => setToReset(null)}
          onConfirm={() => {
            const a = toReset;
            setToReset(null);
            resetPassword(a);
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
  const [role, setRole] = useState<"customer" | "manager" | "admin">(
    "customer",
  );
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
        Tạo tài khoản (khách / quản lý / admin)
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
            className="grid grid-cols-3 gap-1.5 sm:col-span-2 lg:col-span-2"
            role="group"
            aria-label="Loại tài khoản"
          >
            {(
              [
                ["customer", "Khách"],
                ["manager", "Quản lý — cấp premium"],
                ["admin", "Admin — toàn quyền"],
              ] as ["customer" | "manager" | "admin", string][]
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

/* ── CẢNH BÁO THUYỀN VIÊN (kiểm duyệt) ───────────────────────────────────── */

type CrewReportRow = {
  id: string;
  subjectCccd: string | null;
  subjectPhone: string | null;
  subjectName: string | null;
  reporterPhone: string;
  reporterBoat: string | null;
  category: string;
  detail: string | null;
  status: string;
  moderatedBy: string | null;
  moderatedAt: string | null;
  subjectResponse: string | null;
  subjectRespondedAt: string | null;
  createdAt: string;
};

type ReportStatusFilter = "pending" | "approved" | "rejected" | "all";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "Chờ duyệt", cls: "bg-warn-bg text-warn" },
  approved: { label: "Đã duyệt", cls: "bg-danger-bg text-danger" },
  rejected: { label: "Từ chối", cls: "bg-field text-foreground/65" },
  withdrawn: { label: "Đã rút", cls: "bg-field text-foreground/65" },
};

function CrewReportsTab() {
  const [status, setStatus] = useState<ReportStatusFilter>("pending");
  const [rows, setRows] = useState<CrewReportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // xác nhận đổi trạng thái (duyệt/từ chối/rút) qua dialog trong trang
  const [confirm, setConfirm] = useState<{
    row: CrewReportRow;
    action: "approve" | "reject" | "withdraw";
  } | null>(null);
  const [toDelete, setToDelete] = useState<CrewReportRow | null>(null);

  const load = useCallback(() => {
    setError(null);
    setRows(null);
    fetch(apiUrl(`/api/admin/crew-reports?status=${status}`))
      .then(async (r) => {
        const j = (await r.json()) as {
          ok: boolean;
          code?: string;
          reports?: CrewReportRow[];
        };
        if (!j.ok) throw new Error(j.code ?? "load");
        setRows(j.reports ?? []);
      })
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Chưa cấu hình Supabase/service-role — cảnh báo cần DB thật."
            : "Chưa tải được danh sách — thử lại.",
        ),
      );
  }, [status]);
  useEffect(load, [load]);

  async function act(
    row: CrewReportRow,
    action: "approve" | "reject" | "withdraw" | "respond",
    subjectResponse?: string,
  ) {
    setBusyId(row.id);
    const r = await fetch(apiUrl("/api/admin/crew-reports"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: row.id, action, subjectResponse }),
    }).catch(() => null);
    setBusyId(null);
    if (!r?.ok) {
      setError("Thao tác chưa được — thử lại.");
      return;
    }
    load();
  }

  async function remove(row: CrewReportRow) {
    setBusyId(row.id);
    const r = await fetch(
      apiUrl(`/api/admin/crew-reports?id=${encodeURIComponent(row.id)}`),
      { method: "DELETE" },
    ).catch(() => null);
    setBusyId(null);
    if (!r?.ok) {
      setError("Xóa chưa được — thử lại.");
      return;
    }
    load();
  }

  const chip = (id: ReportStatusFilter, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setStatus(id)}
      aria-pressed={status === id}
      className={`min-h-[2.5rem] shrink-0 rounded-full px-4 text-[0.875rem] font-bold transition ${
        status === id ? "bg-navy text-white" : "bg-field text-foreground/70"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-4 space-y-4">
      <p className="surface px-4 py-3 text-[0.875rem] leading-snug text-foreground/70">
        Chủ tàu premium báo cáo vấn đề thuyền viên (theo CCCD). Chỉ báo cáo{" "}
        <b>đã duyệt</b> mới hiện cho chủ tàu khác. Kiểm tra kỹ trước khi duyệt —
        người bị ghi có quyền phản hồi (ghi vào ô bên dưới mỗi báo cáo).
      </p>

      {/* STAFF tự thêm thuyền viên có vấn đề → duyệt luôn (hiện ngay) */}
      <AddCrewReportForm onAdded={load} />

      <div className="flex gap-1.5">
        {chip("pending", "Chờ duyệt")}
        {chip("approved", "Đã duyệt")}
        {chip("rejected", "Từ chối")}
        {chip("all", "Tất cả")}
      </div>

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
      {!rows && !error && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Đang tải…
        </p>
      )}
      {rows && rows.length === 0 && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Không có báo cáo nào ở mục này.
        </p>
      )}

      {rows && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((row) => (
            <ReportCard
              key={row.id}
              row={row}
              busy={busyId === row.id}
              onStatus={(action) => setConfirm({ row, action })}
              onRespond={(text) => act(row, "respond", text)}
              onDelete={() => setToDelete(row)}
            />
          ))}
        </ul>
      )}

      {confirm && (
        <ConfirmDialog
          title={
            confirm.action === "approve"
              ? "Duyệt báo cáo này?"
              : confirm.action === "reject"
                ? "Từ chối báo cáo này?"
                : "Rút báo cáo đã duyệt xuống?"
          }
          message={
            confirm.action === "approve"
              ? "Sau khi duyệt, chủ tàu khác nhập CCCD này sẽ THẤY cảnh báo. Đảm bảo đã kiểm tra."
              : confirm.action === "reject"
                ? "Báo cáo sẽ không hiện cho ai. Dùng khi nội dung sai/không đủ căn cứ."
                : "Cảnh báo sẽ ngừng hiện cho chủ tàu khác."
          }
          confirmLabel={
            confirm.action === "approve"
              ? "Duyệt, cho hiện"
              : confirm.action === "reject"
                ? "Từ chối"
                : "Rút xuống"
          }
          cancelLabel="Không"
          danger={confirm.action !== "approve"}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const { row, action } = confirm;
            setConfirm(null);
            act(row, action);
          }}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Xóa cảnh báo khỏi danh sách?"
          message="Xóa HẲN bản ghi này (khác 'rút xuống' vẫn giữ lại). Không hoàn tác được — dùng khi báo cáo sai/trùng."
          confirmLabel="Xóa luôn"
          cancelLabel="Không"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            const row = toDelete;
            setToDelete(null);
            remove(row);
          }}
        />
      )}
    </div>
  );
}

function ReportCard({
  row,
  busy,
  onStatus,
  onRespond,
  onDelete,
}: {
  row: CrewReportRow;
  busy: boolean;
  onStatus: (action: "approve" | "reject" | "withdraw") => void;
  onRespond: (text: string) => void;
  onDelete: () => void;
}) {
  const [resp, setResp] = useState(row.subjectResponse ?? "");
  const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE.pending;

  return (
    <li className="surface overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <p className="text-[1rem] font-bold text-navy">
            {crewReportCategoryLabel(row.category)}
          </p>
          <p className="mt-0.5 text-[0.8125rem] tabular-nums text-foreground/70">
            {row.subjectCccd ? `CCCD ${formatCccd(row.subjectCccd)}` : ""}
            {row.subjectCccd && row.subjectPhone ? " · " : ""}
            {row.subjectPhone ? `SĐT ${row.subjectPhone}` : ""}
            {row.subjectName ? ` · ${row.subjectName}` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[0.75rem] font-bold ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>

      {row.detail && (
        <p className="px-4 pt-2 text-[0.9375rem] leading-snug text-foreground/80">
          {row.detail}
        </p>
      )}

      <p className="px-4 pt-2 text-[0.8125rem] text-foreground/55">
        Người báo: <span className="tabular-nums">{row.reporterPhone}</span>
        {row.reporterBoat ? ` (${row.reporterBoat})` : ""} · gửi{" "}
        {fmtDT(row.createdAt)}
        {row.moderatedBy &&
          ` · duyệt bởi ${row.moderatedBy} ${fmtDT(row.moderatedAt)}`}
      </p>

      {/* phản hồi người bị ghi (admin thay mặt ghi, v1) */}
      <div className="mt-2 border-t border-line bg-background px-4 py-3">
        <label className="mb-1 block text-[0.8125rem] font-bold text-navy">
          Phản hồi của người bị ghi
        </label>
        <textarea
          value={resp}
          onChange={(e) => setResp(e.target.value)}
          maxLength={500}
          placeholder="Ghi lại đính chính/giải thích của người bị ghi nếu họ liên hệ SDVICO…"
          className="min-h-[3.5rem] w-full rounded-xl border-0 bg-field px-3 py-2 text-[0.875rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        />
        <button
          type="button"
          disabled={busy || resp.trim() === (row.subjectResponse ?? "")}
          onClick={() => onRespond(resp.trim())}
          className="mt-1.5 min-h-[2.5rem] rounded-lg bg-field px-4 text-[0.8125rem] font-bold text-navy disabled:opacity-40"
        >
          Lưu phản hồi
        </button>
      </div>

      <div className="flex gap-1.5 border-t border-line px-4 py-2.5">
        {row.status === "pending" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus("approve")}
              className="min-h-[2.5rem] flex-1 rounded-lg bg-navy px-3 text-[0.8125rem] font-bold text-white disabled:opacity-50"
            >
              Duyệt
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus("reject")}
              className="min-h-[2.5rem] flex-1 rounded-lg bg-field px-3 text-[0.8125rem] font-bold text-foreground/70 disabled:opacity-50"
            >
              Từ chối
            </button>
          </>
        )}
        {row.status === "approved" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus("withdraw")}
            className="min-h-[2.5rem] flex-1 rounded-lg bg-danger-bg px-3 text-[0.8125rem] font-bold text-danger disabled:opacity-50"
          >
            Rút cảnh báo xuống
          </button>
        )}
        {(row.status === "rejected" || row.status === "withdrawn") && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus("approve")}
            className="min-h-[2.5rem] flex-1 rounded-lg bg-navy px-3 text-[0.8125rem] font-bold text-white disabled:opacity-50"
          >
            Duyệt lại (cho hiện)
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          title="Xóa hẳn khỏi danh sách"
          className="min-h-[2.5rem] shrink-0 rounded-lg bg-danger-bg px-3 text-[0.8125rem] font-bold text-danger disabled:opacity-50"
        >
          Xóa
        </button>
      </div>
    </li>
  );
}

/** STAFF tự thêm một thuyền viên có vấn đề (CCCD HOẶC SĐT) → vào thẳng
 *  'approved', hiện ngay cho chủ tàu khác khi tra. */
function AddCrewReportForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [cccd, setCccd] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CrewReportCategory | "">("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const cccdOk = isValidCccd(cccd);
  const phoneOk = isValidVnPhone(phone);
  const canSubmit = (cccdOk || phoneOk) && !!category;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!cccdOk && !phoneOk) {
      setMsg("Cần CCCD (12 số) hoặc SĐT.");
      return;
    }
    if (cccd.trim() && !cccdOk) {
      setMsg("CCCD phải đủ 12 số (hoặc để trống).");
      return;
    }
    if (phone.trim() && !phoneOk) {
      setMsg("SĐT chưa hợp lệ.");
      return;
    }
    if (!category) {
      setMsg("Chọn loại vấn đề.");
      return;
    }
    setBusy(true);
    const r = await fetch(apiUrl("/api/admin/crew-reports"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cccd: cccdOk ? cccd : undefined,
        phone: phoneOk ? phone : undefined,
        subjectName: name.trim() || undefined,
        category,
        detail: detail.trim() || undefined,
      }),
    }).catch(() => null);
    setBusy(false);
    const j = (await r?.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
    } | null;
    if (!r?.ok || !j?.ok) {
      setMsg(
        j?.code === "cccd_pepper_missing"
          ? "Máy chủ chưa cấu hình CREW_CCCD_PEPPER."
          : "Thêm chưa được — thử lại.",
      );
      return;
    }
    setMsg("Đã thêm — cảnh báo hiện ngay cho chủ tàu khác khi tra.");
    setCccd("");
    setPhone("");
    setName("");
    setCategory("");
    setDetail("");
    onAdded();
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
        Thêm thuyền viên có vấn đề (duyệt luôn)
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <form onSubmit={submit} className="mt-3 space-y-2.5">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input
              inputMode="numeric"
              placeholder="CCCD (12 số) — hoặc dùng SĐT"
              value={cccd}
              onChange={(e) => setCccd(e.target.value)}
              className={field}
            />
            <input
              inputMode="tel"
              placeholder="SĐT (nếu không có CCCD)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={field}
            />
          </div>
          <input
            placeholder="Tên thuyền viên (tuỳ chọn)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
          />
          <div
            className="grid gap-1.5 sm:grid-cols-2"
            role="group"
            aria-label="Loại vấn đề"
          >
            {CREW_REPORT_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={`min-h-[2.75rem] rounded-xl px-3 text-left text-[0.8125rem] font-bold transition ${
                  category === c
                    ? "bg-navy text-white"
                    : "bg-field text-foreground/70"
                }`}
              >
                {CREW_REPORT_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
          <textarea
            placeholder="Kể rõ hơn (tuỳ chọn)"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            maxLength={500}
            className="min-h-[3.5rem] w-full rounded-xl border-0 bg-field px-3 py-2 text-[0.875rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
          />
          <button
            type="submit"
            disabled={busy || !canSubmit}
            className="min-h-[2.75rem] w-full rounded-xl bg-trim text-[0.9375rem] font-bold text-white disabled:opacity-50"
          >
            {busy ? "Đang thêm…" : "Thêm & duyệt luôn"}
          </button>
          {msg && (
            <p className="text-[0.875rem] font-semibold text-foreground/75">
              {msg}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

/* ── SẢN PHẨM (danh mục tab Sản phẩm /tau) ────────────────────────────────
   Admin ẩn/hiện/xóa/thêm sản phẩm — kể cả đơn vị NGOÀI SDWork (vendor_name +
   liên hệ riêng). Áp dụng NGAY cho app (client đọc thẳng bảng), không cần
   build lại app. */

type VendorKind = "sdvico" | "external";

type ProductRow = {
  id: string;
  vendorKind: VendorKind;
  vendorName: string | null;
  title: string;
  category: string | null;
  description: string | null;
  features: string[];
  priceText: string | null;
  imageUrl: string | null;
  contactPhone: string | null;
  contactNote: string | null;
  line: string | null;
  visible: boolean;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

function ProductsTab() {
  const [rows, setRows] = useState<ProductRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductRow | "new" | null>(null);
  const [toDelete, setToDelete] = useState<ProductRow | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetch(apiUrl("/api/admin/products"))
      .then(async (r) => {
        const j = (await r.json()) as {
          ok: boolean;
          code?: string;
          listings?: ProductRow[];
        };
        if (!j.ok) throw new Error(j.code ?? "load");
        setRows(j.listings ?? []);
      })
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Chưa cấu hình Supabase/service-role — danh mục cần DB thật."
            : "Chưa tải được danh mục — thử lại.",
        ),
      );
  }, []);
  useEffect(load, [load]);

  async function toggleVisible(row: ProductRow) {
    setBusyId(row.id);
    const r = await fetch(apiUrl("/api/admin/products"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: row.id, visible: !row.visible }),
    }).catch(() => null);
    setBusyId(null);
    if (!r?.ok) {
      setError("Đổi trạng thái chưa được — thử lại.");
      return;
    }
    load();
  }

  async function remove(row: ProductRow) {
    setBusyId(row.id);
    const r = await fetch(
      apiUrl(`/api/admin/products?id=${encodeURIComponent(row.id)}`),
      { method: "DELETE" },
    ).catch(() => null);
    setBusyId(null);
    if (!r?.ok) {
      setError("Xóa chưa được — thử lại.");
      return;
    }
    load();
  }

  return (
    <div className="mt-4 space-y-4">
      <p className="surface px-4 py-3 text-[0.875rem] leading-snug text-foreground/70">
        Danh mục hiện trong tab <b>Sản phẩm → Cửa hàng</b> của app ngư dân.
        Ẩn/hiện/xóa/thêm ở đây áp dụng NGAY, không cần build lại app. Có thể
        thêm sản phẩm/dịch vụ của <b>đơn vị ngoài SDWork</b> (ghi rõ tên đơn
        vị + số điện thoại/ghi chú liên hệ).
      </p>

      <button
        type="button"
        onClick={() => setEditing("new")}
        className="min-h-[2.75rem] w-full rounded-xl bg-trim text-[0.9375rem] font-bold text-white sm:w-auto sm:px-6"
      >
        + Thêm sản phẩm
      </button>

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
      {!rows && !error && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Đang tải danh mục…
        </p>
      )}
      {rows && rows.length === 0 && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Chưa có sản phẩm nào — bấm nút trên để thêm.
        </p>
      )}

      {rows && rows.length > 0 && (
        <ul className="surface overflow-hidden">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1 basis-[240px]">
                <p className="text-[1rem] font-bold text-navy">
                  {row.title}
                  {row.vendorKind === "external" && (
                    <span className="ml-2 rounded-full bg-t3/15 px-2 py-0.5 text-[0.75rem] font-bold text-t3">
                      {row.vendorName ?? "Đơn vị ngoài"}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[0.8125rem] text-foreground/60">
                  {row.category ?? "Chưa gắn loại"} ·{" "}
                  {row.visible ? "đang hiện" : "ĐANG ẨN"}
                  {row.createdBy && ` · sửa gần nhất bởi ${row.createdBy}`}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-[0.8125rem] font-bold ${
                  row.visible
                    ? "bg-ok-bg text-ok"
                    : "bg-field text-foreground/65"
                }`}
              >
                {row.visible ? "Hiện" : "Ẩn"}
              </span>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => toggleVisible(row)}
                  className="min-h-[2.5rem] rounded-lg bg-field px-3 text-[0.8125rem] font-bold text-navy disabled:opacity-50"
                >
                  {row.visible ? "Ẩn đi" : "Cho hiện"}
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => setEditing(row)}
                  className="min-h-[2.5rem] rounded-lg bg-field px-3 text-[0.8125rem] font-bold text-navy disabled:opacity-50"
                >
                  Sửa
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => setToDelete(row)}
                  className="min-h-[2.5rem] rounded-lg bg-danger-bg px-3 text-[0.8125rem] font-bold text-danger disabled:opacity-50"
                >
                  Xóa
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ProductForm
          initial={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title={`Xóa "${toDelete.title}" khỏi danh mục?`}
          message="Sản phẩm sẽ biến mất khỏi tab Sản phẩm của app ngay lập tức. Không hoàn tác được."
          confirmLabel="Xóa luôn"
          cancelLabel="Không"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            const row = toDelete;
            setToDelete(null);
            remove(row);
          }}
        />
      )}
    </div>
  );
}

function ProductForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: ProductRow | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [vendorKind, setVendorKind] = useState<VendorKind>(
    initial?.vendorKind ?? "sdvico",
  );
  const [vendorName, setVendorName] = useState(initial?.vendorName ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [features, setFeatures] = useState(
    (initial?.features ?? []).join("\n"),
  );
  const [priceText, setPriceText] = useState(initial?.priceText ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [contactPhone, setContactPhone] = useState(
    initial?.contactPhone ?? "",
  );
  const [contactNote, setContactNote] = useState(initial?.contactNote ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const body = {
      id: initial?.id,
      vendorKind,
      vendorName: vendorName.trim() || undefined,
      title: title.trim(),
      category: category.trim() || undefined,
      description: description.trim() || undefined,
      features: features
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean),
      priceText: priceText.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      contactNote: contactNote.trim() || undefined,
      visible: initial?.visible ?? true,
    };
    const r = await fetch(apiUrl("/api/admin/products"), {
      method: initial ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    const j = (await r?.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
    } | null;
    if (!r?.ok || !j?.ok) {
      setMsg(
        j?.code === "invalid_draft"
          ? "Thiếu tên, hoặc (đơn vị ngoài) thiếu tên đơn vị/liên hệ."
          : "Lưu chưa được — thử lại.",
      );
      return;
    }
    onSaved();
  }

  const field =
    "min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-3 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea";

  return (
    <div className="surface px-4 py-3.5">
      <p className="mb-3 text-[1rem] font-bold text-navy">
        {initial ? `Sửa "${initial.title}"` : "Thêm sản phẩm mới"}
      </p>
      <form onSubmit={submit} className="space-y-2.5">
        <div
          className="grid grid-cols-2 gap-1.5"
          role="group"
          aria-label="Nguồn sản phẩm"
        >
          {(
            [
              ["sdvico", "SDVICO"],
              ["external", "Đơn vị ngoài"],
            ] as [VendorKind, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setVendorKind(id)}
              aria-pressed={vendorKind === id}
              className={`min-h-[2.75rem] rounded-xl px-3 text-[0.875rem] font-bold transition ${
                vendorKind === id
                  ? "bg-navy text-white shadow-sm"
                  : "bg-field text-foreground/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {vendorKind === "external" && (
          <input
            placeholder="Tên đơn vị (bắt buộc — VD: Cơ sở lưới Vũng Tàu)"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            className={field}
          />
        )}

        <input
          required
          placeholder="Tên sản phẩm/dịch vụ"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={field}
        />
        <input
          placeholder="Loại (VD: Máy lọc nước biển)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={field}
        />
        <textarea
          placeholder="Mô tả ngắn"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="min-h-[3.5rem] w-full rounded-xl border-0 bg-field px-3 py-2 text-[0.875rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        />
        <textarea
          placeholder={"Tính năng — mỗi dòng một ý"}
          value={features}
          onChange={(e) => setFeatures(e.target.value)}
          rows={3}
          className="min-h-[3.5rem] w-full rounded-xl border-0 bg-field px-3 py-2 text-[0.875rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        />
        <div className="grid gap-2.5 sm:grid-cols-2">
          <input
            placeholder="Giá tham khảo (tuỳ chọn)"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            className={field}
          />
          <input
            placeholder="URL ảnh (tuỳ chọn)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className={field}
          />
        </div>
        {vendorKind === "external" && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input
              inputMode="tel"
              placeholder="SĐT liên hệ"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className={field}
            />
            <input
              placeholder="Ghi chú liên hệ (địa chỉ, chợ…)"
              value={contactNote}
              onChange={(e) => setContactNote(e.target.value)}
              className={field}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[2.75rem] rounded-xl bg-field text-[0.9375rem] font-bold text-foreground/70"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={busy}
            className="min-h-[2.75rem] rounded-xl bg-trim text-[0.9375rem] font-bold text-white disabled:opacity-50"
          >
            {busy ? "Đang lưu…" : "Lưu"}
          </button>
        </div>
        {msg && (
          <p className="text-[0.875rem] font-semibold text-foreground/75">
            {msg}
          </p>
        )}
      </form>
    </div>
  );
}

/* ── YÊU CẦU (hỏi mua/tư vấn từ danh mục sản phẩm) ────────────────────────
   Chủ yếu từ sản phẩm ĐƠN VỊ NGOÀI SDWork (nút "Để lại yêu cầu" —
   product-inquiry-button.tsx). Sản phẩm SDVICO vẫn đi CRM consultation_requests
   như cũ (không đụng), không hiện ở đây. */

type InquiryStatus = "moi" | "da_lien_he" | "xong";

const INQUIRY_STATUS_BADGE: Record<InquiryStatus, { label: string; cls: string }> = {
  moi: { label: "Mới", cls: "bg-warn-bg text-warn" },
  da_lien_he: { label: "Đã liên hệ", cls: "bg-sea/15 text-sea" },
  xong: { label: "Xong", cls: "bg-ok-bg text-ok" },
};

type InquiryRow = {
  id: string;
  listingId: string | null;
  listingTitle: string | null;
  vendorKind: string | null;
  customerPhone: string;
  customerName: string | null;
  message: string | null;
  status: InquiryStatus;
  createdAt: string;
  handledBy: string | null;
  handledAt: string | null;
  note: string | null;
};

type InquiryStatusFilter = InquiryStatus | "all";

// ── Tab VÙNG BIỂN (VMS) — bản đồ + tải GeoJSON + ẩn/hiện + mặc định-app + xóa ──

type AdminVmsZone = {
  id: string;
  name: string;
  color: string;
  style: string;
  defaultOn: boolean;
  visible: boolean;
  geojson: GeoJSON.FeatureCollection;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

// Bản đồ lazy-load (MapLibre nặng + không SSR được).
const VmsZonesMapDyn = dynamic(
  () => import("@/components/admin/vms-zones-map"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-field">
        <p className="text-[1rem] font-semibold text-t1">Đang mở bản đồ…</p>
      </div>
    ),
  },
);

const STYLE_LABEL: Record<VmsZoneStyle, string> = {
  fill: "Tô nền",
  line: "Viền liền",
  "line-dashed": "Viền nét đứt",
};

function VmsZonesTab() {
  const [zones, setZones] = useState<AdminVmsZone[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AdminVmsZone | null>(null);

  // form thêm vùng
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0d9488");
  const [style, setStyle] = useState<VmsZoneStyle>("line");
  const [defaultOn, setDefaultOn] = useState(true);
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setZones(null);
    fetch(apiUrl("/api/admin/vms-zones"))
      .then(async (r) => {
        const j = (await r.json()) as {
          ok: boolean;
          code?: string;
          zones?: AdminVmsZone[];
        };
        if (!j.ok) throw new Error(j.code ?? "load");
        setZones(j.zones ?? []);
      })
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Chưa cấu hình Supabase/service-role — vùng biển cần DB thật. Chạy migration 0013_vms_zones trước."
            : "Chưa tải được danh sách vùng — thử lại.",
        ),
      );
  }, []);
  useEffect(load, [load]);

  const patch = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setBusyId(id);
      try {
        const r = await fetch(apiUrl("/api/admin/vms-zones"), {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, ...body }),
        });
        const j = (await r.json()) as { ok: boolean };
        if (!j.ok) throw new Error();
        load();
      } catch {
        setError("Không lưu được thay đổi — thử lại.");
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const r = await fetch(apiUrl(`/api/admin/vms-zones?id=${id}`), {
          method: "DELETE",
        });
        const j = (await r.json()) as { ok: boolean };
        if (!j.ok) throw new Error();
        load();
      } catch {
        setError("Không xóa được — thử lại.");
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  async function onFile(file: File | null) {
    setFileErr(null);
    setGeojson(null);
    setFileName(null);
    if (!file) return;
    try {
      const text = await file.text();
      const fc = parseUploadedGeoJSON(text);
      setGeojson(fc);
      setFileName(`${file.name} · ${countPoints(fc).toLocaleString("vi-VN")} điểm`);
      if (!name.trim()) setName(file.name.replace(/\.(geo)?json$/i, ""));
    } catch (e) {
      setFileErr((e as Error).message);
    }
  }

  async function submit() {
    setFormMsg(null);
    if (!geojson) {
      setFileErr("Chọn tệp GeoJSON trước.");
      return;
    }
    const draft = { name, color, style, defaultOn, visible: true, geojson };
    const invalid = validateZoneDraft(draft);
    if (invalid) {
      setFormMsg(invalid);
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(apiUrl("/api/admin/vms-zones"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, sortOrder: (zones?.length ?? 0) + 10 }),
      });
      const j = (await r.json()) as { ok: boolean; code?: string };
      if (!j.ok) throw new Error(j.code ?? "post");
      setName("");
      setGeojson(null);
      setFileName(null);
      setDefaultOn(true);
      load();
    } catch (e) {
      setFormMsg(
        (e as Error).message === "too_big"
          ? "Tệp quá nặng (>200.000 điểm) — cắt gọn nguồn trước khi tải."
          : "Không thêm được vùng — thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-5">
      <h2 className="display text-[1.375rem] font-bold text-navy">
        Vùng biển trên bản đồ Ra khơi
      </h2>
      <p className="mt-1 text-[0.9375rem] text-foreground/70">
        Thêm / ẩn / xóa vùng và chọn vùng có bật sẵn trên app ngư dân hay không.
        Áp dụng ngay, không cần build lại app.
      </p>

      {error && (
        <p className="mt-3 rounded-xl bg-danger-bg px-3 py-2 text-[0.9375rem] font-semibold text-danger">
          {error}
        </p>
      )}

      {/* Bản đồ xem tất cả vùng */}
      <div className="mt-4 h-[26rem] overflow-hidden rounded-2xl border border-line">
        {zones && (
          <VmsZonesMapDyn
            zones={zones.map((z) => ({
              id: z.id,
              color: z.color,
              style: z.style,
              visible: z.visible,
              geojson: z.geojson,
            }))}
            selectedId={selectedId}
          />
        )}
      </div>

      {/* Thêm vùng bằng GeoJSON */}
      <div className="mt-4 rounded-2xl border border-line bg-field/40 p-4">
        <p className="text-[1rem] font-bold text-navy">Thêm vùng (tải GeoJSON)</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[0.8125rem] font-semibold text-foreground/70">
              Tệp GeoJSON
            </span>
            <input
              type="file"
              accept=".json,.geojson,application/geo+json,application/json"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-[0.875rem] file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-3 file:py-2 file:font-semibold file:text-white"
            />
            {fileName && (
              <span className="mt-1 block text-[0.8125rem] text-ok">{fileName}</span>
            )}
            {fileErr && (
              <span className="mt-1 block text-[0.8125rem] font-semibold text-danger">
                {fileErr}
              </span>
            )}
          </label>
          <label className="block">
            <span className="text-[0.8125rem] font-semibold text-foreground/70">
              Tên vùng
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="vd Vùng cấm đánh bắt mùa sinh sản"
              className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-[0.9375rem]"
            />
          </label>
          <label className="flex items-center gap-3">
            <span className="text-[0.8125rem] font-semibold text-foreground/70">
              Màu
            </span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-16 rounded-lg border border-line"
            />
            <span className="text-[0.8125rem] tabular-nums text-foreground/60">
              {color}
            </span>
          </label>
          <div>
            <span className="text-[0.8125rem] font-semibold text-foreground/70">
              Kiểu vẽ
            </span>
            <div className="mt-1 flex gap-1.5">
              {VMS_ZONE_STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  className={`flex-1 rounded-lg px-2 py-2 text-[0.8125rem] font-semibold ${
                    style === s ? "bg-navy text-white" : "bg-field text-foreground/70"
                  }`}
                >
                  {STYLE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-[0.9375rem]">
          <input
            type="checkbox"
            checked={defaultOn}
            onChange={(e) => setDefaultOn(e.target.checked)}
            className="h-5 w-5"
          />
          Bật sẵn trên app ngư dân (bà con vẫn tắt được)
        </label>
        {formMsg && (
          <p className="mt-2 text-[0.875rem] font-semibold text-danger">{formMsg}</p>
        )}
        <button
          type="button"
          disabled={submitting || !geojson}
          onClick={submit}
          className="mt-3 rounded-xl bg-sea px-5 py-2.5 text-[1rem] font-bold text-white disabled:opacity-50"
        >
          {submitting ? "Đang lưu…" : "Thêm vùng"}
        </button>
      </div>

      {/* Danh sách vùng */}
      <div className="mt-4 space-y-2">
        {zones === null && !error && (
          <p className="text-[0.9375rem] text-foreground/60">Đang tải…</p>
        )}
        {zones?.length === 0 && (
          <p className="rounded-xl bg-field px-3 py-3 text-[0.9375rem] text-foreground/60">
            Chưa có vùng nào. Tải GeoJSON ở trên để thêm.
          </p>
        )}
        {zones?.map((z) => (
          <div
            key={z.id}
            onClick={() => setSelectedId(z.id === selectedId ? null : z.id)}
            className={`cursor-pointer rounded-xl border bg-card p-3 transition ${
              selectedId === z.id ? "border-navy ring-1 ring-navy" : "border-line"
            } ${z.visible ? "" : "opacity-60"}`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span
                className="h-4 w-4 shrink-0 rounded-full border border-line"
                style={{ backgroundColor: z.color }}
              />
              <span className="text-[1rem] font-bold text-navy">{z.name}</span>
              <span className="rounded-full bg-field px-2 py-0.5 text-[0.75rem] text-foreground/60">
                {STYLE_LABEL[z.style as VmsZoneStyle] ?? z.style}
              </span>
              <span className="text-[0.75rem] tabular-nums text-foreground/50">
                {countPoints(z.geojson).toLocaleString("vi-VN")} điểm
              </span>
            </div>
            <div
              className="mt-2.5 flex flex-wrap gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                disabled={busyId === z.id}
                onClick={() => patch(z.id, { defaultOn: !z.defaultOn })}
                className={`rounded-lg px-3 py-1.5 text-[0.8125rem] font-semibold ${
                  z.defaultOn ? "bg-ok-bg text-ok" : "bg-field text-foreground/60"
                }`}
              >
                {z.defaultOn ? "✓ Bật sẵn trên app" : "Tắt sẵn trên app"}
              </button>
              <button
                type="button"
                disabled={busyId === z.id}
                onClick={() => patch(z.id, { visible: !z.visible })}
                className={`rounded-lg px-3 py-1.5 text-[0.8125rem] font-semibold ${
                  z.visible ? "bg-field text-foreground/70" : "bg-warn-bg text-warn"
                }`}
              >
                {z.visible ? "Đang hiện — ẩn đi" : "Đang ẩn — hiện lại"}
              </button>
              <button
                type="button"
                disabled={busyId === z.id}
                onClick={() => setToDelete(z)}
                className="rounded-lg bg-danger-bg px-3 py-1.5 text-[0.8125rem] font-semibold text-danger"
              >
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>

      {toDelete && (
        <ConfirmDialog
          title="Xóa vùng này?"
          message={`"${toDelete.name}" sẽ bị xóa khỏi bản đồ của app ngư dân.`}
          confirmLabel="Xóa luôn"
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            remove(toDelete.id);
            setToDelete(null);
          }}
        />
      )}
    </section>
  );
}

// ── Tab CHỖ BÁN — danh bạ "Bán ở đâu" (nậu vựa/chợ/nhà máy): sửa/ẩn/hiện/xóa/thêm ──

type AdminSellContact = {
  id: string;
  kind: string;
  name: string;
  subLabel: string | null;
  province: string | null;
  address: string | null;
  phone: string | null;
  hours: string | null;
  species: string[];
  markets: string[];
  website: string | null;
  direct: boolean;
  visible: boolean;
  sortOrder: number;
};

function SellContactsTab() {
  const [contacts, setContacts] = useState<AdminSellContact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<SellKind | "all">("all");
  const [editing, setEditing] = useState<AdminSellContact | "new" | null>(null);
  const [toDelete, setToDelete] = useState<AdminSellContact | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setContacts(null);
    fetch(apiUrl("/api/admin/sell-contacts"))
      .then(async (r) => {
        const j = (await r.json()) as {
          ok: boolean;
          code?: string;
          contacts?: AdminSellContact[];
        };
        if (!j.ok) throw new Error(j.code ?? "load");
        setContacts(j.contacts ?? []);
      })
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Chưa cấu hình Supabase/service-role — danh bạ cần DB thật. Chạy migration 0014_sell_contacts trước."
            : "Chưa tải được danh bạ — thử lại.",
        ),
      );
  }, []);
  useEffect(load, [load]);

  const patch = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setBusyId(id);
      try {
        const r = await fetch(apiUrl("/api/admin/sell-contacts"), {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, ...body }),
        });
        if (!((await r.json()) as { ok: boolean }).ok) throw new Error();
        load();
      } catch {
        setError("Không lưu được thay đổi — thử lại.");
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const r = await fetch(apiUrl(`/api/admin/sell-contacts?id=${id}`), {
          method: "DELETE",
        });
        if (!((await r.json()) as { ok: boolean }).ok) throw new Error();
        load();
      } catch {
        setError("Không xóa được — thử lại.");
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  async function seedDefaults() {
    setSeeding(true);
    setError(null);
    try {
      const r = await fetch(apiUrl("/api/admin/sell-contacts"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      const j = (await r.json()) as { ok: boolean; code?: string };
      if (!j.ok) {
        setError(
          j.code === "not_empty"
            ? "Danh bạ đã có dữ liệu — không nạp đè."
            : "Không nạp được danh bạ mặc định.",
        );
      } else load();
    } finally {
      setSeeding(false);
    }
  }

  const shown = (contacts ?? []).filter(
    (c) => kindFilter === "all" || c.kind === kindFilter,
  );

  return (
    <section className="mt-5">
      <h2 className="display text-[1.375rem] font-bold text-navy">
        Danh bạ “Bán ở đâu”
      </h2>
      <p className="mt-1 text-[0.9375rem] text-foreground/70">
        Nậu vựa · Chợ đầu mối · Nhà máy hiện trong app ngư dân (mục Giao dịch →
        Bán ở đâu). Sửa / ẩn / hiện / xóa / thêm — áp dụng ngay. (“Mối quen” là
        sổ riêng của bà con, không quản lý ở đây.)
      </p>

      {error && (
        <p className="mt-3 rounded-xl bg-danger-bg px-3 py-2 text-[0.9375rem] font-semibold text-danger">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["all", ...SELL_KINDS] as (SellKind | "all")[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKindFilter(k)}
            className={`rounded-full px-3.5 py-1.5 text-[0.875rem] font-bold ${
              kindFilter === k ? "bg-navy text-white" : "bg-field text-foreground/70"
            }`}
          >
            {k === "all" ? "Tất cả" : SELL_KIND_LABEL[k]}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="rounded-xl bg-sea px-4 py-2 text-[0.9375rem] font-bold text-white"
          >
            + Thêm đầu mối
          </button>
          {contacts?.length === 0 && (
            <button
              type="button"
              disabled={seeding}
              onClick={seedDefaults}
              className="rounded-xl bg-field px-4 py-2 text-[0.9375rem] font-bold text-navy disabled:opacity-50"
            >
              {seeding ? "Đang nạp…" : "Nạp danh bạ mặc định"}
            </button>
          )}
        </div>
      </div>

      {contacts === null && !error && (
        <p className="mt-4 text-[0.9375rem] text-foreground/60">Đang tải…</p>
      )}
      {contacts?.length === 0 && (
        <p className="mt-4 rounded-xl bg-field px-3 py-3 text-[0.9375rem] text-foreground/60">
          Danh bạ trống. Bấm “Nạp danh bạ mặc định” để đưa ~143 đầu mối có sẵn
          vào quản lý, hoặc tự thêm.
        </p>
      )}

      <div className="mt-3 space-y-2">
        {shown.map((c) => (
          <div
            key={c.id}
            className={`rounded-xl border border-line bg-card p-3 ${
              c.visible ? "" : "opacity-60"
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="rounded-full bg-t2-bg px-2 py-0.5 text-[0.75rem] font-bold text-t2">
                {SELL_KIND_LABEL[c.kind as SellKind] ?? c.kind}
              </span>
              <span className="text-[1rem] font-bold text-navy">{c.name}</span>
              {c.province && (
                <span className="text-[0.8125rem] text-foreground/60">
                  {c.province}
                </span>
              )}
              {c.phone && (
                <span className="text-[0.8125rem] tabular-nums text-foreground/60">
                  {c.phone}
                </span>
              )}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditing(c)}
                className="rounded-lg bg-field px-3 py-1.5 text-[0.8125rem] font-semibold text-sea"
              >
                Sửa
              </button>
              <button
                type="button"
                disabled={busyId === c.id}
                onClick={() => patch(c.id, { visible: !c.visible })}
                className={`rounded-lg px-3 py-1.5 text-[0.8125rem] font-semibold ${
                  c.visible ? "bg-field text-foreground/70" : "bg-warn-bg text-warn"
                }`}
              >
                {c.visible ? "Đang hiện — ẩn đi" : "Đang ẩn — hiện lại"}
              </button>
              <button
                type="button"
                disabled={busyId === c.id}
                onClick={() => setToDelete(c)}
                className="rounded-lg bg-danger-bg px-3 py-1.5 text-[0.8125rem] font-semibold text-danger"
              >
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <SellContactForm
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onError={setError}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          title="Xóa đầu mối này?"
          message={`"${toDelete.name}" sẽ bị xóa khỏi danh bạ của app ngư dân.`}
          confirmLabel="Xóa luôn"
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            remove(toDelete.id);
            setToDelete(null);
          }}
        />
      )}
    </section>
  );
}

function SellContactForm({
  initial,
  onClose,
  onSaved,
  onError,
}: {
  initial: AdminSellContact | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [kind, setKind] = useState<SellKind>(
    (initial?.kind as SellKind) ?? "vua",
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [province, setProvince] = useState(initial?.province ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [hours, setHours] = useState(initial?.hours ?? "");
  const [species, setSpecies] = useState((initial?.species ?? []).join(", "));
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    const draft: SellContactDraft = {
      kind,
      name,
      province: province.trim() || undefined,
      address: address.trim() || undefined,
      phone: phone.trim() || undefined,
      hours: hours.trim() || undefined,
      species: species
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      markets: initial?.markets ?? [],
      website: website.trim() || undefined,
      direct: initial?.direct ?? false,
      visible: initial?.visible ?? true,
    };
    const invalid = validateSellContactDraft(draft);
    if (invalid) {
      setMsg(invalid);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(apiUrl("/api/admin/sell-contacts"), {
        method: initial ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(initial ? { id: initial.id, ...draft } : draft),
      });
      if (!((await r.json()) as { ok: boolean }).ok) throw new Error();
      onSaved();
    } catch {
      onError("Không lưu được đầu mối — thử lại.");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-[440px] overflow-y-auto rounded-2xl bg-card p-5"
      >
        <p className="display text-[1.25rem] font-bold text-navy">
          {initial ? "Sửa đầu mối" : "Thêm đầu mối"}
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <span className="text-[0.8125rem] font-semibold text-foreground/70">
              Nhóm
            </span>
            <div className="mt-1 flex gap-1.5">
              {SELL_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex-1 rounded-lg px-2 py-2 text-[0.8125rem] font-semibold ${
                    kind === k ? "bg-navy text-white" : "bg-field text-foreground/70"
                  }`}
                >
                  {SELL_KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
          <SellField label="Tên (bắt buộc)" value={name} onChange={setName} />
          <SellField label="Tỉnh" value={province} onChange={setProvince} />
          <SellField label="Địa chỉ" value={address} onChange={setAddress} />
          <SellField label="Số điện thoại" value={phone} onChange={setPhone} />
          {kind === "cho" && (
            <SellField label="Giờ họp" value={hours} onChange={setHours} />
          )}
          <SellField
            label="Loài (cách nhau dấu phẩy)"
            value={species}
            onChange={setSpecies}
          />
          {kind === "nhamay" && (
            <SellField
              label="Website"
              value={website}
              onChange={setWebsite}
            />
          )}
        </div>
        {msg && (
          <p className="mt-2 text-[0.875rem] font-semibold text-danger">{msg}</p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[3rem] rounded-full bg-field text-[1rem] font-bold text-foreground/70"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="min-h-[3rem] rounded-xl bg-sea text-[1rem] font-bold text-white disabled:opacity-50"
          >
            {busy ? "Đang lưu…" : "Lưu lại"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SellField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[0.8125rem] font-semibold text-foreground/70">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-[0.9375rem]"
      />
    </label>
  );
}

function InquiriesTab() {
  const [status, setStatus] = useState<InquiryStatusFilter>("moi");
  const [rows, setRows] = useState<InquiryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<InquiryRow | null>(null);

  const load = useCallback(() => {
    setError(null);
    setRows(null);
    fetch(apiUrl(`/api/admin/product-inquiries?status=${status}`))
      .then(async (r) => {
        const j = (await r.json()) as {
          ok: boolean;
          code?: string;
          inquiries?: InquiryRow[];
        };
        if (!j.ok) throw new Error(j.code ?? "load");
        setRows(j.inquiries ?? []);
      })
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Chưa cấu hình Supabase/service-role — yêu cầu cần DB thật."
            : "Chưa tải được danh sách — thử lại.",
        ),
      );
  }, [status]);
  useEffect(load, [load]);

  async function setInquiryStatus(row: InquiryRow, next: InquiryStatus) {
    setBusyId(row.id);
    const r = await fetch(apiUrl("/api/admin/product-inquiries"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: row.id, status: next }),
    }).catch(() => null);
    setBusyId(null);
    if (!r?.ok) {
      setError("Đổi trạng thái chưa được — thử lại.");
      return;
    }
    load();
  }

  async function remove(row: InquiryRow) {
    setBusyId(row.id);
    const r = await fetch(
      apiUrl(`/api/admin/product-inquiries?id=${encodeURIComponent(row.id)}`),
      { method: "DELETE" },
    ).catch(() => null);
    setBusyId(null);
    if (!r?.ok) {
      setError("Xóa chưa được — thử lại.");
      return;
    }
    load();
  }

  const chip = (id: InquiryStatusFilter, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setStatus(id)}
      aria-pressed={status === id}
      className={`min-h-[2.5rem] shrink-0 rounded-full px-4 text-[0.875rem] font-bold transition ${
        status === id ? "bg-navy text-white" : "bg-field text-foreground/70"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-4 space-y-4">
      <p className="surface px-4 py-3 text-[0.875rem] leading-snug text-foreground/70">
        Yêu cầu &ldquo;Để lại yêu cầu&rdquo; bà con gửi từ danh mục sản phẩm — chủ yếu sản
        phẩm của <b>đơn vị ngoài SDWork</b> (hàng SDVICO vẫn đi qua hộp tư vấn
        CRM như cũ, không hiện ở đây).
      </p>

      <div className="flex flex-wrap gap-1.5">
        {chip("moi", "Mới")}
        {chip("da_lien_he", "Đã liên hệ")}
        {chip("xong", "Xong")}
        {chip("all", "Tất cả")}
      </div>

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
      {!rows && !error && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Đang tải…
        </p>
      )}
      {rows && rows.length === 0 && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Không có yêu cầu nào ở mục này.
        </p>
      )}

      {rows && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((row) => {
            const badge = INQUIRY_STATUS_BADGE[row.status] ?? INQUIRY_STATUS_BADGE.moi;
            return (
              <li key={row.id} className="surface overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-4 pt-3">
                  <div className="min-w-0">
                    <p className="text-[1rem] font-bold text-navy">
                      {row.listingTitle ?? "Sản phẩm không rõ"}
                    </p>
                    <p className="mt-0.5 text-[0.8125rem] tabular-nums text-foreground/70">
                      SĐT {row.customerPhone}
                      {row.customerName ? ` · ${row.customerName}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[0.75rem] font-bold ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                </div>
                {row.message && (
                  <p className="px-4 pt-2 text-[0.9375rem] leading-snug text-foreground/80">
                    {row.message}
                  </p>
                )}
                <p className="px-4 pt-2 text-[0.8125rem] text-foreground/55">
                  gửi {fmtDT(row.createdAt)}
                  {row.handledBy &&
                    ` · xử lý bởi ${row.handledBy} ${fmtDT(row.handledAt)}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line px-4 py-2.5">
                  {row.status !== "da_lien_he" && (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => setInquiryStatus(row, "da_lien_he")}
                      className="min-h-[2.5rem] flex-1 rounded-lg bg-sea/15 px-3 text-[0.8125rem] font-bold text-sea disabled:opacity-50"
                    >
                      Đã liên hệ
                    </button>
                  )}
                  {row.status !== "xong" && (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => setInquiryStatus(row, "xong")}
                      className="min-h-[2.5rem] flex-1 rounded-lg bg-navy px-3 text-[0.8125rem] font-bold text-white disabled:opacity-50"
                    >
                      Đánh dấu xong
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => setToDelete(row)}
                    className="min-h-[2.5rem] shrink-0 rounded-lg bg-danger-bg px-3 text-[0.8125rem] font-bold text-danger disabled:opacity-50"
                  >
                    Xóa
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Xóa yêu cầu này?"
          message="Xóa hẳn khỏi danh sách. Không hoàn tác được."
          confirmLabel="Xóa luôn"
          cancelLabel="Không"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            const row = toDelete;
            setToDelete(null);
            remove(row);
          }}
        />
      )}
    </div>
  );
}

/* ── THÔNG BÁO (Web Push per-user/broadcast, Phase 3) ─────────────────────
   Gửi qua PWA service worker (public/sw.js) — không cần app store update.
   Người dùng phải tự bấm "Bật thông báo" trong sheet Tài khoản trước. */

type PushStats = {
  configured: boolean;
  total: number;
  named: number;
  anonymous: number;
};

function PushNotificationsTab() {
  const [stats, setStats] = useState<PushStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<"all" | "phone">("all");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetch(apiUrl("/api/admin/push"))
      .then(async (r) => {
        const j = (await r.json()) as { ok: boolean; code?: string } & Partial<PushStats>;
        if (!j.ok) throw new Error(j.code ?? "load");
        setStats({
          configured: Boolean(j.configured),
          total: j.total ?? 0,
          named: j.named ?? 0,
          anonymous: j.anonymous ?? 0,
        });
      })
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Chưa cấu hình Supabase/service-role."
            : "Chưa tải được thống kê — thử lại.",
        ),
      );
  }, []);
  useEffect(load, [load]);

  async function send() {
    setBusy(true);
    setResult(null);
    const r = await fetch(apiUrl("/api/admin/push"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target,
        phone: target === "phone" ? phone.trim() : undefined,
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || undefined,
      }),
    }).catch(() => null);
    setBusy(false);
    const j = (await r?.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
      sent?: number;
      failed?: number;
      cleaned?: number;
    } | null;
    if (!r?.ok || !j?.ok) {
      setResult(
        j?.code === "vapid_not_configured"
          ? "Máy chủ chưa cấu hình VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT."
          : j?.code === "missing_content"
            ? "Nhập đủ tiêu đề + nội dung."
            : j?.code === "missing_phone"
              ? "Nhập SĐT khi gửi theo từng người."
              : "Gửi chưa được — thử lại.",
      );
      return;
    }
    setResult(
      `Đã gửi ${j.sent} máy${j.failed ? ` · lỗi ${j.failed}` : ""}${j.cleaned ? ` · dọn ${j.cleaned} đăng ký chết` : ""}.`,
    );
    setTitle("");
    setBody("");
    setUrl("");
    load();
  }

  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (target === "all" || phone.trim().length > 0);

  return (
    <div className="mt-4 space-y-4">
      <p className="surface px-4 py-3 text-[0.875rem] leading-snug text-foreground/70">
        Gửi thông báo cho từng người (theo SĐT) hoặc toàn bộ người đã bấm{" "}
        <b>&ldquo;Bật thông báo&rdquo;</b> trong app (sheet Tài khoản). Không cần cập
        nhật app.
      </p>

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

      {stats && (
        <div className="grid grid-cols-3 gap-2.5">
          {(
            [
              ["Tổng đã đăng ký", stats.total],
              ["Có SĐT", stats.named],
              ["Ẩn danh", stats.anonymous],
            ] as [string, number][]
          ).map(([label, v]) => (
            <div key={label} className="surface px-3 py-3 text-center">
              <p className="display text-[1.5rem] font-bold tabular-nums text-navy">
                {v}
              </p>
              <p className="text-[0.8125rem] font-semibold text-foreground/65">
                {label}
              </p>
            </div>
          ))}
        </div>
      )}
      {stats && !stats.configured && (
        <p className="surface px-4 py-3 text-[0.875rem] font-semibold text-danger">
          Chưa cấu hình khoá VAPID. Dán 3 khoá ngay trong tab{" "}
          <span className="underline">Hệ thống → Cấu hình ứng dụng</span> (lưu
          vào DB, áp dụng ngay, KHÔNG cần env Vercel / redeploy). Tạo khoá bằng:
          npx web-push generate-vapid-keys.
        </p>
      )}

      <div className="surface space-y-2.5 px-4 py-3.5">
        <div
          className="grid grid-cols-2 gap-1.5"
          role="group"
          aria-label="Gửi cho ai"
        >
          {(
            [
              ["all", "Toàn bộ"],
              ["phone", "Một người (SĐT)"],
            ] as ["all" | "phone", string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTarget(id)}
              aria-pressed={target === id}
              className={`min-h-[2.75rem] rounded-xl px-3 text-[0.875rem] font-bold transition ${
                target === id
                  ? "bg-navy text-white shadow-sm"
                  : "bg-field text-foreground/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {target === "phone" && (
          <input
            inputMode="tel"
            placeholder="SĐT người nhận (0901234567)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-3 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
          />
        )}
        <input
          placeholder="Tiêu đề"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-3 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        />
        <textarea
          placeholder="Nội dung"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          className="min-h-[3.5rem] w-full rounded-xl border-0 bg-field px-3 py-2 text-[0.875rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        />
        <input
          placeholder="Mở trang nào khi bấm vào (tuỳ chọn, VD /tien)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-3 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        />
        <button
          type="button"
          disabled={!canSend || busy || (stats ? !stats.configured : false)}
          onClick={() => setConfirmSend(true)}
          className="min-h-[2.75rem] w-full rounded-xl bg-trim text-[0.9375rem] font-bold text-white disabled:opacity-50"
        >
          {busy ? "Đang gửi…" : "Gửi thông báo"}
        </button>
        {result && (
          <p className="text-[0.875rem] font-semibold text-foreground/75">
            {result}
          </p>
        )}
      </div>

      {confirmSend && (
        <ConfirmDialog
          title={
            target === "all"
              ? "Gửi cho TOÀN BỘ người đã bật thông báo?"
              : `Gửi cho SĐT ${phone.trim()}?`
          }
          message={`"${title.trim()}" — ${body.trim()}`}
          confirmLabel="Gửi ngay"
          cancelLabel="Không"
          danger={target === "all"}
          onCancel={() => setConfirmSend(false)}
          onConfirm={() => {
            setConfirmSend(false);
            send();
          }}
        />
      )}
    </div>
  );
}

/* ── DỮ LIỆU ───────────────────────────────────────────────────────────── */

/** Sức khoẻ cron + precompute từ /api/admin/crons */
type CronsReport = {
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

function CronRow({
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

function CronsPanel() {
  const [report, setReport] = useState<CronsReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/admin/crons"))
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
    if (!report) return { state: "loading", note: "đang kiểm tra…" };
    if (!t) return { state: "down", note: "không có dữ liệu trả về" };
    if (!t.ok) return { state: "down", note: `lỗi truy vấn: ${t.error}` };
    const base = t.latest
      ? `bản ${fmtD(t.latest)} · ${t.rows} dòng`
      : "chưa có bản nào";
    if (t.fresh === null)
      return { state: "neutral", note: `${base}${noteWhenNeutral ? ` — ${noteWhenNeutral}` : ""}` };
    return t.fresh
      ? { state: "ok", note: `${base} — đúng nhịp ngày` }
      : {
          state: "down",
          note: `${base} — TRỄ (không có bản hôm nay/hôm qua): collector ngoài repo có thể đã đứng`,
        };
  };

  const seaR = dailyRow("sea_daily", "");
  const fdR = dailyRow("fish_forecast_daily", "");
  const stR = dailyRow("storm_events", "", "chỉ ghi khi có bão/ATNĐ — không tính trễ");

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
          label="Snapshot dự báo cá — cron refresh-fish (Vercel 02:00 UTC/ngày + GitHub Actions 6h/lần)"
          note={
            !report
              ? "đang kiểm tra…"
              : !f || !f.ok
                ? `lỗi truy vấn: ${!f ? "?" : (f as { error: string }).error}`
                : !f.exists
                  ? "CHƯA CÓ snapshot nào — cron chưa chạy lần nào (migration 0005 đã apply chưa?)"
                  : `tính lúc ${fmtDT(f.generatedAt)} · ảnh vệ tinh ${fmtD(f.targetDate)} · chất lượng ${f.dataQuality != null ? Math.round(f.dataQuality * 100) + "%" : "—"}${
                      f.fresh
                        ? " — đang tươi"
                        : " — QUÁ 30 GIỜ: cron đứng, app đang tự tính live (chậm hơn); kiểm tra Vercel Cron + GitHub Actions"
                    }`
          }
        />
        <CronRow
          state={
            !report ? "loading" : !w || !w.ok ? "down" : w.keys === 0 ? "down" : w.fresh ? "ok" : "down"
          }
          label="Snapshot thời tiết — cron refresh-weather (Vercel 02:30 UTC/ngày, lưới an toàn khi Open-Meteo lỗi)"
          note={
            !report
              ? "đang kiểm tra…"
              : !w || !w.ok
                ? `lỗi truy vấn: ${!w ? "?" : (w as { error: string }).error}`
                : w.keys === 0
                  ? "CHƯA CÓ khoá nào — cron chưa chạy lần nào"
                  : `${w.keys} khoá (10 cảng + lưới) · mới nhất ${fmtDT(w.newest)}${
                      w.fresh ? " — đang tươi" : " — QUÁ 30 GIỜ: cron đứng"
                    }${
                      w.staleKeys && w.staleKeys.length > 0 && w.fresh
                        ? ` · ${w.staleKeys.length} khoá bị bỏ rơi: ${w.staleKeys.join(", ")}`
                        : ""
                    }`
          }
        />
        <CronRow
          state={seaR.state}
          label="sea_daily — collector dự báo biển theo ngày (NGOÀI repo)"
          note={seaR.note}
        />
        <CronRow
          state={fdR.state}
          label="fish_forecast_daily — collector bản đồ cá theo ngày (NGOÀI repo)"
          note={fdR.note}
        />
        <CronRow
          state={stR.state}
          label="storm_events — collector tin bão (NGOÀI repo)"
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

// Cấu hình ứng dụng lưu DB (app_config) — thay lệ thuộc env máy chủ deploy.
type ConfigRow = {
  key: string;
  label: string;
  secret: boolean;
  help?: string;
  source: "db" | "env" | "none";
  set: boolean;
  value: string | null;
};

function AppConfigCard() {
  const [rows, setRows] = useState<ConfigRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetch(apiUrl("/api/admin/app-config"))
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
            ? "Chỉ admin xem/sửa được cấu hình."
            : "Chưa tải được cấu hình — thử lại.",
        ),
      );
  }, []);
  useEffect(load, [load]);

  async function save(key: string) {
    const value = drafts[key] ?? "";
    if (!value.trim()) return;
    setBusy(key);
    setSaved(null);
    try {
      const r = await fetch(apiUrl("/api/admin/app-config"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const j = (await r.json()) as { ok: boolean };
      if (!j.ok) throw new Error();
      setDrafts((d) => ({ ...d, [key]: "" }));
      setSaved(key);
      load();
    } catch {
      setError("Không lưu được — thử lại.");
    } finally {
      setBusy(null);
    }
  }

  const badge = (s: ConfigRow["source"]) =>
    s === "db"
      ? { t: "DB ✓", c: "bg-ok-bg text-ok" }
      : s === "env"
        ? { t: "env (host)", c: "bg-field text-foreground/70" }
        : { t: "chưa đặt", c: "bg-danger-bg text-danger" };

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
        <p className="mt-2 text-[0.875rem] text-foreground/60">Đang tải…</p>
      )}
      <div className="mt-3 space-y-3">
        {rows?.map((row) => {
          const b = badge(row.source);
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
                  value={drafts[row.key] ?? ""}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [row.key]: e.target.value }))
                  }
                  placeholder={
                    row.source === "none"
                      ? "Dán giá trị…"
                      : "Dán giá trị mới để thay…"
                  }
                  className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-[0.875rem]"
                />
                <button
                  type="button"
                  disabled={busy === row.key || !(drafts[row.key] ?? "").trim()}
                  onClick={() => save(row.key)}
                  className="shrink-0 rounded-lg bg-sea px-4 py-2 text-[0.875rem] font-bold text-white disabled:opacity-50"
                >
                  {busy === row.key
                    ? "Đang lưu…"
                    : saved === row.key
                      ? "Đã lưu ✓"
                      : "Lưu"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SystemTab({ health }: { health: Health }) {
  const env = health.env;
  const db = health.db;

  return (
    <div className="mt-4 space-y-4">
      <AppConfigCard />
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
