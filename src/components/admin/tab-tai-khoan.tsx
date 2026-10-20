"use client";

/*  Tách nguyên văn khỏi src/app/quan-tri/page.tsx (2026-10-19, rà Codex đợt 3: trang quản trị 6.718 dòng
    — tách theo tab, KHÔNG đổi hành vi; trang chính nạp tab khi mở). */

import { AdminSkeleton } from "@/components/admin/admin-nav";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { apiUrl } from "@/lib/api-base";
import { PLATFORM_LABEL, USAGE_STAGE_LABEL, persistNote, readinessChip, type DevicePlatform, type ReadinessReason, type ReadinessTone, type UsageStage, usageStage } from "@/lib/app-usage";
import { tokenHeader } from "@/lib/device-token-store";
import { canResetPassword } from "@/lib/staff-permissions";
import { DEFAULT_CUSTOMER_PASSWORD } from "@/lib/temp-password";
import { PREMIUM_TERM_MAX_MONTHS, PREMIUM_TERM_MIN_MONTHS, PREMIUM_TERM_MONTHS, PREMIUM_TERM_PRESETS, clampTermMonths, nextPremiumUntil, premiumTermLabel, resolveTier } from "@/lib/tier";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type Me, fmtD, fmtDT, fold, permsFor } from "@/components/admin/quan-tri-chung";

export type Account = {
  phone: string;
  name: string | null;
  tier: string;
  premiumUntil: string | null;
  premiumActivatedAt: string | null;
  role: string;
  /** QUẢN TRỊ VIÊN thật — env ADMIN_PHONES (cứu hộ) HOẶC staff_accounts
   *  role='admin' (0056). Xem badge ở danh sách tài khoản. */
  isAdmin: boolean;
  /** real | test | demo | reviewer (0056) — khác real: không làm staff,
   *  chuỗi có hạn, không nhận tin gửi tất cả */
  kind?: "real" | "test" | "demo" | "reviewer";
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
  /** dữ liệu đi biển trong máy phủ tới ngày nào (0025) */
  dataUntil?: string | null;
  dataUntilWeb?: string | null;
  storageQuotaMb?: number | null;
  storageUsedMb?: number | null;
  /** tách theo kho (0030) — xem chip "kho" trong `UsageChip` */
  storageLsMb?: number | null;
  storageIdbMb?: number | null;
  storageCacheMb?: number | null;
  storageAvailableMb?: number | null;
  storagePersisted?: boolean | null;
  /** kết quả lần HỎI gần nhất (0031) — null = chưa hỏi lần nào */
  storagePersistAsked?: boolean | null;
  storageBackend?: string | null;
  devicePlatform: DevicePlatform | null;
  devices: {
    tag: string;
    platform: DevicePlatform | null;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
  }[];
};

/** Thống kê theo người cấp premium (log premium_grants) */
export type GrantStat = { by: string; managing: number; totalGrants: number };

/*  Chỉ NGÀY, không giờ (0036) — `data_until` là ngày của bản dự báo, không phải
    mốc thao tác. Ghim múi giờ VN và dựng từ phần ngày để không bị lệch một ngày
    khi máy chủ/trình duyệt ở múi khác. */
export const fmtNgay = (d: string | null | undefined): string => {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return y && m && day ? `${day}/${m}/${y}` : "—";
};

/* ── TÀI KHOẢN ─────────────────────────────────────────────────────────── */

export type TierFilter = "all" | "premium" | "basic";

