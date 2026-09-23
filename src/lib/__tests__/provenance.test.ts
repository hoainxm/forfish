import { describe, expect, it } from "vitest";
import {
  LICENSES,
  SOURCES,
  attributionsFor,
  cleanPackage,
  confidenceOf,
  daysBetween,
  dirtySources,
  isCleanLicense,
  sourcesOf,
  validateProvenance,
  CONFIDENCE_WEIGHTS,
  OFFSET_FULL_M,
  OFFSET_ZERO_M,
  FRESH_ZERO_DAYS,
  type Provenance,
  type WithProvenance,
} from "@/lib/provenance";

const AT = "2026-08-29";

/** Lý lịch tối thiểu — mọi ca dựng từ đây rồi ghi đè phần cần thử. */
function prov(p: Partial<Provenance> = {}): Provenance {
  return { origin: { source: "sdfish", at: AT }, ...p };
}

describe("bảng giấy phép — bất biến không được lỏng tay", () => {
  it("mỗi giấy phép tự khai đúng id của mình (chống lỗi copy-paste)", () => {
    for (const [id, t] of Object.entries(LICENSES)) expect(t.id).toBe(id);
  });

  it("mỗi nguồn tự khai đúng id + trỏ tới giấy phép có thật", () => {
    for (const [id, s] of Object.entries(SOURCES)) {
      expect(s.id).toBe(id);
      expect(LICENSES[s.license]).toBeDefined();
      expect(s.attribution.length).toBeGreaterThan(0);
    }
  });

  it("ODbL CÓ share-alike, các giấy phép bán được thì KHÔNG", () => {
    expect(LICENSES["odbl-1.0"].shareAlike).toBe(true);
    for (const id of ["public-domain", "cc0-1.0", "cc-by-4.0", "gebco", "sdfish-own"] as const) {
      expect(LICENSES[id].shareAlike).toBe(false);
    }
  });

  it("giấy phép CHƯA TRA ĐƯỢC thì mặc định KHÔNG phát hành lại được", () => {
    // Đoán "chắc là tự do" là cách nhanh nhất để bị kiện — mặc định an toàn nhất.
    expect(LICENSES.unknown.redistributable).toBe(false);
  });

  it("OSM là ODbL — đây là nguồn phải lọc ra khỏi gói bán", () => {
    expect(SOURCES.osm.license).toBe("odbl-1.0");
  });
});

describe("sourcesOf — gom đủ nguồn, không trùng", () => {
  it("gộp cả origin lẫn derivedFrom", () => {
    const p = prov({
      origin: { source: "aca", at: AT },
      derivedFrom: [
        { source: "osm", at: AT },
        { source: "sdfish", at: AT },
      ],
    });
    expect(sourcesOf(p).sort()).toEqual(["aca", "osm", "sdfish"]);
  });

  it("nguồn lặp lại chỉ tính một lần", () => {
    const p = prov({
      origin: { source: "osm", at: AT },
      derivedFrom: [{ source: "osm", at: "2026-01-01" }],
    });
    expect(sourcesOf(p)).toEqual(["osm"]);
  });
});

describe("lọc giấy phép — gói sạch", () => {
  it("hình học OSM ⇒ KHÔNG sạch (share-alike)", () => {
    const p = prov({ origin: { source: "osm", at: AT } });
    expect(isCleanLicense(p)).toBe(false);
    expect(dirtySources(p)).toEqual(["osm"]);
  });

  it("NGUỒN PHỤ dính OSM cũng làm bẩn cả đối tượng", () => {
    // Ca thật: hình rạn vẽ từ ảnh vệ tinh nhưng nhãn tên lấy từ OSM.
    const p = prov({
      origin: { source: "aca", at: AT },
      derivedFrom: [{ source: "osm", at: AT }],
    });
    expect(isCleanLicense(p)).toBe(false);
    expect(dirtySources(p)).toEqual(["osm"]);
  });

  it("public domain + CC-BY + tự soạn ⇒ SẠCH", () => {
    const p = prov({
      origin: { source: "etopo", at: AT },
      derivedFrom: [
        { source: "aca", at: AT },
        { source: "sdfish", at: AT },
        { source: "nga-msi", at: AT },
        { source: "gebco", at: AT },
      ],
    });
    expect(isCleanLicense(p)).toBe(true);
    expect(dirtySources(p)).toEqual([]);
  });

  it("crossChecks KHÔNG làm bẩn — đối chiếu là ĐỌC, không phải dẫn xuất", () => {
    // Dùng OSM để kiểm tra một hình ACA không tạo ra tác phẩm dẫn xuất từ OSM.
    const p = prov({
      origin: { source: "aca", at: AT },
      crossChecks: [{ source: "osm", agreed: true, offsetM: 50, at: AT }],
    });
    expect(isCleanLicense(p)).toBe(true);
  });
});

