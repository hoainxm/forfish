import { describe, expect, it, vi } from "vitest";
import { cacSdtTra, chinhCuaSdtPhu, locMayTheoSdt, sdtTraCuaTaiKhoan, vaiVoiMay } from "@/lib/stracking/sdt-phu";
import { chiaTinChoSdtPhu } from "@/lib/stracking/thong-bao";

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

describe("tin cảnh báo cho tài khoản có SĐT phụ", () => {
  const tin = (phone: string, body: string, day = false) => ({
    phone, title: `Cảnh báo ${phone}`, body, url: "/tau", tag: `stracking-${phone}`, day,
  });

  it("tin gửi SĐT trên máy ⇒ thêm bản cho tài khoản chính, tag theo người nhận", () => {
    const out = chiaTinChoSdtPhu([tin("0946364444", "KG-91737-TS: Mất GPS 21:00", true)], new Map([["0946364444", ["0918388742"]]]));
    expect(out).toHaveLength(2);
    const chinh = out.find((t) => t.phone === "0918388742")!;
    expect(chinh.body).toBe("KG-91737-TS: Mất GPS 21:00");
    expect(chinh.tag).toBe("stracking-0918388742");
    expect(chinh.day).toBe(true);
  });

  it("tài khoản chính đã có tin riêng ⇒ gộp vào 1 tin, không lặp dòng, day OR", () => {
    const out = chiaTinChoSdtPhu(
      [tin("0918388742", "AG-94783-TS: Pin yếu 20:00"), tin("0946364444", "KG-94292-TS: Mất GPS 21:00", true)],
      new Map([["0946364444", ["0918388742"]]]),
    );
    expect(out).toHaveLength(2);
    const chinh = out.find((t) => t.phone === "0918388742")!;
    expect(chinh.title).toBe("Cảnh báo 0918388742");
    expect(chinh.body).toBe("AG-94783-TS: Pin yếu 20:00\nKG-94292-TS: Mất GPS 21:00");
    expect(chinh.day).toBe(true);
  });

  it("không có ai gán SĐT phụ ⇒ y nguyên", () => {
    const goc = [tin("0946364444", "x")];
    expect(chiaTinChoSdtPhu(goc, new Map())).toEqual(goc);
  });

  it("tra ngược: gom theo SĐT phụ, bỏ SĐT sai; hỏng ⇒ map rỗng", async () => {
    const adminIn = (kq: { data: unknown; error: { message: string } | null }) => ({
      from: () => ({ select: () => ({ in: () => Promise.resolve(kq) }) }),
    });
    const m = await chinhCuaSdtPhu(adminIn({ data: [{ phone: "0918388742", sdt_phu: "0946364444" }], error: null }), ["0946364444", "xx"]);
    expect([...m]).toEqual([["0946364444", ["0918388742"]]]);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await chinhCuaSdtPhu(adminIn({ data: null, error: { message: "nghẹt" } }), ["0946364444"])).size).toBe(0);
    err.mockRestore();
  });
});
