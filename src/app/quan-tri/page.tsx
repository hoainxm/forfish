"use client";

/*
  /quan-tri — WEB QUẢN TRỊ (staff: admin toàn quyền · quản lý theo bảng quyền;
  vai ở bảng staff_accounts — RBAC 2026-10-02, lib/staff-store). ĐỘC LẬP về giao
  diện (app-shell cho khu này thoát khung mobile + dock), CHUNG deploy/DB với
  app ngư dân. Người dùng là STAFF SDVICO — desktop-first, responsive xuống
  tablet/mobile (bổ sung 2026-07-26 theo yêu cầu chủ dự án: search, confirm
  khi nâng premium/xoá bằng dialog trong trang, dải số thống kê).
  Ba tab:
  · Tài khoản — thống kê + tìm kiếm/lọc + danh sách khách, tạo tay, đổi hạng
    (confirm + chọn hạn), xoá (confirm)
  · Dữ liệu  — tình trạng các nguồn (client gọi API sẵn có của app)
  · Hệ thống — env, đếm, migration, nhịp webhook
  Quyền THẬT nằm ở /api/admin/* (requireStaff/requireAdmin/requirePermission)
  — trang này chỉ là vỏ hiển thị. Đăng nhập = chuỗi cứng như app (hạn 7 ngày).
*/

import { clearKairosLocal } from "@/lib/kairos/cache";
import dynamic from "next/dynamic";
import { AdminNav, AdminSkeleton } from "@/components/admin/admin-nav";
import { MarketAdminTab } from "@/components/admin/market-admin-tab";
import { timeoutSignal } from "@/lib/abort";
import { normalizeOwnerLogin, ownerEmail } from "@/lib/admin";
import { ADMIN_TAB_LABEL, ALL_ADMIN_TABS, groupVisibleTabs, tabFromHash, type AdminTab } from "@/lib/admin-nav";
import { apiUrl } from "@/lib/api-base";
import { deviceId } from "@/lib/device-id";
import { isValidTokenShape } from "@/lib/device-token";
import { saveToken, signOutLocal, tokenHeader } from "@/lib/device-token-store";
import { clearInbox } from "@/lib/inbox";
import { tokenIssueErrorMessage } from "@/lib/login-error";
import { isValidVnPhone, phoneToEmail, sanitizePhoneInput } from "@/lib/phone";
import { visibleTabs } from "@/lib/staff-permissions";
import { devicePlatform } from "@/lib/storage-persist";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { type Health, type Me, permsFor } from "@/components/admin/quan-tri-chung";

/*  TAB NẠP KHI MỞ (2026-10-19, rà Codex đợt 3: "tách trang quản trị theo chức năng và tải khi mở tab").
    Mỗi tab một file trong src/components/admin/tab-*.tsx; mở tab nào mới tải mã tab đó. */
const SellContactsTab = dynamic(() => import("@/components/admin/tab-cho-ban").then((m) => m.SellContactsTab), { loading: () => <AdminSkeleton label="Đang mở mục…" /> });
const OrdersTab = dynamic(() => import("@/components/admin/tab-don-hang").then((m) => m.OrdersTab), { loading: () => <AdminSkeleton label="Đang mở mục…" /> });
const DataTab = dynamic(() => import("@/components/admin/tab-he-thong").then((m) => m.DataTab), { loading: () => <AdminSkeleton label="Đang mở mục…" /> });
const SystemTab = dynamic(() => import("@/components/admin/tab-he-thong").then((m) => m.SystemTab), { loading: () => <AdminSkeleton label="Đang mở mục…" /> });
const InquiriesTab = dynamic(() => import("@/components/admin/tab-hoi-mua").then((m) => m.InquiriesTab), { loading: () => <AdminSkeleton label="Đang mở mục…" /> });
const ActivityLogTab = dynamic(() => import("@/components/admin/tab-nhat-ky").then((m) => m.ActivityLogTab), { loading: () => <AdminSkeleton label="Đang mở mục…" /> });
const PermissionsTab = dynamic(() => import("@/components/admin/tab-phan-quyen").then((m) => m.PermissionsTab), { loading: () => <AdminSkeleton label="Đang mở mục…" /> });
const ProductsTab = dynamic(() => import("@/components/admin/tab-san-pham").then((m) => m.ProductsTab), { loading: () => <AdminSkeleton label="Đang mở mục…" /> });
const AccountsTab = dynamic(() => import("@/components/admin/tab-tai-khoan").then((m) => m.AccountsTab), { loading: () => <AdminSkeleton label="Đang mở mục…" /> });
const PushNotificationsTab = dynamic(() => import("@/components/admin/tab-thong-bao").then((m) => m.PushNotificationsTab), { loading: () => <AdminSkeleton label="Đang mở mục…" /> });
const CrewReportsTab = dynamic(() => import("@/components/admin/tab-thuyen-vien").then((m) => m.CrewReportsTab), { loading: () => <AdminSkeleton label="Đang mở mục…" /> });
const KairosTab = dynamic(() => import("@/components/admin/tab-kairos").then((m) => m.KairosTab), { loading: () => <AdminSkeleton label="Đang mở mục…" /> });
const ReportsTab = dynamic(() => import("@/components/admin/tab-bao-cao").then((m) => m.ReportsTab), { loading: () => <AdminSkeleton label="Đang mở mục…" /> });
const VmsZonesTab = dynamic(() => import("@/components/admin/tab-vung-vms").then((m) => m.VmsZonesTab), { loading: () => <AdminSkeleton label="Đang mở mục…" /> });