describe("cleanPackage — MỘT câu truy vấn ra gói bán được", () => {
  const items: WithProvenance[] = [
    { prov: prov({ origin: { source: "osm", at: AT } }) }, // bẩn
    { prov: prov({ origin: { source: "sdfish", at: AT } }) }, // sạch, tin thấp
    {
      prov: prov({
        origin: { source: "aca", at: AT },
        crossChecks: [
          { source: "wcmc", agreed: true, offsetM: 80, at: AT },
          { source: "etopo", agreed: true, offsetM: 100, at: AT },
        ],
      }),
    }, // sạch, tin cao
    { prov: prov({ origin: { source: "gebco", at: "1990-01-01" } }) }, // sạch, quá cũ
  ];

  it("lọc theo giấy phép", () => {
    expect(cleanPackage(items)).toHaveLength(3);
  });

  it("thêm sàn độ tin cậy thì siết tiếp", () => {
    const strict = cleanPackage(items, { minConfidence: 80, today: AT });
    expect(strict).toHaveLength(1);
    expect(strict[0].prov.origin.source).toBe("aca");
  });

  it("không truyền sàn thì không đụng tới độ tin cậy", () => {
    expect(cleanPackage(items, {})).toHaveLength(3);
  });
});

describe("attributionsFor — ghi công đủ, không trùng", () => {
  it("chỉ liệt kê nguồn CÓ yêu cầu ghi công", () => {
    const list = attributionsFor([
      { prov: prov({ origin: { source: "aca", at: AT } }) },
      { prov: prov({ origin: { source: "aca", at: AT } }) }, // trùng → 1 dòng
      { prov: prov({ origin: { source: "etopo", at: AT } }) }, // public domain
      { prov: prov({ origin: { source: "sdfish", at: AT } }) }, // tự soạn
    ]);
    expect(list).toEqual([SOURCES.aca.attribution]);
  });
});

describe("daysBetween", () => {
  it("đếm đúng số ngày", () => {
    expect(daysBetween("2026-08-01", "2026-08-29")).toBe(28);
    expect(daysBetween("2026-08-29", "2026-08-29")).toBe(0);
  });
  it("chuỗi hỏng → NaN, không ném", () => {
    expect(Number.isNaN(daysBetween("hôm qua", "2026-08-29"))).toBe(true);
  });
});

