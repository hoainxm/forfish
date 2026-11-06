import { describe, expect, it, vi } from "vitest";
import { cacSdtTra, chinhCuaSdtPhu, chuanSoKhac, maLoiGhi, soChoDuyet, ganSdtThem, locMayTheoSdt, phuCuaCacSdt, sdtTraCuaTaiKhoan, vaiVoiMay } from "@/lib/sdt-khac";
import { chiaTinChoSdtPhu, tinHetCanhBao } from "@/lib/stracking/thong-bao";

type Kq = { data: unknown; error: { message: string; code?: string } | null };
/** Admin giả: mỗi bảng một kết quả (hoặc Error = ném); ghi lại bảng + cột đã tra. */
function adminTra(theoBang: Record<string, Kq | Error>, nhat: string[] = []) {
  return {
    from: (t: string) => ({
      select: () => ({
        in: (c: string) => ({
          not: (n: string) => {
            nhat.push(`${t}.${c}.${n}`);
            const kq = theoBang[t] ?? { data: [], error: null };
            return kq instanceof Error ? Promise.reject(kq) : Promise.resolve(kq);
          },
        }),
      }),
    }),
  };
}
const BANG_CHUA_CO = { data: null, error: { message: "relation does not exist", code: "PGRST205" } };

describe("Số khác của tôi (0086, thay SĐT phụ 0084)", () => {
  it("SĐT chính đứng đầu, thêm số khác hợp lệ, bỏ trùng và ô hỏng", () => {
    expect(cacSdtTra("0918388742", ["0946364444", "0903333333"])).toEqual(["0918388742", "0946364444", "0903333333"]);
    expect(cacSdtTra("0918388742", ["0918388742"])).toEqual(["0918388742"]);
    expect(cacSdtTra("0918388742")).toEqual(["0918388742"]);
    expect(cacSdtTra("0918388742", ["0946),x.eq.(1", null])).toEqual(["0918388742"]);
    expect(cacSdtTra("abc", ["0946364444"])).toEqual(["0946364444"]);
  });

  it("bộ lọc .or() CHỈ chủ tàu (anh Long 06/11: thuyền trưởng không xem giám sát); rỗng ⇒ null", () => {
    expect(locMayTheoSdt(["0918388742", "0946364444"])).toBe("sdt_chu_tau.in.(0918388742,0946364444)");
    expect(locMayTheoSdt([])).toBeNull();
    expect(locMayTheoSdt(["1,2)"])).toBeNull();
  });

  it("vai: chủ tàu khi SĐT chủ tàu là SĐT chính hoặc số khác", () => {
    expect(vaiVoiMay("0946364444", ["0918388742", "0946364444"])).toBe("chu-tau");
    expect(vaiVoiMay("0900000000", ["0918388742"])).toBe("thuyen-truong");
    expect(vaiVoiMay(null, ["0918388742"])).toBe("thuyen-truong");
  });

  it("đọc bảng sdt_khac CHỈ dòng đã duyệt: 3 số (VMS + mua hàng) cùng về, không đè nhau", async () => {
    const nhat: string[] = [];
    const a = adminTra(
      { sdt_khac: { data: [{ phone: "0918388742", sdt: "0946364444" }, { phone: "0918388742", sdt: "0903333333" }], error: null } },
      nhat,
    );
    expect(await sdtTraCuaTaiKhoan(a, "0918388742")).toEqual(["0918388742", "0946364444", "0903333333"]);
    expect(nhat).toEqual(["sdt_khac.phone.duyet_luc"]);
  });

  it("bảng chưa có (deploy trước migration) ⇒ lùi đọc cột cũ customers.sdt_phu — không mất số phụ đang dùng", async () => {
    const nhat: string[] = [];
    const a = adminTra({ sdt_khac: BANG_CHUA_CO, customers: { data: [{ phone: "0918388742", sdt_phu: "0946364444" }], error: null } }, nhat);
    expect(await sdtTraCuaTaiKhoan(a, "0918388742")).toEqual(["0918388742", "0946364444"]);
    expect(nhat).toEqual(["sdt_khac.phone.duyet_luc", "customers.phone.sdt_phu"]);
  });

  it("hỏng/ném ⇒ chỉ SĐT chính; SĐT phiên sai ⇒ rỗng", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sdtTraCuaTaiKhoan(adminTra({ sdt_khac: { data: null, error: { message: "nghẹt" } } }), "0918388742")).toEqual(["0918388742"]);
    expect(await sdtTraCuaTaiKhoan(adminTra({ sdt_khac: new Error("nghẹt") }), "0918388742")).toEqual(["0918388742"]);
    expect(await sdtTraCuaTaiKhoan(adminTra({}), "")).toEqual([]);
    err.mockRestore();
  });

  it("dòng rác từ DB (số sai, trùng SĐT chính) bị bỏ", async () => {
    const a = adminTra({ sdt_khac: { data: [{ phone: "0918388742", sdt: "0918388742" }, { phone: "0918388742", sdt: "x" }], error: null } });
    expect(await sdtTraCuaTaiKhoan(a, "0918388742")).toEqual(["0918388742"]);
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
    const m = await chinhCuaSdtPhu(adminTra({ sdt_khac: { data: [{ phone: "0918388742", sdt: "0946364444" }], error: null } }), ["0946364444", "xx"]);
    expect([...m]).toEqual([["0946364444", ["0918388742"]]]);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await chinhCuaSdtPhu(adminTra({ sdt_khac: { data: null, error: { message: "nghẹt" } } }), ["0946364444"])).size).toBe(0);
    err.mockRestore();
  });
});

