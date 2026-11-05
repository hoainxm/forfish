// SĐT PHỤ của tài khoản (migration 0084) — 1 tài khoản tra máy S-Tracking theo SĐT chính + 1 SĐT phụ do nhân viên gán.
// Mọi route tra `stracking_thiet_bi` theo SĐT phiên đi qua đây, không tự ghép chuỗi `.or()` nữa.

const SDT = /^0[1-9]\d{8}$/;

type CustomersReader = {
  from(t: "customers"): {
    select(c: "sdt_phu"): {
      eq(c: "phone", v: string): {
        maybeSingle(): PromiseLike<{ data: { sdt_phu?: unknown } | null; error: { message: string } | null }>;
      };
    };
  };
};

/** Các SĐT hợp lệ, không trùng, SĐT chính đứng đầu. Ô hỏng/trống bị bỏ — chặn luôn chuyện lọt ký tự lạ vào bộ lọc. */
export function cacSdtTra(chinh: string, phu?: unknown): string[] {
  const out: string[] = [];
  for (const s of [chinh, phu]) if (typeof s === "string" && SDT.test(s) && !out.includes(s)) out.push(s);
  return out;
}

/** Bộ lọc PostgREST `.or()` — máy có SĐT chủ tàu HOẶC thuyền trưởng thuộc danh sách. Danh sách rỗng ⇒ null (đừng tra). */
export function locMayTheoSdt(sdts: readonly string[]): string | null {
  const ds = sdts.filter((s) => SDT.test(s));
  if (!ds.length) return null;
  const v = ds.join(",");
  return `sdt_chu_tau.in.(${v}),sdt_thuyen_truong.in.(${v})`;
}

/** Vai người xem với máy: chủ tàu nếu SĐT chủ tàu là một trong các SĐT của tài khoản. */
export function vaiVoiMay(sdtChuTau: string | null | undefined, sdts: readonly string[]): "chu-tau" | "thuyen-truong" {
  return sdtChuTau && sdts.includes(sdtChuTau) ? "chu-tau" : "thuyen-truong";
}

/**
 * SĐT để tra S-Tracking của tài khoản. Đọc SĐT phụ hỏng (DB nghẹt, chưa chạy 0084) ⇒ CHỈ SĐT chính + log:
 * thiếu tàu phụ một lượt còn hơn chặn cả khối giám sát hành trình.
 */
export async function sdtTraCuaTaiKhoan(admin: unknown, phone: string): Promise<string[]> {
  if (!SDT.test(phone)) return [];
  try {
    const { data, error } = await (admin as CustomersReader).from("customers").select("sdt_phu").eq("phone", phone).maybeSingle();
    if (error) {
      console.error("[sdt-phu] đọc hỏng:", error.message);
      return [phone];
    }
    return cacSdtTra(phone, data?.sdt_phu);
  } catch (e) {
    console.error("[sdt-phu] đọc hỏng:", e instanceof Error ? e.message : e);
    return [phone];
  }
}
