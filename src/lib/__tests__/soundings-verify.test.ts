/*  ĐỐI CHIẾU SỐ ĐO SÂU — cổng giữ cho `scripts/verify-soundings.mjs` và
    `public/data/soundings-verified.v1.json` khỏi mục.

    Bộ test này canh BA thứ khác nhau, và cả ba đều đã hỏng thật ít nhất một
    lần trong dự án:

    (1) PHỦ HẾT. Mọi điểm/tuyến/đoạn của ba file nguồn phải có một phán quyết.
        Một mục lọt ra ngoài bảng đối chiếu là một số đo KHÔNG AI SOI mà vẫn
        nằm trong app — đúng kiểu im lặng mà cả đợt này sinh ra để diệt.

    (2) NGHI LỖI KHÔNG ĐƯỢC ĐEO ĐIỂM CAO. Nếu một điểm bị nghi bóc sai mà vẫn
        mang bậc A thì thang tin cậy đang nói dối, và nói dối theo hướng nguy
        hiểm nhất.

    (3) HẰNG SỐ KHÔNG ĐƯỢC TRÔI. Script là `.mjs` nên không nạp được `@/lib`;
        nó chép hằng số lưới của `depth-grid.ts` và công thức chấm điểm của
        `provenance.ts`. Chép thì phải có người canh — chính là file này, cùng
        cách `depth-grid.test.ts` canh script sinh lưới.

    Cộng thêm CỔNG ĐỎ: chèn tay một điểm giả kiểu "DHN - 0 6" (tên điểm đọc
    thành độ sâu 6 m) ở chỗ vệ tinh nói 200 m — bộ phân loại phải bắt được. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEPTH_META } from "../depth-grid";
import {
  CONFIDENCE_WEIGHTS,
  FRESH_FULL_DAYS,
  FRESH_ZERO_DAYS,
  OFFSET_FULL_M,
  OFFSET_ZERO_M,
  SOURCES,
  confidenceOf,
} from "../provenance";
import type { Provenance } from "../provenance";
import {
  BIG_GAP_M,
  GRID_META,
  LAND_Z,
  OUT_OF_DOMAIN_M,
  TBHH_METHOD,
  TOL_ABS_M,
  VERDICT,
  WHOLE_METRE_MIN_N,
  WHOLE_METRE_SHARE,
  CONFIDENCE_WEIGHTS as SCRIPT_WEIGHTS,
  FRESH_FULL_DAYS as SCRIPT_FRESH_FULL,
  FRESH_ZERO_DAYS as SCRIPT_FRESH_ZERO,
  OFFSET_FULL_M as SCRIPT_OFFSET_FULL,
  OFFSET_ZERO_M as SCRIPT_OFFSET_ZERO,
  cellCentre,
  classifyDepth,
  collapseFamilies,
  confidenceScore,
  wholeMetreFlag,
} from "../../../scripts/verify-soundings.mjs";

const DATA = join(process.cwd(), "public", "data");
const doc = (n: string) => JSON.parse(readFileSync(join(DATA, n), "utf8"));

const verified = doc("soundings-verified.v1.json");
const soundings = doc("soundings.v1.json");
const cangvu = doc("soundings-cangvu.v1.json");
const fairway = doc("fairway-depths.v1.json");

type Muc = {
  tep: number;
  loai: "diem" | "tuyen" | "doan";
  i: number;
  so: string | null;
  ngay: string | null;
  sauM: number;
  gebcoM: number | null;
  etopoM: number | null;
  delta: number | null;
  kq: string;
  lyDo: string | null;
  tinCay: number;
  bac: string;
  xacNhan: Array<{ source: string; agreed: boolean; offsetM: number | null; at: string }>;
};
const muc: Muc[] = verified.muc;
const of = (tep: number, loai: string) => muc.filter((m) => m.tep === tep && m.loai === loai);

describe("soundings-verified.v1.json — phủ hết, không bỏ sót mục nào", () => {
  it("nhận đúng ba file nguồn và ghi ngày đối chiếu", () => {
    expect(verified.v).toBe(1);
    expect(verified.tep).toEqual([
      "soundings.v1.json",
      "soundings-cangvu.v1.json",
      "fairway-depths.v1.json",
    ]);
    expect(verified.layNgay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("mọi điểm của cả hai file số đo sâu đều có phán quyết", () => {
    expect(of(0, "diem")).toHaveLength(soundings.diem.length);
    expect(of(1, "diem")).toHaveLength(cangvu.diem.length);
    for (const [tep, src] of [
      [0, soundings],
      [1, cangvu],
    ] as const) {
      const idx = of(tep, "diem").map((m) => m.i).sort((a, b) => a - b);
      expect(new Set(idx).size).toBe(idx.length); // không trùng chỉ số
      expect(idx[0]).toBe(0);
      expect(idx[idx.length - 1]).toBe(src.diem.length - 1);
    }
  });

  it("mọi tuyến CÓ độ sâu khống chế và mọi đoạn luồng đều có phán quyết", () => {
    const coSau = (f: { tuyen?: Array<{ sau: number | null }> }) =>
      (f.tuyen ?? []).filter((t) => t.sau !== null && t.sau !== undefined).length;
    expect(of(0, "tuyen")).toHaveLength(coSau(soundings));
    expect(of(1, "tuyen")).toHaveLength(coSau(cangvu));
    expect(of(2, "doan")).toHaveLength(fairway.doan.length);
  });

  it("mỗi mục có kết quả hợp lệ, độ sâu khớp file gốc, và bậc tin cậy 0..100", () => {
    const hopLe = new Set(Object.values(VERDICT));
    for (const m of muc) {
      expect(hopLe.has(m.kq)).toBe(true);
      expect(m.tinCay).toBeGreaterThanOrEqual(0);
      expect(m.tinCay).toBeLessThanOrEqual(100);
      expect(["A", "B", "C", "D"]).toContain(m.bac);
    }
    // xác suất trôi cao nhất là chỗ giải mã dm→m; soi lại bằng chính file gốc
    for (const m of of(0, "diem")) {
      expect(m.sauM).toBeCloseTo(soundings.diem[m.i][2] / 10, 6);
    }
  });

  it("tổng kết khớp đúng số mục đã chấm — không có mục nào rơi khỏi bảng đếm", () => {
    const t = verified.tomTat;
    expect(t.tong).toBe(muc.length);
    expect(t.khop + t.giaiThichDuoc + t.nghiLoi + t.khongDoiChieuDuoc).toBe(muc.length);
  });

  it("KHÔNG có mục nào 'không đối chiếu được' mà im lặng — phải nói vì sao", () => {
    for (const m of muc.filter((x) => x.kq === VERDICT.UNKNOWN)) {
      expect(typeof m.lyDo).toBe("string");
      expect((m.lyDo ?? "").length).toBeGreaterThan(20);
    }
  });
});

describe("nghi lỗi KHÔNG được mang độ tin cậy cao", () => {
  it("mọi mục bị nghi rơi xuống bậc D và dưới ngưỡng 40", () => {
    const sus = muc.filter((m) => m.kq === VERDICT.SUSPECT);
    for (const m of sus) {
      expect(m.bac).toBe("D");
      expect(m.tinCay).toBeLessThan(40);
      // và không được có xác nhận nào ghi "agreed" — nghi mà vẫn xác nhận là mâu thuẫn
      expect(m.xacNhan.some((c) => c.agreed)).toBe(false);
    }
  });

  it("chỉ mục KHỚP mới được ghi agreed=true, và chỉ khi đó mới có vênh vị trí", () => {
    for (const m of muc) {
      for (const c of m.xacNhan) {
        expect(c.agreed).toBe(m.kq === VERDICT.MATCH);
        // luật của validateProvenance: không khớp thì CẤM ghi offsetM
        if (!c.agreed) expect(c.offsetM).toBeNull();
        else expect(c.offsetM).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("bậc A chỉ dành cho mục KHỚP", () => {
    for (const m of muc.filter((x) => x.bac === "A")) expect(m.kq).toBe(VERDICT.MATCH);
  });
});

describe("cổng đỏ — điểm giả kiểu 'DHN - 0 6' phải bị bắt", () => {
  /*  Ca thật đã dính: chuỗi "DHN - 0 6" là TÊN điểm, bộ bóc đọc thành ĐỘ SÂU
      6 m. Toạ độ thật, dải hợp lý, mọi cổng cũ cho qua. Thứ duy nhất tố cáo
      được nó là mô hình độ sâu: chỗ đó biển sâu 200 m. */
  it("khảo sát 6 m ở chỗ CẢ HAI mô hình nói 200 m ⇒ NGHI LỖI", () => {
    const r = classifyDepth(6, -200, -200);
    expect(r.verdict).toBe(VERDICT.SUSPECT);
    expect(r.lyDo).toContain("ngoài địa bàn");
  });

  it("điểm giả không thể leo lên bậc cao — không xác nhận thì không có điểm", () => {
    const gia = classifyDepth(6, -200, -200);
    const xacNhan = [
      { source: "gebco", agreed: gia.verdict === VERDICT.MATCH, offsetM: null, at: "2026-08-31" },
      { source: "etopo", agreed: gia.verdict === VERDICT.MATCH, offsetM: null, at: "2026-08-31" },
    ];
    const c = confidenceScore(collapseFamilies(xacNhan), TBHH_METHOD, "2026-08-01", "2026-08-31");
    expect(c.band).toBe("D");
    expect(c.score).toBeLessThan(40);
  });

  it("KHÔNG mục thật nào trong file đang rơi vào chế độ đó — nếu có thì phải mở PDF", () => {
    const raSau = muc.filter(
      (m) => m.gebcoM !== null && m.etopoM !== null && Math.min(m.gebcoM, m.etopoM) > OUT_OF_DOMAIN_M,
    );
    expect(raSau).toEqual([]);
  });

  it("cổng lệch-lớn bắt ca chưa ra khỏi địa bàn nhưng vênh quá bao đo được", () => {
    // 35 m nước dưới một điểm khai 5 m: chưa quá trần 40 m, nhưng Δ = 30 m
    expect(classifyDepth(5, -35, -35).verdict).toBe(VERDICT.SUSPECT);
    expect(classifyDepth(5, -35, -35).lyDo).toContain(String(BIG_GAP_M));
  });
});

