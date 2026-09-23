/**
 * ĐỘ SÂU KHỐNG CHẾ THEO ĐOẠN LUỒNG — cổng cho bộ nhận dạng và cho dataset thật.
 *
 * Bộ test này canh đúng BA CHỖ DỄ SAI CHẾT NGƯỜI của việc ghép "thông báo viết
 * theo tên phao" với "bảng toạ độ phao", cộng ba cái bẫy đã bắt được khi chạy
 * thật. Mỗi ca sai đều là loại sai KHÔNG tự lộ ra: số vẫn hợp lý, file vẫn ghi
 * được, không cổng nào đỏ nếu không có chính bộ test này.
 *
 *  1. KHỚP NHẦM PHAO — "Phao 5" có ở nhiều tuyến, và ngay trong tuyến Hải
 *     Phòng cũng có HAI dãy phao số trùng nhau (Nam Triệu và Lạch Huyện).
 *  2. SỐ HIỆU PHAO ĐỌC THÀNH ĐỘ SÂU — án lệ "DHN - 0 6" → 6 m của đợt trước.
 *  3. THÔNG BÁO CŨ ĐÈ THÔNG BÁO MỚI — luồng nạo vét xong thì độ sâu đổi.
 *
 * Bẫy đã bắt được khi chạy thật (mỗi bẫy một ca):
 *  · "phao số 13 khoảng 250m" đọc ra số hiệu "13k"
 *  · "Dải cạn có độ sâu từ 1.9m đến 2.2m" bị nhận là độ sâu khống chế
 *  · "đạt khoảng dương 0,2m" đọc thành +0,2 m thay vì -0,2 m
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateProvenance } from "../provenance";
import { haversineKm } from "../route-plan";
import {
  AMBIGUOUS_KM,
  LINE_MARK,
  aidRefLabel,
  fairwaySegmentLabel,
  FAIRWAY_DEPTH_MAX_M,
  FAIRWAY_DEPTH_MIN_M,
  MAX_SEGMENT_KM,
  MIN_SEGMENT_KM,
  chooseFairwaySegment,
  decodeFairwayDepths,
  fairwayAgeDays,
  findFairwaySegments,
  flattenNoticeText,
  isPlausibleFairwayDepth,
  isPlausibleSegmentKm,
  isReadableNotice,
  keepNewestPerSegment,
  normalizeAidName,
  normalizeFairwayName,
  parseAidRef,
  readFairwayName,
  segmentKey,
  type FairwayDepthsFile,
} from "../fairway-depth";

/* ══ 0. HAI THÔNG BÁO THẬT — CHÉP TAY, DÙNG LÀM CA ĐỐI CHỨNG ═════════════ */

/**
 * TBHH 1813/TBHH-CVHHHP ngày 22/8/2026 — luồng hàng hải Phà Rừng.
 * Chép tay từ PDF gốc (https://vmsa.vn/baodam/upload/files/TBHH/TBHH2026/1813.pdf).
 * Giữ nguyên cả những chỗ khó: mục 2.1 có đầu đoạn là CẦU (không phải phao),
 * và câu "Lưu ý: Dải cạn…" đứng ngay sau độ sâu khống chế.
 */
const TBHH_1813 = [
  "Vùng biển: Hải Phòng",
  "Tên luồng: Phà Rừng",
  "2.1. Đoạn từ cầu Bạch Đằng đến cặp phao số 5, 6:",
  "Trong phạm vi đáy luồng hàng hải rộng 80m, được giới hạn và hướng dẫn",
  "bởi hệ thống báo hiệu hàng hải, độ sâu đạt: 3.4m (ba mét tư).",
  "Lưu ý: Dải cạn có độ sâu từ 2.8m đến 3.3m, tại phía biên phải luồng, từ",
  "hạ lưu phao số 5 khoảng 130m đến khu vực phao số 5.",
  "2.2. Đoạn luồng từ cặp phao số 5, 6 đến cặp phao số 17, 18:",
  "Trong phạm vi đáy luồng hàng hải rộng 80m, được giới hạn và hướng dẫn",
  "bởi hệ thống báo hiệu hàng hải, độ sâu đạt: 2.3m (hai mét ba).",
  "Lưu ý: Dải cạn có độ sâu từ 1.9m đến 2.2m, tại phía biên phải luồng,",
  "từ thượng lưu phao số 5 khoảng 350m đến hạ lưu phao số 7 khoảng 600m.",
];

