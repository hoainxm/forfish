import { describe, expect, it } from "vitest";

import { DOCK, dockActive, dockBadge, dockTheoVai, nhanBadgeDock, type NguonBadge } from "@/lib/dock-nav";
import { nhanHopLe } from "@/lib/labels";
import { chanBanDoFree, coBanDo, isVai, lyDoKhongDoiVai, nenLenChuTau, nenNhanVaiMayChu, parseVaiMay, suyVai, tenVai, VAI } from "@/lib/vai";
import { MOI_O_DOCK } from "@/lib/dock-nav";

describe("vai — bốn vai, mỗi SĐT một vai (spec 17 §2.1)", () => {
  it("đủ 4 vai, tên hiện cho bà con", () => {
    expect(VAI.map((v) => v.id)).toEqual(["ngu-dan", "chu-tau", "thu-mua", "dai-ly"]);
    expect(VAI.map((v) => v.ten)).toEqual(["Đi bạn", "Chủ tàu", "Thu mua", "Đại lý"]);
    expect(tenVai("ngu-dan")).toBe("Đi bạn");
    expect(tenVai(null)).toBe("");
  });
  it("isVai chỉ nhận đúng 4 mã", () => {
    for (const v of ["ngu-dan", "chu-tau", "thu-mua", "dai-ly"]) expect(isVai(v)).toBe(true);
    for (const v of ["", "admin", null, undefined, 1, "Chu-tau"]) expect(isVai(v)).toBe(false);
  });
});

describe("ô Bản đồ theo vai × gói (spec 17 §11)", () => {
  it("chủ tàu + chưa chọn vai: luôn có bản đồ, như hôm nay", () => {
    expect(coBanDo("chu-tau", false)).toBe(true);
    expect(coBanDo(null, false)).toBe(true);
  });
  it("đi bạn / thu mua / đại lý: chỉ khi có gói", () => {
    for (const v of ["ngu-dan", "thu-mua", "dai-ly"] as const) {
      expect(coBanDo(v, false), v).toBe(false);
      expect(coBanDo(v, true), v).toBe(true);
    }
  });
  it("cổng máy chủ: chỉ chặn đúng vai cần gói; vai lạ / null / cột chưa có ⇒ không chặn", () => {
    expect(chanBanDoFree("ngu-dan", false)).toBe(true);
    expect(chanBanDoFree("dai-ly", true)).toBe(false);
    expect(chanBanDoFree("chu-tau", false)).toBe(false);
    expect(chanBanDoFree(null, false)).toBe(false);
    expect(chanBanDoFree("rac", false)).toBe(false);
  });
});

describe("suy vai cho tài khoản cũ (spec 17 §3.2) — điều kiện đầu tiên thắng", () => {
  const k = { coShop: false, coThietBi: false, coTau: false, ngheKairos: null };
  it("thứ tự: gian hàng ⇒ thiết bị/tàu ⇒ nghề thu mua ⇒ null", () => {
    expect(suyVai({ ...k, coShop: true, coTau: true })).toBe("dai-ly");
    expect(suyVai({ ...k, coThietBi: true, ngheKairos: "thu-mua" })).toBe("chu-tau");
    expect(suyVai({ ...k, coTau: true })).toBe("chu-tau");
    expect(suyVai({ ...k, ngheKairos: "thu-mua" })).toBe("thu-mua");
    expect(suyVai({ ...k, ngheKairos: "cau-muc" })).toBeNull();
    expect(suyVai(k)).toBeNull();
  });
});

