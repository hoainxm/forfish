// "SỐ KHÁC CỦA TÔI" (migration 0086, thay SĐT phụ một ô 0084) — tài khoản có tới 3 SĐT khác đã được nhân viên duyệt.
// Một danh sách dùng chung: máy S-Tracking (tra máy, gia hạn, xoá, tin cảnh báo) + đồ mua SDVICO (/api/me/sdvico).
// Mọi route tra theo SĐT phiên đi qua đây, không tự ghép chuỗi `.or()`.
//
// CHỈ dòng đã duyệt (`duyet_luc`) được dùng — dòng chờ là bà con tự gửi, chưa ai xác nhận số đó là của họ.
// Bảng chưa có (deploy trước migration) ⇒ lùi đọc cột cũ `customers.sdt_phu`, không mất số phụ đang dùng.

import { isMissingTableError } from "@/lib/staff-permissions";
import { isValidVnPhone, normalizeVnPhone } from "@/lib/phone";

const SDT = /^0[1-9]\d{8}$/;
/** Tối đa số khác / tài khoản — trùng trigger `sdt_khac_toi_da` (0086). */
export const SDT_KHAC_TOI_DA = 3;

type Loi = { message: string; code?: string } | null;
type Chon = {
  from(t: string): {
    select(c: string): {
      in(c: string, v: string[]): {
        not(c: string, op: "is", v: null): PromiseLike<{ data: Record<string, unknown>[] | null; error: Loi }>;
      };
    };
  };
};

/** Một cặp tài khoản (SĐT chính) ⇄ số khác đã duyệt. */
export interface CapSdt {
  phone: string;
  sdt: string;
}

/**
 * Đọc cặp đã duyệt theo một chiều: `cot="phone"` (tài khoản ⇒ số khác) hoặc `cot="sdt"` (số ⇒ tài khoản).
 * Hỏng ⇒ ném (caller quyết lùi gì). Bảng chưa có ⇒ đọc cột cũ 0084.
 */
async function docCap(admin: unknown, cot: "phone" | "sdt", ds: string[]): Promise<CapSdt[]> {
  const a = admin as Chon;
  const moi = await a.from("sdt_khac").select("phone, sdt").in(cot, ds).not("duyet_luc", "is", null);
  let rows: { phone: unknown; sdt: unknown }[];
  if (!moi.error) rows = (moi.data ?? []) as { phone: unknown; sdt: unknown }[];
  else if (isMissingTableError(moi.error)) {
    const cu = await a
      .from("customers")
      .select("phone, sdt_phu")
      .in(cot === "phone" ? "phone" : "sdt_phu", ds)
      .not("sdt_phu", "is", null);
    if (cu.error) throw new Error(cu.error.message);
    rows = (cu.data ?? []).map((r) => ({ phone: r.phone, sdt: r.sdt_phu }));
  } else throw new Error(moi.error.message);
  return rows.flatMap((r) =>
    typeof r.phone === "string" && typeof r.sdt === "string" && SDT.test(r.sdt) && r.sdt !== r.phone
      ? [{ phone: r.phone, sdt: r.sdt }]
      : [],
  );
}

/** Các SĐT hợp lệ, không trùng, SĐT chính đứng đầu. Ô hỏng/trống bị bỏ — chặn chuyện lọt ký tự lạ vào bộ lọc. */
export function cacSdtTra(chinh: string, khac: readonly unknown[] = []): string[] {
  const out: string[] = [];
  for (const s of [chinh, ...khac]) if (typeof s === "string" && SDT.test(s) && !out.includes(s)) out.push(s);
  return out;
}

/** Bộ lọc PostgREST `.or()` — máy có SĐT CHỦ TÀU thuộc danh sách. Danh sách rỗng ⇒ null (đừng tra).
 *  CHỈ CHỦ TÀU (anh Long 06/11: "chủ tàu mới xem giám sát, thuyền trưởng nếu có chỉ là trong hồ sơ lao động thôi") —
 *  SĐT thuyền trưởng trên S-Tracking KHÔNG cho xem / xoá / gia hạn máy. */
export function locMayTheoSdt(sdts: readonly string[]): string | null {
  const ds = sdts.filter((s) => SDT.test(s));
  if (!ds.length) return null;
  return `sdt_chu_tau.in.(${ds.join(",")})`;
}

/** Vai người xem với máy: chủ tàu nếu SĐT chủ tàu là một trong các SĐT của tài khoản. */
export function vaiVoiMay(sdtChuTau: string | null | undefined, sdts: readonly string[]): "chu-tau" | "thuyen-truong" {
  return sdtChuTau && sdts.includes(sdtChuTau) ? "chu-tau" : "thuyen-truong";
}

/**
 * Mọi SĐT của tài khoản (chính đứng đầu + số khác đã duyệt). Đọc hỏng (DB nghẹt) ⇒ CHỈ SĐT chính + log:
 * thiếu tàu/đồ của số khác một lượt còn hơn chặn cả khối.
 */
export async function sdtTraCuaTaiKhoan(admin: unknown, phone: string): Promise<string[]> {
  if (!SDT.test(phone)) return [];
  try {
    return cacSdtTra(
      phone,
      (await docCap(admin, "phone", [phone])).map((c) => c.sdt),
    );
  } catch (e) {
    console.error("[sdt-khac] đọc hỏng:", e instanceof Error ? e.message : e);
    return [phone];
  }
}