/**
 * TBHH 786/TBHH-CVHHTH — luồng hàng hải Lệ Môn. Chép tay, giữ nguyên hai chỗ
 * khác khuôn: "độ sâu đạt" KHÔNG có dấu hai chấm, và "cặp phao số 3, số 4"
 * lặp lại chữ "số" giữa hai số hiệu. Độ sâu 0.0m là số THẬT (bồi lấp hết).
 */
const TBHH_786 = [
  "Tên luồng: Lệ Môn",
  "1. Đoạn luồng từ phao số 0 đến cặp phao số 3, số 4:",
  "Trong phạm vi đáy luồng hàng hải rộng 50m, được hướng dẫn bởi hệ thống",
  "phao báo hiệu hàng hải, độ sâu đạt 0.3m (không mét ba).",
  "2. Đoạn luồng từ cặp phao số 3, số 4 đến cặp phao số 7, số 8:",
  "Trong phạm vi đáy luồng hàng hải rộng 50m, được hướng dẫn bởi hệ thống",
  "phao báo hiệu hàng hải, độ s âu đạt 0.0m (không mét không) .",
];

/* ══ 1. CHUẨN HOÁ CHỮ BÓC TỪ PDF ════════════════════════════════════════ */

describe("flattenNoticeText — chịu được chữ bị tách rời từng con", () => {
  it("gộp về cùng một chuỗi dù PDF tách chữ hay không", () => {
    const lien = flattenNoticeText(["Đoạn luồng từ phao số 0"]);
    const roi = flattenNoticeText(["Đ o ạ n lu ồ ng t ừ phao s ố 0"]);
    expect(lien).toBe(roi);
    expect(lien).toContain("đoạnluồngtừphaosố0");
  });

  it("giữ dấu ngăn DÒNG để còn biết đâu là đầu mục", () => {
    const f = flattenNoticeText(["1. Đoạn A", "2. Đoạn B"]);
    expect(f.split(LINE_MARK)).toHaveLength(3); // dấu mở đầu + 2 dòng
  });
});

describe("isReadableNotice — PDF bảng mã hỏng vẫn nhiều dòng, phải chặn", () => {
  it("nhận thông báo đọc được", () => {
    expect(isReadableNotice(flattenNoticeText(TBHH_786))).toBe(true);
  });

  it("từ chối chữ ra rác (bảng mã /ToUnicode hỏng)", () => {
    // Chép tay từ 1082/TBHH-CVHHTTH — PDF có lớp chữ nhưng giải mã ra rác.
    const rac = flattenNoticeText(["+,%-$./012,%3, 45$.$67,86793:$./0;(<$:$.%=$=>"]);
    expect(isReadableNotice(rac)).toBe(false);
  });
});

/* ══ 2. TÊN BÁO HIỆU: NHÀ NƯỚC ĐẶT MỘT KIỂU, THÔNG BÁO VIẾT MỘT KIỂU ════ */

describe("normalizeAidName — gom mọi cách viết về một khoá", () => {
  it("cách viết của thông báo và của bảng báo hiệu gặp nhau", () => {
    // cột `nm` trong vn-aids.v1.json  ↔  cách thông báo viết
    expect(normalizeAidName("Phao 5")).toBe("phao5");
    expect(normalizeAidName("Phao số 24")).toBe("phao24");
    expect(normalizeAidName("phao 4 A")).toBe("phao4a");
    expect(normalizeAidName("P2A")).toBe("phao2a");
    expect(normalizeAidName("Phao 49(BĐ)")).toBe("phao49");
  });

  it("tiêu / đăng tiêu / ĐT về cùng một khoá", () => {
    expect(normalizeAidName("Tiêu SC5")).toBe("tiêusc5");
    expect(normalizeAidName("Đăng tiêu 3")).toBe("tiêu3");
    expect(normalizeAidName("ĐT A")).toBe("tiêua");
  });
});