describe("phân loại — chiều lệch quyết định, không chỉ độ lớn", () => {
  it("khảo sát SÂU HƠN mô hình không bao giờ bị kết tội (chữ ký nạo vét)", () => {
    for (let sau = 5; sau <= 25; sau += 0.5) {
      for (const zModel of [-2, -3, -5, -8]) {
        const r = classifyDepth(sau, zModel, zModel);
        expect(r.verdict).not.toBe(VERDICT.SUSPECT);
      }
    }
  });

  it("mô hình nói ĐẤT thì trả 'không đối chiếu được', KHÔNG trả 'khớp'", () => {
    // Luồng Cái Mép – Thị Vải: khảo sát 13,7 m, cả hai mô hình xếp là đất.
    // Bản nháp đầu kết tội 138 điểm kiểu này — toàn oan.
    const r = classifyDepth(13.7, 1, 3);
    expect(r.verdict).toBe(VERDICT.UNKNOWN);
    expect(r.lyDo).toContain("đất");
  });

  it("hai mô hình mâu thuẫn đất↔nước cũng là 'không đối chiếu được'", () => {
    const r = classifyDepth(4.8, 1, -25);
    expect(r.verdict).toBe(VERDICT.UNKNOWN);
    expect(r.lyDo).toContain("mâu thuẫn");
  });

  it("dải tha bổng nới ra đúng bằng khoảng vênh giữa hai mô hình", () => {
    // hai mô hình nhất trí ⇒ tol = TOL_ABS_M
    expect(classifyDepth(10, -10 - TOL_ABS_M, -10 - TOL_ABS_M).verdict).toBe(VERDICT.MATCH);
    expect(classifyDepth(10, -11 - TOL_ABS_M, -11 - TOL_ABS_M).verdict).toBe(VERDICT.EXPLAINED);
    // hai mô hình lệch nhau 8 m ⇒ tol rộng thêm 8 m, cùng một Δ lại thành khớp
    expect(classifyDepth(10, -18 - TOL_ABS_M, -10 - TOL_ABS_M).verdict).toBe(VERDICT.MATCH);
  });

  it("thiếu một mô hình thì không kết luận", () => {
    expect(classifyDepth(10, null, -12).verdict).toBe(VERDICT.UNKNOWN);
    expect(classifyDepth(10, -12, null).verdict).toBe(VERDICT.UNKNOWN);
    expect(classifyDepth(Number.NaN, -12, -12).verdict).toBe(VERDICT.UNKNOWN);
  });

  it("ngưỡng đất khớp DepthClass 0 của lưới đang chạy", () => {
    expect(LAND_Z).toBe(-2);
  });
});

