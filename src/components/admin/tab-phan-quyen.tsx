"use client";

/*  Tách nguyên văn khỏi src/app/quan-tri/page.tsx (2026-10-19, rà Codex đợt 3: trang quản trị 6.718 dòng
    — tách theo tab, KHÔNG đổi hành vi; trang chính nạp tab khi mở). */

import { AdminSkeleton } from "@/components/admin/admin-nav";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";
import { isValidVnPhone } from "@/lib/phone";
import { ACTION_LABEL, MANAGER_TABS, PERM_ACTIONS, RESET_PASSWORD_LABEL, TAB_ACTIONS, TAB_LABEL, type ManagerTab, type StaffPermissions } from "@/lib/staff-permissions";
import { DEFAULT_CUSTOMER_PASSWORD } from "@/lib/temp-password";
import { useCallback, useEffect, useMemo, useState } from "react";

/* ── PHÂN QUYỀN (admin-only) ───────────────────────────────────────────────
   Hai khối: (1) QUẢN TRỊ VIÊN toàn quyền — nâng/hạ ngay tại đây (nguồn DB
   role='admin'), riêng người từ env ADMIN_PHONES chỉ xem được vì web không
   sửa env; (2) bảng quyền từng tài khoản QUẢN LÝ: 13 khu × 4 hành động (TAB_ACTIONS)
   (Xem/Tạo mới/Sửa/Xóa). Chốt thật ở /api/admin/* (requireAdmin /
   requirePermission); màn này chỉ soạn cấu hình. */

export type ManagerPerm = {
  phone: string;
  name: string | null;
  permissions: StaffPermissions;
  configured: boolean;
  /** own = khách mình cấp · all_premium = đại lý tổng (0056) */
  scope?: "own" | "all_premium";
};

/** Một quản trị viên + NGUỒN quyền: 'db' hạ được ở đây, 'env' thì không. */
export type AdminRow = { phone: string; name: string | null; source: "owner" | "env" | "db" };

/**
 * Tạo tài khoản NHÂN SỰ (quản lý / quản trị viên) — tách hẳn khỏi form tạo
 * KHÁCH ở tab Tài khoản (user 2026-07-31: "tách hẳn luồng tạo quản trị viên và
 * user riêng ra cho đỡ lẫn"). Cùng gọi POST /api/admin/accounts (vẫn là một
 * hàng customers) nhưng server bắt ADMIN-ONLY khi role != 'customer'.
 * KHÔNG có ô premium: premium là HẠNG của người dùng app, không dính vai nhân
 * sự — cần thì cấp bên tab Tài khoản.
 */