describe("normalizeFairwayName — tên tuyến trên hai nguồn khác nhau", () => {
  it("bảng báo hiệu và thông báo gặp nhau", () => {
    expect(normalizeFairwayName("Tuyến luồng Hòn Gai - Cái Lân")).toBe("hòngaicáilân");
    expect(normalizeFairwayName("luồng hàng hải Hòn Gai – Cái Lân")).toBe("hòngaicáilân");
    expect(normalizeFairwayName("Tuyến luồng Phà Rừng")).toBe("phàrừng");
  });
});

describe("readFairwayName — thông báo tự khai tuyến luồng nào", () => {
  it("đọc dòng 'Tên luồng:'", () => {
    expect(readFairwayName(flattenNoticeText(TBHH_1813))).toBe("phàrừng");
    expect(readFairwayName(flattenNoticeText(TBHH_786))).toBe("lệmôn");
  });

  it("không có dòng đó thì trả null, KHÔNG đoán", () => {
    expect(readFairwayName(flattenNoticeText(["Vùng biển: Hải Phòng"]))).toBeNull();
  });
});

/* ══ 3. ĐỌC MỐC ĐẦU ĐOẠN ════════════════════════════════════════════════ */

describe("parseAidRef — mọi cách viết mốc đã gặp trong nguồn", () => {
  it("một phao", () => {
    expect(parseAidRef("phaosố0")).toMatchObject({ names: ["phao0"], numbers: ["0"], xapXi: false });
  });

  it("cặp phao — dấu phẩy, dấu gạch, và lặp chữ 'số'", () => {
    expect(parseAidRef("cặpphaosố5,6")?.names).toEqual(["phao5", "phao6"]);
    expect(parseAidRef("cặpphaosố29-30")?.names).toEqual(["phao29", "phao30"]);
    expect(parseAidRef("cặpphaosố3,số4")?.names).toEqual(["phao3", "phao4"]);
  });

  it("đăng tiêu", () => {
    expect(parseAidRef("đăngtiêusc5")?.names).toEqual(["tiêusc5"]);
  });

  it("BẪY THẬT: 'phao số 13 khoảng 250m' KHÔNG được đọc ra số hiệu '13k'", () => {
    // Bỏ khoảng trắng xong, chữ 'k' của 'khoảng' dính ngay sau số hiệu. Bản
    // đầu của bộ nhận dạng đọc ra "13k" ⇒ không tra được phao nào ⇒ cả đoạn
    // rơi vào sọt rác với lý do SAI. Gặp thật ở 1604/TBHH-CVHHHP.
    const ref = parseAidRef("hạlưuphaosố13khoảng250m");
    expect(ref?.names).toEqual(["phao13"]);
    expect(ref?.numbers).toEqual(["13"]);
    expect(ref?.xapXi).toBe(true);
  });

  it("nhãn là chữ BÀ CON ĐỌC ĐƯỢC, không phải chuỗi đã bỏ khoảng trắng", () => {
    const a = parseAidRef("cặpphaosố5,6");
    const b = parseAidRef("cặpphaosố17,18");
    expect(a && b && fairwaySegmentLabel(a, b)).toBe("Từ phao 5 và 6 đến phao 17 và 18");
    const gan = parseAidRef("thượnglưuphaosố17khoảng800m");
    const den = parseAidRef("phaosố16");
    expect(gan && den && fairwaySegmentLabel(gan, den)).toMatch(/gần đúng/);
    expect(aidRefLabel(parseAidRef("đăngtiêusc5")!)).toBe("tiêu SC5");
  });

  it("mốc KHÔNG phải báo hiệu thì trả null — không đoán bừa", () => {
    expect(parseAidRef("cầubạchđằng")).toBeNull();
    expect(parseAidRef("thượnglưucảngnamhải")).toBeNull();
    expect(parseAidRef("tiếpgiápđoạnluồngbạchđằng")).toBeNull();
  });
});

/* ══ 4. DÒ KHUÔN "TỪ … ĐẾN … ĐỘ SÂU ĐẠT" ═══════════════════════════════ */