describe("vai lưu trong máy", () => {
  const raw = (o: object) => JSON.stringify(o);
  it("chỉ áp bản của đúng tài khoản; hỏng / vai lạ ⇒ chưa biết", () => {
    expect(parseVaiMay(raw({ sdt: "0901", vai: "thu-mua", cho: true, luc: 5 }), "0901")).toEqual({
      sdt: "0901",
      vai: "thu-mua",
      cho: true,
      luc: 5,
    });
    expect(parseVaiMay(raw({ sdt: "0901", vai: "thu-mua" }), "0902")).toBeNull();
    expect(parseVaiMay(raw({ sdt: "0901", vai: "rac" }), "0901")).toBeNull();
    expect(parseVaiMay("{hong", "0901")).toBeNull();
    expect(parseVaiMay(null, "0901")).toBeNull();
    expect(parseVaiMay(raw({ sdt: "0901", vai: null }), "0901")?.vai).toBeNull();
    expect(parseVaiMay(raw({ sdt: "0901", vai: "chu-tau" }), null)).toBeNull();
  });
  it("vai chờ gửi (đổi lúc mất sóng) không bị máy chủ đè; giá trị lạ từ máy chủ bỏ qua", () => {
    const cho = { sdt: "0901", vai: "dai-ly" as const, cho: true, luc: 1 };
    const xong = { ...cho, cho: false };
    expect(nenNhanVaiMayChu(cho, "chu-tau")).toBe(false);
    expect(nenNhanVaiMayChu(xong, "chu-tau")).toBe(true);
    expect(nenNhanVaiMayChu(xong, "dai-ly")).toBe(false);
    expect(nenNhanVaiMayChu(null, null)).toBe(true);
    expect(nenNhanVaiMayChu(null, "rac")).toBe(false);
  });
});

describe("dock theo vai (spec 17 §4.1)", () => {
  const ten = (vai: Parameters<typeof dockTheoVai>[0], banDo: boolean) => dockTheoVai(vai, banDo).map((m) => m.label);
  it("chủ tàu / chưa chọn vai: y như dock mặc định", () => {
    expect(dockTheoVai("chu-tau", true)).toEqual(DOCK);
    expect(dockTheoVai(null, true)).toEqual(DOCK);
  });
  it("đi bạn: Việc làm thay Tàu tôi; Bản đồ chỉ khi có gói", () => {
    expect(ten("ngu-dan", false)).toEqual(["Trang chủ", "Kairos", "Việc làm", "Chợ cá", "Vật tư"]);
    expect(ten("ngu-dan", true)).toEqual(["Trang chủ", "Kairos", "Bản đồ", "Việc làm", "Chợ cá", "Vật tư"]);
  });
  it("thu mua: Chợ cá ngay sau Kairos khi không gói; có gói thì Bản đồ chen vào ô 3 như mọi vai", () => {
    expect(ten("thu-mua", false)).toEqual(["Trang chủ", "Kairos", "Chợ cá", "Vật tư"]);
    expect(ten("thu-mua", true)).toEqual(["Trang chủ", "Kairos", "Bản đồ", "Chợ cá", "Vật tư"]);
    expect(dockTheoVai("thu-mua", false)[2].href).toBe("/tien?muc=tin");
    expect(dockActive("/tien", dockTheoVai("thu-mua", false))).toBe("cho-ca");
  });
  it("đại lý: Bán hàng thành ô riêng, bỏ Chợ cá", () => {
    expect(ten("dai-ly", false)).toEqual(["Trang chủ", "Kairos", "Bán hàng", "Vật tư"]);
    expect(ten("dai-ly", true)).toEqual(["Trang chủ", "Kairos", "Bản đồ", "Bán hàng", "Vật tư"]);
  });
  it("Bản đồ luôn ô thứ 3 khi có, ở mọi vai (tab bar cố định)", () => {
    for (const v of [null, "ngu-dan", "chu-tau", "thu-mua", "dai-ly"] as const)
      expect(dockTheoVai(v, true)[2].id, String(v)).toBe("ban-do");
  });
  it("mọi tên ô ≤2 chữ, 4–6 ô", () => {
    for (const v of [null, "ngu-dan", "chu-tau", "thu-mua", "dai-ly"] as const)
      for (const b of [true, false]) {
        const d = dockTheoVai(v, b);
        expect(d.length).toBeGreaterThanOrEqual(4);
        expect(d.length).toBeLessThanOrEqual(6);
        for (const m of d) expect(nhanHopLe(m.label), m.label).toBe(true);
      }
  });
  it("ô sáng theo dock đang có: /ban-hang sáng Bán hàng ở đại lý, Vật tư ở người khác; /viec chỉ sáng khi có ô", () => {
    expect(dockActive("/ban-hang/don", dockTheoVai("dai-ly", false))).toBe("ban-hang");
    expect(dockActive("/ban-hang/don", dockTheoVai("chu-tau", true))).toBe("vat-tu");
    expect(dockActive("/viec/ho-so", dockTheoVai("ngu-dan", false))).toBe("viec-lam");
    expect(dockActive("/viec", dockTheoVai("chu-tau", true))).toBeNull();
    expect(dockActive("/ngu-truong", dockTheoVai("thu-mua", false))).toBeNull();
  });
  it("ô Bán hàng đếm đơn chờ", () => {
    const s: NguonBadge = { kairosChuaDoc: 0, donChoBan: 3, gioDong: 1 };
    expect(dockBadge("ban-hang", s)).toBe(3);
    expect(nhanBadgeDock("ban-hang", s)).toBe(", 3 đơn chờ");
    expect(dockBadge("viec-lam", s)).toBe(0);
  });
});

