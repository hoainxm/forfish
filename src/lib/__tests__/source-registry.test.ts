import { describe, expect, it } from "vitest";
import {
  dataQuality,
  fishFailNote,
  LOW_QUALITY_THRESHOLD,
  lowQualityNote,
  monthOfIsoDate,
  oldestIsoDate,
  resolveField,
  type FieldCandidate,
} from "@/lib/source-registry";

const TODAY = "2026-07-26";

/** ứng viên giả: trả grid = id để biết bản nào thắng */
function cand(
  id: string,
  date: string | null,
  maxAgeDays = 3,
  opts: { throws?: boolean; delayMs?: number; onLoad?: () => void } = {},
): FieldCandidate<string> {
  return {
    id,
    label: id,
    maxAgeDays,
    load: async () => {
      opts.onLoad?.();
      if (opts.delayMs)
        await new Promise((r) => setTimeout(r, opts.delayMs));
      if (opts.throws) throw new Error(`${id} hỏng`);
      return date === null ? null : { grid: id, date };
    },
  };
}

describe("resolveField — luật chọn nguồn", () => {
  it("luật 1: chạy SONG SONG, không tuần tự", async () => {
    // hai ứng viên mỗi cái ngủ 60ms; tuần tự ≥120ms, song song ~60ms
    const t0 = Date.now();
    await resolveField(
      [
        cand("a", "2026-07-25", 3, { delayMs: 60 }),
        cand("b", "2026-07-24", 3, { delayMs: 60 }),
      ],
      TODAY,
    );
    expect(Date.now() - t0).toBeLessThan(115);
  });

  it("luật 1b: ứng viên ưu tiên cao HỎNG vẫn không chặn ứng viên sau", async () => {
    const r = await resolveField(
      [cand("a", null, 3, { throws: true }), cand("b", "2026-07-25")],
      TODAY,
    );
    expect(r?.id).toBe("b");
  });

  it("luật 2: bỏ ứng viên ném lỗi / trả null / ngày không parse được", async () => {
    const r = await resolveField(
      [
        cand("throws", "2026-07-26", 3, { throws: true }),
        cand("null", null),
        cand("empty-date", ""),
        cand("bad-date", "last"),
        cand("nonsense-date", "2026-13-45"),
        cand("good", "2026-07-20", 30),
      ],
      TODAY,
    );
    expect(r?.id).toBe("good");
    expect(r?.grid).toBe("good");
  });

  it("luật 3: lấy bản có ngày MỚI NHẤT, kể cả khi nó xếp sau", async () => {
    const r = await resolveField(
      [cand("uu-tien-1", "2026-07-10", 30), cand("uu-tien-2", "2026-07-24", 30)],
      TODAY,
    );
    expect(r?.id).toBe("uu-tien-2");
    expect(r?.date).toBe("2026-07-24");
  });

  it("luật 3b: HOÀ ngày → lấy ứng viên ưu tiên cao hơn (đứng trước)", async () => {
    const r = await resolveField(
      [cand("chinh", "2026-07-24", 30), cand("du-phong", "2026-07-24", 30)],
      TODAY,
    );
    expect(r?.id).toBe("chinh");
  });

  it("luật 4: ageDays = số ngày tới hôm nay; ngày tương lai kẹp về 0", async () => {
    const r = await resolveField([cand("a", "2026-07-22", 30)], TODAY);
    expect(r?.ageDays).toBe(4);
    const future = await resolveField([cand("b", "2026-07-28", 30)], TODAY);
    expect(future?.ageDays).toBe(0);
    expect(future?.stale).toBe(false);
  });

  it("luật 4b: đúng tuổi qua ranh giới THÁNG (cuối tháng không tính sai)", async () => {
    const r = await resolveField([cand("a", "2026-07-31", 30)], "2026-08-02");
    expect(r?.ageDays).toBe(2);
  });

  it("luật 5: quá tuổi vẫn TRẢ VỀ nhưng gắn stale (không âm thầm coi là mới)", async () => {
    const r = await resolveField([cand("cu", "2026-07-01", 3)], TODAY);
    expect(r).not.toBeNull();
    expect(r?.id).toBe("cu");
    expect(r?.ageDays).toBe(25);
    expect(r?.stale).toBe(true);
  });

  it("luật 5b: đúng bằng maxAgeDays thì CHƯA stale, hơn 1 ngày mới stale", async () => {
    expect((await resolveField([cand("a", "2026-07-23", 3)], TODAY))?.stale).toBe(
      false,
    );
    expect((await resolveField([cand("a", "2026-07-22", 3)], TODAY))?.stale).toBe(
      true,
    );
  });

  it("luật 5c: bản MỚI NHẤT thắng kể cả khi nó stale còn bản kia cũng stale", async () => {
    const r = await resolveField(
      [cand("cu-hon", "2026-06-01", 3), cand("moi-hon", "2026-07-10", 3)],
      TODAY,
    );
    expect(r?.id).toBe("moi-hon");
    expect(r?.stale).toBe(true);
  });

  it("luật 6: không ứng viên nào dùng được → null", async () => {
    expect(
      await resolveField(
        [cand("a", null), cand("b", null, 3, { throws: true })],
        TODAY,
      ),
    ).toBeNull();
    expect(await resolveField([], TODAY)).toBeNull();
  });

  it("mỗi ứng viên chỉ được gọi ĐÚNG MỘT LẦN (không dội nguồn ngoài)", async () => {
    let n = 0;
    await resolveField([cand("a", "2026-07-25", 3, { onLoad: () => n++ })], TODAY);
    expect(n).toBe(1);
  });
});