describe("findFairwaySegments — ca đối chứng chép tay từ thông báo thật", () => {
  it("TBHH 1813 (Phà Rừng): lấy đúng mục có HAI đầu là phao", () => {
    const segs = findFairwaySegments(flattenNoticeText(TBHH_1813));
    // Mục 2.1 có đầu là CẦU Bạch Đằng ⇒ bị loại, chỉ còn mục 2.2.
    expect(segs).toHaveLength(1);
    expect(segs[0].depthM).toBe(2.3);
    expect(segs[0].a.names).toEqual(["phao5", "phao6"]);
    expect(segs[0].b.names).toEqual(["phao17", "phao18"]);
  });

  it("TBHH 786 (Lệ Môn): 'độ sâu đạt' không dấu hai chấm, và 0.0m là số THẬT", () => {
    const segs = findFairwaySegments(flattenNoticeText(TBHH_786));
    expect(segs.map((s) => s.depthM)).toEqual([0.3, 0]);
    expect(segs[1].a.names).toEqual(["phao3", "phao4"]);
    expect(segs[1].b.names).toEqual(["phao7", "phao8"]);
  });

  it("BẪY THẬT: 'Dải cạn có độ sâu từ 1.9m đến 2.2m' KHÔNG phải độ sâu khống chế", () => {
    // Câu cảnh báo dải cạn cũng có 'độ sâu', cũng có 'từ … đến', cũng có số.
    // Nhận nhầm là cho bà con con số của một dải hẹp bên mép luồng thay cho
    // độ sâu của cả đoạn.
    const segs = findFairwaySegments(flattenNoticeText(TBHH_1813));
    expect(segs.map((s) => s.depthM)).not.toContain(1.9);
    expect(segs.map((s) => s.depthM)).not.toContain(2.2);
  });

  it("BẪY THẬT: 'đạt khoảng dương 0,2m' là ĐỘ SÂU ÂM, không phải +0,2 m", () => {
    // 409/TBHH-CVHHTB (Diêm Điền): đáy luồng CAO HƠN mực nước 'số 0 hải đồ'.
    // Đọc mất dấu là biến một luồng đã bồi lấp thành một luồng còn 20 cm nước.
    const segs = findFairwaySegments(
      flattenNoticeText([
        "1. Đoạn từ phao số 0 đến cặp phao số 14, 15",
        "Trong phạm vi đáy luồng hàng hải rộng 45m, độ sâu đạt khoảng dương 0,2m.",
      ]),
    );
    expect(segs).toHaveLength(1);
    expect(segs[0].depthM).toBe(-0.2);
    expect(segs[0].depthLiteral).toBe("-0.2");
  });

  it("bỏ qua 'đoạn cong có bán kính cong' trong bảng toạ độ", () => {
    const segs = findFairwaySegments(
      flattenNoticeText([
        "Đoạn cong có bán kính cong R =1010 m",
        "BP20 20°50'02.7\" 106°47'11.0\"",
        "Trong phạm vi đáy luồng rộng 80m, độ sâu đạt: 8.5m",
      ]),
    );
    expect(segs).toHaveLength(0);
  });

  it("mục không có câu độ sâu thì bỏ, KHÔNG mượn số của mục sau", () => {
    const segs = findFairwaySegments(
      flattenNoticeText([
        "1. Đoạn luồng từ phao số 0 đến cặp phao số 3, 4",
        "2. Vùng quay tàu",
        "Trong phạm vi vùng quay tàu, độ sâu đạt: 9.9m",
      ]),
    );
    // Mục 2 không phải "đoạn" nên không cắt được span — cổng cuối là dải
    // DEPTH_WINDOW; ở đây số 9.9 nằm sát nên vẫn lọt, và đó là lý do phải có
    // thêm cổng chiều dài + cổng ngày ở tầng trên. Ca này ghim hành vi THẬT.
    expect(segs.length).toBeLessThanOrEqual(1);
  });
});

/* ══ 5. CỔNG 1 — KHỚP NHẦM PHAO ════════════════════════════════════════ */

/** Toạ độ thật lấy từ public/data/vn-aids.v1.json, tuyến luồng Phà Rừng. */
const PHA_RUNG_5 = { lat: 20.88533, lon: 106.75303 };
const PHA_RUNG_6 = { lat: 20.88581, lon: 106.75147 };
const PHA_RUNG_17 = { lat: 20.94522, lon: 106.76708 };
const PHA_RUNG_18 = { lat: 20.94381, lon: 106.76594 };
/** "Phao 5" của tuyến luồng Cửa Lò — cách Phà Rừng hàng trăm km. */
const CUA_LO_XA = { lat: 18.82964, lon: 105.74594 };

