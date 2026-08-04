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
import {
  usageStage,
  USAGE_STAGE_LABEL,
  type UsageStage,
} from "@/lib/app-usage";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatCccd, isValidCccd } from "@/lib/crew";
import { isValidVnPhone, phoneToEmail, sanitizePhoneInput } from "@/lib/phone";
import {
  crewReportCategoryLabel,
  CREW_REPORT_CATEGORIES,
  CREW_REPORT_CATEGORY_LABELS,
  type CrewReportCategory,
} from "@/lib/crew-report";
import {
  ACTION_LABEL,
  MANAGER_TABS,
  PERM_ACTIONS,
  TAB_LABEL,
  visibleTabs,
  type ManagerTab,
  type StaffPermissions,
  type TabPerms,
} from "@/lib/staff-permissions";
import {
  ADMIN_ACTIONS,
  actionLabel,
  isDangerAction,
} from "@/lib/admin-activity";

type Tab =
  | "tai-khoan"
  | "canh-bao"
  | "san-pham"
  | "yeu-cau"
  | "vung-bien"
  | "cho-ban"
  | "thong-bao"
  | "du-lieu"
  | "he-thong"
  | "phan-quyen"
  | "nhat-ky";

/** Vai trò staff — admin (env) toàn quyền; quản lý (DB) theo bảng phân quyền */
type StaffRole = "admin" | "manager";

/** Người đang đăng nhập trang quản trị. permissions=null khi admin (toàn quyền). */
type Me = { phone: string; role: StaffRole; permissions: StaffPermissions | null };

const ADMIN_ALL: TabPerms = { view: true, create: true, edit: true, delete: true };
const NONE: TabPerms = { view: false, create: false, edit: false, delete: false };

/** Quyền của người đang đăng nhập trên một tab (admin = toàn quyền mọi tab). */
function permsFor(me: Me, tab: ManagerTab): TabPerms {
  if (me.role === "admin") return ADMIN_ALL;
  return me.permissions?.[tab] ?? NONE;
}

