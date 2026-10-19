"use client";

/*  Tách nguyên văn khỏi src/app/quan-tri/page.tsx (2026-10-19, rà Codex đợt 3: trang quản trị 6.718 dòng
    — tách theo tab, KHÔNG đổi hành vi; trang chính nạp tab khi mở). */

import { type ManagerTab, type StaffPermissions, type TabPerms } from "@/lib/staff-permissions";

/** Vai trò staff — admin (env cứu hộ / staff_accounts) toàn quyền; quản lý theo bảng phân quyền */
export type StaffRole = "admin" | "manager";

/** Người đang đăng nhập trang quản trị. permissions=null khi admin (toàn quyền). */
export type Me = { phone: string; role: StaffRole; permissions: StaffPermissions | null };

export const ADMIN_ALL: TabPerms = { view: true, create: true, edit: true, delete: true };

export const NONE: TabPerms = { view: false, create: false, edit: false, delete: false };

/** Quyền của người đang đăng nhập trên một tab (admin = toàn quyền mọi tab). */
export function permsFor(me: Me, tab: ManagerTab): TabPerms {
  if (me.role === "admin") return ADMIN_ALL;
  return me.permissions?.[tab] ?? NONE;
}

export type Health = {
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

export const fmtDT = (iso: string | null | undefined): string =>
  iso
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso))
    : "—";

export const fmtD = (iso: string | null | undefined): string =>
  iso
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(iso + (iso.length === 10 ? "T00:00:00+07:00" : "")))
    : "—";

/** So khớp tìm kiếm không dấu, không phân hoa-thường ("Hải" khớp "hai") */
export const fold = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    // ̀–ͯ = dấu tổ hợp sau NFD (huyền/sắc/hỏi/ngã/nặng, mũ, móc)
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