describe("cổng chữ số lẻ bị rơi — ca đối chứng CHÉP TAY từ PDF gốc", () => {
  /*  Thông báo 57/TBHH-TCTBĐATHHMN (bản lưu trữ vms-south.vn trong Internet
      Archive, mục NtM 318/2019). Bản song ngữ vẽ chữ số lẻ ở toạ độ khác nên
      bộ bóc dựng nó thành DÒNG RIÊNG:

          Chèn Độ sâu 7 10°34'55.39"N 106°50'11.82"E
          7                                            ← chữ số lẻ, dòng riêng
          Chèn Độ sâu 8 5 10°45'15.61"N 106°44'45.93"E ← 8,5 m

      Hai danh sách dưới đây CHÉP TAY: một là 17 số đang nằm trong
      soundings.v1.json, một là 21 số đọc rõ được bằng mắt từ chính PDF ấy
      (PDF liệt kê 23 hàng cho thông báo này; 2 hàng bị lớp chữ che mất chữ số
      lẻ nên không chép). Cổng phải đỏ với danh sách thứ nhất và im với danh
      sách thứ hai — nếu không, nó đang bắt theo cái khác chứ không theo lỗi
      này. */
  const trongFile = [7, 3, 14, 4, 7, 8, 8, 8, 8, 7, 8, 8, 8, 7.6, 6, 7, 7];
  const trongPdf = [
    7.7, 8.5, 8.5, 8.2, 8.3, 7.9, 8.3, 8.4, 8.2, 8, 7.5, 8.2, 7.9, 7.5, 8.1, 6.5, 7.6, 7.3, 8.4,
    8.4, 8.4,
  ];

  it("cờ đỏ với bản đã rơi chữ số lẻ", () => {
    const f = wholeMetreFlag(trongFile);
    expect(f).not.toBeNull();
    expect(f?.whole).toBe(16);
    expect(f?.n).toBe(17);
    expect(f?.lyDo).toContain("mét chẵn");
  });

  it("im với bản đọc đúng từ PDF", () => {
    expect(wholeMetreFlag(trongPdf)).toBeNull();
  });

  it("không phán xét thông báo quá ít điểm — toàn số nguyên ở n nhỏ là chuyện thường", () => {
    expect(wholeMetreFlag(Array.from({ length: WHOLE_METRE_MIN_N - 1 }, () => 5))).toBeNull();
    expect(wholeMetreFlag(Array.from({ length: WHOLE_METRE_MIN_N }, () => 5))).not.toBeNull();
  });

  it("ngưỡng nằm giữa hai cụm đo được (0–20% ↔ 94%)", () => {
    expect(WHOLE_METRE_SHARE).toBeGreaterThan(0.2);
    expect(WHOLE_METRE_SHARE).toBeLessThan(0.94);
  });

  it("thông báo bị cờ kéo theo TOÀN BỘ điểm của nó xuống nghi lỗi", () => {
    // Bất biến, không phụ thuộc corpus: vệ tinh mù trước lỗi dưới 1 m nên
    // "khớp" ở một điểm KHÔNG gỡ tội cho thông báo bị cờ.
    const co = verified.thongBaoNghi as Array<{ so: string; soNguyen: number; tong: number }>;
    for (const tb of co) {
      const cua = muc.filter((m) => m.so === tb.so && m.loai === "diem");
      expect(cua.length).toBe(tb.tong);
      for (const m of cua) expect(m.kq).toBe(VERDICT.SUSPECT);
    }
  });

  it("ca đã truy ra nguyên nhân — 57/TBHH-TCTBĐATHHMN vẫn đang bị cờ", () => {
    /*  ĐỎ CÓ CHỦ Ý, giống cổng "nguồn lạ" ở fairway-depth.test.ts. Đã mở PDF
        gốc đọc bằng mắt: 16/17 số của thông báo này rơi mất chữ số lẻ (7,7 →
        7 · 8,5 → 8 · 6,5 → 6), và 3 hàng còn lạc từ NtM 319/2019 (nguồn
        59/TBHH) sang. Khi `scripts/fetch-soundings.mjs` biết dựng lại chữ số
        lẻ nằm ở dòng riêng và biết cắt theo ranh giới mục NtM, chạy lại
        `node scripts/verify-soundings.mjs` rồi XOÁ ca này — đừng nới nó. */
    const co = verified.thongBaoNghi as Array<{ so: string; soNguyen: number; tong: number }>;
    const n57 = co.find((x) => x.so === "57/TBHH-TCTBĐATHHMN");
    expect(n57, "lỗi rơi chữ số lẻ ở 57/TBHH-TCTBĐATHHMN đã sửa? xoá ca test này").toBeDefined();
    expect(n57?.soNguyen).toBe(16);
    expect(n57?.tong).toBe(17);
  });
});