/** Gom theo lô (PostgREST giới hạn độ dài URL). Hỏng ⇒ map rỗng + log. */
async function gom(
  admin: unknown,
  cot: "phone" | "sdt",
  phones: readonly string[],
  lo: number,
  khoa: (c: CapSdt) => [string, string],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const ds = [...new Set(phones.filter((s) => SDT.test(s)))];
  try {
    for (let i = 0; i < ds.length; i += lo)
      for (const c of await docCap(admin, cot, ds.slice(i, i + lo))) {
        const [k, v] = khoa(c);
        const cu = out.get(k) ?? [];
        if (!cu.includes(v)) out.set(k, [...cu, v]);
      }
  } catch (e) {
    console.error(`[sdt-khac] tra theo ${cot} hỏng:`, e instanceof Error ? e.message : e);
    return new Map();
  }
  return out;
}

/**
 * Chiều ngược: SĐT trên máy ⇒ các tài khoản có nó trong "số khác" (để gửi tin cảnh báo đủ cho họ).
 * Hỏng ⇒ map rỗng: tin vẫn tới SĐT trên máy như cũ, chỉ thiếu bản cho tài khoản chính lượt này.
 */
export function chinhCuaSdtPhu(admin: unknown, phones: readonly string[], lo = 300): Promise<Map<string, string[]>> {
  return gom(admin, "sdt", phones, lo, (c) => [c.sdt, c.phone]);
}

/** Chiều xuôi: tài khoản (SĐT chính) ⇒ các số khác đã duyệt. Hỏng ⇒ map rỗng + log. */
export function phuCuaCacSdt(admin: unknown, phones: readonly string[], lo = 300): Promise<Map<string, string[]>> {
  return gom(admin, "phone", phones, lo, (c) => [c.phone, c.sdt]);
}

/**
 * Gắn `sdt_them` cho máy: tài khoản M có số khác P trùng SĐT chủ tàu/thuyền trưởng của máy ⇒ M cũng là người của máy.
 * `phuCua`: M ⇒ [P…]. Trả bản mới, không sửa mảng vào.
 */
export function ganSdtThem<T extends { sdt_chu_tau: string | null; sdt_thuyen_truong: string | null }>(
  tau: readonly T[],
  phuCua: ReadonlyMap<string, readonly string[]>,
): (T & { sdt_them: string[] })[] {
  const chinhCuaPhu = new Map<string, string[]>();
  for (const [chinh, ds] of phuCua) for (const phu of ds) chinhCuaPhu.set(phu, [...(chinhCuaPhu.get(phu) ?? []), chinh]);
  return tau.map((t) => ({
    ...t,
    sdt_them: [...new Set([t.sdt_chu_tau, t.sdt_thuyen_truong].flatMap((s) => (s ? chinhCuaPhu.get(s) ?? [] : [])))],
  }));
}

/* ── GHI (bà con gửi số / nhân viên gán) ─────────────────────────────────────────────────────────────────────────── */

export type LoiSoKhac =
  | "bad_sdt"
  | "trung_sdt_chinh"
  /** đã đủ 3 số (trigger 0086) */
  | "toi_da"
  /** tài khoản này đã có số đó (đã gửi / đã gán) */
  | "da_co"
  /** số đã duyệt cho tài khoản KHÁC — một số một người */
  | "da_gan_nguoi_khac"
  /** tài khoản chưa có hồ sơ customers (FK) */
  | "khong_co_ho_so"
  | "migration_needed"
  | "loi";

/** Chuẩn hoá số bà con/nhân viên gõ: phải là SĐT VN hợp lệ và khác SĐT chính của tài khoản. */
export function chuanSoKhac(raw: unknown, chinh: string): { ok: true; sdt: string } | { ok: false; code: LoiSoKhac } {
  if (typeof raw !== "string" || !isValidVnPhone(raw)) return { ok: false, code: "bad_sdt" };
  const sdt = normalizeVnPhone(raw);
  if (!SDT.test(sdt)) return { ok: false, code: "bad_sdt" };
  if (sdt === chinh) return { ok: false, code: "trung_sdt_chinh" };
  return { ok: true, sdt };
}

/** Lỗi Postgres khi ghi `sdt_khac` ⇒ mã nói được với người dùng. Ràng buộc nằm ở DB (0086) nên đọc mã của DB. */
export function maLoiGhi(err: unknown): LoiSoKhac {
  if (isMissingTableError(err)) return "migration_needed";
  const e = (err ?? {}) as { code?: unknown; message?: unknown; details?: unknown };
  const chu = `${String(e.message ?? "")} ${String(e.details ?? "")}`;
  if (e.code === "P0001" && chu.includes("sdt_khac_toi_da")) return "toi_da";
  if (e.code === "23505") return chu.includes("sdt_khac_da_duyet_mot_nguoi") ? "da_gan_nguoi_khac" : "da_co";
  if (e.code === "23503") return "khong_co_ho_so";
  return "loi";
}

type ChonCho = {
  from(t: "sdt_khac"): {
    select(c: "sdt"): {
      eq(c: "phone", v: string): { is(c: "duyet_luc", v: null): PromiseLike<{ data: { sdt: unknown }[] | null; error: Loi }> };
    };
  };
};

/** Số bà con đã gửi mà nhân viên CHƯA duyệt — để app nói "đang chờ SDVICO xác nhận". Hỏng/bảng chưa có ⇒ []. */
export async function soChoDuyet(admin: unknown, phone: string): Promise<string[]> {
  if (!SDT.test(phone)) return [];
  try {
    const { data, error } = await (admin as ChonCho).from("sdt_khac").select("sdt").eq("phone", phone).is("duyet_luc", null);
    if (error) return [];
    return (data ?? []).flatMap((r) => (typeof r.sdt === "string" && SDT.test(r.sdt) ? [r.sdt] : []));
  } catch {
    return [];
  }
}