type Tab = AdminTab;

export default function QuanTriPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("tai-khoan");
  // Tab nằm trên #hash: tải lại / gửi link vẫn mở đúng khu (đọc sau mount —
  // SSR không có window).
  useEffect(() => {
    const fromHash = tabFromHash(window.location.hash);
    if (fromHash) setTab(fromHash);
  }, []);
  const selectTab = useCallback((next: Tab) => {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
    // đổi khu thì về đầu nội dung — đỡ rơi giữa danh sách dài của tab trước
    window.scrollTo({ top: 0 });
  }, []);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthErr, setHealthErr] = useState<number | null>(null);

  const loadHealth = useCallback(() => {
    setHealth(null);
    setHealthErr(null);
    fetch(apiUrl("/api/admin/health"), { headers: tokenHeader() })
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
    /* DỌN MÁY GIỐNG HỆT NÚT ĐĂNG XUẤT CỦA APP (sửa 2026-08-02). Trước đây chỗ
       này gọi signOut() TRẦN: danh tính offline (`forfish.identity.v1`) ở lại
       máy VĨNH VIỄN, kéo theo `shouldClearPremiumMark` không bao giờ đúng nữa —
       tức dấu premium cũng không bao giờ được dọn trên máy đó. Staff SDVICO hay
       dùng chung máy, và máy đó cũng chạy app khách. /quan-tri chạy ở bờ nên
       không cần đồng hồ như hero-account: mất sóng thì cùng lắm phiên còn trên
       máy chủ, phần trong máy vẫn phải sạch. */
    clearInbox();
    clearKairosLocal(); // bản lưu dòng tin + nháp Kairos (14 §8)
    /*  THU HỒI CHUỖI Ở MÁY CHỦ rồi xoá ở máy (2026-10-02). Bản cũ chỉ bỏ phiên
        Supabase: chuỗi cứng vẫn nằm trong máy ⇒ bấm Đăng xuất xong /quan-tri
        vẫn vào được, và chuỗi admin (nhiều máy) sống tiếp trên máy dùng chung.
        Mất sóng thì vẫn dọn máy — chuỗi trên máy chủ tự hết hạn (staff 7 ngày). */
    await fetch(apiUrl("/api/auth/token"), {
      method: "DELETE",
      headers: tokenHeader(),
      signal: timeoutSignal(8000),
    }).catch(() => null);
    // signOutLocal đi qua CỔNG DUY NHẤT (K7) — quên = xoá luôn dấu hạng
    signOutLocal("user");
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
      <div className="mx-auto max-w-[40rem] px-4 py-16 text-center">
        <h1 className="display text-[1.5rem] font-bold text-navy">
          Trang quản trị SDFish
        </h1>
        <p className="mt-3 text-[1.125rem] leading-snug text-foreground/70">
          {healthErr === 403 &&
            "Tài khoản này chưa được cấp quyền quản trị. Vui lòng liên hệ Admin để được hỗ trợ."}
          {healthErr === 503 &&
            "Chưa kết nối được cơ sở dữ liệu (Supabase). Trang quản trị không chạy ở chế độ dùng thử."}
          {healthErr === 0 && "Không kết nối được với máy chủ. Bạn kiểm tra lại mạng rồi tải lại trang nhé."}
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
      <div className="mx-auto max-w-[75rem] px-4 pb-16 pt-6 md:px-8">
        <div className="flex items-center gap-3" aria-hidden>
          <div className="h-11 w-11 animate-pulse rounded-xl bg-field" />
          <div className="space-y-2">
            <div className="h-5 w-40 animate-pulse rounded-md bg-field" />
            <div className="h-3.5 w-28 animate-pulse rounded-md bg-field" />
          </div>
        </div>
        <div className="mt-6 md:grid md:grid-cols-[13.5rem_minmax(0,1fr)] md:gap-8">
          <div className="hidden space-y-2 md:block" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-xl bg-field" />
            ))}
          </div>
          <AdminSkeleton label="Đang kiểm tra quyền quản trị…" rows={4} />
        </div>
      </div>
    );
  }

  /*  Thiếu `me` → coi là QUẢN LÝ KHÔNG QUYỀN (thấy rỗng), KHÔNG phải admin
      (bản cũ mặc định "admin" — fail-open ở vỏ; quyền thật vẫn ở server nhưng
      vỏ không được hứa thứ người đó không có). */
  const me: Me = {
    phone: health.me?.phone ?? "",
    role: health.me?.role ?? "manager",
    permissions: health.me?.permissions ?? null,
  };
  const isAdmin = me.role === "admin";

  // TAB được thấy: admin = đủ; quản lý = chỉ các tab có cờ view trong bảng
  // quyền (tab admin-only cứng không bao giờ hiện). Rồi XẾP vào nhóm.
  const visible: Tab[] = isAdmin ? ALL_ADMIN_TABS : visibleTabs(me.permissions);
  const groups = groupVisibleTabs(visible);

  // Tab đang chọn không nằm trong danh sách được phép → về tab đầu (quản lý bị
  // thu quyền giữa chừng / hash lạ vẫn không kẹt ở tab trống).
  const activeTab = visible.includes(tab) ? tab : (visible[0] ?? tab);

  return (
    <div className="mx-auto max-w-[75rem] px-4 pb-16 pt-6 md:px-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* Logo CHUNG với app ngư dân (bộ icon PWA sinh từ image/logo sdfish.png) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt="SDFish"
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-xl border border-line"
          />
          <div className="min-w-0">
            <h1 className="display text-[1.5rem] font-bold leading-tight text-navy md:text-[1.75rem]">
              SDFish Quản trị
            </h1>
            <p className="mt-0.5 truncate text-[0.9375rem] text-foreground/65">
              {isAdmin
                ? "Quản trị viên · toàn quyền"
                : `Quản lý · ${me.phone}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="min-h-[2.75rem] shrink-0 rounded-xl bg-field px-4 text-[0.875rem] font-bold text-navy transition-transform active:scale-[0.98]"
        >
          Đăng xuất
        </button>
      </header>

      {/* Điều hướng theo NHÓM (lib/admin-nav): cột trái trên desktop, thanh
          dính đầu màn trên mobile. Danh sách tab đã lọc theo vai ở trên. */}
      <div className="mt-4 md:mt-6 md:grid md:grid-cols-[13.5rem_minmax(0,1fr)] md:gap-8">
        <AdminNav groups={groups} active={activeTab} onSelect={selectTab} />

        {/* key = tab ⇒ mỗi lần đổi khu, nội dung mới hiện mờ dần (motion điềm
            đạm có sẵn, tự tắt khi máy bật giảm chuyển động). */}
        <section key={activeTab} className="anim-fade-in min-w-0" role="tabpanel">
          <h2 className="mt-4 hidden text-[1.25rem] font-bold text-navy md:mt-0 md:block">
            {ADMIN_TAB_LABEL[activeTab]}
          </h2>
      {activeTab === "tai-khoan" && <AccountsTab me={me} />}
      {activeTab === "canh-bao" && (
        <CrewReportsTab perms={permsFor(me, "canh-bao")} />
      )}
      {activeTab === "san-pham" && (
        <ProductsTab perms={permsFor(me, "san-pham")} />
      )}
      {activeTab === "don-hang" && (
        <OrdersTab perms={permsFor(me, "don-hang")} />
      )}
      {activeTab === "cho-vat-tu" && <MarketAdminTab me={me} canEdit={permsFor(me, "cho-vat-tu").edit} />}
      {activeTab === "yeu-cau" && <InquiriesTab perms={permsFor(me, "yeu-cau")} />}
      {activeTab === "vung-bien" && <VmsZonesTab perms={permsFor(me, "vung-bien")} />}
      {activeTab === "cho-ban" && (
        <SellContactsTab perms={permsFor(me, "cho-ban")} />
      )}
      {activeTab === "thong-bao" && (
        <PushNotificationsTab perms={permsFor(me, "thong-bao")} />
      )}
      {activeTab === "du-lieu" && <DataTab />}
      {activeTab === "he-thong" && isAdmin && <SystemTab health={health} />}
      {activeTab === "phan-quyen" && isAdmin && <PermissionsTab />}
      {activeTab === "nhat-ky" && <ActivityLogTab canProbe={isAdmin} />}
      {activeTab === "kairos" && <KairosTab perms={permsFor(me, "kairos")} />}
      {activeTab === "bao-cao" && <ReportsTab />}
        </section>
      </div>
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
    /*  SĐT như mọi tài khoản, HOẶC tên đăng nhập của ADMIN TỔNG (2026-10-02,
        vd "admin" → admin@sdvico.local). Máy không biết tên thật là gì — máy
        chủ chỉ nhận đúng tên khai ở OWNER_LOGIN (lib/admin authIdentity). */
    const loginName = isValidVnPhone(phone) ? null : normalizeOwnerLogin(phone);
    if (!isValidVnPhone(phone) && !loginName) {
      setError("Số điện thoại hoặc tên đăng nhập không đúng định dạng.");
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError(
        "Chưa kết nối được cơ sở dữ liệu (Supabase). Trang quản trị không chạy ở chế độ dùng thử.",
      );
      return;
    }
    setBusy(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: loginName ? ownerEmail(loginName) : phoneToEmail(phone),
      password,
    });
    if (signInError || !data.user) {
      setBusy(false);
      setError("Số điện thoại hoặc mật khẩu chưa đúng.");
      return;
    }
    /*  ĐỔI PHIÊN LẤY CHUỖI CỨNG như /login (RBAC 2026-10-02). Bản cũ chạy THUẦN
        phiên Supabase ⇒ mọi /api/admin/* sống nhờ "đường lùi cookie một nhịp
        phát hành" (api-identity.ts) — gỡ đường lùi là chết cả web quản trị. Nay
        nhận chuỗi (admin: nhiều máy, hạn 7 ngày — lib/admin tokenTtlMs) rồi
        bỏ phiên Supabase. Đổi mật khẩu lần đầu thì GIỮ phiên (màn đó cần). */
    let issued: {
      ok?: boolean;
      token?: unknown;
      code?: string;
      mustChangePassword?: boolean;
      tier?: string | null;
      premiumUntil?: string | null;
    } | null = null;
    try {
      const r = await fetch(apiUrl("/api/auth/token"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId: deviceId(), platform: devicePlatform() }),
        signal: timeoutSignal(20000),
      });
      issued = await r.json().catch(() => null);
    } catch {
      issued = null;
    }
    if (!issued) {
      setBusy(false);
      setError("Mạng yếu — bấm Đăng nhập lại.");
      return;
    }
    if (!issued.ok || !isValidTokenShape(issued.token)) {
      setBusy(false);
      setError(tokenIssueErrorMessage(issued.code ?? "issue_failed"));
      return;
    }
    const tierTho = typeof issued.tier === "string" ? issued.tier : "basic";
    if (
      !saveToken(
        issued.token,
        tierTho,
        tierTho === "premium" ? (issued.premiumUntil ?? null) : null,
      )
    ) {
      setBusy(false);
      setError("Trình duyệt đang chặn lưu trữ (chế độ Ẩn danh?) — tắt rồi đăng nhập lại.");
      return;
    }
    // tài khoản còn mật khẩu tạm: bắt đổi trước (đổi xong app trả về trang chủ,
    // quay lại /quan-tri là vào thẳng)
    if (
      issued.mustChangePassword === true ||
      data.user.user_metadata?.must_change_password === true
    ) {
      router.push("/doi-mat-khau");
      return;
    }
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* phiên tạm còn sót không nới quyền gì — chuỗi đã là thứ duy nhất được dùng */
    }
    setBusy(false);
    onLoggedIn(); // gọi lại /api/admin/health — đủ quyền là vào thẳng bảng điều khiển
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[26.25rem] flex-col justify-center px-4 py-10">
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
            Số điện thoại hoặc tên đăng nhập
          </span>
          <input
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            autoFocus
            placeholder="0901 234 567"
            value={phone}
            onChange={(e) => {
              const v = e.target.value;
              // có chữ cái = tên đăng nhập (admin tổng); chỉ số = SĐT như cũ
              setPhone(/[a-z]/i.test(v) ? v.trim().toLowerCase().slice(0, 32) : sanitizePhoneInput(v));
            }}
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
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>

      <p className="mt-3 px-1 text-[0.875rem] leading-snug text-foreground/60">
        Chỉ tài khoản quản trị viên hoặc quản lý được vào đây. Quên mật khẩu thì
        báo quản trị viên đặt lại giúp.
      </p>
    </div>
  );
}