describe("khoá vai (anh Long 03/11: chọn một lần, ngư dân + tàu = chủ tàu, đại lý/thu mua độc lập)", () => {
  it("chưa có vai ⇒ chọn được bất kỳ; cùng vai ⇒ không đổi gì", () => {
    for (const v of ["ngu-dan", "chu-tau", "thu-mua", "dai-ly"] as const) expect(lyDoKhongDoiVai(null, v, false)).toBeNull();
    expect(lyDoKhongDoiVai("thu-mua", "thu-mua", false)).toBeNull();
  });
  it("Đi bạn ⇒ Chủ tàu chỉ khi có tàu trong sổ", () => {
    expect(lyDoKhongDoiVai("ngu-dan", "chu-tau", true)).toBeNull();
    expect(lyDoKhongDoiVai("ngu-dan", "chu-tau", false)).toBe("chua_co_tau");
  });
  it("mọi đường khác bị khoá — kể cả Chủ tàu ⇒ Đi bạn, Đại lý ⇔ Thu mua", () => {
    expect(lyDoKhongDoiVai("chu-tau", "ngu-dan", true)).toBe("da_co_vai");
    expect(lyDoKhongDoiVai("dai-ly", "thu-mua", false)).toBe("da_co_vai");
    expect(lyDoKhongDoiVai("thu-mua", "dai-ly", false)).toBe("da_co_vai");
    expect(lyDoKhongDoiVai("thu-mua", "chu-tau", true)).toBe("da_co_vai");
    expect(lyDoKhongDoiVai("dai-ly", "chu-tau", true)).toBe("da_co_vai");
  });
  it("tự lên Chủ tàu: Đi bạn / chưa chọn vai có tàu; Đại lý, Thu mua có tàu vẫn giữ", () => {
    expect(nenLenChuTau("ngu-dan", 1)).toBe(true);
    expect(nenLenChuTau(null, 2)).toBe(true);
    expect(nenLenChuTau("ngu-dan", 0)).toBe(false);
    expect(nenLenChuTau("dai-ly", 3)).toBe(false);
    expect(nenLenChuTau("thu-mua", 3)).toBe(false);
    expect(nenLenChuTau("chu-tau", 3)).toBe(false);
  });
});

describe("mọi màn của ô dock đều có dock (anh Long 03/11: /viec không có đường về)", () => {
  it("route của ô Việc làm, Bán hàng thuộc dock dù dock mặc định không có ô đó", () => {
    for (const p of ["/viec", "/viec/giay", "/viec/tin/x", "/ban-hang", "/ban-hang/yeu-cau"])
      expect(dockActive(p, MOI_O_DOCK), p).not.toBeNull();
    for (const p of ["/login", "/dang-ky", "/chon-vai", "/quyen-rieng-tu"]) expect(dockActive(p, MOI_O_DOCK), p).toBeNull();
  });
});