describe("dataQuality — phạt theo ĐÒN BẨY của từng nguồn", () => {
  const ok = { key: "sst", required: true, resolved: { stale: false } };
  const ok2 = { key: "chl", required: true, resolved: { stale: false } };
  const opt = (key: string) => ({ key, required: false, resolved: { stale: false } });
  const gone = (key: string) => ({ key, required: false, resolved: null });
  const old = (key: string) => ({ key, required: false, resolved: { stale: true } });

  it("đủ nguồn và đều mới → 1", () => {
    expect(
      dataQuality([ok, ok2, opt("bathy"), opt("sla"), opt("hycom")]),
    ).toBe(1);
  });

  it("mất nguồn NẶNG phạt nặng theo đòn bẩy (bathy 0.2 · sla/hycom 0.15)", () => {
    expect(dataQuality([ok, ok2, gone("bathy")])).toBe(0.8);
    expect(dataQuality([ok, ok2, gone("sla")])).toBe(0.85);
    expect(dataQuality([ok, ok2, gone("hycom")])).toBe(0.85);
  });

  it("mất nguồn NHẸ phạt nhẹ (currents/anom 0.05)", () => {
    expect(dataQuality([ok, ok2, gone("currents")])).toBe(0.95);
    expect(dataQuality([ok, ok2, gone("anom")])).toBe(0.95);
  });

  it("trường lạ (quên khai đòn bẩy) → mức nhẹ mặc định, không doạ oan", () => {
    expect(dataQuality([ok, ok2, gone("chua-khai")])).toBe(0.95);
  });

  it("CÓ nhưng cũ = nửa mức mất hẳn của chính trường đó", () => {
    expect(dataQuality([ok, ok2, old("bathy")])).toBe(0.9);
    expect(dataQuality([ok, ok2, old("currents")])).toBe(0.975);
  });

  it("trường BẮT BUỘC cũ trừ nặng 0,25", () => {
    expect(dataQuality([{ key: "sst", required: true, resolved: { stale: true } }, ok2])).toBe(
      0.75,
    );
  });

  it("trường bắt buộc mất hẳn → kéo về 0 (route đã {ok:false})", () => {
    expect(dataQuality([{ key: "sst", required: true, resolved: null }, ok2])).toBe(0);
  });

  it("kẹp trong [0,1], không âm", () => {
    const allBad = Array.from({ length: 4 }, () => ({
      key: "sst",
      required: true,
      resolved: null,
    }));
    expect(dataQuality(allBad)).toBe(0);
  });

  // CHẶN HỒI QUY cho lỗi "cảnh báo là MÃ CHẾT": trước đây phạt đều 0.05 × 5
  // trường ⇒ sàn 0.75 mà ngưỡng 0.5 ⇒ nhánh cảnh báo KHÔNG BAO GIỜ chạy.
  it("mất nguồn NẶNG phải LỌT ngưỡng cảnh báo; nguồn nhẹ thì KHÔNG", () => {
    for (const k of ["bathy", "sla", "hycom"]) {
      expect(dataQuality([ok, ok2, gone(k)])).toBeLessThan(LOW_QUALITY_THRESHOLD);
    }
    for (const k of ["currents", "anom"]) {
      expect(dataQuality([ok, ok2, gone(k)])).toBeGreaterThanOrEqual(
        LOW_QUALITY_THRESHOLD,
      );
    }
  });
});