describe("hằng số chép sang script KHÔNG được trôi khỏi src/lib", () => {
  it("lưới 15″ trong script khớp DEPTH_META", () => {
    expect(GRID_META.lat0).toBeCloseTo(DEPTH_META.lat0, 12);
    expect(GRID_META.lon0).toBeCloseTo(DEPTH_META.lon0, 12);
    expect(GRID_META.step).toBeCloseTo(DEPTH_META.step, 12);
    expect(GRID_META.nLat).toBe(DEPTH_META.nLat);
    expect(GRID_META.nLon).toBe(DEPTH_META.nLon);
  });

  it("tâm ô luôn cách điểm không quá nửa đường chéo ô 15″ (~318 m)", () => {
    const c = cellCentre(10.5, 107.0);
    expect(Math.abs(c.lat - 10.5)).toBeLessThanOrEqual(DEPTH_META.step / 2 + 1e-9);
    expect(Math.abs(c.lon - 107.0)).toBeLessThanOrEqual(DEPTH_META.step / 2 + 1e-9);
  });

  it("trọng số + ngưỡng chấm điểm khớp provenance.ts", () => {
    expect(SCRIPT_WEIGHTS).toEqual(CONFIDENCE_WEIGHTS);
    expect(SCRIPT_OFFSET_FULL).toBe(OFFSET_FULL_M);
    expect(SCRIPT_OFFSET_ZERO).toBe(OFFSET_ZERO_M);
    expect(SCRIPT_FRESH_FULL).toBe(FRESH_FULL_DAYS);
    expect(SCRIPT_FRESH_ZERO).toBe(FRESH_ZERO_DAYS);
  });

  it("hạng phương pháp mượn cho 'tbhh' là hạng CÓ THẬT trong provenance.ts", () => {
    // "tbhh" chưa đăng ký trong SOURCES (cổng ở fairway-depth.test.ts cố ý giữ
    // đỏ), nên script mượn hạng gần nhất. Hạng mượn phải tồn tại thật.
    const cac = new Set(Object.values(SOURCES).map((s) => s.method));
    expect(cac.has(TBHH_METHOD)).toBe(true);
  });

  it("confidenceScore của script cho ĐÚNG số như confidenceOf của lib", () => {
    const cases: Array<[Provenance, string | undefined]> = [
      [{ origin: { source: "etopo", at: "2026-01-01" } }, "2026-08-31"],
      [
        {
          origin: { source: "etopo", at: "2020-01-01" },
          crossChecks: [{ source: "gebco", agreed: true, offsetM: 200, at: "2026-08-31" }],
        },
        "2026-08-31",
      ],
      [
        {
          origin: { source: "etopo", at: "2026-08-01" },
          crossChecks: [
            { source: "gebco", agreed: true, offsetM: 120, at: "2026-08-31" },
            { source: "aca", agreed: true, offsetM: 900, at: "2026-08-31" },
          ],
        },
        "2026-08-31",
      ],
      [
        {
          origin: { source: "etopo", at: "2026-08-01" },
          crossChecks: [{ source: "gebco", agreed: false, offsetM: null, at: "2026-08-31" }],
        },
        undefined,
      ],
    ];
    for (const [p, today] of cases) {
      const lib = confidenceOf(p, today);
      const script = confidenceScore(
        p.crossChecks ?? [],
        SOURCES[p.origin.source].method,
        p.origin.at,
        today,
      );
      expect(script.score).toBe(lib.score);
      expect(script.band).toBe(lib.band);
      expect(script.confirmations).toBe(lib.confirmations);
      expect(script.worstOffsetM).toBe(lib.worstOffsetM);
    }
  });

  it("gộp họ nguồn: ETOPO + GEBCO chỉ tính là MỘT xác nhận độc lập", () => {
    /*  Đo thật trên 362 điểm cả hai cùng thấy nước: khoảng vênh giữa chúng có
        TRUNG VỊ 0,0 m. Đếm thành hai nguồn độc lập là tự thưởng điểm cho một
        sự trùng khớp không mang thông tin. */
    const hai = [
      { source: "gebco", agreed: true, offsetM: 100, at: "2026-08-31" },
      { source: "etopo", agreed: true, offsetM: 300, at: "2026-08-31" },
    ];
    const gop = collapseFamilies(hai);
    expect(gop).toHaveLength(1);
    expect(gop[0].offsetM).toBe(300); // giữ bản VÊNH NHẤT, không giữ bản đẹp nhất
    expect(confidenceScore(gop, TBHH_METHOD, "2026-08-01", "2026-08-31").confirmations).toBe(1);
    // nguồn khác họ thì KHÔNG gộp
    expect(
      collapseFamilies([...hai, { source: "aca", agreed: true, offsetM: 10, at: "2026-08-31" }]),
    ).toHaveLength(2);
  });
});