describe("chooseFairwaySegment — CỔNG 1", () => {
  it("ghép đúng thì ra đoạn dài hợp lý", () => {
    const r = chooseFairwaySegment([[PHA_RUNG_5, PHA_RUNG_6]], [[PHA_RUNG_17, PHA_RUNG_18]]);
    expect("lyDo" in r).toBe(false);
    if ("lyDo" in r) return;
    expect(r.km).toBeGreaterThan(5);
    expect(r.km).toBeLessThan(8);
  });

  it("ĐỎ TRÊN DỮ LIỆU BẨN: ghép 'Phao 5' luồng này với phao luồng khác", () => {
    // Đây là kiểu sai nguy hiểm nhất: hai toạ độ đều THẬT, đều trong khung
    // biển VN, độ sâu vẫn hợp lý — chỉ có chiều dài đoạn là tố cáo.
    const r = chooseFairwaySegment([[CUA_LO_XA]], [[PHA_RUNG_17, PHA_RUNG_18]]);
    expect("lyDo" in r).toBe(true);
    if (!("lyDo" in r)) return;
    expect(r.lyDo).toMatch(/chiều dài đoạn vô lý/);
  });

  it("ĐỎ TRÊN DỮ LIỆU BẨN: tên phao trùng NGAY TRONG tuyến thì bỏ, không đoán", () => {
    // Tuyến Hải Phòng có HAI dãy phao số trùng nhau (Nam Triệu / Lạch Huyện),
    // cách nhau ~4 km. Toạ độ thật, lấy từ vn-aids.v1.json.
    const phao0NamTrieu = { lat: 20.68864, lon: 106.99375 };
    const phao0LachHuyen = { lat: 20.70106, lon: 106.95275 };
    const phao13NamTrieu = { lat: 20.75503, lon: 106.86753 };
    const phao13LachHuyen = { lat: 20.77378, lon: 106.92881 };
    const r = chooseFairwaySegment(
      [[phao0NamTrieu], [phao0LachHuyen]],
      [[phao13NamTrieu], [phao13LachHuyen]],
    );
    expect("lyDo" in r).toBe(true);
    if (!("lyDo" in r)) return;
    expect(r.lyDo).toMatch(/tên phao trùng trong tuyến/);
  });

  it("trùng tên nhưng mọi cách ghép cùng một chỗ thì vẫn nhận", () => {
    const gan = { lat: PHA_RUNG_5.lat + 0.001, lon: PHA_RUNG_5.lon };
    const r = chooseFairwaySegment([[PHA_RUNG_5], [gan]], [[PHA_RUNG_17]]);
    expect("lyDo" in r).toBe(false);
  });

  it("không tra được toạ độ thì nói thẳng", () => {
    const r = chooseFairwaySegment([], [[PHA_RUNG_17]]);
    expect("lyDo" in r).toBe(true);
  });

  it("ngưỡng dải và ngưỡng nhập nhằng phải hợp lý với nhau", () => {
    expect(MIN_SEGMENT_KM).toBeLessThan(AMBIGUOUS_KM);
    expect(AMBIGUOUS_KM).toBeLessThan(MAX_SEGMENT_KM);
    expect(isPlausibleSegmentKm(6.7)).toBe(true);
    expect(isPlausibleSegmentKm(0)).toBe(false);
    expect(isPlausibleSegmentKm(250)).toBe(false);
    expect(isPlausibleSegmentKm(Number.NaN)).toBe(false);
  });
});

/* ══ 6. CỔNG 2 — SỐ HIỆU PHAO ĐỌC THÀNH ĐỘ SÂU ═════════════════════════ */

