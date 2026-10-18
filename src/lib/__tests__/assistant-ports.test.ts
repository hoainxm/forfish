import { describe, expect, it } from "vitest";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { PORTS } from "@/data/ports";
import { ALL_PORT_NAMES, matchPortKeys, nearPortKeys, portById, portByKey, portKey } from "@/lib/assistant/ports";

/*  KHỚP TÊN CẢNG VỚI DANH SÁCH THẬT (audit 2026-09-06 P1-2/P1-3, QA AC-T44).
    Bug thật: "Sa Kỳ" có ở PORTS ("Sa Kỳ") lẫn FISHING_PORTS ("Cảng cá Sa Kỳ")
    → 2 ứng viên → conf 0,55 → "Không thấy cảng tên đó". Ở đây test với
    ĐÚNG hai danh sách của app, không phải danh sách 2 tên tự đặt.  */

describe("assistant-ports — khoá cảng", () => {
  it("AC-T04: bỏ tiền tố cảng cá/cảng/bến/cửa, bỏ phần trong ngoặc, bỏ dấu (viết hoa/thường/không dấu cùng ra một khoá)", () => {
    expect(portKey("Cảng cá Sa Kỳ")).toBe("sa ky");
    expect(portKey("cảng Sa Kỳ")).toBe("sa ky");
    expect(portKey("Hòn Rớ (Nha Trang)")).toBe("hon ro");
    expect(portKey("Lạch Hới (Sầm Sơn)")).toBe("lach hoi");
    expect(portKey("bến Tắc Cậu")).toBe("tac cau");
    // tên vốn bắt đầu bằng "Cửa …" vẫn giữ được phần còn lại (không thành rỗng)
    expect(portKey("Cửa Lò")).toBe("lo");
    expect(portKey("Cửa")).toBe("cua");
  });

  it("cùng một cảng ở hai danh sách → MỘT ứng viên (Sa Kỳ, Quy Nhơn, Hòn Rớ, Vũng Tàu)", () => {
    for (const say of ["Sa Kỳ", "cảng cá Sa Kỳ", "sa ky", "Quy Nhơn", "Hòn Rớ", "Vũng Tàu", "Tắc Cậu", "Phan Thiết"]) {
      const keys = matchPortKeys(say, ALL_PORT_NAMES);
      expect(keys, say).toHaveLength(1);
      expect(portByKey(keys[0]), say).toBeTruthy();
    }
  });

  it("id ưu tiên PORTS (có dự báo biển), tỉnh theo danh mục chỉ định (tên sau sáp nhập)", () => {
    expect(portByKey("Sa Kỳ")).toMatchObject({ id: "sa-ky", name: "Sa Kỳ", province: "Quảng Ngãi" });
    expect(portByKey("Quy Nhơn")).toMatchObject({ id: "quy-nhon", name: "Quy Nhơn", province: "Gia Lai" });
    expect(portByKey("Hòn Rớ")).toMatchObject({ id: "hon-ro", name: "Hòn Rớ", province: "Khánh Hòa" });
    expect(portByKey("Tắc Cậu")).toMatchObject({ id: "tac-cau", province: "An Giang" });
    // tên hiển thị không kèm ngoặc
    expect(portByKey("Hòn Rớ")?.name).not.toContain("(");
  });

  it("AC-T04: khớp đầy đủ thắng khớp một phần; nhiều cảng cùng chữ → ≤4 ứng viên để hỏi lại", () => {
    // "Cửa" đứng một mình: nhiều cảng "Cửa …" → hỏi lại chip
    const nhieu = matchPortKeys("Cửa Việt", ALL_PORT_NAMES);
    expect(nhieu.length).toBeGreaterThanOrEqual(1);
    expect(nhieu.length).toBeLessThanOrEqual(4);
    const ho = matchPortKeys("Hòn", ALL_PORT_NAMES);
    expect(ho.length).toBeGreaterThan(1);
    expect(ho.length).toBeLessThanOrEqual(4);
    expect(matchPortKeys("x", ALL_PORT_NAMES)).toEqual([]);
    expect(matchPortKeys("Xyz Không Có", ALL_PORT_NAMES)).toEqual([]);
  });

  it("P1-N2: khoá 1 từ KHÔNG được nuốt cụm dài — 'Đà Nẵng' không ra 'Bến Đá'", () => {
    // "Bến Đá" có khoá 1 từ "da"; "đà nẵng" chứa từ "da" nên bản cũ khớp một phần → đặt cảng nhà ở TP.HCM
    expect(matchPortKeys("Đà Nẵng", ALL_PORT_NAMES)).toEqual([]);
    expect(matchPortKeys("Đà Nẵng", ALL_PORT_NAMES).map((k) => portByKey(k)?.name)).not.toContain("Bến Đá");
    // vẫn gọi đúng khi bà con nói CHÍNH tên đó
    expect(matchPortKeys("Bến Đá", ALL_PORT_NAMES)).toEqual(["da"]);
    // khoá ≥2 từ vẫn nhận chiều "cụm bà con nói chứa tên cảng"
    expect(matchPortKeys("cảng cá Sa Kỳ Quảng Ngãi", ALL_PORT_NAMES)).toEqual(["sa ky"]);
    // "Cửa" đứng một mình vẫn ra nhiều cảng để hỏi lại
    expect(matchPortKeys("Cửa", ALL_PORT_NAMES).length).toBeGreaterThan(1);
  });

  it("P1-N2: không thấy tên → gợi ý cảng CÓ DỰ BÁO BIỂN cùng tỉnh (rỗng nếu không đoán được)", () => {
    const gan = nearPortKeys("Đà Nẵng").map((k) => portByKey(k));
    expect(gan.length).toBeGreaterThan(0);
    for (const g of gan) expect(g?.province).toBe("Đà Nẵng");
    expect(gan.map((g) => g?.name)).toContain("Thọ Quang");
    expect(gan.map((g) => g?.name)).not.toContain("Bến Đá");
    expect(nearPortKeys("Khánh Hòa").map((k) => portByKey(k)?.name)).toContain("Hòn Rớ");
    expect(nearPortKeys("Xyz Lạ Hoắc")).toEqual([]);
    expect(nearPortKeys("x")).toEqual([]);
  });

  it("mọi cảng trong hai danh sách đều tra ngược được theo id", () => {
    for (const p of [...PORTS, ...FISHING_PORTS]) expect(portById(p.id), p.id).toBeTruthy();
    expect(portById("cang-ca-sa-ky")?.name).toBe("Cảng cá Sa Kỳ");
  });
});