type Health = {
  ok: boolean;
  code?: string;
  me?: { phone: string; role: StaffRole; permissions: StaffPermissions | null };
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
  /** QUẢN TRỊ VIÊN thật (SĐT trong env ADMIN_PHONES) — KHÁC cột `role` trong
   *  DB: role='admin' trong DB không có tác dụng gì, chỉ 'manager' mới được
   *  code đọc. Xem badge ở danh sách tài khoản. */
  isAdmin: boolean;
  fromSdwork: boolean;
  updatedAt: string | null;
  canLogin: boolean;
  // NV2 (ba-spec 10) — chip chăm khách staff bấm tay + trạng thái thu tiền
  premiumUsed: boolean;
  contacted: boolean;
  payment: { code: string; reconciledStatus: string } | null;
  // ghi chú theo dõi onboarding của staff (migration 0018)
  staffUsed: boolean;
  staffGuided: boolean;
  noteBy: string | null;
  noteAt: string | null;
  /* ĐO THẬT việc dùng app (migration 0021) — KHÁC chip staff tự tick ở trên:
     cái này máy tự báo, cái kia là niềm tin của nhân viên. */
  pwaLastOpenAt: string | null;
  webLastOpenAt: string | null;
  offlineReadyAt: string | null;
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

  const loadHealth = useCallback(() => {
    setHealth(null);
    setHealthErr(null);
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
  useEffect(loadHealth, [loadHealth]);

  async function logout() {
    const supabase = createClient();
    await supabase?.auth.signOut();
    // Ở LẠI /quan-tri và hiện form đăng nhập quản trị ngay tại đây — KHÔNG đá
    // sang /login của app khách (user 2026-07-31).
    setHealth(null);
    setHealthErr(401);
    router.refresh();
  }

  // ── CHƯA ĐĂNG NHẬP → đăng nhập THẲNG tại /quan-tri, không chuyển trang ───
  if (healthErr === 401) {
    return <AdminLogin onLoggedIn={loadHealth} />;
  }

  // ── đã đăng nhập nhưng chưa đủ quyền / hệ thống lỗi — nói rõ vì sao ──────
  if (healthErr != null) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-16 text-center">
        <h1 className="display text-[1.5rem] font-bold text-navy">
          Trang quản trị SDFish
        </h1>
        <p className="mt-3 text-[1.0625rem] leading-snug text-foreground/70">
          {healthErr === 403 &&
            "Tài khoản đang đăng nhập không có quyền quản trị (không phải admin, cũng chưa được gán làm tài khoản quản lý)."}
          {healthErr === 503 &&
            "Hệ thống chưa cấu hình Supabase — trang quản trị cần DB thật, không chạy ở demo mode."}
          {healthErr === 0 && "Không gọi được máy chủ — kiểm tra mạng rồi tải lại."}
        </p>
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

  const me: Me = {
    phone: health.me?.phone ?? "",
    role: health.me?.role ?? "admin",
    permissions: health.me?.permissions ?? null,
  };
  const isAdmin = me.role === "admin";

  // TAB được thấy: admin = 9 tab nghiệp vụ + Phân quyền; quản lý = chỉ các tab
  // có cờ view trong bảng quyền (4 tab admin-only cứng không bao giờ hiện).
  const tabs: [Tab, string][] = isAdmin
    ? [
        ["tai-khoan", "Tài khoản"],
        ["canh-bao", "Thuyền viên"],
        ["san-pham", "Sản phẩm"],
        ["yeu-cau", "Yêu cầu"],
        ["vung-bien", "Vùng biển"],
        ["cho-ban", "Chỗ bán"],
        ["thong-bao", "Thông báo"],
        ["du-lieu", "Dữ liệu"],
        ["he-thong", "Hệ thống"],
        ["phan-quyen", "Phân quyền"],
        ["nhat-ky", "Nhật ký"],
      ]
    : visibleTabs(me.permissions).map((t) => [t, TAB_LABEL[t]] as [Tab, string]);

  // Tab đang chọn không nằm trong danh sách được phép → về tab đầu (quản lý bị
  // thu quyền giữa chừng vẫn không kẹt ở tab trống).
  const activeTab = tabs.some(([id]) => id === tab) ? tab : (tabs[0]?.[0] ?? tab);

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-6 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Logo CHUNG với app ngư dân (bộ icon PWA sinh từ image/logo sdfish.png) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt="SDFish"
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-xl border border-line"
          />
          <div>
            <h1 className="display text-[1.5rem] font-bold leading-tight text-navy md:text-[1.75rem]">
              SDFish Quản trị
            </h1>
            <p className="mt-0.5 text-[0.9375rem] text-foreground/65">
              {isAdmin
                ? "Quản trị viên · toàn quyền"
                : `Quản lý · ${me.phone}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="min-h-[2.5rem] shrink-0 rounded-xl bg-field px-4 text-[0.875rem] font-bold text-navy"
        >
          Đăng xuất
        </button>
      </div>

      {/* Thanh tab cuộn ngang (pattern ui/tabs.tsx) — nhãn 1 dòng (nowrap).
          Danh sách `tabs` đã tính theo vai (admin thấy đủ, quản lý theo bảng
          phân quyền) ở trên. */}
      <div
        className="mt-4 flex gap-1.5 overflow-x-auto border-b border-line pb-2"
        role="tablist"
      >
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setTab(id)}
            className={`min-h-[2.75rem] shrink-0 whitespace-nowrap rounded-xl px-4 text-[0.9375rem] font-bold transition ${
              activeTab === id
                ? "bg-navy text-white shadow-sm"
                : "bg-field text-foreground/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "tai-khoan" && <AccountsTab me={me} />}
      {activeTab === "canh-bao" && (
        <CrewReportsTab perms={permsFor(me, "canh-bao")} />
      )}
      {activeTab === "san-pham" && (
        <ProductsTab perms={permsFor(me, "san-pham")} />
      )}
      {activeTab === "yeu-cau" && isAdmin && <InquiriesTab />}
      {activeTab === "vung-bien" && isAdmin && <VmsZonesTab />}
      {activeTab === "cho-ban" && (
        <SellContactsTab perms={permsFor(me, "cho-ban")} />
      )}
      {activeTab === "thong-bao" && (
        <PushNotificationsTab perms={permsFor(me, "thong-bao")} />
      )}
      {activeTab === "du-lieu" && isAdmin && <DataTab />}
      {activeTab === "he-thong" && isAdmin && <SystemTab health={health} />}
      {activeTab === "phan-quyen" && isAdmin && <PermissionsTab />}
      {activeTab === "nhat-ky" && isAdmin && <ActivityLogTab />}
    </div>
  );
}

/* ── ĐĂNG NHẬP TẠI CHỖ ───────────────────────────────────────────────────── */

/**
 * Form đăng nhập NGAY TRÊN /quan-tri (user 2026-07-31: trước đây bị đá sang
 * /login của app ngư dân, vào xong rơi về trang chủ app, phải gõ lại địa chỉ
 * trang quản trị).
 *
 * KHÔNG mở thêm cửa nào: vẫn là tài khoản Supabase chung, vẫn giữ luật 1 tài
 * khoản = 1 máy như /login. Quyền THẬT do /api/admin/* chốt (requireAdmin /
 * requirePermission) — đăng nhập xong mà không phải staff thì health trả 403
 * và màn dưới hiện "không có quyền quản trị".
 */
function AdminLogin({ onLoggedIn }: { onLoggedIn: () => void }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidVnPhone(phone)) {
      setError("Số điện thoại chưa hợp lệ.");
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError(
        "Máy chủ chưa cấu hình Supabase — trang quản trị cần DB thật, không chạy ở demo mode.",
      );
      return;
    }
    setBusy(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(phone),
      password,
    });
    if (signInError || !data.user) {
      setBusy(false);
      setError("Sai số điện thoại hoặc mật khẩu.");
      return;
    }
    // 1 TÀI KHOẢN = 1 MÁY — giữ ĐÚNG luật của /login, không nới riêng cho
    // trang quản trị. Thu hồi hỏng thì bỏ qua, phiên máy này vẫn hợp lệ.
    try {
      await supabase.auth.signOut({ scope: "others" });
    } catch {
      /* mạng chập chờn — không chặn đăng nhập */
    }
    // tài khoản còn mật khẩu tạm: bắt đổi trước (đổi xong app trả về trang chủ,
    // quay lại /quan-tri là vào thẳng)
    if (data.user.user_metadata?.must_change_password === true) {
      router.push("/doi-mat-khau");
      return;
    }
    setBusy(false);
    onLoggedIn(); // gọi lại /api/admin/health — đủ quyền là vào thẳng bảng điều khiển
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[420px] flex-col justify-center px-4 py-10">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt="SDFish"
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 rounded-xl border border-line"
        />
        <div>
          <h1 className="display text-[1.5rem] font-bold leading-tight text-navy">
            SDFish Quản trị
          </h1>
          <p className="mt-0.5 text-[0.9375rem] text-foreground/65">
            Dành cho nhân viên SDVICO
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="surface mt-5 space-y-3 px-4 py-4">
        {error && (
          <p
            role="alert"
            className="rounded-xl px-3.5 py-3 text-[0.9375rem] font-semibold leading-snug"
            style={{ color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
          >
            {error}
          </p>
        )}
        <label className="block">
          <span className="mb-1 block text-[0.875rem] font-bold text-navy">
            Số điện thoại
          </span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="username"
            required
            autoFocus
            placeholder="0901 234 567"
            value={phone}
            onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
            className="min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-3 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.875rem] font-bold text-navy">
            Mật khẩu
          </span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-3 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="min-h-[2.75rem] w-full rounded-xl bg-trim text-[0.9375rem] font-bold text-white disabled:opacity-50"
        >
          {busy ? "Đang vào…" : "Đăng nhập"}
        </button>
      </form>

      <p className="mt-3 px-1 text-[0.875rem] leading-snug text-foreground/60">
        Chỉ tài khoản quản trị viên hoặc quản lý được vào đây. Quên mật khẩu thì
        báo quản trị viên đặt lại giúp.
      </p>
    </div>
  );
}

/* ── TÀI KHOẢN ─────────────────────────────────────────────────────────── */

type TierFilter = "all" | "premium" | "basic";

function AccountsTab({ me }: { me: Me }) {
  const isAdmin = me.role === "admin";
  // Quyền trên tab Tài khoản: create=tạo khách · edit=cấp/gia hạn premium ·
  // delete=xoá tài khoản. Hạ hạng + đặt-lại-mật-khẩu vẫn ADMIN-ONLY cứng.
  const perms = permsFor(me, "tai-khoan");
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [grantStats, setGrantStats] = useState<GrantStat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyPhone, setBusyPhone] = useState<string | null>(null);
  // tìm kiếm + lọc hạng (client-side — vài trăm hàng, không cần server)
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  // Tab này là của NGƯỜI DÙNG APP (user 2026-07-31) → mặc định chỉ hiện khách;
  // nhân sự (quản lý/quản trị viên) vẫn xem được bằng chip, vì đôi khi cần đặt
  // lại mật khẩu hoặc cấp premium cho chính họ.
  const [roleFilter, setRoleFilter] = useState<"khach" | "nhan-su">("khach");
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
  // NV3 — ghi thu tiền: khách đang nhập mã + nội dung ô mã CK
  const [toPay, setToPay] = useState<Account | null>(null);
  const [payCode, setPayCode] = useState("");
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

  /** nhân sự = có quyền vào web quản trị (KHÁC hạng premium — hai trục rời) */
  const isStaff = useCallback(
    (a: Account) => a.isAdmin || a.role === "manager",
    [],
  );

  /** khớp tìm kiếm + lọc hạng, CHƯA xét vai */
  const matched = useMemo(() => {
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

  const visible = useMemo(
    () =>
      matched?.filter((a) =>
        roleFilter === "nhan-su" ? isStaff(a) : !isStaff(a),
      ) ?? null,
    [matched, roleFilter, isStaff],
  );

  /** đang xem Khách mà tìm trúng nhân sự → mách một câu, đừng để tưởng mất */
  const hiddenStaff = useMemo(
    () =>
      roleFilter === "khach" && matched
        ? matched.filter(isStaff).length
        : 0,
    [matched, roleFilter, isStaff],
  );

  /** grant = kích hoạt/gia hạn 1 năm 6 tháng (server tự tính hạn + ghi log);
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
  async function setCareFlag(a: Account, flag: "premium_used" | "contacted") {
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

  /** NV3 (ba-spec 10) — ghi thu tiền bằng MÃ CK (chỉ mã, không số tiền).
   *  reconciled_status='pending' chờ SDWork đối chiếu (NV4/NV5). */
  async function recordPayment(a: Account, code: string) {
    setBusyPhone(a.phone);
    setError(null);
    setNotice(null);
    const r = await fetch(apiUrl("/api/admin/accounts"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: a.phone, action: "record_payment", code }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
    } | null;
    setBusyPhone(null);
    if (!r?.ok || !j?.ok) {
      setError(
        j?.code === "bad_code"
          ? "Nhập mã chuyển khoản."
          : j?.code === "not_your_customer"
            ? "Chỉ ghi thu tiền cho khách của bạn."
            : "Ghi thu tiền chưa được — thử lại.",
      );
      return;
    }
    setNotice(
      `Đã ghi mã CK cho ${a.phone} — chờ đối chiếu (xem biến động số dư SDWork rồi bấm "Đã đối chiếu").`,
    );
    load();
  }

  /** Đối chiếu THỦ CÔNG (admin) — sau khi xem biến động số dư SDWork thấy tiền
   *  vào (mã = SĐT khách), bấm để đánh dấu payment 'pending' → 'reconciled'. */
  async function reconcilePayment(a: Account) {
    setBusyPhone(a.phone);
    setError(null);
    setNotice(null);
    const r = await fetch(apiUrl("/api/admin/accounts"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: a.phone, action: "reconcile_payment" }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
    } | null;
    setBusyPhone(null);
    if (!r?.ok || !j?.ok) {
      setError(
        j?.code === "no_pending_payment"
          ? "Khách này không có khoản nào đang chờ đối chiếu."
          : "Đối chiếu chưa được — thử lại.",
      );
      return;
    }
    setNotice(`Đã đối chiếu khoản thu của ${a.phone}.`);
    load();
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

  /** Ghi chú theo dõi onboarding (đã/chưa sử dụng · đã/chưa hướng dẫn trực
   *  tiếp). Cập nhật NGAY trên màn (optimistic), hỏng thì tải lại về đúng DB. */
  async function setFlag(a: Account, patch: { used?: boolean; guided?: boolean }) {
    setNotice(null);
    setAccounts((prev) =>
      prev
        ? prev.map((x) =>
            x.phone === a.phone
              ? {
                  ...x,
                  staffUsed: patch.used ?? x.staffUsed,
                  staffGuided: patch.guided ?? x.staffGuided,
                }
              : x,
          )
        : prev,
    );
    const r = await fetch(apiUrl("/api/admin/accounts"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: a.phone, action: "set-flags", ...patch }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { ok?: boolean } | null;
    if (!r?.ok || !j?.ok) {
      setError("Lưu ghi chú chưa được — thử lại.");
      load(); // trả màn về đúng trạng thái DB
    }
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

      {/* VAI: tab này của NGƯỜI DÙNG APP; nhân sự để riêng cho khỏi lẫn */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            ["khach", "Khách dùng app"],
            ["nhan-su", "Nhân sự quản trị"],
          ] as ["khach" | "nhan-su", string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setRoleFilter(id)}
            aria-pressed={roleFilter === id}
            className={`min-h-[2.5rem] shrink-0 rounded-full px-4 text-[0.875rem] font-bold transition ${
              roleFilter === id
                ? "bg-navy text-white"
                : "bg-field text-foreground/70"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="text-[0.8125rem] text-foreground/55">
          {roleFilter === "khach"
            ? "Tạo/phân quyền nhân sự làm ở tab Phân quyền"
            : "Chỉ để cấp premium / đặt lại mật khẩu cho nhân sự"}
        </span>
      </div>

      {hiddenStaff > 0 && (
        <p className="surface px-4 py-2.5 text-[0.875rem] text-foreground/70">
          Có <b>{hiddenStaff}</b> tài khoản <b>nhân sự</b> cũng khớp tìm kiếm —
          bấm <b>Nhân sự quản trị</b> để xem.
        </p>
      )}

      {/* Tạo KHÁCH (thường/premium) — cần cờ create. Tạo NHÂN SỰ (quản lý,
          quản trị viên) đã tách hẳn sang tab Phân quyền (user 2026-07-31: hai
          luồng lẫn vào nhau khó nhìn). */}
      {perms.create && <CreateAccountForm onCreated={load} />}

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
                    {/* VAI của người cấp — hỏi nhiều nhất ở chỗ này: thấy SĐT
                        lạ cấp premium mà không biết admin hay quản lý */}
                    {acc && <RoleBadge account={acc} />}
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
            {/* đếm theo ĐÚNG nhóm đang xem — trước so với tổng cả bảng nên
                lúc nào cũng ra "x/y khớp" dù không lọc gì */}
            {`${visible.length} ${roleFilter === "khach" ? "khách" : "nhân sự"}`}
            {visible.length !== (roleFilter === "khach"
              ? accounts.filter((a) => !isStaff(a)).length
              : accounts.filter(isStaff).length) &&
              ` khớp (trên ${
                roleFilter === "khach"
                  ? accounts.filter((a) => !isStaff(a)).length
                  : accounts.filter(isStaff).length
              })`}
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
                      {/* VAI: quản trị viên (env) > quản lý (DB role). Ghi rõ
                          để khỏi lẫn — xem RoleBadge. */}
                      <RoleBadge account={a} />
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
                        onClick={() => setCareFlag(a, "premium_used")}
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
                        onClick={() => setCareFlag(a, "contacted")}
                        aria-pressed={a.contacted}
                        className={`min-h-[2rem] rounded-full px-2.5 text-[0.75rem] font-bold transition ${
                          a.contacted
                            ? "bg-t1-bg text-t1"
                            : "bg-field text-foreground/55"
                        }`}
                      >
                        {a.contacted ? "✓ Đã liên hệ" : "Chưa liên hệ"}
                      </button>
                      {/* NV3 — trạng thái thu tiền + ghi mã CK */}
                      {a.payment ? (
                        <span
                          className={`inline-flex min-h-[2rem] items-center rounded-full px-2.5 text-[0.75rem] font-bold ${
                            a.payment.reconciledStatus === "reconciled"
                              ? "bg-ok-bg text-ok"
                              : "bg-warn-bg text-warn"
                          }`}
                          title={`Mã CK: ${a.payment.code}`}
                        >
                          {a.payment.reconciledStatus === "reconciled"
                            ? "✓ Đã thu · đối chiếu"
                            : "Đã thu · chờ đối chiếu"}
                        </span>
                      ) : (
                        <span className="inline-flex min-h-[2rem] items-center rounded-full bg-field px-2.5 text-[0.75rem] font-bold text-foreground/55">
                          Chưa thu
                        </span>
                      )}
                      {a.payment &&
                        a.payment.reconciledStatus !== "reconciled" &&
                        isAdmin && (
                          <button
                            type="button"
                            disabled={busyPhone === a.phone}
                            onClick={() => reconcilePayment(a)}
                            title="Đã xem biến động số dư SDWork thấy tiền vào → đánh dấu đối chiếu"
                            className="min-h-[2rem] rounded-full bg-ok-bg px-2.5 text-[0.75rem] font-bold text-ok disabled:opacity-50"
                          >
                            ✓ Đối chiếu
                          </button>
                        )}
                      <button
                        type="button"
                        disabled={busyPhone === a.phone}
                        onClick={() => {
                          setPayCode(a.phone);
                          setToPay(a);
                        }}
                        className="min-h-[2rem] rounded-full bg-navy px-2.5 text-[0.75rem] font-bold text-white disabled:opacity-50"
                      >
                        Ghi thu tiền
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
                    {perms.edit && (
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
                          ? "Gia hạn +1 năm 6 tháng"
                          : "Kích hoạt premium"}
                      </button>
                    )}
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
                    {perms.delete && (
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

                  {/* THEO DÕI onboarding (0018): đã/chưa sử dụng · đã/chưa
                      hướng dẫn trực tiếp. Sửa được khi có cờ edit; không thì
                      hiện trạng thái để xem. */}
                  <div className="mt-1 flex basis-full flex-wrap items-center gap-1.5">
                    <span className="text-[0.75rem] font-semibold text-foreground/50">
                      Hướng dẫn:
                    </span>
                    {/* BỎ chip "Đã/Chưa sử dụng" (2026-08-01, chủ dự án):
                        nó là nhân viên TỰ TICK để đoán khách có dùng app không
                        — nay máy TỰ BÁO (chip trạng thái bên dưới), đo thật
                        thay cho đoán. Giữ lại đúng chip "đã hướng dẫn": cái đó
                        ghi VIỆC NHÂN VIÊN ĐÃ LÀM, không phép đo nào thay được.
                        Cặp đọc rất gọn: đã hướng dẫn chưa (mình làm gì) ×
                        trạng thái đo được (khách làm được tới đâu). Cột
                        `staff_used` giữ nguyên trong DB, chỉ gỡ khỏi màn. */}
                    <FlagToggle
                      onLabel="Đã hướng dẫn trực tiếp"
                      offLabel="Chưa hướng dẫn trực tiếp"
                      value={a.staffGuided}
                      editable={perms.edit}
                      onToggle={() => setFlag(a, { guided: !a.staffGuided })}
                    />
                    {/* AI ghi chú — phải nói RÕ đây là SĐT NHÂN VIÊN.
                        Lỗi đã sửa (2026-08-01g): trước in trần "· 0938635689
                        13:20" ngay sát chip trạng thái máy khách ⇒ đọc dính
                        thành một cụm, tưởng khách có hai số điện thoại. */}
                    {a.noteBy && (
                      <span className="text-[0.75rem] text-foreground/45">
                        (nhân viên {a.noteBy} · {fmtDT(a.noteAt)})
                      </span>
                    )}
                  </div>

                  {/* MÁY KHÁCH — hàng RIÊNG, có nhãn: đây là thứ MÁY TỰ BÁO,
                      khác hẳn hàng "Hướng dẫn" bên trên (nhân viên tự tick). */}
                  <div className="mt-1 flex basis-full flex-wrap items-center gap-1.5">
                    <span className="text-[0.75rem] font-semibold text-foreground/50">
                      Máy khách:
                    </span>
                    <AppUsage a={a} />
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
              ? `Gia hạn premium +1 năm 6 tháng cho ${toGrant.a.phone}?`
              : `Kích hoạt premium 1 năm 6 tháng cho ${toGrant.a.phone}?`
          }
          message={`${toGrant.a.name ?? "Khách"} sẽ có premium đến ${fmtD(toGrant.until)}. Lần cấp này được ghi log dưới tên bạn.`}
          confirmLabel={toGrant.active ? "Gia hạn +1 năm 6 tháng" : "Kích hoạt 1 năm 6 tháng"}
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

      {/* NV3 — dialog nhập MÃ CK ghi thu tiền */}
      {toPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="surface w-full max-w-[420px] p-5">
            <p className="display text-[1.125rem] font-bold text-navy">
              Ghi thu tiền — {toPay.phone}
            </p>
            <p className="mt-1 text-[0.875rem] leading-snug text-foreground/70">
              Mã CK = <b>SĐT khách</b> (khách ghi SĐT vào nội dung chuyển khoản)
              — đã điền sẵn, sửa nếu khách ghi mã khác. Sau đó xem biến động số
              dư SDWork thấy tiền vào rồi bấm &quot;Đã đối chiếu&quot;.
            </p>
            <input
              autoFocus
              value={payCode}
              onChange={(e) => setPayCode(e.target.value)}
              placeholder="Mã CK = SĐT khách (vd 0912345678)"
              className="mt-3 min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-3 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setToPay(null)}
                className="min-h-[2.75rem] flex-1 rounded-xl bg-field text-[0.9375rem] font-bold text-foreground/70"
              >
                Không
              </button>
              <button
                type="button"
                disabled={!payCode.trim() || busyPhone === toPay.phone}
                onClick={() => {
                  const a = toPay;
                  const code = payCode.trim();
                  setToPay(null);
                  recordPayment(a, code);
                }}
                className="min-h-[2.75rem] flex-1 rounded-xl bg-trim text-[0.9375rem] font-bold text-white disabled:opacity-50"
              >
                Ghi thu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * VAI của một tài khoản — nói rõ ADMIN vs QUẢN LÝ cho khỏi lẫn (user
 * 2026-07-31: "nếu nó là admin thì cần biết nó là admin").
 *
 * Hai vai, theo đúng luật ở lib/admin-auth.ts:
 * · `isAdmin` — QUẢN TRỊ VIÊN, toàn quyền. Nguồn: env ADMIN_PHONES HOẶC
 *   customers.role='admin' (nâng/hạ ở tab Phân quyền).
 * · `role='manager'` → QUẢN LÝ, quyền theo bảng ở tab Phân quyền.
 */
function RoleBadge({ account }: { account: Account }) {
  if (account.isAdmin) {
    return (
      <span className="ml-2 rounded-full bg-navy px-2 py-0.5 text-[0.75rem] font-bold text-white">
        Quản trị viên
      </span>
    );
  }
  if (account.role === "manager") {
    return (
      <span className="ml-2 rounded-full bg-t1-bg px-2 py-0.5 text-[0.75rem] font-bold text-t1">
        Quản lý
      </span>
    );
  }
  return null;
}

/**
 * ĐO THẬT việc dùng app (0021) — máy tự báo, khác chip "đã sử dụng" nhân viên
 * tự tick ngay bên cạnh.
 *
 * Thứ đáng nhìn nhất KHÔNG phải "có mở app không" mà là **đã cài mà chưa bao
 * giờ mở BẢN CÀI**: trên iPhone, kho của bản Thêm-vào-Màn-hình-chính TÁCH RIÊNG
 * với Safari, nên nhóm đó tải đủ dữ liệu trong Safari rồi ra khơi với máy trắng
 * tay. Đây là danh sách để GỌI ĐIỆN NHẮC.
 */
function AppUsage({ a }: { a: Account }) {
  const stage = usageStage(a);
  const skin: Record<UsageStage, string> = {
    "chua-ghi-nhan": "bg-field text-foreground/50",
    "moi-vo-web": "bg-warn-bg text-warn",
    "da-mo-ban-cai": "bg-t1-bg text-t1",
    "du-do-di-bien": "bg-ok-bg text-ok",
  };
  const why: Record<UsageStage, string> = {
    "chua-ghi-nhan":
      "Máy chưa gửi nhịp nào. KHÔNG có nghĩa chưa dùng app: nhịp chỉ gửi khi ĐÃ ĐĂNG NHẬP + còn sóng, và chỉ ghi từ 01/08/2026.",
    "moi-vo-web":
      "Đã mở app trong trình duyệt nhưng CHƯA lần nào mở bản cài. Trên iPhone, bản Thêm-vào-Màn-hình-chính có kho RIÊNG — ra khơi là trắng tay. Gọi nhắc: mở icon vừa cài ngay khi còn sóng.",
    "da-mo-ban-cai":
      "Đã mở bản cài nhưng chưa lần nào tải xong đủ vỏ app + mọi lớp dữ liệu. Chỉ cần nhắc bấm tải lúc còn sóng.",
    "du-do-di-bien":
      "Máy đã báo: vỏ app đủ + mọi lớp dữ liệu đã tải, ĐO TRÊN ĐÚNG KHO sẽ dùng ngoài biển. Lưu ý: đây là mốc ĐÃ TỪNG đủ, không phải bây giờ còn đủ.",
  };
  const mocs = [
    a.offlineReadyAt ? `đủ đồ ${fmtDT(a.offlineReadyAt)}` : null,
    a.pwaLastOpenAt ? `bản cài ${fmtDT(a.pwaLastOpenAt)}` : null,
    a.webLastOpenAt ? `web ${fmtDT(a.webLastOpenAt)}` : null,
  ].filter(Boolean);
  return (
    <>
      <span
        title={why[stage]}
        className={`rounded-full px-2 py-0.5 text-[0.75rem] font-bold ${skin[stage]}`}
      >
        {USAGE_STAGE_LABEL[stage]}
      </span>
      {mocs.length > 0 && (
        <span className="text-[0.75rem] text-foreground/40">
          {mocs.join(" · ")}
        </span>
      )}
    </>
  );
}

/** Chip theo dõi 2 trạng thái (đã/chưa). Sửa được → nút bật/tắt; chỉ xem →
 *  badge tĩnh. Bật = xanh (bg-ok-bg), tắt = xám trung tính. */
function FlagToggle({
  onLabel,
  offLabel,
  value,
  editable,
  onToggle,
}: {
  onLabel: string;
  offLabel: string;
  value: boolean;
  editable: boolean;
  onToggle: () => void;
}) {
  const cls = value ? "bg-ok-bg text-ok" : "bg-field text-foreground/55";
  const label = value ? onLabel : offLabel;
  if (!editable) {
    return (
      <span
        className={`inline-flex min-h-[2rem] items-center rounded-full px-3 text-[0.75rem] font-bold ${cls}`}
      >
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={onToggle}
      className={`inline-flex min-h-[2rem] items-center rounded-full px-3 text-[0.75rem] font-bold transition ${cls}`}
    >
      {label}
    </button>
  );
}

/** Tạo tài khoản KHÁCH (người dùng app: thường hoặc premium). Nhân sự
 *  (quản lý / quản trị viên) tạo ở tab Phân quyền — xem CreateStaffForm. */
function CreateAccountForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
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
      // premium khi tạo = một lần KÍCH HOẠT chuẩn (1 năm 6 tháng, server tính hạn + log)
      body: JSON.stringify({
        phone,
        name,
        password,
        role: "customer",
        activatePremium,
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
        ? "Đã tạo. Báo người dùng đăng nhập bằng SĐT + mật khẩu tạm (lần đầu app bắt đổi)."
        : "Đã lưu nhưng TẠO ĐĂNG NHẬP LỖI — kiểm tra lại.",
    );
    setPhone("");
    setName("");
    setPassword("");
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
        Tạo tài khoản khách
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
          <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-2.5 rounded-xl bg-field px-3.5 text-[0.875rem] font-bold text-foreground/80 sm:col-span-2 lg:col-span-2">
            <input
              type="checkbox"
              checked={activatePremium}
              onChange={(e) => setActivatePremium(e.target.checked)}
              className="h-5 w-5 accent-[var(--ok)]"
            />
            Kích hoạt premium 1 năm 6 tháng ngay khi tạo
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

function CrewReportsTab({ perms }: { perms: TabPerms }) {
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

      {/* STAFF tự thêm thuyền viên có vấn đề → duyệt luôn (hiện ngay) — cần create */}
      {perms.create && <AddCrewReportForm onAdded={load} />}

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
              perms={perms}
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
  perms,
  onStatus,
  onRespond,
  onDelete,
}: {
  row: CrewReportRow;
  busy: boolean;
  perms: TabPerms;
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

      {/* phản hồi người bị ghi (admin thay mặt ghi, v1) — ghi = edit */}
      {perms.edit && (
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
      )}

      {(perms.edit || perms.delete) && (
      <div className="flex gap-1.5 border-t border-line px-4 py-2.5">
        {perms.edit && row.status === "pending" && (
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
        {perms.edit && row.status === "approved" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus("withdraw")}
            className="min-h-[2.5rem] flex-1 rounded-lg bg-danger-bg px-3 text-[0.8125rem] font-bold text-danger disabled:opacity-50"
          >
            Rút cảnh báo xuống
          </button>
        )}
        {perms.edit &&
          (row.status === "rejected" || row.status === "withdrawn") && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus("approve")}
              className="min-h-[2.5rem] flex-1 rounded-lg bg-navy px-3 text-[0.8125rem] font-bold text-white disabled:opacity-50"
            >
              Duyệt lại (cho hiện)
            </button>
          )}
        {perms.delete && (
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            title="Xóa hẳn khỏi danh sách"
            className="min-h-[2.5rem] shrink-0 rounded-lg bg-danger-bg px-3 text-[0.8125rem] font-bold text-danger disabled:opacity-50"
          >
            Xóa
          </button>
        )}
      </div>
      )}
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

function ProductsTab({ perms }: { perms: TabPerms }) {
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

      {perms.create && (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="min-h-[2.75rem] w-full rounded-xl bg-trim text-[0.9375rem] font-bold text-white sm:w-auto sm:px-6"
        >
          + Thêm sản phẩm
        </button>
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
                {perms.edit && (
                  <>
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
                  </>
                )}
                {perms.delete && (
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => setToDelete(row)}
                    className="min-h-[2.5rem] rounded-lg bg-danger-bg px-3 text-[0.8125rem] font-bold text-danger disabled:opacity-50"
                  >
                    Xóa
                  </button>
                )}
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

function SellContactsTab({ perms }: { perms: TabPerms }) {
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
        {perms.create && (
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
        )}
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
              {perms.edit && (
                <>
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
                </>
              )}
              {perms.delete && (
                <button
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => setToDelete(c)}
                  className="rounded-lg bg-danger-bg px-3 py-1.5 text-[0.8125rem] font-semibold text-danger"
                >
                  Xóa
                </button>
              )}
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

function PushNotificationsTab({ perms }: { perms: TabPerms }) {
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

      {perms.create ? (
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
      ) : (
        <p className="surface px-4 py-6 text-center text-[0.9375rem] text-foreground/65">
          Bạn chỉ có quyền xem thống kê thông báo. Cần quyền gửi thì báo quản trị
          viên bật thêm.
        </p>
      )}

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

/* ── PHÂN QUYỀN (admin-only) ───────────────────────────────────────────────
   Hai khối: (1) QUẢN TRỊ VIÊN toàn quyền — nâng/hạ ngay tại đây (nguồn DB
   role='admin'), riêng người từ env ADMIN_PHONES chỉ xem được vì web không
   sửa env; (2) bảng quyền từng tài khoản QUẢN LÝ: 5 tab × 4 hành động
   (Xem/Tạo mới/Sửa/Xóa). Chốt thật ở /api/admin/* (requireAdmin /
   requirePermission); màn này chỉ soạn cấu hình. */

type ManagerPerm = {
  phone: string;
  name: string | null;
  permissions: StaffPermissions;
  configured: boolean;
};

/** Một quản trị viên + NGUỒN quyền: 'db' hạ được ở đây, 'env' thì không. */
type AdminRow = { phone: string; name: string | null; source: "env" | "db" };

/**
 * Tạo tài khoản NHÂN SỰ (quản lý / quản trị viên) — tách hẳn khỏi form tạo
 * KHÁCH ở tab Tài khoản (user 2026-07-31: "tách hẳn luồng tạo quản trị viên và
 * user riêng ra cho đỡ lẫn"). Cùng gọi POST /api/admin/accounts (vẫn là một
 * hàng customers) nhưng server bắt ADMIN-ONLY khi role != 'customer'.
 * KHÔNG có ô premium: premium là HẠNG của người dùng app, không dính vai nhân
 * sự — cần thì cấp bên tab Tài khoản.
 */
function CreateStaffForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"manager" | "admin">("manager");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmAdmin, setConfirmAdmin] = useState(false);

  async function create() {
    setBusy(true);
    setMsg(null);
    const r = await fetch(apiUrl("/api/admin/accounts"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, name, password, role }),
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
            : j?.code === "admin_only"
              ? "Chỉ quản trị viên tạo được tài khoản nhân sự."
              : "Tạo chưa được — thử lại.",
      );
      return;
    }
    setMsg(
      j.provisioned
        ? `Đã tạo ${role === "admin" ? "quản trị viên" : "quản lý"} ${phone}. Báo họ đăng nhập bằng SĐT + mật khẩu tạm (lần đầu bắt đổi).`
        : "Đã lưu nhưng TẠO ĐĂNG NHẬP LỖI — kiểm tra lại.",
    );
    setPhone("");
    setName("");
    setPassword("");
    setRole("manager");
    onCreated();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // tạo QUẢN TRỊ VIÊN = trao toàn quyền ngay → hỏi lại một nhịp
    if (role === "admin") {
      setConfirmAdmin(true);
      return;
    }
    create();
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
        Tạo tài khoản nhân sự (quản lý / quản trị viên)
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <form
          onSubmit={submit}
          className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
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
            placeholder="Tên nhân sự (tuỳ chọn)"
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
          <div
            className="grid grid-cols-2 gap-1.5 sm:col-span-2 lg:col-span-2"
            role="group"
            aria-label="Vai"
          >
            {(
              [
                ["manager", "Quản lý — theo bảng quyền"],
                ["admin", "Quản trị viên — toàn quyền"],
              ] as ["manager" | "admin", string][]
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
          <button
            type="submit"
            disabled={busy}
            className="min-h-[2.75rem] rounded-xl bg-trim text-[0.9375rem] font-bold text-white disabled:opacity-50"
          >
            {busy ? "Đang tạo…" : "Tạo tài khoản"}
          </button>
          {msg && (
            <p className="text-[0.875rem] font-semibold text-foreground/75 sm:col-span-2 lg:col-span-3">
              {msg}
            </p>
          )}
        </form>
      )}

      {confirmAdmin && (
        <ConfirmDialog
          title={`Tạo ${phone} làm quản trị viên?`}
          message="Tài khoản mới sẽ TOÀN QUYỀN ngay: xóa tài khoản, đặt lại mật khẩu, đổi phân quyền, gửi thông báo… và tự tạo/nâng được quản trị viên khác. Nếu chỉ cần làm việc theo khu thì chọn Quản lý."
          confirmLabel="Tạo quản trị viên"
          cancelLabel="Không"
          danger
          onCancel={() => setConfirmAdmin(false)}
          onConfirm={() => {
            setConfirmAdmin(false);
            create();
          }}
        />
      )}
    </div>
  );
}

function PermissionsTab() {
  const [managers, setManagers] = useState<ManagerPerm[] | null>(null);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  // nâng/hạ quản trị viên
  const [roleMsg, setRoleMsg] = useState<string | null>(null);
  const [roleBusy, setRoleBusy] = useState(false);
  const [promotePhone, setPromotePhone] = useState("");
  const [toPromote, setToPromote] = useState<string | null>(null);
  const [toDemote, setToDemote] = useState<AdminRow | null>(null);

  const load = useCallback(() => {
    setError(null);
    setManagers(null);
    fetch(apiUrl("/api/admin/staff"))
      .then(async (r) => {
        const j = (await r.json()) as {
          ok: boolean;
          code?: string;
          managers?: ManagerPerm[];
          admins?: AdminRow[];
          migrationNeeded?: boolean;
        };
        if (!j.ok) throw new Error(j.code ?? "load");
        setManagers(j.managers ?? []);
        setAdmins(j.admins ?? []);
        setMigrationNeeded(Boolean(j.migrationNeeded));
      })
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Chưa cấu hình Supabase/service-role — phân quyền cần DB thật."
            : e.message === "admin_only"
              ? "Chỉ quản trị viên vào được mục Phân quyền."
              : "Chưa tải được danh sách quản lý — thử lại.",
        ),
      );
  }, []);
  useEffect(load, [load]);

  /** Nâng/hạ quản trị viên. Server chốt lại mọi luật (tự hạ mình · admin env ·
   *  người cuối cùng) — ở đây chỉ dịch mã lỗi ra tiếng người. */
  async function setRole(phone: string, role: "admin" | "manager") {
    setRoleBusy(true);
    setRoleMsg(null);
    const r = await fetch(apiUrl("/api/admin/staff"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "set-role", phone, role }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
    } | null;
    setRoleBusy(false);
    if (!r?.ok || !j?.ok) {
      const why: Record<string, string> = {
        self: "Không tự hạ chính mình được — nhờ quản trị viên khác làm.",
        env_admin:
          "SĐT này lấy quyền từ env ADMIN_PHONES — muốn bỏ quyền phải xoá khỏi biến môi trường trên Vercel rồi deploy lại, web không hạ được.",
        last_admin:
          "Đây là quản trị viên CUỐI CÙNG — hạ xuống là không ai vào được web quản trị nữa. Nâng người khác lên trước đã.",
        not_found:
          "Chưa có tài khoản nào mang SĐT này — tạo tài khoản ở tab Tài khoản trước.",
        bad_phone: "SĐT chưa hợp lệ.",
      };
      setRoleMsg(why[j?.code ?? ""] ?? "Chưa đổi được — thử lại.");
      return;
    }
    setRoleMsg(
      role === "admin"
        ? `Đã nâng ${phone} lên quản trị viên.`
        : `Đã hạ ${phone} xuống quản lý.`,
    );
    setPromotePhone("");
    load();
  }

  return (
    <div className="mt-4 space-y-4">
      <p className="surface px-4 py-3 text-[0.875rem] leading-snug text-foreground/70">
        Khu <b>NHÂN SỰ</b>: tạo và phân quyền người làm việc trên web quản trị.
        Người dùng app (khách thường / premium) nằm ở tab <b>Tài khoản</b> —
        hai luồng tách hẳn cho khỏi lẫn.
        <br />
        <b className="text-navy">Quản trị viên</b> toàn quyền mọi khu, không cần
        cấu hình. <b className="text-navy">Quản lý</b> chạy theo bảng quyền: 5
        khu (Tài khoản · Sản phẩm · Thuyền viên · Thông báo · Chỗ bán) × 4 mức{" "}
        <b>Xem · Tạo mới · Sửa · Xóa</b>; bỏ <b>Xem</b> = ẩn hẳn khu đó. (4 khu
        Yêu cầu · Vùng biển · Dữ liệu · Hệ thống chỉ dành cho quản trị viên.)
      </p>

      <CreateStaffForm onCreated={load} />

      {/* QUẢN TRỊ VIÊN — toàn quyền, nâng/hạ ngay tại đây (trừ người từ env). */}
      <div className="surface px-4 py-3.5">
        <p className="text-[0.9375rem] font-bold text-navy">
          Quản trị viên · toàn quyền ({admins.length})
        </p>
        {admins.length === 0 ? (
          <p className="mt-1 text-[0.875rem] font-semibold text-danger">
            KHÔNG còn quản trị viên nào — kiểm tra lại ngay.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {admins.map((a) => (
              <li
                key={a.phone}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.875rem]"
              >
                <span className="font-bold tabular-nums text-navy">
                  {a.phone}
                </span>
                {a.name && <span className="text-foreground/60">{a.name}</span>}
                {a.source === "env" ? (
                  <span
                    className="rounded-full bg-field px-2 py-0.5 text-[0.75rem] font-bold text-foreground/65"
                    title="Quyền từ biến môi trường ADMIN_PHONES — web không hạ được, phải sửa trên Vercel rồi deploy"
                  >
                    từ env · cửa cứu hộ
                  </span>
                ) : (
                  <>
                    <span className="rounded-full bg-navy px-2 py-0.5 text-[0.75rem] font-bold text-white">
                      từ tài khoản
                    </span>
                    <button
                      type="button"
                      disabled={roleBusy}
                      onClick={() => setToDemote(a)}
                      className="min-h-[2rem] rounded-lg bg-danger-bg px-3 text-[0.75rem] font-bold text-danger disabled:opacity-50"
                    >
                      Hạ xuống quản lý
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* NÂNG: nhập SĐT một tài khoản đã có → thành quản trị viên */}
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3 sm:flex-row">
          <input
            inputMode="numeric"
            placeholder="SĐT tài khoản muốn nâng lên quản trị viên…"
            value={promotePhone}
            onChange={(e) => setPromotePhone(e.target.value)}
            aria-label="SĐT nâng lên quản trị viên"
            className="min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-3 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea sm:flex-1"
          />
          <button
            type="button"
            disabled={roleBusy || !isValidVnPhone(promotePhone)}
            onClick={() => setToPromote(promotePhone.trim())}
            className="min-h-[2.75rem] shrink-0 rounded-xl bg-trim px-4 text-[0.9375rem] font-bold text-white disabled:opacity-40"
          >
            Nâng lên quản trị viên
          </button>
        </div>
        {roleMsg && (
          <p className="mt-2 text-[0.875rem] font-semibold text-foreground/75">
            {roleMsg}
          </p>
        )}
        <p className="mt-2 text-[0.8125rem] leading-snug text-foreground/60">
          Quản trị viên toàn quyền mọi khu, không cần bảng quyền. Nâng/hạ ở đây
          ăn ngay, không cần deploy. Không thể tự hạ chính mình, cũng không hạ
          được người cuối cùng.
          <br />
          Người ghi <b>từ env</b> lấy quyền từ biến <b>ADMIN_PHONES</b> trên
          Vercel — giữ làm cửa cứu hộ, web không hạ được. Muốn chuyển hẳn sang
          quản từ web: nâng chính SĐT đó lên quản trị viên ở ô dưới (ghi quyền
          vào tài khoản), kiểm tra vẫn vào được, rồi mới xoá nó khỏi{" "}
          <b>ADMIN_PHONES</b>.
        </p>
      </div>

      {toPromote && (
        <ConfirmDialog
          title={`Nâng ${toPromote} lên quản trị viên?`}
          message="Tài khoản này sẽ TOÀN QUYỀN mọi khu: xóa tài khoản, đặt lại mật khẩu, đổi phân quyền, gửi thông báo… và tự nâng được người khác lên quản trị viên. Chỉ nâng người bạn thật sự tin."
          confirmLabel="Nâng lên quản trị viên"
          cancelLabel="Không"
          danger
          onCancel={() => setToPromote(null)}
          onConfirm={() => {
            const p = toPromote;
            setToPromote(null);
            setRole(p, "admin");
          }}
        />
      )}
      {toDemote && (
        <ConfirmDialog
          title={`Hạ ${toDemote.phone} xuống quản lý?`}
          message={`${toDemote.name ? `${toDemote.name} — ` : ""}mất toàn quyền ngay, chỉ còn quyền theo bảng phân quyền của tài khoản quản lý (bảng cũ giữ nguyên nếu trước đây từng có).`}
          confirmLabel="Hạ xuống quản lý"
          cancelLabel="Không"
          danger
          onCancel={() => setToDemote(null)}
          onConfirm={() => {
            const p = toDemote.phone;
            setToDemote(null);
            setRole(p, "manager");
          }}
        />
      )}

      {migrationNeeded && (
        <p className="surface bg-warn-bg px-4 py-3 text-[0.875rem] font-semibold text-warn">
          Cột phân quyền chưa có trong DB — cần apply migration
          0017_staff_permissions. Hiện quản lý đang chạy theo quyền mặc định
          (Xem + Tạo + Sửa, không Xóa); lưu thay đổi sẽ báo lỗi cho tới khi
          apply xong.
        </p>
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
      {!managers && !error && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Đang tải danh sách quản lý…
        </p>
      )}
      {managers && managers.length === 0 && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Chưa có tài khoản quản lý nào. Tạo ở tab <b>Tài khoản</b> (chọn loại
          &ldquo;Quản lý&rdquo;), rồi quay lại đây phân quyền.
        </p>
      )}

      {managers?.map((m) => (
        <ManagerPermCard key={m.phone} manager={m} onSaved={load} />
      ))}
    </div>
  );
}

function ManagerPermCard({
  manager,
  onSaved,
}: {
  manager: ManagerPerm;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<StaffPermissions>(manager.permissions);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(manager.permissions),
    [draft, manager.permissions],
  );

  function toggle(tab: ManagerTab, action: (typeof PERM_ACTIONS)[number]) {
    setMsg(null);
    setDraft((d) => ({
      ...d,
      [tab]: { ...d[tab], [action]: !d[tab][action] },
    }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const r = await fetch(apiUrl("/api/admin/staff"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: manager.phone, permissions: draft }),
    }).catch(() => null);
    setBusy(false);
    const j = (await r?.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
    } | null;
    if (!r?.ok || !j?.ok) {
      setMsg(
        j?.code === "migration_needed"
          ? "Chưa lưu được — DB chưa có cột phân quyền (apply migration 0017)."
          : "Lưu chưa được — thử lại.",
      );
      return;
    }
    setMsg("Đã lưu quyền.");
    onSaved();
  }

  return (
    <div className="surface px-4 py-3.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p className="text-[1rem] font-bold tabular-nums text-navy">
          {manager.phone}
        </p>
        {manager.name && (
          <span className="font-semibold text-foreground/70">
            {manager.name}
          </span>
        )}
        {!manager.configured && (
          <span className="rounded-full bg-field px-2 py-0.5 text-[0.75rem] font-bold text-foreground/60">
            đang dùng quyền mặc định
          </span>
        )}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="pb-2 pr-3 text-[0.8125rem] font-bold text-foreground/60">
                Khu
              </th>
              {PERM_ACTIONS.map((a) => (
                <th
                  key={a}
                  className="pb-2 text-center text-[0.8125rem] font-bold text-foreground/60"
                >
                  {ACTION_LABEL[a]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MANAGER_TABS.map((tab) => (
              <tr key={tab} className="border-t border-line">
                <td className="py-2 pr-3 text-[0.9375rem] font-semibold text-navy">
                  {TAB_LABEL[tab]}
                </td>
                {PERM_ACTIONS.map((action) => {
                  const on = draft[tab][action];
                  return (
                    <td key={action} className="py-2 text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={`${TAB_LABEL[tab]} — ${ACTION_LABEL[action]}`}
                        onClick={() => toggle(tab, action)}
                        className={`inline-flex h-9 min-w-[2.75rem] items-center justify-center rounded-lg px-2 text-[0.8125rem] font-bold transition ${
                          on
                            ? "bg-ok-bg text-ok"
                            : "bg-field text-foreground/45"
                        }`}
                      >
                        {on ? "Bật" : "Tắt"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={save}
          className="min-h-[2.75rem] rounded-xl bg-trim px-6 text-[0.9375rem] font-bold text-white disabled:opacity-50"
        >
          {busy ? "Đang lưu…" : "Lưu quyền"}
        </button>
        {dirty && !busy && (
          <button
            type="button"
            onClick={() => {
              setDraft(manager.permissions);
              setMsg(null);
            }}
            className="min-h-[2.75rem] rounded-xl bg-field px-4 text-[0.9375rem] font-bold text-foreground/70"
          >
            Hoàn tác
          </button>
        )}
        {msg && (
          <span className="text-[0.875rem] font-semibold text-foreground/75">
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── NHẬT KÝ HOẠT ĐỘNG (admin-only) ────────────────────────────────────────
   Log append-only mọi thao tác ghi/xóa của staff (admin_activity_log, 0019) →
   soát được ai làm gì, lúc nào; nhất là XÓA/RESET/ĐỔI QUYỀN (tô đỏ). */

type ActivityEvent = {
  id: string;
  actorPhone: string;
  actorRole: string;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
};

function ActivityLogTab() {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [readErr, setReadErr] = useState<string | null>(null);
  const [probe, setProbe] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dangerOnly, setDangerOnly] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setEvents(null);
    fetch(apiUrl("/api/admin/activity"))
      .then(async (r) => {
        const j = (await r.json()) as {
          ok: boolean;
          code?: string;
          events?: ActivityEvent[];
          migrationNeeded?: boolean;
          error?: { code?: string; message?: string; hint?: string };
        };
        if (!j.ok) throw new Error(j.code ?? "load");
        setEvents(j.events ?? []);
        setMigrationNeeded(Boolean(j.migrationNeeded));
        setReadErr(
          j.error ? `${j.error.code ?? ""} ${j.error.message ?? ""}`.trim() : null,
        );
      })
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Chưa cấu hình Supabase/service-role — nhật ký cần DB thật."
            : e.message === "admin_only"
              ? "Chỉ quản trị viên xem được nhật ký."
              : "Chưa tải được nhật ký — thử lại.",
        ),
      );
  }, []);
  useEffect(load, [load]);

  const visible = useMemo(() => {
    if (!events) return null;
    const q = fold(query.trim());
    const qDigits = query.replace(/\D/g, "");
    return events.filter((e) => {
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (dangerOnly && !isDangerAction(e.action)) return false;
      if (!q && !qDigits) return true;
      if (qDigits && e.actorPhone.includes(qDigits)) return true;
      if (q && fold(actionLabel(e.action)).includes(q)) return true;
      return false;
    });
  }, [events, query, actionFilter, dangerOnly]);

  return (
    <div className="mt-4 space-y-4">
      <p className="surface px-4 py-3 text-[0.875rem] leading-snug text-foreground/70">
        Ghi lại mọi thao tác <b>ghi/xóa</b> của quản trị viên & quản lý (tạo/xóa
        tài khoản, cấp premium, đổi ghi chú, gửi thông báo, đổi phân quyền…) —
        soát được <b>ai làm gì, lúc nào</b>. Thao tác xóa/nhạy cảm tô{" "}
        <span className="font-bold text-danger">đỏ</span>. Không sửa/xóa được
        nhật ký.
      </p>

      {migrationNeeded && (
        <p className="surface bg-warn-bg px-4 py-3 text-[0.875rem] font-semibold text-warn">
          Đọc bảng nhật ký KHÔNG được — thường là chưa apply migration
          0019_admin_activity_log. Thao tác vẫn chạy nhưng chưa được ghi lại.
          {readErr && (
            <span className="mt-1 block font-mono text-[0.75rem] font-normal">
              Lỗi thật: {readErr}
            </span>
          )}
        </p>
      )}

      {/* TỰ KIỂM TRA: ghi log là fire-and-forget nên nhật ký câm mà không ai
          biết vì sao (prod 2026-07-31: có thao tác thật mà bảng rỗng). Nút này
          ghi thử một dòng ngay và nói kết quả. */}
      <div className="surface flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          type="button"
          disabled={probing}
          onClick={async () => {
            setProbing(true);
            setProbe(null);
            const r = await fetch(apiUrl("/api/admin/activity"), {
              method: "POST",
            }).catch(() => null);
            const j = (await r?.json().catch(() => null)) as {
              ok?: boolean;
              wrote?: boolean;
              readBack?: number | null;
            } | null;
            setProbing(false);
            if (!r?.ok || !j?.ok) {
              setProbe("Không gọi được máy chủ — thử lại.");
              return;
            }
            setProbe(
              j.wrote
                ? `Ghi được. Nhật ký đang có ${j.readBack ?? "?"} dòng.`
                : "GHI HỎNG — nhật ký không ghi được. Mã lỗi nằm ở Vercel → Logs (tìm \"activity-log\").",
            );
            if (j.wrote) load();
          }}
          className="min-h-[2.5rem] rounded-xl bg-field px-4 text-[0.875rem] font-bold text-navy disabled:opacity-50"
        >
          {probing ? "Đang kiểm tra…" : "Kiểm tra ghi nhật ký"}
        </button>
        {probe && (
          <span className="text-[0.875rem] font-semibold text-foreground/75">
            {probe}
          </span>
        )}
      </div>

      {/* lọc: tìm theo SĐT/tên hành động + chọn loại + chỉ nhạy cảm */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <input
          type="search"
          inputMode="search"
          placeholder="Tìm theo SĐT người làm hoặc tên thao tác…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Tìm nhật ký"
          className="min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-4 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea sm:flex-1"
        />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          aria-label="Lọc loại thao tác"
          className="min-h-[2.75rem] rounded-xl border-0 bg-field px-3 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        >
          <option value="all">Mọi thao tác</option>
          {ADMIN_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {actionLabel(a)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setDangerOnly((v) => !v)}
          aria-pressed={dangerOnly}
          className={`min-h-[2.75rem] shrink-0 rounded-xl px-4 text-[0.875rem] font-bold transition ${
            dangerOnly ? "bg-danger text-white" : "bg-field text-foreground/70"
          }`}
        >
          Chỉ xóa/nhạy cảm
        </button>
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
      {!events && !error && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Đang tải nhật ký…
        </p>
      )}
      {events && events.length === 0 && !error && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Chưa có hoạt động nào được ghi.
        </p>
      )}

      {visible && events && events.length > 0 && (
        <>
          <p className="px-1 text-[0.8125rem] font-semibold text-foreground/55">
            {visible.length === events.length
              ? `${events.length} hoạt động gần nhất`
              : `${visible.length}/${events.length} hoạt động khớp`}
          </p>
          {visible.length === 0 ? (
            <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
              Không hoạt động nào khớp bộ lọc.
            </p>
          ) : (
            <ul className="surface overflow-hidden">
              {visible.map((e) => {
                const danger = isDangerAction(e.action);
                return (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-line px-4 py-2.5 last:border-b-0"
                  >
                    <span
                      className={`text-[0.9375rem] font-bold ${danger ? "text-danger" : "text-navy"}`}
                    >
                      {actionLabel(e.action)}
                    </span>
                    <span className="text-[0.875rem] tabular-nums text-foreground/70">
                      {e.actorPhone}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[0.6875rem] font-bold ${
                        e.actorRole === "admin"
                          ? "bg-navy/10 text-navy"
                          : "bg-t1-bg text-t1"
                      }`}
                    >
                      {e.actorRole === "admin" ? "admin" : "quản lý"}
                    </span>
                    {e.target && (
                      <span className="text-[0.8125rem] tabular-nums text-foreground/60">
                        → {e.target}
                      </span>
                    )}
                    {e.detail && Object.keys(e.detail).length > 0 && (
                      <span className="text-[0.75rem] text-foreground/45">
                        {summarizeDetail(e.detail)}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 text-[0.75rem] tabular-nums text-foreground/50">
                      {fmtDT(e.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/** Gói `detail` jsonb thành chuỗi "khóa: giá trị" ngắn cho một dòng nhật ký. */
function summarizeDetail(detail: Record<string, unknown>): string {
  return Object.entries(detail)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? "…" : String(v)}`)
    .join(" · ");
}