export function CreateStaffForm({
  onCreated,
  canManageAdmins,
}: {
  onCreated: () => void;
  /** chỉ ADMIN TỔNG mới tạo được quản trị viên (server chốt lại: owner_only) */
  canManageAdmins: boolean;
}) {
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
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify({ phone, name, password, role }),
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
            ? "Mật khẩu cần có tối thiểu 6 ký tự."
            : j?.code === "admin_only"
              ? "Chỉ Quản trị viên (Admin) mới có quyền tạo tài khoản nhân sự."
              : "Tạo tài khoản không thành công. Vui lòng thử lại.",
      );
      return;
    }
    setMsg(
      j.existed
        ? `Số ${phone} đã có tài khoản từ trước — mật khẩu cũ giữ nguyên. Vai hiện tại: ${j.role === "admin" ? "quản trị viên" : "quản lý"}${j.keptRole ? " (giữ vai cao hơn; muốn hạ thì dùng nút Hạ bên dưới)" : ""}.`
        : j.provisioned
        ? `Đã tạo tài khoản ${role === "admin" ? "quản trị viên" : "quản lý"} cho số ${phone}. Vui lòng báo nhân sự đăng nhập bằng SĐT và mật khẩu tạm (ứng dụng sẽ yêu cầu đổi mật khẩu ở lần đầu tiên).`
        : "Đã lưu thông tin nhưng lỗi quá trình tạo tài khoản đăng nhập. Vui lòng kiểm tra lại.",
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
        className="flex min-h-[2.75rem] w-full items-center justify-between gap-3 text-left text-[1rem] font-bold text-navy"
        aria-expanded={open}
      >
        Tạo tài khoản nhân sự (quản lý / quản trị viên)
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <form
          onSubmit={submit}
          className="anim-fade-in mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <input
            required
            inputMode="numeric"
            placeholder="Số điện thoại (vd: 0901234567)"
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
            placeholder="Mật khẩu tạm thời (≥6 ký tự)"
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
                ["manager", "Cấp Quản lý — quyền hạn được cấp theo chức năng"],
                ["admin", "Cấp Quản trị viên — có toàn quyền trên hệ thống"],
              ] as ["manager" | "admin", string][]
            )
              .filter(([id]) => id !== "admin" || canManageAdmins)
              .map(([id, label]) => (
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
            {busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
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
          title={`Xác nhận cấp quyền Quản trị viên cho số ${phone}?`}
          message="Quản trị viên sẽ có toàn quyền trên hệ thống (xóa tài khoản, cấp mật khẩu, đổi phân quyền, gửi thông báo, v.v.). Nếu nhân sự chỉ phụ trách khách hàng theo khu vực, vui lòng chọn cấp độ Quản lý."
          confirmLabel="Xác nhận tạo Quản trị viên"
          cancelLabel="Hủy thao tác"
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

export function PermissionsTab() {
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
  const [canManageAdmins, setCanManageAdmins] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setManagers(null);
    fetch(apiUrl("/api/admin/staff"), { headers: tokenHeader() })
      .then(async (r) => {
        const j = (await r.json()) as {
          ok: boolean;
          code?: string;
          managers?: ManagerPerm[];
          admins?: AdminRow[];
          migrationNeeded?: boolean;
          canManageAdmins?: boolean;
        };
        if (!j.ok) throw new Error(j.code ?? "load");
        setManagers(j.managers ?? []);
        setAdmins(j.admins ?? []);
        setCanManageAdmins(j.canManageAdmins === true);
        setMigrationNeeded(Boolean(j.migrationNeeded));
      })
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Chưa kết nối được cơ sở dữ liệu (Supabase). Tính năng này không chạy ở chế độ dùng thử."
            : e.message === "admin_only"
              ? "Khu vực Phân quyền chỉ dành riêng cho Quản trị viên."
              : "Chưa tải được danh sách nhân sự quản lý. Vui lòng thử lại.",
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
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify({ action: "set-role", phone, role }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
    } | null;
    setRoleBusy(false);
    if (!r?.ok || !j?.ok) {
      const why: Record<string, string> = {
        self: "Bạn không thể tự hạ cấp tài khoản của chính mình — vui lòng nhờ một Quản trị viên khác thao tác.",
        env_admin:
          "Tài khoản này được cấp quyền trực tiếp từ biến môi trường ADMIN_PHONES — để hủy quyền, bạn cần cập nhật cấu hình trên máy chủ Vercel, không thể hủy trực tiếp trên giao diện web.",
        last_admin:
          "Đây là Quản trị viên DUY NHẤT còn lại — nếu bạn hạ cấp, sẽ không còn ai có quyền quản trị hệ thống. Vui lòng phân quyền cho một người khác trước.",
        not_found:
          "Hệ thống chưa có tài khoản nào dùng số điện thoại này — vui lòng tạo tài khoản mới ở tab Tài khoản trước.",
        bad_phone: "Số điện thoại không đúng định dạng.",
        owner_only: "Chỉ admin tổng mới nâng/hạ được quản trị viên.",
        owner: "Không thể thay đổi tài khoản admin tổng trên web.",
        not_real_account:
          "Đây là tài khoản test/demo — không được làm nhân sự. Đổi loại về \"Thật\" ở tab Tài khoản trước (có chủ ý).",
        unavailable: "Chưa tra được cơ sở dữ liệu — vui lòng thử lại sau ít phút.",
      };
      setRoleMsg(why[j?.code ?? ""] ?? "Phân quyền không thành công. Vui lòng thử lại.");
      return;
    }
    setRoleMsg(
      role === "admin"
        ? `Đã nâng cấp tài khoản ${phone} thành Quản trị viên.`
        : `Đã điều chỉnh tài khoản ${phone} xuống cấp Quản lý.`,
    );
    setPromotePhone("");
    load();
  }

  return (
    <div className="mt-4 space-y-4">
      <p className="surface px-4 py-3 text-[0.875rem] leading-snug text-foreground/70">
        Khu <b>QUẢN LÝ NHÂN SỰ</b>: tạo và phân quyền người làm việc trên web quản trị.
        Người dùng app (khách thường / premium) nằm ở tab <b>Danh sách tài khoản</b> —
        hai luồng tách hẳn cho khỏi lẫn.
        <br />
        <b className="text-navy">Quản trị viên</b> toàn quyền mọi khu, không cần
        cấu hình. <b className="text-navy">Quản lý</b> chạy theo bảng quyền: mọi
        khu × 4 mức <b>Xem · Tạo mới · Sửa · Xóa</b> (ô “—” = khu đó không có thao tác
        này); bỏ chọn <b>Xem</b> = ẩn hẳn khu đó. Riêng <b>Phân quyền</b> và{" "}
        <b>Cấu hình hệ thống</b> luôn chỉ dành cho quản trị viên.
      </p>

      <CreateStaffForm onCreated={load} canManageAdmins={canManageAdmins} />

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
                {a.source === "owner" ? (
                  <span
                    className="rounded-full bg-trim px-2 py-0.5 text-[0.75rem] font-bold text-white"
                    title="Tài khoản đăng nhập bằng tên, khai ở OWNER_LOGIN — người duy nhất nâng/hạ quản trị viên; web không hạ/xoá được"
                  >
                    admin tổng
                  </span>
                ) : a.source === "env" ? (
                  <span
                    className="rounded-full bg-field px-2 py-0.5 text-[0.75rem] font-bold text-foreground/65"
                    title="Nhận quyền trực tiếp từ biến môi trường ADMIN_PHONES — không thể thay đổi trên web, cần cập nhật trên máy chủ Vercel"
                  >
                    từ env · cửa cứu hộ
                  </span>
                ) : (
                  <>
                    <span className="rounded-full bg-navy px-2 py-0.5 text-[0.75rem] font-bold text-white">
                      từ tài khoản
                    </span>
                    {canManageAdmins && (
                    <button
                      type="button"
                      disabled={roleBusy}
                      onClick={() => setToDemote(a)}
                      className="min-h-[2rem] rounded-lg bg-danger-bg px-3 text-[0.75rem] font-bold text-danger disabled:opacity-50"
                    >
                      Hạ xuống quản lý
                    </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* NÂNG: nhập SĐT một tài khoản đã có → thành quản trị viên. CHỈ ADMIN
            TỔNG (2026-10-02) — quản trị viên thường không thấy ô này. */}
        {canManageAdmins && (
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3 sm:flex-row">
          <input
            inputMode="numeric"
            placeholder="Nhập SĐT của tài khoản muốn nâng lên Quản trị viên…"
            value={promotePhone}
            onChange={(e) => setPromotePhone(e.target.value)}
            aria-label="Số điện thoại cần nâng cấp"
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
        )}
        {roleMsg && (
          <p className="mt-2 text-[0.875rem] font-semibold text-foreground/75">
            {roleMsg}
          </p>
        )}
        <p className="mt-2 text-[0.8125rem] leading-snug text-foreground/60">
          Quản trị viên toàn quyền mọi khu, không cần bảng quyền. Chỉ{" "}
          <b>admin tổng</b> nâng/hạ được quản trị viên; quản trị viên quản lý
          nhân sự cấp Quản lý. Nâng/hạ ăn ngay, không cần deploy. Không thể tự
          hạ chính mình.
          <br />
          Người ghi <b>cấp quyền từ biến môi trường</b> nhận quyền từ hệ thống gốc <b>ADMIN_PHONES</b> trên
          Vercel — giữ làm cửa cứu hộ, web không hạ được. Muốn chuyển hẳn sang
          quản từ web: nâng chính SĐT đó lên quản trị viên ở ô dưới (ghi quyền
          vào tài khoản), kiểm tra vẫn vào được, rồi mới xoá nó khỏi{" "}
          <b>ADMIN_PHONES</b>.
        </p>
      </div>

      {toPromote && (
        <ConfirmDialog
          title={`Xác nhận cấp quyền Quản trị viên cho số ${toPromote}?`}
          message="Quản trị viên sẽ có toàn quyền trên hệ thống (bao gồm xóa tài khoản, cấp lại mật khẩu, và có thể cấp quyền Admin cho người khác). Hãy đảm bảo bạn cấp quyền đúng người."
          confirmLabel="Cấp quyền Quản trị viên"
          cancelLabel="Hủy thao tác"
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
          title={`Chuyển tài khoản ${toDemote.phone} xuống cấp Quản lý?`}
          message={`${toDemote.name ? `${toDemote.name} — ` : ""}sẽ mất quyền quản trị viên, chỉ còn các quyền thao tác trong phạm vi quản lý được phân công.`}
          confirmLabel="Chuyển xuống cấp Quản lý"
          cancelLabel="Hủy thao tác"
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
          Bảng nhân sự chưa có trong DB — cần apply migration
          0056_rbac_staff_accounts. Hiện vai và quyền vẫn đọc từ hồ sơ khách
          (cách cũ, vẫn chạy).
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
        <AdminSkeleton label="Đang tải danh sách quản lý…" />
      )}
      {managers && managers.length === 0 && (
        <p className="surface px-4 py-8 text-center text-[1rem] text-foreground/65">
          Chưa có tài khoản quản lý nào. Tạo bằng mục{" "}
          <b>Tạo tài khoản nhân sự</b> ở trên (chọn &ldquo;Quản lý&rdquo;), rồi
          phân quyền ngay tại đây.
        </p>
      )}

      {managers?.map((m) => (
        <ManagerPermCard key={m.phone} manager={m} onSaved={load} />
      ))}
    </div>
  );
}

export function ManagerPermCard({
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
      headers: { "content-type": "application/json", ...tokenHeader() },
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
          ? "Chưa lưu được cấu hình — hệ thống đang thiếu cột dữ liệu phân quyền (vui lòng chạy tiến trình migration 0017)."
          : "Lưu phân quyền không thành công. Vui lòng thử lại.",
      );
      return;
    }
    setMsg("Cấu hình phân quyền đã được lưu.");
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

      {/* "Thấy khách nào" (own / đại lý tổng) BỎ 2026-10-28: mọi quản lý thấy mọi
          khách thật; quyền thao tác do bảng dưới quyết. */}
      <p className="mt-2 text-[0.8125rem] text-foreground/60">
        Thấy mọi khách thật · thao tác theo bảng dưới
      </p>

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
                  // trang không có hành động này (vd Báo cáo chỉ có Xem) — không bày nút ảo
                  if (!TAB_ACTIONS[tab].includes(action))
                    return (
                      <td key={action} className="py-2 text-center text-foreground/35" aria-label="Không áp dụng">
                        —
                      </td>
                    );
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
                        {on ? "Kích hoạt" : "Vô hiệu hoá"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*  CỜ RIÊNG đặt lại mật khẩu (2026-10-06) — không thuộc ô Xem/Tạo/Sửa/Xoá
          của tab nào; mặc định TẮT. Có cờ cũng chỉ trên khách của người này. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-[0.9375rem] font-semibold text-navy">
          {RESET_PASSWORD_LABEL}
          <span className="block text-[0.8125rem] font-normal text-foreground/65">
            Mật khẩu khách về {DEFAULT_CUSTOMER_PASSWORD}. Không áp cho tài khoản nhân sự.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={draft.resetPassword}
          aria-label={RESET_PASSWORD_LABEL}
          onClick={() => {
            setMsg(null);
            setDraft((d) => ({ ...d, resetPassword: !d.resetPassword }));
          }}
          className={`inline-flex h-9 min-w-[2.75rem] items-center justify-center rounded-lg px-2 text-[0.8125rem] font-bold transition ${
            draft.resetPassword ? "bg-ok-bg text-ok" : "bg-field text-foreground/45"
          }`}
        >
          {draft.resetPassword ? "Kích hoạt" : "Vô hiệu hoá"}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={save}
          className="min-h-[2.75rem] rounded-xl bg-trim px-6 text-[0.9375rem] font-bold text-white disabled:opacity-50"
        >
          {busy ? "Đang lưu cấu hình…" : "Lưu phân quyền"}
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
