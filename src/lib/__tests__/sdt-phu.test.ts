import { describe, expect, it, vi } from "vitest";
import { cacSdtTra, locMayTheoSdt, sdtTraCuaTaiKhoan, vaiVoiMay } from "@/lib/stracking/sdt-phu";

function adminTra(kq: { data: unknown; error: { message: string } | null } | Error) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => (kq instanceof Error ? Promise.reject(kq) : Promise.resolve(kq)),
        }),
      }),
    }),
  };
}

describe("SĐT phụ S-Tracking (0084)", () => {
  it("SĐT chính đứng đầu, thêm SĐT phụ hợp lệ, bỏ trùng và ô hỏng", () => {
    expect(cacSdtTra("0918388742", "0946364444")).toEqual(["0918388742", "0946364444"]);
    expect(cacSdtTra("0918388742", "0918388742")).toEqual(["0918388742"]);
    expect(cacSdtTra("0918388742", null)).toEqual(["0918388742"]);
    expect(cacSdtTra("0918388742", "0946),x.eq.(1")).toEqual(["0918388742"]);
    expect(cacSdtTra("abc", "0946364444")).toEqual(["0946364444"]);
  });

  it("bộ lọc .or() phủ cả chủ tàu lẫn thuyền trưởng; rỗng ⇒ null", () => {
    expect(locMayTheoSdt(["0918388742", "0946364444"])).toBe(
      "sdt_chu_tau.in.(0918388742,0946364444),sdt_thuyen_truong.in.(0918388742,0946364444)",
    );
    expect(locMayTheoSdt([])).toBeNull();
    expect(locMayTheoSdt(["1,2)"])).toBeNull();
  });

  it("vai: chủ tàu khi SĐT chủ tàu là SĐT chính hoặc phụ", () => {
    expect(vaiVoiMay("0946364444", ["0918388742", "0946364444"])).toBe("chu-tau");
    expect(vaiVoiMay("0900000000", ["0918388742"])).toBe("thuyen-truong");
    expect(vaiVoiMay(null, ["0918388742"])).toBe("thuyen-truong");
  });

  it("đọc SĐT phụ: có ⇒ 2 số; hỏng/ném ⇒ chỉ SĐT chính; SĐT phiên sai ⇒ rỗng", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sdtTraCuaTaiKhoan(adminTra({ data: { sdt_phu: "0946364444" }, error: null }), "0918388742")).toEqual([
      "0918388742",
      "0946364444",
    ]);
    expect(await sdtTraCuaTaiKhoan(adminTra({ data: null, error: null }), "0918388742")).toEqual(["0918388742"]);
    expect(await sdtTraCuaTaiKhoan(adminTra({ data: null, error: { message: "column does not exist" } }), "0918388742")).toEqual([
      "0918388742",
    ]);
    expect(await sdtTraCuaTaiKhoan(adminTra(new Error("nghẹt")), "0918388742")).toEqual(["0918388742"]);
    expect(await sdtTraCuaTaiKhoan(adminTra({ data: { sdt_phu: "0946364444" }, error: null }), "")).toEqual([]);
    err.mockRestore();
  });
});