export function AccountsTab({ me }: { me: Me }) {
  const isAdmin = me.role === "admin";
  // Quyền trên tab Tài khoản: create=tạo khách · edit=cấp/gia hạn premium ·
  // delete=xoá tài khoản. Hạ hạng vẫn ADMIN-ONLY cứng. Đặt lại mật khẩu: admin,
  // hoặc quản lý được tick cờ riêng (2026-10-06) — server chốt thêm "chỉ khách
  // của mình, không phải nhân sự".
  const perms = permsFor(me, "tai-khoan");
  const canReset = canResetPassword(me.role, me.permissions);
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
    /** kỳ hạn (số tháng) admin đang chọn cho lần cấp/gia hạn này */
    months: number;
    /** mốc lúc mở dialog — ghim để xem trước hạn không gọi Date.now() khi render
        (render phải thuần); server vẫn tự tính lại theo giờ thật lúc cấp */
    nowMs: number;
  } | null>(null);
  const [toDowngrade, setToDowngrade] = useState<Account | null>(null);
  const [toDelete, setToDelete] = useState<Account | null>(null);
  const [toReset, setToReset] = useState<Account | null>(null);
  const [toRevoke, setToRevoke] = useState<Account | null>(null);
  // NV3 — ghi thu tiền: khách đang nhập mã + nội dung ô mã CK
  const [toPay, setToPay] = useState<Account | null>(null);
  const [payCode, setPayCode] = useState("");
  // thông báo thành công (đặt lại mật khẩu…) — tách khỏi error để không đỏ oan
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetch(apiUrl("/api/admin/accounts"), { headers: tokenHeader() })
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
            ? "Cấu hình môi trường đang thiếu khóa dịch vụ (Service Role Key). Vui lòng thêm từ Supabase Dashboard và khởi động lại."
            : "Chưa tải được danh sách. Vui lòng thử lại.",
        ),
      );
  }, []);
  useEffect(load, [load]);

  // hạng HIỆU LỰC (premium hết hạn tính là thường) — cùng luật resolveTier
  const effTier = useCallback(
    (a: Account) => resolveTier(a.tier, a.premiumUntil, Date.now()),
    [],
  );

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

  /*  ── SỐ THỐNG KÊ ĐẦU TAB — ĐẾM ĐÚNG THỨ ĐANG XEM ────────────────────────
      Lỗi cũ (báo từ hiện trường 2026-08-31, Vss Quân Bình Định: *"cái con số
      pre nó ko nhảy theo"*): bốn ô số này đếm trên `accounts` — TOÀN BỘ bảng —
      trong khi MỌI thứ bên dưới chúng (ô tìm, chip Premium/Thường, chip Khách
      dùng app/Nhân sự quản trị) đều lọc danh sách. Hệ quả: gõ tìm, đổi chip,
      bấm sang "Nhân sự quản trị" — danh sách đổi mà bốn con số đứng im, nên
      nhìn như hỏng. Riêng chip vai còn sai cả nghĩa: màn mặc định là "Khách
      dùng app" (đã trừ nhân sự) mà ô vẫn ghi "Tổng tài khoản" gồm cả nhân sự.

      Nay đếm trên `visible` — đúng những dòng đang bày ra. Nhãn ô đầu đổi
      "Tổng tài khoản" → "Đang xem" cho khỏi hứa một con số toàn bảng.
      Muốn xem tổng thật thì bỏ hết bộ lọc, đúng như mọi màn danh sách khác.

      ĐẶT SAU `visible`: nó phải đọc `visible`, mà `visible` khai bên trên —
      để nguyên chỗ cũ là rơi vào vùng chết TDZ. */
  const stats = useMemo(() => {
    if (!visible) return null;
    return {
      total: visible.length,
      premium: visible.filter((a) => effTier(a) === "premium").length,
      canLogin: visible.filter((a) => a.canLogin).length,
      manual: visible.filter((a) => !a.fromSdwork).length,
    };
  }, [visible, effTier]);

  /** đang xem Khách mà tìm trúng nhân sự → mách một câu, đừng để tưởng mất */
  const hiddenStaff = useMemo(
    () =>
      roleFilter === "khach" && matched
        ? matched.filter(isStaff).length
        : 0,
    [matched, roleFilter, isStaff],
  );

  /** grant = kích hoạt/gia hạn premium theo kỳ hạn admin chọn (server tự tính
   *  hạn + ghi log); downgrade = hạ về thường (admin). `termMonths` chỉ dùng cho
   *  grant — server bỏ qua khi downgrade. */
  async function patchAction(
    a: Account,
    action: "grant" | "downgrade",
    termMonths?: number,
  ) {
    setBusyPhone(a.phone);
    setNotice(null);
    const r = await fetch(apiUrl("/api/admin/accounts"), {
      method: "PATCH",
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify({
        phone: a.phone,
        action,
        ...(action === "grant" && termMonths != null ? { termMonths } : {}),
      }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as {
      ok?: boolean;
      logged?: boolean;
      code?: string;
    } | null;
    setBusyPhone(null);
    if (!r?.ok || !j?.ok) {
      setError(
        staffDenialMessage(j?.code) ??
        (action === "grant"
          ? "Thao tác kích hoạt hoặc gia hạn bị lỗi. Vui lòng thử lại."
          : "Lỗi khi hạ cấp tài khoản. Vui lòng thử lại."),
      );
      return;
    }
    if (j.logged === false) {
      // thao tác THÀNH CÔNG nhưng ghi log hỏng — nói thật để đối soát tay
      setError(
        "Đã đổi hạng nhưng hệ thống gặp lỗi khi lưu lịch sử. Thống kê theo người cấp có thể bị thiếu dữ liệu này.",
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
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify({ phone: a.phone, action: "set_flag", flag, value: next }),
    }).catch(() => null);
    if (!r?.ok) {
      flip(!next);
      setError("Lỗi cập nhật trạng thái chăm sóc khách hàng. Vui lòng thử lại.");
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
      headers: { "content-type": "application/json", ...tokenHeader() },
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
          ? "Nhập mã giao dịch chuyển khoản."
          : j?.code === "not_your_customer"
            ? "Bạn chỉ được ghi nhận thu tiền cho khách hàng do mình quản lý."
            : "Lỗi ghi nhận thông tin thu tiền. Vui lòng thử lại.",
      );
      return;
    }
    setNotice(
      `Đã ghi nhận mã chuyển khoản cho ${a.phone}. Vui lòng kiểm tra biến động số dư SDWork và bấm "Đã đối chiếu".`,
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
      headers: { "content-type": "application/json", ...tokenHeader() },
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
          ? "Khách hàng này không có khoản thu nào đang chờ đối chiếu."
          : "Lỗi thao tác đối chiếu. Vui lòng thử lại.",
      );
      return;
    }
    setNotice(`Đã đối chiếu thành công khoản thu của ${a.phone}.`);
    load();
  }

  /** reset-password (2026-10-06): khách về sd123456, nhân sự ra mật khẩu ngẫu
   *  nhiên (server trả về, hiện một lần); app nhắc đổi khi đăng nhập lại. */
  async function resetPassword(a: Account) {
    setBusyPhone(a.phone);
    setNotice(null);
    const r = await fetch(apiUrl("/api/admin/accounts"), {
      method: "PATCH",
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify({ phone: a.phone, action: "reset-password" }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
      tempPassword?: string;
      isDefault?: boolean;
    } | null;
    setBusyPhone(null);
    if (!r?.ok || !j?.ok) {
      setError(
        j?.code === "not_provisioned"
          ? "Tài khoản này chưa được khởi tạo hoàn toàn trên hệ thống nên chưa thể đặt lại mật khẩu."
          : j?.code === "not_your_customer"
            ? "Khách này không do bạn cấp/chăm nên bạn không đặt lại mật khẩu được. Nhờ quản trị viên."
            : j?.code === "staff_target" || j?.code === "self"
              ? "Không đặt lại được mật khẩu tài khoản nhân sự ở đây. Nhờ quản trị viên."
              : j?.code === "no_permission"
                ? "Tài khoản của bạn chưa được cấp quyền đặt lại mật khẩu."
                : "Lỗi đặt lại mật khẩu. Vui lòng thử lại.",
      );
      return;
    }
    setNotice(
      j.isDefault
        ? `Đã đặt lại mật khẩu cho ${a.phone}${a.name ? ` (${a.name})` : ""} về ${j.tempPassword ?? DEFAULT_CUSTOMER_PASSWORD}. Các máy đang đăng nhập số này đã bị đăng xuất; khách đăng nhập lại bằng SĐT + ${j.tempPassword ?? DEFAULT_CUSTOMER_PASSWORD}, app sẽ nhắc đổi mật khẩu (có thể để sau).`
        : `Đã cấp lại mật khẩu cho nhân sự ${a.phone}${a.name ? ` (${a.name})` : ""}: ${j.tempPassword ?? "(không nhận được — bấm đặt lại lần nữa)"} — mật khẩu này chỉ hiện MỘT lần, các máy đang đăng nhập đã bị đăng xuất.`,
    );
  }

  /** LOẠI TÀI KHOẢN (0056) — chỉ admin. Khác "thật": không làm nhân sự,
   *  phiên đăng nhập có hạn, không nhận tin gửi tất cả. */
  async function setKind(a: Account, kind: NonNullable<Account["kind"]>) {
    setBusyPhone(a.phone);
    setNotice(null);
    const r = await fetch(apiUrl("/api/admin/accounts"), {
      method: "PATCH",
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify({ phone: a.phone, action: "set-kind", kind }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { ok?: boolean; code?: string } | null;
    setBusyPhone(null);
    if (!r?.ok || !j?.ok) {
      setError(
        j?.code === "is_staff"
          ? "Tài khoản nhân sự không được đổi sang test/demo — hạ vai ở tab Phân quyền trước."
          : j?.code === "migration_needed"
            ? "Cơ sở dữ liệu chưa có cột loại tài khoản (migration 0056) — báo kỹ thuật apply trước."
            : "Đổi loại tài khoản không thành công. Vui lòng thử lại.",
      );
      return;
    }
    setNotice(`Đã đổi ${a.phone} thành tài khoản ${KIND_LABEL[kind].toLowerCase()} — các máy đang đăng nhập đã bị đăng xuất.`);
    load();
  }

  /** ĐĂNG XUẤT MỌI MÁY — chỉ admin (nghi lộ tài khoản / mất máy). */
  async function revokeSessions(a: Account) {
    setBusyPhone(a.phone);
    setNotice(null);
    const r = await fetch(apiUrl("/api/admin/accounts"), {
      method: "PATCH",
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify({ phone: a.phone, action: "revoke-sessions" }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { ok?: boolean; revoked?: number } | null;
    setBusyPhone(null);
    if (!r?.ok || !j?.ok) {
      setError("Chưa đăng xuất được — vui lòng thử lại.");
      return;
    }
    setNotice(`Đã đăng xuất ${j.revoked ?? 0} máy của ${a.phone}.`);
  }

  async function remove(a: Account) {
    setBusyPhone(a.phone);
    const r = await fetch(
      apiUrl(`/api/admin/accounts?phone=${encodeURIComponent(a.phone)}`),
      { method: "DELETE", headers: tokenHeader() },
    ).catch(() => null);
    setBusyPhone(null);
    if (!r?.ok) {
      const j = (await r?.json().catch(() => null)) as { code?: string } | null;
      setError(staffDenialMessage(j?.code) ?? "Xóa không thành công. Vui lòng thử lại.");
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
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify({ phone: a.phone, action: "set-flags", ...patch }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { ok?: boolean } | null;
    if (!r?.ok || !j?.ok) {
      setError("Lưu ghi chú không thành công. Vui lòng thử lại.");
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
              ["Đang xem", stats.total],
              ["Gói Premium đang hiệu lực", stats.premium],
              ["Đã đăng nhập", stats.canLogin],
              ["Tạo thủ công", stats.manual],
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
          placeholder="Tìm theo số điện thoại hoặc tên khách hàng…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Tìm tài khoản"
          className="min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-4 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea sm:flex-1"
        />
        <div className="flex gap-1.5">
          {chip("all", "Tất cả")}
          {chip("premium", "Premium")}
          {chip("basic", "Hạng thường")}
        </div>
      </div>

      {/* VAI: tab này của NGƯỜI DÙNG APP; nhân sự để riêng cho khỏi lẫn */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            ["khach", "Khách hàng dùng app"],
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
            ? "Để tạo hoặc phân quyền nhân sự, hãy dùng tab Phân quyền"
            : "Chỉ dùng để cấp Premium / đặt lại mật khẩu cho nhân sự"}
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
        <AdminSkeleton label="Đang tải danh sách tài khoản…" />
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
                      <KindBadge account={a} />
                    </p>
                    <p className="mt-0.5 text-[0.8125rem] text-foreground/60">
                      {a.fromSdwork ? "Nguồn từ SDWork" : "Tạo thủ công"} ·{" "}
                      {a.canLogin ? "Đã đăng nhập" : "Chưa tạo tài khoản"} ·
                      cập nhật {fmtDT(a.updatedAt)}
                      {a.premiumActivatedAt &&
                        ` · Premium được kích hoạt ${fmtD(a.premiumActivatedAt)}`}
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
                        {a.premiumUsed ? "✓ Đã sử dụng" : "Chưa sử dụng"}
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
                          title={`Mã giao dịch: ${a.payment.code}`}
                        >
                          {a.payment.reconciledStatus === "reconciled"
                            ? "✓ Đã thu · đã đối chiếu"
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
                            title="Sau khi thấy tiền vào tài khoản SDWork → chọn đánh dấu đối chiếu"
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
                        ? `Gói Premium đến ${fmtD(a.premiumUntil)}`
                        : "Premium"
                      : a.tier === "premium"
                        ? `Đã hết hạn ${fmtD(a.premiumUntil)}`
                        : "Hạng thường"}
                  </span>
                  <div className="flex shrink-0 gap-1.5">
                    {perms.edit && (
                      <button
                        type="button"
                        disabled={busyPhone === a.phone}
                        onClick={() => {
                          const active = effTier(a) === "premium";
                          // mở dialog với kỳ hạn mặc định; admin đổi trong dialog
                          setToGrant({
                            a,
                            active,
                            months: PREMIUM_TERM_MONTHS,
                            nowMs: Date.now(),
                          });
                        }}
                        className="min-h-[2.5rem] rounded-lg bg-navy px-3 text-[0.8125rem] font-bold text-white disabled:opacity-50"
                      >
                        {effTier(a) === "premium"
                          ? "Gia hạn gói Premium"
                          : "Kích hoạt gói Premium"}
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
                    {canReset && a.canLogin && (isAdmin || !isStaff(a)) && (
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
                      <label className="sr-only" htmlFor={`kind-${a.phone}`}>
                        Loại tài khoản của {a.phone}
                      </label>
                    )}
                    {isAdmin && (
                      <select
                        id={`kind-${a.phone}`}
                        value={a.kind ?? "real"}
                        disabled={busyPhone === a.phone}
                        onChange={(e) =>
                          setKind(a, e.target.value as NonNullable<Account["kind"]>)
                        }
                        title="Loại tài khoản — test/demo không làm nhân sự, phiên có hạn, không nhận tin gửi tất cả"
                        className="min-h-[2.5rem] rounded-lg bg-field px-2 text-[0.8125rem] font-bold text-foreground/70 disabled:opacity-50"
                      >
                        {(Object.keys(KIND_LABEL) as NonNullable<Account["kind"]>[]).map((k) => (
                          <option key={k} value={k}>
                            {KIND_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    )}
                    {isAdmin && a.canLogin && (
                      <button
                        type="button"
                        disabled={busyPhone === a.phone}
                        onClick={() => setToRevoke(a)}
                        className="min-h-[2.5rem] rounded-lg bg-field px-3 text-[0.8125rem] font-bold text-foreground/70 disabled:opacity-50"
                      >
                        Đăng xuất mọi máy
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
                      onLabel="Đã được hướng dẫn trực tiếp"
                      offLabel="Chưa được hướng dẫn trực tiếp"
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
      {toGrant &&
        (() => {
          // xem trước hạn mới theo ĐÚNG luật server + kỳ hạn admin đang chọn
          const term = premiumTermLabel(toGrant.months);
          const until = nextPremiumUntil(
            toGrant.active ? toGrant.a.premiumUntil : null,
            toGrant.nowMs,
            toGrant.months,
          );
          return (
            <ConfirmDialog
              title={
                toGrant.active
                  ? `Xác nhận gia hạn gói Premium cho ${toGrant.a.phone}?`
                  : `Xác nhận kích hoạt gói Premium cho ${toGrant.a.phone}?`
              }
              message={`${toGrant.a.name ?? "Khách hàng"} sẽ được cấp gói Premium ${term}, sử dụng đến ngày ${fmtD(until)}. Lịch sử cấp quyền này sẽ ghi nhận dưới tên bạn.`}
              confirmLabel={toGrant.active ? "Xác nhận gia hạn" : "Xác nhận kích hoạt"}
              cancelLabel="Hủy thao tác"
              danger={false}
              onCancel={() => setToGrant(null)}
              onConfirm={() => {
                const a = toGrant.a;
                const months = toGrant.months;
                setToGrant(null);
                patchAction(a, "grant", months);
              }}
            >
              <PremiumTermPicker
                months={toGrant.months}
                onChange={(m) => setToGrant({ ...toGrant, months: m })}
              />
            </ConfirmDialog>
          );
        })()}
      {toDowngrade && (
        <ConfirmDialog
          title={`Hạ cấp ${toDowngrade.phone} về tài khoản thường?`}
          message="Khách hàng sẽ không thể xem bản đồ dự báo cá và dự báo thời tiết 16 ngày."
          confirmLabel="Xác nhận hạ cấp"
          cancelLabel="Hủy thao tác"
          danger
          onCancel={() => setToDowngrade(null)}
          onConfirm={() => {
            const a = toDowngrade;
            setToDowngrade(null);
            patchAction(a, "downgrade");
          }}
        />
      )}
      {toRevoke && (
        <ConfirmDialog
          title={`Đăng xuất mọi máy của ${toRevoke.phone}?`}
          message={`${toRevoke.name ? `${toRevoke.name} — ` : ""}mọi điện thoại/máy tính đang đăng nhập số này sẽ bị đăng xuất ở lần dùng mạng kế tiếp. Dữ liệu đã tải trong máy giữ nguyên; người dùng đăng nhập lại bằng mật khẩu hiện tại.`}
          confirmLabel="Đăng xuất mọi máy"
          cancelLabel="Hủy thao tác"
          danger={false}
          onCancel={() => setToRevoke(null)}
          onConfirm={() => {
            const a = toRevoke;
            setToRevoke(null);
            revokeSessions(a);
          }}
        />
      )}
      {toReset && (
        <ConfirmDialog
          title={`Xác nhận đặt lại mật khẩu cho ${toReset.phone}?`}
          message={`${toReset.name ? `${toReset.name} — ` : ""}${isStaff(toReset) ? "đây là tài khoản NHÂN SỰ: hệ thống tạo mật khẩu tạm ngẫu nhiên (hiện một lần sau khi bấm)" : `mật khẩu sẽ về mặc định ${DEFAULT_CUSTOMER_PASSWORD}`}, mật khẩu cũ bị hủy và mọi máy đang đăng nhập bị đăng xuất. Đăng nhập lại app sẽ nhắc đổi mật khẩu.`}
          confirmLabel="Xác nhận đặt lại"
          cancelLabel="Hủy thao tác"
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
          title={`Xác nhận xóa tài khoản ${toDelete.phone}?`}
          message={`${toDelete.name ? `${toDelete.name} — ` : ""}khách sẽ không thể đăng nhập được nữa. Không thể khôi phục lại tài khoản đã xóa.`}
          confirmLabel="Xác nhận xóa"
          cancelLabel="Hủy thao tác"
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
          <div className="surface w-full max-w-[26.25rem] p-5">
            <p className="display text-[1.125rem] font-bold text-navy">
              Ghi thu tiền — {toPay.phone}
            </p>
            <p className="mt-1 text-[0.875rem] leading-snug text-foreground/70">
              Mã CK = <b>Số điện thoại khách</b> (khách ghi SĐT vào nội dung chuyển khoản)
              — đã điền sẵn, sửa nếu khách ghi mã khác. Sau đó xem biến động số
              dư SDWork thấy tiền vào rồi bấm &quot;Đã đối chiếu&quot;.
            </p>
            <input
              autoFocus
              value={payCode}
              onChange={(e) => setPayCode(e.target.value)}
              placeholder="Mã giao dịch = Số điện thoại khách (vd: 0912345678)"
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
/** Câu báo cho các mã CHẶN theo vai (RBAC 2026-10-02) — null = không phải
 *  mã chặn vai, caller dùng câu mặc định của mình. */
export function staffDenialMessage(code: string | undefined): string | null {
  switch (code) {
    case "self":
      return "Không thể thao tác trên chính tài khoản của bạn.";
    case "staff_target":
      return "Tài khoản này là nhân sự quản trị — chỉ quản trị viên mới thao tác được.";
    case "not_your_customer":
      return "Khách này do người khác quản lý — bạn chỉ thao tác được với khách do mình cấp Premium.";
    case "env_admin":
      return "Quản trị viên cấp từ cấu hình máy chủ — không xoá được trên web.";
    case "last_admin":
      return "Đây là quản trị viên cuối cùng — thêm quản trị viên khác trước.";
    case "owner_only":
      return "Chỉ admin tổng mới thao tác được với tài khoản quản trị viên.";
    default:
      return null;
  }
}

/** Nhãn LOẠI tài khoản (0056). Giữ đồng bộ với ACCOUNT_KINDS ở lib/admin. */
export const KIND_LABEL: Record<NonNullable<Account["kind"]>, string> = {
  real: "Thật",
  test: "Test",
  demo: "Demo",
  reviewer: "Duyệt app",
};

/** Chỉ hiện khi KHÁC tài khoản thật — để không nhầm máy thử với bà con. */
export function KindBadge({ account }: { account: Account }) {
  if (!account.kind || account.kind === "real") return null;
  return (
    <span className="ml-2 rounded-full bg-warn-bg px-2 py-0.5 text-[0.75rem] font-bold text-warn">
      {KIND_LABEL[account.kind]}
    </span>
  );
}

export function RoleBadge({ account }: { account: Account }) {
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
export function AppUsage({ a }: { a: Account }) {
  const stage = usageStage({ ...a, dataUntil: a.dataUntil ?? null });
  const skin: Record<UsageStage, string> = {
    "chua-ghi-nhan": "bg-field text-foreground/50",
    "moi-vo-web": "bg-warn-bg text-warn",
    "da-mo-ban-cai": "bg-warn-bg text-warn",
    "da-tai-mot-phan": "bg-t1-bg text-t1",
    "du-do-di-bien": "bg-ok-bg text-ok",
  };
  const why: Record<UsageStage, string> = {
    "chua-ghi-nhan":
      "Thiết bị chưa gửi tín hiệu. Tuy nhiên điều này không có nghĩa là khách chưa dùng app: tín hiệu chỉ được gửi khi đã đăng nhập và có mạng (chỉ ghi nhận từ 01/08/2026).",
    "moi-vo-web":
      "Khách mới dùng trên trình duyệt nhưng chưa mở bản đã cài. Trên iPhone, bản cài ngoài Màn hình chính có kho lưu trữ riêng, nếu không tải dữ liệu thì ra khơi sẽ không xem được bản đồ. Vui lòng gọi nhắc khách mở icon vừa cài khi còn mạng.",
    "da-mo-ban-cai":
      "Khách đã mở bản cài nhưng chưa tải dữ liệu. Vui lòng hướng dẫn khách bấm tải dự báo khi có sóng.",
    "da-tai-mot-phan":
      "Khách đã mở bản cài và đang tải dở dữ liệu thì bị gián đoạn. Vui lòng gọi nhắc khách mở lại app lúc có sóng để tải nốt phần còn thiếu.",
    "du-do-di-bien":
      "Thiết bị báo cáo: Ứng dụng và toàn bộ dữ liệu đã được tải về kho offline. Lưu ý: đây là trạng thái ghi nhận trong quá khứ, hiện tại dữ liệu có thể đã hết hạn.",
  };
  /*  CHIP SẴN SÀNG (2026-08-02g) — gộp "online lần cuối" + "dữ liệu tới ngày
      nào", và ĐO TRÊN ĐÚNG KHO SẼ RA KHƠI. Luật thuần + test ở lib/app-usage.ts.
      Hai con số này tách ra thì người trực tổng đài phải tự ghép trong đầu mỗi
      hàng một lần — và sẽ bỏ sót đúng nhóm nguy hiểm nhất: đã cài, đã đủ đồ, mở
      app hằng ngày, nhưng toàn mở bằng Safari nên kho ra khơi đứng im. */
  /*  ĐỒNG HỒ CHỤP LÚC MOUNT, KHÔNG GỌI TRONG THÂN RENDER (sửa 2026-08-03).
      `Date.now()` là hàm KHÔNG THUẦN; gọi thẳng khi vẽ làm React không bảo đảm
      được kết quả ổn định giữa hai lượt vẽ, và `react-hooks/purity` bắt lỗi —
      cổng `npm run lint` của CI là cổng CỨNG nên chỗ này đang CHẶN MỌI PUSH vào
      `main`. Chip chỉ đo tuổi theo NGÀY (mốc online lần cuối, dữ liệu tới ngày
      nào), nên một mốc chụp lúc mount là quá đủ; trang tự vẽ lại khi tải lại
      danh sách khách, lúc đó mốc cũng mới theo. */
  const [bayGio] = useState(() => Date.now());
  const rd = readinessChip(
    {
      pwaLastOpenAt: a.pwaLastOpenAt ?? null,
      webLastOpenAt: a.webLastOpenAt ?? null,
      dataUntil: a.dataUntil ?? null,
      dataUntilWeb: a.dataUntilWeb ?? null,
    },
    bayGio,
  );
  const rdSkin: Record<ReadinessTone, string> = {
    ok: "bg-ok-bg text-ok",
    warn: "bg-warn-bg text-warn",
    risk: "bg-danger-bg text-danger",
    unknown: "bg-field text-foreground/50",
  };
  const rdLabel: Record<ReadinessReason, string> = {
    "chua-ghi-nhan": "Chưa ghi nhận hoạt động",
    "chua-cai": "Chưa sử dụng bản cài",
    "ban-cai-cu": "Lâu chưa mở lại bản cài",
    "het-du-lieu": "Đã hết dữ liệu lưu trữ",
    "sap-can": "Dữ liệu lưu trữ sắp hết hạn",
    "mat-song-lau": "Lâu chưa kết nối mạng",
    "chua-bao-ngay": "Không rõ trạng thái dữ liệu",
    on: "Sẵn sàng sử dụng",
  };
  /* VIỆC CẦN LÀM, không phải mô tả trạng thái — nhân viên đọc là gọi được luôn */
  const rdWhy: Record<ReadinessReason, string> = {
    "chua-ghi-nhan":
      "Thiết bị chưa gửi tín hiệu (không có nghĩa là khách chưa dùng app, vì tín hiệu chỉ gửi khi đã đăng nhập và có mạng, ghi nhận từ 01/08/2026).",
    "chua-cai":
      "Khách mới dùng trên trình duyệt. Đối với iPhone, dữ liệu tải trên Safari sẽ không dùng được khi ra khơi. Gọi nhắc khách mở bằng icon ngoài Màn hình chính để tải dữ liệu.",
    "ban-cai-cu":
      "Khách đã cài app nhưng gần đây chỉ dùng trên trình duyệt. Dữ liệu trên bản cài không được cập nhật. Vui lòng gọi nhắc khách mở đúng icon ứng dụng khi có mạng.",
    "het-du-lieu":
      "Dữ liệu dự báo trong bản cài đã hết hạn. Nếu ra khơi lúc này sẽ không có thông tin. Cần gọi hỗ trợ ngay.",
    "sap-can":
      "Dữ liệu dự báo trong app chỉ còn vài ngày. Vui lòng gọi nhắc khách cập nhật dự báo mới khi có mạng.",
    "mat-song-lau":
      "Thiết bị đã lâu không kết nối mạng, số liệu này là từ lần cuối cập nhật. Khả năng tàu đang ở ngoài khơi.",
    "chua-bao-ngay":
      "Thiết bị có mở ứng dụng gần đây nhưng chưa báo cáo tình trạng dữ liệu.",
    on: "Ứng dụng được mở gần đây và dữ liệu dự báo vẫn còn dài hạn. Không cần gọi hỗ trợ.",
  };
  const mocs = [
    /*  DÁN NHÃN KHO (0027): trên iOS kho bản cài tách riêng Safari, nên một con
        số trần "dữ liệu tới 17/08" là câu nói thiếu — không biết nó tả cái kho
        sẽ ra khơi hay cái kho nằm lại bờ. */
    /*  ⚠️ CHỈ DÁM NÓI "bản cài" KHI MÁY ĐÃ TỪNG MỞ BẢN CÀI (sửa 2026-08-03b —
        chủ dự án bắt được mâu thuẫn thật trên prod: Thu Hà chip ghi "Chưa mở
        bản cài" mà dòng dưới ghi "bản cài: dữ liệu tới 17/08").
        Nguồn gốc: TRƯỚC migration 0038, `data_until` được ghi cho MỌI nhịp kể cả
        nhịp từ WEB. Sau khi tách cột, mấy giá trị cũ đó nằm lại trong cột "bản
        cài" — đo trên prod có 3 tài khoản dính (`pwa_last_open_at` NULL mà
        `data_until` có ngày). Mã hiện tại không đẻ thêm được ca này.
        Vì sao phải sửa gấp: lỗi lệch về phía NGUY HIỂM — người trực thấy "bản
        cài: tới 17/08" sẽ KHÔNG gọi đúng người cần gọi nhất, tức người có đủ dữ
        liệu trong Safari nhưng ra khơi tay trắng. Đó chính là nhóm cả tính năng
        này sinh ra để tìm. */
    a.dataUntil
      ? a.pwaLastOpenAt
        ? `bản cài đặt: dữ liệu sử dụng được đến ${fmtNgay(a.dataUntil)}`
        : `trạng thái cũ (trước 08/2026): dữ liệu sử dụng được đến ${fmtNgay(a.dataUntil)}`
      : null,
    a.dataUntilWeb ? `trình duyệt web: dữ liệu sử dụng được đến ${fmtNgay(a.dataUntilWeb)}` : null,
    /*  KHO CỦA MÁY (0029) — con số quyết định "dữ liệu đi biển nên nằm kho nào",
        và là chỗ duy nhất biết iOS thật sự cho bao nhiêu. Hiện cả hai để nhìn ra
        máy nào sắp đầy (used tiến sát quota = gọi nhắc dọn bớt ảnh/video TRƯỚC
        khi ra khơi, đừng để ra tới biển mới biết không lưu được). */
    a.storageQuotaMb != null
      ? `kho ${a.storageUsedMb ?? "?"}/${a.storageQuotaMb} MB`
      : null,
    /*  ĐÃ LƯU Ở ĐÂU (0030) — bốn câu hỏi chủ dự án cần trả lời được từ trang này.
        Trên WebKit các kho KHÔNG bình đẳng: localStorage có trần RIÊNG ~5 MB
        (và iOS 16 chạm trần là XOÁ SẠCH nó, kéo theo chuỗi đăng nhập), còn
        IndexedDB/Cache dùng chung hạn ngạch origin. Nên một con số tổng không
        nói được kho nào sắp chật. */
    a.storageLsMb != null || a.storageIdbMb != null
      ? `lưu trữ: ls ${a.storageLsMb ?? "?"} · idb ${a.storageIdbMb ?? "?"} · cache ${a.storageCacheMb ?? "?"} MB`
      : null,
    /*  CÒN CHỖ KHÔNG — gần 0 là máy sắp không giữ nổi gói đi biển, đáng gọi
        nhắc dọn ảnh/video TRƯỚC khi nhổ neo. */
    a.storageAvailableMb != null ? `dung lượng trống ${a.storageAvailableMb} MB` : null,
    /*  ⚠️ KHO DỰ BÁO CÒN KẸT Ở localStorage — máy không mở nổi IndexedDB nên
        đang chở ~4 MB trong thùng 5 MB, tức chạy sát mép lỗi iOS 16. Chỉ nêu
        khi ĐANG kẹt: trạng thái đúng thì không cần chiếm chỗ trên màn hình. */
    a.storageBackend === "ls" ? "⚠️ Kho dự báo đang dùng bộ nhớ tạm (localStorage)" : null,
    /*  BỘ NHỚ BỀN — chống vòng thu hồi LRU khi máy đầy. Luật "chỉ nói khi CÒN
        LÀM ĐƯỢC GÌ" nằm ở `persistNote` (lib/app-usage, có test): máy đã cài,
        còn 39 GB trống mà vẫn hô "chưa được cấp bộ nhớ bền" là bắt nhân viên
        gọi điện nhắc một việc không tồn tại — chủ dự án bắt được đúng ca đó
        2026-08-03. */
    persistNote({
      persisted: a.storagePersisted ?? null,
      asked: a.storagePersistAsked ?? null,
      availableMb: a.storageAvailableMb ?? null,
    }),
    a.offlineReadyAt ? `dữ liệu đầy đủ lúc ${fmtDT(a.offlineReadyAt)}` : null,
    a.pwaLastOpenAt ? `mở app lần cuối lúc ${fmtDT(a.pwaLastOpenAt)}` : null,
    a.webLastOpenAt ? `mở trên web lần cuối lúc ${fmtDT(a.webLastOpenAt)}` : null,
  ].filter(Boolean);
  return (
    <>
      {/*  HAI HÀNG, HAI CÂU HỎI (chủ dự án chốt 2026-08-03: "tách 2 hàng để
           phân biệt rõ user này đã đi qua đủ nấc thang web→pwa→dữ liệu; 1 hàng
           là liên quan tới hiện trạng").
           · HÀNG 1 — ĐÃ ĐI TỚI ĐÂU: thang MỘT CHIỀU, chỉ tiến. Loại máy nằm ở
             đây (chủ dự án chốt) vì nó quyết định BƯỚC HƯỚNG DẪN của cả thang:
             iPhone thì bản cài có kho RIÊNG nên nấc "bản cài" là ải thật;
             Android dùng chung kho nên ải đó nhẹ hơn. Chip "đổi máy" cũng ở đây
             vì đổi máy là ĐẶT LẠI cả thang.
           · HÀNG 2 — BÂY GIỜ RA SAO: có LÙI được (dữ liệu hết hạn, lâu chưa lên
             sóng). Đây mới là chip trả lời "có phải gọi người này không". */}
      <div className="flex flex-wrap items-center gap-1.5">
      {/* LOẠI MÁY (0022) — nhân viên gọi điện phải chỉ ĐÚNG bước của máy đó:
          iPhone thì Chia sẻ → Thêm vào Màn hình chính (và bản cài có kho RIÊNG
          tách Safari), Android thì Cài ứng dụng. Chỉ hiện khi máy đã báo. */}
      {a.devicePlatform && (
        <span
          title={
            a.devicePlatform === "ios"
              ? "Với iPhone/iPad — Hướng dẫn: Bấm nút Chia sẻ → Thêm vào Màn hình chính. LƯU Ý: Bản cài ngoài Màn hình chính có kho lưu trữ độc lập, dữ liệu tải qua trình duyệt Safari sẽ không dùng được."
              : a.devicePlatform === "android"
                ? "Với máy Android — Hướng dẫn: Bấm Cài ứng dụng. Ứng dụng dùng chung bộ nhớ với trình duyệt Chrome nên có thể tải dữ liệu trên nền tảng nào cũng được."
                : "Hệ thống không xác định được thiết bị là iPhone hay Android (có thể khách dùng máy tính hoặc trình duyệt khác)."
          }
          className="rounded-full bg-field px-2 py-0.5 text-[0.75rem] font-semibold text-foreground/70"
        >
          {PLATFORM_LABEL[a.devicePlatform]}
        </span>
      )}
      {/*  Chip THANG — LUÔN hiện, không bao giờ giấu (sửa 2026-08-03j).
           Bản trước giấu nó khi trùng câu với chip sẵn sàng. Luật đó đúng khi
           bốn chip nằm CHUNG một hàng, nhưng từ khi tách hai hàng thì giấu =
           hàng "đã đi tới đâu" TRỐNG RỖNG ở đúng hai bậc thấp nhất, trong đó có
           `moi-vo-web` — nhóm đáng gọi điện NHẤT. Chuyện trùng câu nay xử tận
           gốc ở `USAGE_STAGE_LABEL` (đổi sang "Mới vô web" / "Chưa có nhịp"),
           nên không còn gì để giấu. */}
      <span
        title={why[stage]}
        className={`rounded-full px-2 py-0.5 text-[0.75rem] font-bold ${skin[stage]}`}
      >
        {USAGE_STAGE_LABEL[stage]}
      </span>
      {/* ĐÃ ĐỔI MÁY (bảng customer_devices, 0033) — chỉ hiện khi TỪ 2 MÁY trở
          lên; một máy là chuyện thường, không cần chip. Danh sách nằm trong
          tooltip cho khỏi tốn chỗ: hàng khách vốn đã dày. Máy MỚI NHẤT đứng
          đầu (API trả theo last_seen_at giảm dần). */}
      {a.devices.length > 1 && (
        <span
          title={[
            `Tài khoản này đã sử dụng trên ${a.devices.length} thiết bị (thiết bị mới nhất ở trên):`,
            ...a.devices.map(
              (d, i) =>
                `${i === 0 ? "▸ thiết bị đang dùng" : "·"} ${
                  d.platform ? PLATFORM_LABEL[d.platform] : "Không xác định được thiết bị"
                } …${d.tag} — lần đầu ${fmtD(d.firstSeenAt)}, gần nhất ${fmtDT(d.lastSeenAt)}`,
            ),
            "",
            "Số liệu này thuộc về thiết bị ĐANG SỬ DỤNG — nếu khách đổi máy, thống kê sẽ tính lại từ đầu.",
          ].join("\n")}
          className="rounded-full bg-warn-bg px-2 py-0.5 text-[0.75rem] font-bold text-warn"
        >
          Đã đổi {a.devices.length} máy
        </span>
      )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
      {/* CHIP SẴN SÀNG — gộp "online lần cuối" + "dữ liệu tới ngày nào", đo trên
          ĐÚNG kho sẽ ra khơi. Đứng ngay sau bậc thang vì đây mới là chip trả lời
          câu "có phải gọi người này không". */}
      <span
        title={rdWhy[rd.reason]}
        className={`rounded-full px-2 py-0.5 text-[0.75rem] font-bold ${rdSkin[rd.tone]}`}
      >
        {rdLabel[rd.reason]}
        {/*  VIẾT ĐỦ CHỮ "ngày" (sửa 2026-08-03b, chủ dự án hỏi "13n là gì?").
             Viết tắt bắt người đọc suy luận — trái luật của chính dự án cho
             người dùng 40–60 tuổi, và trang này thì người trực đọc lướt hàng
             trăm hàng. Con số là SỐ NGÀY TRỌN VẸN còn lại (cắt phần đã trôi của
             hôm nay), nên nó nhỏ hơn hiệu hai ngày lịch đúng 1 — nói "trọn" để
             không chỏi với dòng "dữ liệu tới 17/08" ngay bên cạnh. */}
        {rd.seaDays != null && rd.seaDays > 0
          ? ` · còn ${rd.seaDays} ngày đầy đủ dữ liệu`
          : ""}
      </span>
      </div>
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
export function FlagToggle({
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

/** Chọn kỳ hạn premium: các gói dựng sẵn (PREMIUM_TERM_PRESETS) + ô "Khác" nhập
 *  số tháng tuỳ ý. Dùng chung dialog cấp/gia hạn và form tạo tài khoản — thêm
 *  gói mới chỉ cần sửa PREMIUM_TERM_PRESETS ở lib/tier. `onChange` trả số đã
 *  clamp về khoảng hợp lệ. */
export function PremiumTermPicker({
  months,
  onChange,
}: {
  months: number;
  onChange: (m: number) => void;
}) {
  const isPreset = PREMIUM_TERM_PRESETS.some((p) => p.months === months);
  const [customText, setCustomText] = useState(isPreset ? "" : String(months));

  // preset được chọn từ nơi khác (mở dialog với mặc định) → xoá ô Khác cho khớp
  useEffect(() => {
    if (isPreset) setCustomText("");
  }, [isPreset]);

  return (
    <div className="mt-3 text-left">
      <p className="text-[0.875rem] font-bold text-foreground/70">Kỳ hạn</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {PREMIUM_TERM_PRESETS.map((p) => (
          <button
            key={p.months}
            type="button"
            onClick={() => onChange(p.months)}
            className={`min-h-[2.5rem] rounded-lg px-3 text-[0.875rem] font-bold ${
              months === p.months
                ? "bg-navy text-white"
                : "bg-card text-foreground/70"
            }`}
          >
            {p.label}
          </button>
        ))}
        <label
          className={`flex min-h-[2.5rem] items-center gap-1.5 rounded-lg px-3 text-[0.875rem] font-bold ${
            !isPreset ? "bg-navy text-white" : "bg-card text-foreground/70"
          }`}
        >
          Khác
          <input
            type="number"
            inputMode="numeric"
            min={PREMIUM_TERM_MIN_MONTHS}
            max={PREMIUM_TERM_MAX_MONTHS}
            value={customText}
            placeholder="tháng"
            onChange={(e) => {
              const v = e.target.value;
              setCustomText(v);
              if (v.trim() !== "") onChange(clampTermMonths(v));
            }}
            className="w-16 rounded bg-card px-2 py-1 text-center text-foreground"
          />
        </label>
      </div>
    </div>
  );
}

/** Tạo tài khoản KHÁCH (người dùng app: thường hoặc premium). Nhân sự
 *  (quản lý / quản trị viên) tạo ở tab Phân quyền — xem CreateStaffForm. */
export function CreateAccountForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  // ĐIỀN SẴN mật khẩu mặc định của khách (2026-10-06, user chốt: "set mặc định
  // mật khẩu về sd123456, hiện tại còn lung tung") — vẫn sửa được khi cần.
  const [password, setPassword] = useState(DEFAULT_CUSTOMER_PASSWORD);
  const [activatePremium, setActivatePremium] = useState(false);
  // kỳ hạn premium khi tạo kèm — chỉ gửi khi có tick activatePremium
  const [premiumMonths, setPremiumMonths] = useState(PREMIUM_TERM_MONTHS);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch(apiUrl("/api/admin/accounts"), {
      method: "POST",
      headers: { "content-type": "application/json", ...tokenHeader() },
      // premium khi tạo = một lần KÍCH HOẠT chuẩn (kỳ hạn admin chọn, server tính hạn + log)
      body: JSON.stringify({
        phone,
        name,
        password,
        role: "customer",
        activatePremium,
        ...(activatePremium ? { termMonths: premiumMonths } : {}),
      }),
    }).catch(() => null);
    setBusy(false);
    const j = (await r?.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
      provisioned?: boolean;
      existed?: boolean;
      role?: string;
      keptRole?: boolean;
    } | null;
    if (!r?.ok || !j?.ok) {
      setMsg(
        j?.code === "bad_phone"
          ? "Số điện thoại không đúng định dạng."
          : j?.code === "bad_password"
            ? "Mật khẩu cần có ít nhất 6 ký tự."
            : "Tạo tài khoản không thành công. Vui lòng thử lại.",
      );
      return;
    }
    setMsg(
      j.existed
        ? `Số ${phone} đã có tài khoản từ trước — mật khẩu cũ giữ nguyên${activatePremium ? ", đã kích hoạt Premium" : ""}.${j.keptRole ? ` Giữ nguyên vai ${j.role === "admin" ? "quản trị viên" : "quản lý"} (muốn hạ vai thì dùng tab Phân quyền).` : ""}`
        : j.provisioned
        ? `Tạo thành công. Vui lòng báo khách đăng nhập bằng SĐT và mật khẩu ${password.trim()} (app sẽ nhắc đổi mật khẩu ở lần đầu tiên).`
        : "Đã lưu thông tin nhưng lỗi quá trình tạo tài khoản đăng nhập. Vui lòng kiểm tra lại.",
    );
    setPhone("");
    setName("");
    setPassword(DEFAULT_CUSTOMER_PASSWORD);
    setActivatePremium(false);
    setPremiumMonths(PREMIUM_TERM_MONTHS);
    onCreated();
  }

  const field =
    "min-h-[2.75rem] w-full rounded-xl border-0 bg-field px-3 text-[0.9375rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea";

  return (
    <div className="surface px-4 py-3.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[2.75rem] w-full items-center justify-between gap-3 text-left text-[1rem] font-bold text-navy"
        aria-expanded={open}
      >
        Tạo tài khoản khách
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <form
          onSubmit={submit}
          className="anim-fade-in mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <input
            required
            inputMode="numeric"
            placeholder="Số điện thoại (ví dụ: 0901234567)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={field}
          />
          <input
            placeholder="Tên khách hàng (tuỳ chọn)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
          />
          <input
            required
            type="text"
            aria-label="Mật khẩu ban đầu (mặc định sd123456)"
            placeholder="Mật khẩu tạm thời (≥6 ký tự)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
          <div className="grid gap-2 sm:col-span-2 lg:col-span-2">
            <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-2.5 rounded-xl bg-field px-3.5 text-[0.875rem] font-bold text-foreground/80">
              <input
                type="checkbox"
                checked={activatePremium}
                onChange={(e) => setActivatePremium(e.target.checked)}
                className="h-5 w-5 accent-[var(--ok)]"
              />
              Kích hoạt premium {premiumTermLabel(premiumMonths)} ngay khi tạo
            </label>
            {activatePremium && (
              <div className="rounded-xl bg-field px-3.5 py-2.5">
                <PremiumTermPicker
                  months={premiumMonths}
                  onChange={setPremiumMonths}
                />
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={busy}
            className="min-h-[2.75rem] rounded-xl bg-trim text-[0.9375rem] font-bold text-white disabled:opacity-50 sm:col-span-2 lg:col-span-4"
          >
            {busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
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
