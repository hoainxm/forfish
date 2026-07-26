import { describe, expect, it } from "vitest";
import {
  dataQuality,
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

describe("dataQuality", () => {
  const ok = { required: true, resolved: { stale: false } };
  const okOpt = { required: false, resolved: { stale: false } };

  it("đủ nguồn và đều mới → 1", () => {
    expect(dataQuality([ok, ok, okOpt, okOpt, okOpt])).toBe(1);
  });

  it("mỗi trường tuỳ chọn MẤT trừ 0,05", () => {
    expect(dataQuality([ok, ok, { required: false, resolved: null }])).toBe(0.95);
    expect(
      dataQuality([
        ok,
        ok,
        { required: false, resolved: null },
        { required: false, resolved: null },
      ]),
    ).toBe(0.9);
  });

  it("trường tuỳ chọn CŨ trừ 0,025 — nhẹ hơn mất hẳn", () => {
    expect(dataQuality([ok, ok, { required: false, resolved: { stale: true } }])).toBe(
      0.975,
    );
  });

  it("trường BẮT BUỘC cũ trừ nặng 0,25", () => {
    expect(dataQuality([{ required: true, resolved: { stale: true } }, ok])).toBe(
      0.75,
    );
  });

  it("trường bắt buộc mất hẳn → kéo về 0 (route đã {ok:false})", () => {
    expect(dataQuality([{ required: true, resolved: null }, ok])).toBe(0);
  });

  it("kẹp trong [0,1], không âm", () => {
    const allBad = Array.from({ length: 4 }, () => ({
      required: true,
      resolved: null,
    }));
    expect(dataQuality(allBad)).toBe(0);
  });

  it("mức xấu nhất còn dữ liệu (2 bắt buộc cũ + 5 tuỳ chọn mất) = 0,25", () => {
    const fields = [
      { required: true, resolved: { stale: true } },
      { required: true, resolved: { stale: true } },
      ...Array.from({ length: 5 }, () => ({ required: false, resolved: null })),
    ];
    expect(dataQuality(fields)).toBe(0.25);
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

describe("lowQualityNote — chỉ nói khi THẬT SỰ cần (màn hình phải gọn)", () => {
  it("đủ nguồn, đều mới → IM LẶNG", () => {
    expect(
      lowQualityNote({
        dataQuality: 1,
        sources: { sst: { stale: false }, chl: { stale: false } },
      }),
    ).toBeNull();
  });

  it("thiếu vài nguồn tuỳ chọn nhưng vẫn khá → IM LẶNG", () => {
    expect(lowQualityNote({ dataQuality: 0.9, sources: {} })).toBeNull();
  });

  it("ảnh nhiệt CŨ → nói chuyện ảnh cũ", () => {
    expect(
      lowQualityNote({
        dataQuality: 0.75,
        sources: { sst: { stale: true }, chl: { stale: false } },
      }),
    ).toBe("Số biển hôm nay lấy từ ảnh cũ — có thể chưa sát.");
  });

  it("ảnh phù du CŨ cũng nói", () => {
    expect(
      lowQualityNote({ dataQuality: 0.75, sources: { chl: { stale: true } } }),
    ).toContain("ảnh cũ");
  });

  it("chất lượng dưới 0,5 → nói thiếu nguồn", () => {
    expect(lowQualityNote({ dataQuality: 0.45, sources: {} })).toBe(
      "Hôm nay thiếu vài nguồn số biển — bản đồ cá có thể chưa sát.",
    );
  });

  it("đúng 0,5 chưa nói (chỉ DƯỚI ngưỡng mới nói)", () => {
    expect(lowQualityNote({ dataQuality: 0.5, sources: {} })).toBeNull();
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
