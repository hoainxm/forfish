"use client";

// HỒ SƠ VỰA — gọi máy chủ (spec 17 §12.4). Luật thuần ở lib/vua-profile.ts.
//
// OFFLINE-AN TOÀN: authedFetch có trần giờ + nuốt lỗi mạng (res=null). Mọi nhánh hỏng trả `{ ok:false, reason }`,
// không ném, không treo. Không lưu bản nào trong máy (không khoá `forfish.*` mới): hồ sơ là việc làm khi có sóng, ở
// bờ; mất sóng thì màn nói thẳng là chưa tải được, giữ chữ đang gõ.

import { authedFetch } from "@/lib/device-token-store";
import type { PublicVua, VuaField, VuaKind, VuaStatus } from "@/lib/vua-profile";

const READ_MS = 12000;
const WRITE_MS = 20000;

export interface MyVua {
  name: string;
  kind: VuaKind;
  province: string | null;
  address: string | null;
  species: string[];
  hours: string | null;
  contact: string | null;
  status: VuaStatus;
  statusNote: string | null;
  approvedAt: string | null;
  updatedAt: string | null;
}

/** mang = mất sóng / quá giờ · chua-san-sang = máy chủ chưa nối hoặc bảng chưa có (503) · chua-dang-nhap = 401 */
export type VuaLoi = "mang" | "chua-san-sang" | "chua-dang-nhap";

function loiTu(res: Response | null): VuaLoi {
  if (!res) return "mang";
  if (res.status === 401) return "chua-dang-nhap";
  if (res.status === 503) return "chua-san-sang";
  return "mang";
}

export async function fetchMyVua(): Promise<
  { ok: true; profile: MyVua | null; xacMinh: boolean } | { ok: false; reason: VuaLoi }
> {
  const { res } = await authedFetch("/api/me/vua", { method: "GET" }, READ_MS);
  const j = res ? ((await res.json().catch(() => null)) as { ok?: boolean; profile?: MyVua | null; xacMinh?: boolean } | null) : null;
  if (res?.ok && j?.ok) return { ok: true, profile: j.profile ?? null, xacMinh: !!j.xacMinh };
  return { ok: false, reason: loiTu(res) };
}

export async function saveMyVua(body: {
  name: string;
  kind: VuaKind;
  province: string;
  address: string;
  species: string;
  hours: string;
  contact: string;
}): Promise<
  { ok: true; profile: MyVua } | { ok: false; reason: VuaLoi | "khoa" | "sai"; field?: VuaField }
> {
  const { res } = await authedFetch(
    "/api/me/vua",
    { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    WRITE_MS,
  );
  const j = res
    ? ((await res.json().catch(() => null)) as { ok?: boolean; code?: string; field?: VuaField; profile?: MyVua } | null)
    : null;
  if (res?.ok && j?.ok && j.profile) return { ok: true, profile: j.profile };
  if (res?.status === 403 && j?.code === "locked") return { ok: false, reason: "khoa" };
  if (res?.status === 400) return { ok: false, reason: "sai", field: j?.field };
  return { ok: false, reason: loiTu(res) };
}

/** Hồ sơ vựa đang hiện cho Đầu mối. null = chưa tải được (mất sóng / chưa sẵn sàng) — danh bạ admin vẫn hiện như cũ. */
export async function fetchPublicVua(): Promise<PublicVua[] | null> {
  const { res } = await authedFetch("/api/vua", { method: "GET" }, READ_MS);
  if (!res?.ok) return null;
  const j = (await res.json().catch(() => null)) as { ok?: boolean; vua?: PublicVua[] } | null;
  return j?.ok && Array.isArray(j.vua) ? j.vua : null;
}