describe("tin \"đã hết cảnh báo\" xét MỌI tàu của tài khoản có SĐT phụ", () => {
  const may = (imei: string, ten: string, chu: string) => ({ imei, serial: `S${imei}`, ten_tau: ten, sdt_chu_tau: chu, sdt_thuyen_truong: null });
  const KG = may("1", "KG-91737-TS", "0946364444");
  const AG = may("2", "AG-94783-TS", "0918388742");
  const phuCua = new Map([["0918388742", ["0946364444"]]]);
  const daBao = new Set(["0946364444", "0918388742"]);

  it("ganSdtThem: máy của SĐT phụ có thêm tài khoản chính; máy khác không", () => {
    const [kg, ag] = ganSdtThem([KG, AG], phuCua);
    expect(kg.sdt_them).toEqual(["0918388742"]);
    expect(ag.sdt_them).toEqual([]);
  });

  it("KG hết, AG CÒN cảnh báo ⇒ chỉ 444 nhận \"đã hết\", tài khoản chính KHÔNG (không đè cảnh báo AG)", () => {
    const tin = tinHetCanhBao([{ imei: "1", luc: "2026-11-05T14:30:00Z" }], ganSdtThem([KG, AG], phuCua), new Set(["2"]), daBao);
    expect(tin.map((t) => t.phone)).toEqual(["0946364444"]);
  });

  it("KG hết, AG cũng không còn cảnh báo ⇒ cả hai nhận \"đã hết\"", () => {
    const tin = tinHetCanhBao([{ imei: "1", luc: "2026-11-05T14:30:00Z" }], ganSdtThem([KG, AG], phuCua), new Set(), daBao);
    expect(tin.map((t) => t.phone).sort()).toEqual(["0918388742", "0946364444"]);
    expect(tin.find((t) => t.phone === "0918388742")!.tag).toBe("stracking-0918388742");
  });

  it("tài khoản chính chưa được báo cảnh báo hôm nay ⇒ không gửi \"đã hết\" cho họ", () => {
    const tin = tinHetCanhBao([{ imei: "1", luc: "2026-11-05T14:30:00Z" }], ganSdtThem([KG, AG], phuCua), new Set(), new Set(["0946364444"]));
    expect(tin.map((t) => t.phone)).toEqual(["0946364444"]);
  });

  it("phuCuaCacSdt: tài khoản ⇒ MỌI số khác; hỏng ⇒ rỗng", async () => {
    const a = adminTra({
      sdt_khac: { data: [{ phone: "0918388742", sdt: "0946364444" }, { phone: "0918388742", sdt: "0903333333" }], error: null },
    });
    expect([...(await phuCuaCacSdt(a, ["0918388742"]))]).toEqual([["0918388742", ["0946364444", "0903333333"]]]);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await phuCuaCacSdt(adminTra({ sdt_khac: { data: null, error: { message: "x" } } }), ["0918388742"])).size).toBe(0);
    err.mockRestore();
  });
});

describe("ghi số khác (0086): chuẩn hoá số gõ + mã lỗi từ ràng buộc DB", () => {
  it("chuẩn hoá: +84/khoảng trắng ⇒ 0…; sai ⇒ bad_sdt; trùng SĐT chính ⇒ trung_sdt_chinh", () => {
    expect(chuanSoKhac("+84 903 333 333", "0918388742")).toEqual({ ok: true, sdt: "0903333333" });
    expect(chuanSoKhac("12345", "0918388742")).toEqual({ ok: false, code: "bad_sdt" });
    expect(chuanSoKhac(null, "0918388742")).toEqual({ ok: false, code: "bad_sdt" });
    expect(chuanSoKhac("0918 388 742", "0918388742")).toEqual({ ok: false, code: "trung_sdt_chinh" });
  });

  it("mã lỗi: trigger 3 số ⇒ toi_da; unique đã duyệt ⇒ da_gan_nguoi_khac; unique (phone,sdt) ⇒ da_co; FK ⇒ khong_co_ho_so", () => {
    expect(maLoiGhi({ code: "P0001", message: "sdt_khac_toi_da_3" })).toBe("toi_da");
    expect(maLoiGhi({ code: "23505", message: 'duplicate key value violates unique constraint "sdt_khac_da_duyet_mot_nguoi"' })).toBe(
      "da_gan_nguoi_khac",
    );
    expect(maLoiGhi({ code: "23505", message: 'duplicate key value violates unique constraint "sdt_khac_mot_lan"' })).toBe("da_co");
    expect(maLoiGhi({ code: "23503", message: "fk" })).toBe("khong_co_ho_so");
    expect(maLoiGhi({ code: "PGRST205", message: "no table" })).toBe("migration_needed");
    expect(maLoiGhi({ code: "XX000", message: "?" })).toBe("loi");
    expect(maLoiGhi(null)).toBe("loi");
  });

  it("số chờ duyệt: chỉ số hợp lệ; hỏng/ném ⇒ []", async () => {
    const a = (kq: unknown) => ({
      from: () => ({ select: () => ({ eq: () => ({ is: () => (kq instanceof Error ? Promise.reject(kq) : Promise.resolve(kq)) }) }) }),
    });
    expect(await soChoDuyet(a({ data: [{ sdt: "0903333333" }, { sdt: "rác" }], error: null }), "0918388742")).toEqual(["0903333333"]);
    expect(await soChoDuyet(a({ data: null, error: { message: "x" } }), "0918388742")).toEqual([]);
    expect(await soChoDuyet(a(new Error("nghẹt")), "0918388742")).toEqual([]);
    expect(await soChoDuyet(a({ data: [{ sdt: "0903333333" }], error: null }), "")).toEqual([]);
  });
});