describe("tháng mùa vụ theo NGÀY DỮ LIỆU (không theo đồng hồ máy chủ)", () => {
  it("lấy đúng tháng của ngày dữ liệu", () => {
    expect(monthOfIsoDate("2026-07-31")).toBe(7);
    expect(monthOfIsoDate("2026-08-01")).toBe(8);
    expect(monthOfIsoDate("2026-01-05")).toBe(1);
    expect(monthOfIsoDate("2026-12-31")).toBe(12);
  });

  it("ngày hỏng → 0 để nơi gọi tự lùi, KHÔNG bịa tháng", () => {
    expect(monthOfIsoDate("")).toBe(0);
    expect(monthOfIsoDate("last")).toBe(0);
  });

  it("CUỐI THÁNG: ảnh 31/7 dùng ngày 1/8 vẫn là mùa vụ THÁNG 7", () => {
    // đây chính là lỗi cũ: new Date().getMonth()+1 trên máy chủ trả 8
    const target = oldestIsoDate(["2026-07-31", "2026-08-01"]);
    expect(target).toBe("2026-07-31");
    expect(monthOfIsoDate(target)).toBe(7);
  });
});

describe("lowQualityNote — CHỈ nói khi ảnh CŨ (thiếu nguồn KHÔNG doạ user)", () => {
  it("đủ nguồn, đều mới → IM LẶNG", () => {
    expect(
      lowQualityNote({ sources: { sst: { stale: false }, chl: { stale: false } } }),
    ).toBeNull();
  });

  it("ảnh nhiệt CŨ → nói chuyện ảnh cũ", () => {
    expect(
      lowQualityNote({ sources: { sst: { stale: true }, chl: { stale: false } } }),
    ).toBe("Số biển hôm nay lấy từ ảnh cũ — có thể chưa sát.");
  });

  it("ảnh phù du CŨ cũng nói", () => {
    expect(lowQualityNote({ sources: { chl: { stale: true } } })).toContain("ảnh cũ");
  });

  // Chủ dự án chốt 2026-07-27: bà con KHÔNG cần biết chuyện thiếu nguồn phụ
  // (ảnh vẫn mới, bản đồ vẫn dựng từ nguồn còn sống). dataQuality giữ cho QUẢN TRỊ.
  it("THIẾU NGUỒN nhưng ảnh MỚI → IM LẶNG (không còn cảnh báo 'thiếu vài nguồn')", () => {
    expect(lowQualityNote({ sources: {} })).toBeNull();
    expect(
      lowQualityNote({ sources: { sst: { stale: false }, currents: { stale: false } } }),
    ).toBeNull();
  });

  it("payload cũ (chưa có provenance) → IM LẶNG, không doạ oan", () => {
    expect(lowQualityNote({})).toBeNull();
  });
});

describe("oldestIsoDate", () => {
  it("lấy ngày CŨ NHẤT (nói thật về tuổi bản đồ)", () => {
    expect(oldestIsoDate(["2026-07-24", "2026-07-20", "2026-07-26"])).toBe(
      "2026-07-20",
    );
  });

  it("bỏ ngày rỗng/null/hỏng", () => {
    expect(oldestIsoDate([null, "", undefined, "xxx", "2026-07-24"])).toBe(
      "2026-07-24",
    );
  });

  it("không ngày nào hợp lệ → chuỗi rỗng", () => {
    expect(oldestIsoDate([null, "", "last"])).toBe("");
  });
});

/*  CÂU BÁO LỖI LỚP CÁ — nói đúng việc, và đừng mời bấm cái nút vô ích.
    Ảnh màn hình thật 18/8: "Dự báo cá chưa tải được — chạm để thử lại" hiện
    trong khi snapshot trên máy chủ khoẻ (0,5 giờ tuổi, chất lượng 1, 2187 ô) —
    tức lỗi là chuyện QUYỀN chứ không phải nguồn, mà câu chữ lại đổ cho việc
    tải. Bà con bấm mãi không được gì. */
describe("fishFailNote", () => {
  it("chưa đăng nhập / chưa premium → KHÔNG hiện nút thử lại (thẻ khoá lo)", () => {
    for (const code of [
      "login_required",
      "no_token",
      "unknown_token",
      "token_revoked",
      "premium_required",
    ]) {
      expect(fishFailNote(code)).toBeNull();
    }
  });

  it("hạ tầng bận (503) → nói đúng là bận, mời thử lại SAU", () => {
    expect(fishFailNote("unavailable")).toContain("bận");
  });

  it("lỗi tải thật / không rõ mã → câu cũ, có mời thử lại", () => {
    expect(fishFailNote()).toContain("chưa tải được");
    expect(fishFailNote(undefined)).toContain("chưa tải được");
    expect(fishFailNote("nguon_hong")).toContain("chưa tải được");
  });
});
