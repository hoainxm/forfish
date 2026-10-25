import "server-only";
// SDVICO TRỰC KHÁCH — phần máy chủ (14 §3.14, 0072): khoá lấy phiếu cho AI Assistant + đọc/ghi bảng sdvico_khach_hoi.
// Chỉ route server gọi (service role). Thiếu Supabase / thiếu khoá ⇒ 503, không bao giờ mở cửa.

import { NextResponse } from "next/server";
import { getConfigValue } from "@/lib/app-config";
import { checkIngestKey } from "@/lib/kairos/ingest-key";

export const LEAD_KEY_HEADER = "x-sdvico-key";

/** Khoá đúng ⇒ null; thiếu cấu hình ⇒ 503; sai ⇒ 401. So thời gian hằng (checkIngestKey). */
export async function khoaPhieuSai(req: Request): Promise<NextResponse | null> {
  let khoa: string | null = null;
  try {
    khoa = await getConfigValue("sdvico_lead_key");
  } catch (e) {
    console.error("[sdvico] đọc khoá phiếu khách hỏng:", (e as Error)?.message);
  }
  const v = checkIngestKey(req.headers.get(LEAD_KEY_HEADER), khoa);
  if (v === "unconfigured") return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  if (v === "bad") return NextResponse.json({ ok: false, error: "bad_key" }, { status: 401 });
  return null;
}

/** Hàng bảng sdvico_khach_hoi. */
export interface PhieuRow {
  id: string;
  created_at: string;
  nguon: "kairos" | "san-pham" | "sen-bien";
  san_pham: string | null;
  ten: string;
  phone: string;
  so_tau: string;
  cang: string;
  loi_nhan: string | null;
  kairos_post_id: string | null;
  kairos_comment_id: string | null;
  trang_thai: "moi" | "da_bao";
}