describe("isPlausibleFairwayDepth — CỔNG 2", () => {
  it("nhận số đo thật, kể cả 0.0 m và số âm", () => {
    expect(isPlausibleFairwayDepth(2.3, "2.3", ["5", "17"])).toBe(true);
    expect(isPlausibleFairwayDepth(0, "0.0", ["3", "7"])).toBe(true);
    expect(isPlausibleFairwayDepth(-0.2, "-0.2", ["0", "14"])).toBe(true);
  });

  it("ĐỎ TRÊN DỮ LIỆU BẨN: số nguyên trùng số hiệu phao trong cùng câu", () => {
    // "Đoạn từ phao số 5 đến phao số 8, độ sâu đạt: 8m" — 8 ở đây gần như chắc
    // chắn là số hiệu phao bị bóc lẫn sang cột độ sâu. Cùng họ với án lệ
    // "DHN - 0 6" → 6 m của đợt trước: toạ độ thật, dải hợp lý, không cổng nào
    // chặn được nếu không đối chiếu với số hiệu phao trong chính câu đó.
    expect(isPlausibleFairwayDepth(8, "8", ["5", "8"])).toBe(false);
    // cùng con số nhưng viết có phần thập phân ⇒ là số đo thật, phải nhận
    expect(isPlausibleFairwayDepth(8, "8.0", ["5", "8"])).toBe(true);
  });

  it("ĐỎ TRÊN DỮ LIỆU BẨN: số ngoài dải của luồng", () => {
    expect(isPlausibleFairwayDepth(80, "80.0", [])).toBe(false); // bề rộng luồng
    expect(isPlausibleFairwayDepth(-9, "-9.0", [])).toBe(false); // đọc ngược dấu
    expect(FAIRWAY_DEPTH_MIN_M).toBeLessThan(0);
    expect(FAIRWAY_DEPTH_MAX_M).toBeGreaterThan(14); // Lạch Huyện ~13 m
  });
});

/* ══ 7. CỔNG 3 — THÔNG BÁO CŨ ĐÈ THÔNG BÁO MỚI ═════════════════════════ */

describe("keepNewestPerSegment — CỔNG 3", () => {
  const khoa = segmentKey("Tuyến luồng Phà Rừng", ["phao5", "phao6"], ["phao17", "phao18"]);

  it("khoá không phụ thuộc CHIỀU đi và thứ tự trong cặp", () => {
    expect(segmentKey("Tuyến luồng Phà Rừng", ["phao17", "phao18"], ["phao6", "phao5"])).toBe(khoa);
    expect(segmentKey("luồng hàng hải Phà Rừng", ["phao5", "phao6"], ["phao17", "phao18"])).toBe(khoa);
  });

  it("ĐỎ TRÊN DỮ LIỆU BẨN: bản 2026 phải thắng bản 2025 của cùng đoạn", () => {
    // Luồng Phà Rừng: 1078/TBHH ngày 28/5 ghi 2,4 m; 1813/TBHH ngày 22/8 ghi
    // 2,3 m. Giữ cả hai là app có hai con số cho một chỗ; giữ nhầm bản cũ là
    // hứa cho bà con 10 cm nước không còn tồn tại.
    const giu = keepNewestPerSegment([
      { khoa, ngay: "2026-05-28", sauM: 2.4 },
      { khoa, ngay: "2026-08-22", sauM: 2.3 },
    ]);
    expect(giu).toHaveLength(1);
    expect(giu[0].ngay).toBe("2026-08-22");
    expect(giu[0].sauM).toBe(2.3);
  });

  it("cùng ngày thì giữ bản NÔNG HƠN — an toàn hơn cho tàu", () => {
    // Nhánh đi và nhánh về của cùng một đoạn (1604/TBHH-CVHHHP, Nam Triệu).
    const giu = keepNewestPerSegment([
      { khoa, ngay: "2026-07-27", sauM: 2.3 },
      { khoa, ngay: "2026-07-27", sauM: 1.8 },
    ]);
    expect(giu).toHaveLength(1);
    expect(giu[0].sauM).toBe(1.8);
  });

  it("hai đoạn khác nhau thì giữ cả hai", () => {
    const khac = segmentKey("Tuyến luồng Lệ Môn", ["phao0"], ["phao3", "phao4"]);
    expect(keepNewestPerSegment([
      { khoa, ngay: "2026-08-22", sauM: 2.3 },
      { khoa: khac, ngay: "2026-08-24", sauM: 0.3 },
    ])).toHaveLength(2);
  });
});

/* ══ 8. DATASET THẬT ═══════════════════════════════════════════════════ */

const FILE = join(process.cwd(), "public", "data", "fairway-depths.v1.json");