describe("thang độ tin cậy", () => {
  it("không ai xác nhận ⇒ chỉ còn điểm phương pháp — bậc thấp", () => {
    const c = confidenceOf(prov({ origin: { source: "osm", at: AT } }), AT);
    expect(c.confirmations).toBe(0);
    expect(c.parts.agreement).toBe(0);
    expect(c.parts.offset).toBe(0);
    expect(c.band).toBe("D");
  });

  it("nguồn ảnh vệ tinh 5 m ăn điểm phương pháp cao hơn OSM vẽ tay", () => {
    const aca = confidenceOf(prov({ origin: { source: "aca", at: AT } }), AT);
    const osm = confidenceOf(prov({ origin: { source: "osm", at: AT } }), AT);
    expect(aca.parts.method).toBeGreaterThan(osm.parts.method);
    expect(aca.parts.method).toBe(CONFIDENCE_WEIGHTS.method);
  });

  it("thêm nguồn xác nhận thì điểm TĂNG; hai nguồn ⇒ điểm xác nhận đầy", () => {
    const one = confidenceOf(
      prov({
        origin: { source: "osm", at: AT },
        crossChecks: [{ source: "wcmc", agreed: true, offsetM: 100, at: AT }],
      }),
      AT,
    );
    const two = confidenceOf(
      prov({
        origin: { source: "osm", at: AT },
        crossChecks: [
          { source: "wcmc", agreed: true, offsetM: 100, at: AT },
          { source: "aca", agreed: true, offsetM: 100, at: AT },
        ],
      }),
      AT,
    );
    expect(two.score).toBeGreaterThan(one.score);
    expect(one.confirmations).toBe(1);
    expect(two.confirmations).toBe(2);
    expect(two.parts.agreement).toBe(CONFIDENCE_WEIGHTS.agreement);
  });

  it("đối chiếu KHÔNG khớp không được tính là xác nhận", () => {
    const c = confidenceOf(
      prov({
        origin: { source: "osm", at: AT },
        crossChecks: [
          { source: "wcmc", agreed: false, offsetM: null, at: AT },
          { source: "aca", agreed: false, offsetM: null, at: AT },
        ],
      }),
      AT,
    );
    expect(c.confirmations).toBe(0);
    expect(c.parts.agreement).toBe(0);
  });

  it("xác nhận bởi CHÍNH nguồn gốc không tính (không độc lập)", () => {
    const c = confidenceOf(
      prov({
        origin: { source: "osm", at: AT },
        crossChecks: [{ source: "osm", agreed: true, offsetM: 10, at: AT }],
      }),
      AT,
    );
    expect(c.confirmations).toBe(0);
  });

  it("vênh càng lớn điểm càng giảm; ≥ ngưỡng ZERO thì mất hẳn điểm vênh", () => {
    const near = confidenceOf(
      prov({
        origin: { source: "aca", at: AT },
        crossChecks: [{ source: "wcmc", agreed: true, offsetM: OFFSET_FULL_M, at: AT }],
      }),
      AT,
    );
    const far = confidenceOf(
      prov({
        origin: { source: "aca", at: AT },
        crossChecks: [{ source: "wcmc", agreed: true, offsetM: OFFSET_ZERO_M, at: AT }],
      }),
      AT,
    );
    expect(near.parts.offset).toBe(CONFIDENCE_WEIGHTS.offset);
    expect(far.parts.offset).toBe(0);
    expect(near.score).toBeGreaterThan(far.score);
  });

  it("vênh lấy trường hợp XẤU NHẤT, không lấy trung bình", () => {
    // Trung bình sẽ giấu mất một xác nhận lệch 3 km — đó vẫn là điểm mù.
    const c = confidenceOf(
      prov({
        origin: { source: "aca", at: AT },
        crossChecks: [
          { source: "wcmc", agreed: true, offsetM: 50, at: AT },
          { source: "osm", agreed: true, offsetM: OFFSET_ZERO_M, at: AT },
        ],
      }),
      AT,
    );
    expect(c.worstOffsetM).toBe(OFFSET_ZERO_M);
    expect(c.parts.offset).toBe(0);
  });

  it("dữ liệu cũ hơn ngưỡng ⇒ mất hẳn điểm độ tươi", () => {
    const old = confidenceOf(
      prov({ origin: { source: "aca", at: "2013-01-01" } }),
      "2026-08-29",
    );
    expect(daysBetween("2013-01-01", "2026-08-29")).toBeGreaterThan(FRESH_ZERO_DAYS);
    expect(old.parts.freshness).toBe(0);
  });

  it("KHÔNG truyền `today` ⇒ bỏ yếu tố độ tươi và chia lại thang (không phạt oan)", () => {
    const p = prov({
      origin: { source: "aca", at: "2013-01-01" },
      crossChecks: [{ source: "wcmc", agreed: true, offsetM: 50, at: AT }],
    });
    const noDate = confidenceOf(p);
    const withDate = confidenceOf(p, "2026-08-29");
    expect(noDate.parts.freshness).toBe(0);
    // Cùng bằng chứng, nhưng bản có ngày bị trừ vì dữ liệu quá cũ.
    expect(noDate.score).toBeGreaterThan(withDate.score);
  });

  it("điểm luôn nằm trong 0..100 và bậc khớp điểm", () => {
    const best = confidenceOf(
      prov({
        origin: { source: "aca", at: AT },
        crossChecks: [
          { source: "wcmc", agreed: true, offsetM: 0, at: AT },
          { source: "etopo", agreed: true, offsetM: 10, at: AT },
        ],
      }),
      AT,
    );
    expect(best.score).toBe(100);
    expect(best.band).toBe("A");
    const worst = confidenceOf(prov({ origin: { source: "osm", at: "1990-01-01" } }), AT);
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.band).toBe("D");
  });
});