describe("ngưỡng đã chọn phải nằm ngoài bao lệch mà dữ liệu thật thể hiện", () => {
  it("mục nào chạm trần lệch lớn thì PHẢI bị kết 'nghi lỗi', không lọt im", () => {
    /* Trước 2026-09-01 ca này khẳng định KHÔNG mục nào chạm trần 20 m — đúng
       với corpus hồi đó. Đợt OCR miền Nam làm nó chạm: `2332/TBHH-CVHHTPHCM`
       ghi 15,3 m trong khi CẢ HAI mô hình nói 40 m (Δ 24,7 m).

       KHÔNG nới `BIG_GAP_M` — trần đang làm đúng việc của nó. Và KHÔNG quay lại
       khẳng định "không bao giờ chạm", vì điều đó chỉ đúng khi chưa có dữ liệu
       xấu nào; nó là một sự thật về corpus, không phải một tính chất an toàn.

       Tính chất an toàn thật sự — và là thứ bà con phụ thuộc vào — là: chạm
       trần thì phải BỊ KẾT TỘI, để `soundings-verified.v1.json` ghi lại và
       giao diện KHÔNG vẽ điểm đó. Ca này canh đúng điều ấy. */
    const deltas = muc.map((m) => m.delta).filter((d): d is number => d !== null);
    expect(deltas.length).toBeGreaterThan(0);
    const chamTran = muc.filter((m) => m.delta !== null && (m.delta as number) >= BIG_GAP_M);
    for (const m of chamTran) expect(m.kq).toBe("nghi-loi");
  });

  it("sàn tha bổng 6 m — nằm trên p85 của |Δ| đo được, dưới trần lệch lớn", () => {
    /* Trước 2026-09-01 ca này canh p90, và p90 hồi ấy là 5,0 m. Corpus khi đó
       TOÀN MIỀN NAM. Đợt OCR miền Bắc thêm 107 tuyến ở cửa lạch Hải Phòng —
       Nghi Sơn — Cửa Lò, và ở đó |Δ| rộng hơn hẳn (p50 5,4 m so với 1,9 m của
       phần cũ) vì một lý do vật lý, không phải vì bóc sai: ô lưới 450 m của
       GEBCO/ETOPO KHÔNG THẤY được lòng lạch nạo vét hẹp hơn nó. Đo thật: 75/107
       mục OCR bị chính hai mô hình xếp là "đất", tức chúng không có ý kiến.
       p90 toàn bộ vì thế lên 6,7 m.

       KHÔNG nới `TOL_ABS_M` để chiều theo con số ấy — nới một cổng an toàn cho
       vừa dữ liệu mới là đi ngược chiều. Giữ sàn 6 m và hạ mốc canh xuống p85
       (5,1 m). Ý nghĩa giữ nguyên: sàn phải nằm trên phần lớn nhiễu thường
       ngày và dưới trần lệch lớn. Kết cục thật vẫn được canh ở chỗ khác, và nó
       xanh: 0/107 mục OCR bị kết "nghi lỗi". */
    const abs = muc
      .map((m) => m.delta)
      .filter((d): d is number => d !== null)
      .map(Math.abs)
      .sort((a, b) => a - b);
    const p85 = abs[Math.floor(abs.length * 0.85)];
    expect(TOL_ABS_M).toBeGreaterThanOrEqual(p85);
    expect(TOL_ABS_M).toBeLessThan(BIG_GAP_M);
  });

  it("ô mô hình vượt trần địa bàn 40 m thì mục đó PHẢI bị kết 'nghi lỗi'", () => {
    /* Cùng lý do với ca trên: đây là sự thật về corpus, không phải tính chất an
       toàn. Corpus sau OCR chạm đúng 40 m. Ngưỡng giữ nguyên; điều được canh là
       không có mục nào vượt trần mà vẫn lọt vào bản đồ. */
    const vuot = muc.filter(
      (m) =>
        m.gebcoM !== null &&
        m.etopoM !== null &&
        Math.min(m.gebcoM as number, m.etopoM as number) > OUT_OF_DOMAIN_M,
    );
    for (const m of vuot) expect(m.kq).toBe("nghi-loi");
  });
});