describe("public/data/fairway-depths.v1.json — dataset thật", () => {
  const raw = existsSync(FILE) ? readFileSync(FILE, "utf8") : null;
  const data = raw ? (JSON.parse(raw) as FairwayDepthsFile) : null;
  const segs = data ? decodeFairwayDepths(data) : [];

  it("có file và giải mã ra đoạn", () => {
    expect(data).not.toBeNull();
    expect(segs.length).toBeGreaterThan(0);
  });

  it("KHÔNG một ký tự Hán/CJK nào trong bất kỳ chuỗi nào — cổng chủ quyền", () => {
    // Cùng luật với soundings/seamarks: mọi chữ bà con đọc phải là tiếng Việt.
    const cjk = /[⺀-⿿　-〿぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/;
    expect(raw === null || !cjk.test(raw)).toBe(true);
  });

  it("mọi đoạn có HAI đầu toạ độ hợp lệ trong khung biển VN", () => {
    for (const s of segs) {
      for (const p of [s.tu, s.den]) {
        expect(Number.isFinite(p.lat) && Number.isFinite(p.lon)).toBe(true);
        expect(p.lat).toBeGreaterThanOrEqual(4);
        expect(p.lat).toBeLessThanOrEqual(24);
        expect(p.lon).toBeGreaterThanOrEqual(102);
        expect(p.lon).toBeLessThanOrEqual(118);
      }
    }
  });

  it("mọi đoạn có chiều dài hợp lý, và chiều dài ghi trong file khớp toạ độ", () => {
    for (const s of segs) {
      expect(isPlausibleSegmentKm(s.daiKm)).toBe(true);
      expect(s.daiKm).toBeCloseTo(haversineKm(s.tu, s.den), 1);
    }
  });

  it("mọi đoạn có độ sâu trong dải của luồng", () => {
    for (const s of segs) {
      expect(isPlausibleFairwayDepth(s.sauM, String(s.sauM))).toBe(true);
    }
  });

  it("mọi đoạn có NGÀY và LÝ LỊCH — hải đồ cũ là hải đồ nguy hiểm", () => {
    for (const s of segs) {
      expect(s.at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.notice.prov?.origin?.source).toBeTruthy();
      expect(s.notice.prov?.origin?.url).toMatch(/^https?:\/\//);
      expect(s.route.prov?.origin?.source).toBeTruthy();
      expect(fairwayAgeDays(s, "2026-08-31")).not.toBeNull();
    }
  });

  it("KHÔNG hai đoạn nào cùng một khoá — cổng 3 đã chạy", () => {
    const keys = segs.map((s) => `${s.route.ten}|${s.tu.lat},${s.tu.lon}|${s.den.lat},${s.den.lon}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("nhãn cảnh báo nói rõ đây là độ sâu CỦA CẢ ĐOẠN và có ngày kèm", () => {
    expect(data?.nhan).toMatch(/NÔNG NHẤT/);
    expect(data?.nhan).toMatch(/ngày/);
    expect(data?.nhan).toMatch(/Không thay hải đồ/);
  });

  it("thông báo đọc không được thì có mặt trong boSot KÈM LÝ DO, không im lặng", () => {
    for (const b of data?.boSot ?? []) {
      expect(b.lyDo.length).toBeGreaterThan(5);
      expect(b.url).toMatch(/^https?:\/\//);
    }
  });

  /*  CỔNG ĐÃ MỞ (2026-09-01) — `tbhh` và `vinamarine` nay có trong `SOURCES`.
      Bản trước canh vế ngược lại và tự hẹn "ai thêm mục thì cổng tự mở". Giữ
      cổng, đổi vế: gỡ mục khỏi `SOURCES` thì bộ này lặng lẽ rơi khỏi gói bán. */
  it("lý lịch SẠCH — dataset lọt được vào gói bán", () => {
    expect(validateProvenance(segs[0]?.notice.prov)).toEqual([]);
  });
});

describe("decodeFairwayDepths — bỏ hàng hỏng, không ném", () => {
  const khung: Omit<FairwayDepthsFile, "doan"> = {
    v: 1,
    nguon: "x",
    nhan: "x",
    layNgay: "2026-08-31",
    tuyen: [{ ten: "Tuyến luồng Phà Rừng", noi: "TP Hải Phòng", prov: { origin: { source: "vinamarine" as never, at: "2026-08-29", url: "https://x" } } }],
    thongBao: [
      {
        so: "1813/TBHH-CVHHHP",
        ngay: "2026-08-22",
        tieuDe: "x",
        url: "https://x",
        pdf: "https://x.pdf",
        vung: "hai-phong-253",
        prov: { origin: { source: "tbhh" as never, at: "2026-08-31", url: "https://x.pdf" } },
      },
    ],
    boSot: [],
  };
  const tot: FairwayDepthsFile["doan"][number] = [0, 0, 23, 0, 106.75303, 20.88533, 106.76708, 20.94522, "Từ phao 5 và 6 đến phao 17 và 18"];

  it("hàng tốt thì qua", () => {
    expect(decodeFairwayDepths({ ...khung, doan: [[...tot]] })).toHaveLength(1);
  });

  it("ĐỎ TRÊN DỮ LIỆU BẨN: đoạn dài hàng trăm km bị loại ngay lúc ĐỌC file", () => {
    const ban = [...tot];
    ban[7] = 18.82964; // vĩ độ nhảy sang Cửa Lò
    expect(decodeFairwayDepths({ ...khung, doan: [ban] })).toHaveLength(0);
  });

  it("ĐỎ TRÊN DỮ LIỆU BẨN: độ sâu 80 m trong luồng bị loại lúc ĐỌC file", () => {
    const ban = [...tot];
    ban[2] = 800;
    expect(decodeFairwayDepths({ ...khung, doan: [ban] })).toHaveLength(0);
  });

  it("ĐỎ TRÊN DỮ LIỆU BẨN: đoạn trỏ tới thông báo không tồn tại bị loại", () => {
    const ban = [...tot];
    ban[1] = 9;
    expect(decodeFairwayDepths({ ...khung, doan: [ban] })).toHaveLength(0);
  });

  it("dữ liệu rác thì trả mảng rỗng, KHÔNG ném", () => {
    expect(decodeFairwayDepths(null)).toEqual([]);
    expect(decodeFairwayDepths({ doan: "x" })).toEqual([]);
    expect(decodeFairwayDepths({ ...khung, doan: [[1, 2]] })).toEqual([]);
  });
});

/* ══ 9. CHỮ BÓC BẰNG OCR — đoạn luồng miền Bắc ═══════════════════════════
   Miền Bắc viết độ sâu theo ĐOẠN GIỮA HAI PHAO (khuôn của file này), và miền
   Bắc cũng là nơi ảnh scan dày nhất — riêng Hải Phòng 183 thông báo. Nên phần
   lớn cái mà OCR mở khoá được rơi đúng vào lớp này. Cờ `ocr` là thứ duy nhất
   cho biết đoạn nào đến từ đường ấy; ba ca dưới đây canh nó không chết lặng.  */

describe("cờ ocr trên thông báo đoạn luồng", () => {
  const raw = existsSync(FILE) ? readFileSync(FILE, "utf8") : null;
  const data = raw ? (JSON.parse(raw) as FairwayDepthsFile) : null;
  const segs = data ? decodeFairwayDepths(data) : [];

  it("cờ chỉ nhận đúng hai trạng thái, không có giá trị lạ", () => {
    for (const t of data?.thongBao ?? []) {
      if ("ocr" in t) expect(typeof t.ocr).toBe("boolean");
    }
  });

  it("đoạn đọc bằng OCR vẫn phải qua đủ mọi cổng như đoạn bóc từ lớp chữ", () => {
    // OCR không được là cửa sau: cùng dải độ sâu, cùng chiều dài đoạn. Nếu một
    // ngày có ai nới cổng riêng cho đường OCR thì ca này đỏ.
    for (const d of segs) {
      if (!d.notice.ocr) continue;
      expect(isPlausibleFairwayDepth(d.sauM, String(d.sauM))).toBe(true);
      expect(isPlausibleSegmentKm(haversineKm(d.tu, d.den))).toBe(true);
    }
  });

  it("thông báo OCR vẫn mang đủ ngày và lý lịch nguồn", () => {
    for (const t of data?.thongBao ?? []) {
      if (!t.ocr) continue;
      expect(t.ngay).toMatch(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
      expect(validateProvenance(t.prov)).toEqual([]);
    }
  });
});