describe("validateProvenance — trả HẾT lỗi, không ném", () => {
  it("lý lịch đúng ⇒ rỗng", () => {
    expect(
      validateProvenance(
        prov({
          origin: { source: "aca", at: AT, version: "v2" },
          derivedFrom: [{ source: "sdfish", at: AT }],
          crossChecks: [{ source: "wcmc", agreed: true, offsetM: 12, at: AT }],
        }),
      ),
    ).toEqual([]);
  });

  it("thiếu hẳn lý lịch", () => {
    expect(validateProvenance(null)).toEqual(["thiếu lý lịch (prov)"]);
    expect(validateProvenance(undefined)).toHaveLength(1);
  });

  it("bắt ngày sai định dạng ở origin lẫn derivedFrom", () => {
    const errs = validateProvenance({
      origin: { source: "aca", at: "29/08/2026" },
      derivedFrom: [{ source: "osm", at: "" }],
    });
    expect(errs.some((e) => e.startsWith("origin:"))).toBe(true);
    expect(errs.some((e) => e.startsWith("derivedFrom[0]:"))).toBe(true);
  });

  it("bắt ngày ĐÚNG DẠNG nhưng không có thật", () => {
    const errs = validateProvenance({ origin: { source: "aca", at: "2026-02-31" } });
    expect(errs.some((e) => e.includes("không có thật"))).toBe(true);
  });

  it("bắt nguồn lạ", () => {
    const errs = validateProvenance({
      // @ts-expect-error — cố ý truyền nguồn không có trong bảng
      origin: { source: "navionics", at: AT },
    });
    expect(errs.some((e) => e.includes("nguồn lạ"))).toBe(true);
  });

  it("bắt mâu thuẫn: không khớp mà vẫn ghi khoảng lệch", () => {
    const errs = validateProvenance(
      prov({ crossChecks: [{ source: "aca", agreed: false, offsetM: 900, at: AT }] }),
    );
    expect(errs.some((e) => e.includes("agreed=false"))).toBe(true);
  });

  it("bắt offsetM âm", () => {
    const errs = validateProvenance(
      prov({ crossChecks: [{ source: "aca", agreed: true, offsetM: -5, at: AT }] }),
    );
    expect(errs.some((e) => e.includes("offsetM phải ≥ 0"))).toBe(true);
  });

  it("bắt đối chiếu với chính nguồn gốc + đối chiếu trùng nguồn", () => {
    const errs = validateProvenance({
      origin: { source: "osm", at: AT },
      crossChecks: [
        { source: "osm", agreed: true, offsetM: 1, at: AT },
        { source: "aca", agreed: true, offsetM: 1, at: AT },
        { source: "aca", agreed: true, offsetM: 2, at: AT },
      ],
    });
    expect(errs.some((e) => e.includes("CHÍNH nguồn gốc"))).toBe(true);
    expect(errs.some((e) => e.includes("trùng nguồn"))).toBe(true);
  });

  it("gom NHIỀU lỗi trong một lượt (đang duyệt hàng nghìn đối tượng)", () => {
    const errs = validateProvenance({
      origin: { source: "aca", at: "xx" },
      crossChecks: [{ source: "wcmc", agreed: false, offsetM: 3, at: "yy" }],
    });
    expect(errs.length).toBeGreaterThanOrEqual(3);
  });
});
