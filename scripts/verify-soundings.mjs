// SOI LỖI BÓC TRONG SỐ ĐO SÂU KHẢO SÁT — bằng hai mô hình độ sâu ĐỘC LẬP.
//
//   node scripts/verify-soundings.mjs              # đối chiếu + ghi file kết quả
//   node scripts/verify-soundings.mjs --stats      # chỉ in phân bố, KHÔNG ghi file
//   node scripts/verify-soundings.mjs --offline    # dùng lại kho tạm, không gọi mạng
//   node scripts/verify-soundings.mjs --cache <đường dẫn>
//
// Ghi ĐÚNG MỘT file: public/data/soundings-verified.v1.json. KHÔNG đè file gốc.
// Kho tạm (phản hồi thô của hai mô hình) nằm NGOÀI repo — thư mục tạm của hệ
// điều hành — theo quy tắc CHỐNG PHÌNH #5 trong CLAUDE.md.
//
// ── VÌ SAO CÓ FILE NÀY: HƯỚNG ĐỐI CHIẾU BỊ LẬT NGƯỢC ───────────────────────
// Giả thuyết ban đầu là "khảo sát đúng, lưới vệ tinh sai, lấy khảo sát sửa
// lưới". Đo thật (lead, 30/08) bác bỏ: 377/379 điểm và 13/13 đoạn luồng KHỚP
// lớp đi biển của lưới ETOPO+GEBCO; hai điểm lệch đều nằm sát ngưỡng 12 m.
// Lưới không cần sửa.
//
// Cái CẦN sửa đi theo chiều ngược lại. Đường ống bóc PDF đã sinh điểm giả
// nhiều lần, và MỌI LẦN ĐỀU IM LẶNG vì con số giả nằm trong dải hợp lý:
//   · "DHN - 0 6" (TÊN điểm) → đọc thành ĐỘ SÂU 6 m, toạ độ thật, dải hợp lý
//   · "10 5 ° 18’" → 5,3° thay vì 105,3° — mất trắng cột kinh độ
//   · "7,5 10°44'" → 510 độ
//   · bản ký số trống ngày → vớ "Nghị định 58/2017" → khảo sát 2025 ghi 2017
// Cổng hiện có (ngoài khung VN, độ sâu âm, trần 200 m) chặn được cái VÔ LÝ.
// Chúng không chặn được cái HỢP LÝ MÀ SAI. Mô hình độ sâu vệ tinh là nguồn
// độc lập duy nhất bắt được loại đó: nó không biết gì về PDF, nên nó không thể
// sai theo CÙNG KIỂU.
//
// ── HAI MÔ HÌNH, KHÔNG PHẢI MỘT ────────────────────────────────────────────
//  · ETOPO 2022 15″ — NOAA NCEI, public domain, qua ERDDAP PIFSC. CÙNG endpoint
//    mà scripts/generate-depth-grid.mjs dùng để sinh depth-grid.v1.bin.
//  · GEBCO Grid 15″ — qua ODB FastAPI của NTU. ⚠️ BẮT BUỘC `mode=point`; thiếu
//    nó API nội suy thành TRẮC DIỆN (bẫy đã ghi ở scripts/compare-sources.mjs).
// Hai mô hình này KHÔNG hoàn toàn độc lập (cùng gộp nhiều khảo sát chung), nên
// luật kết tội dưới đây đòi CẢ HAI cùng nói sâu — và lấy bên NÔNG HƠN làm
// chứng, tức luôn nghiêng về phía tha bổng.
//
// Không thêm dependency. Toán cầu + chỉ số lưới viết lại tại chỗ vì
// scripts/*.mjs không nạp được alias "@/lib" — GIỐNG lý do đã ghi ở đầu
// scripts/compare-sources.mjs. Mối nối giữ bằng test:
// src/lib/__tests__/soundings-verify.test.ts đối chiếu hằng số lưới + trọng số
// chấm điểm với src/lib/depth-grid.ts và src/lib/provenance.ts, VÀ chạy
// `depthClassAt` dưới đây trên chính depth-grid.v1.bin rồi so từng ô với bản
// của thư viện — đỏ khi hai bên trôi.
// ⚠️ Câu trên từng SAI: tới 2026-09-04 test chỉ so `GRID_META`, không đụng tới
// cách đóng gói bit lẫn bảng lớp, nên lưới lên 4 bit mà script vẫn giải mã 2
// bit suốt một đợt. Guard được viện dẫn mà không tồn tại còn tệ hơn không có
// guard: nó ru người đọc. Nay ca so-từng-ô là có thật (review đợt 4, N5).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

/* ── 0. HẰNG SỐ LƯỚI — PHẢI KHỚP src/lib/depth-grid.ts ──────────────────── */

/** Bước lưới ETOPO/GEBCO 15 giây cung. */
export const STEP_15S = 1 / 240;
/** Gốc lưới: ô là ô TÂM, tâm ở (k + 0,5)/240 độ — y hệt DEPTH_META. */
export const GRID_META = {
  lat0: 5 + STEP_15S / 2,
  lon0: 102 + STEP_15S / 2,
  step: STEP_15S,
  nLat: 4441,
  nLon: 3841,
};

const R_EARTH_M = 6_371_008.8;
const rad = (d) => (d * Math.PI) / 180;

export function haversineM(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Tâm ô lưới 15″ chứa toạ độ này — giá trị mô hình thuộc về ĐÂY, không thuộc điểm đo. */
export function cellCentre(lat, lon) {
  const i = Math.round((lat - GRID_META.lat0) / GRID_META.step);
  const j = Math.round((lon - GRID_META.lon0) / GRID_META.step);
  return { lat: GRID_META.lat0 + i * GRID_META.step, lon: GRID_META.lon0 + j * GRID_META.step };
}

/**
 * Lớp đi biển của lưới đóng gói — PHẢI khớp `depthClassAt` của
 * src/lib/depth-grid.ts.
 *
 * 4 BIT/Ô, 6 LỚP (sửa 2026-09-04, review đợt 4 N5). Bản trước còn giải mã
 * 2 bit/ô của lưới cũ: file 4 bit to gấp đôi nên chỉ số vẫn nằm trong mảng ⇒
 * KHÔNG ném, không đỏ, chỉ lặng lẽ ghi lớp sai vào `soundings-verified.v1.json`.
 * Ô chẵn ở 4 bit thấp, ô lẻ ở 4 bit cao; mã > 5 là không có thật ⇒ `null`.
 */
export function depthClassAt(bin, lat, lon) {
  const { lat0, lon0, step, nLat, nLon } = GRID_META;
  const i = Math.round((lat - lat0) / step);
  const j = Math.round((lon - lon0) / step);
  if (i < 0 || i >= nLat || j < 0 || j >= nLon) return null;
  const k = i * nLon + j;
  const v = (bin[k >> 1] >> ((k & 1) * 4)) & 15;
  return v <= 5 ? v : null;
}
/** Khớp `DEPTH_CLASS_LABEL` của depth-grid.ts theo THỨ TỰ chỉ số 0–5. */
export const CLASS_NAME = [
  "đất",
  "mặt nạ rạn",
  "rất cạn",
  "cạn 2–4 m",
  "nông",
  "đủ sâu",
];

/* ── 1. NGƯỠNG PHÂN LOẠI — MỖI SỐ MỘT LÝ DO ────────────────────────────── */

/*  BA NGÂN SÁCH SAI LỆCH CÓ THẬT giữa "số khảo sát" và "số mô hình". Cộng lại
    thành dải tha bổng. Không lấy số tròn cho đẹp — lấy theo vật lý của chỗ
    sai, rồi soi lại bằng phân bố đo được trên chính 557 điểm này (in bằng
    `--stats`).

    (a) CHUẨN MỰC NƯỚC. Thông báo hàng hải quy về "số 0 hải đồ" (xấp xỉ mực
        nước thấp nhất thiên văn). ETOPO/GEBCO quy về mực nước TRUNG BÌNH. Số 0
        hải đồ nằm DƯỚI mực trung bình ⇒ cùng một đáy biển thì số khảo sát NHỎ
        HƠN số mô hình, LUÔN theo một chiều. Biên độ triều Việt Nam ~4 m ở Hòn
        Dấu/Vũng Tàu, ~1,5–2 m miền Trung ⇒ lệch chuẩn cỡ 1–2 m.

    (b) Ô 450 m NUỐT LUỒNG. Luồng nạo vét rộng 100–150 m nằm gọn trong một ô
        15″; giá trị ô là trung bình của luồng VÀ bãi hai bên. Luồng đào tới
        −12 m qua nền 3 m cho giá trị ô cỡ 4–6 m ⇒ mô hình NÔNG HƠN khảo sát
        tới ~9 m.

    (c) NỘI SUY. Ở dải ven bờ Việt Nam không mô hình nào có đo đa tia; giá trị
        là nội suy giữa các tuyến khảo sát cũ. Cỡ sai số ấy KHÔNG phải đoán —
        nó ĐO ĐƯỢC bằng chính khoảng vênh giữa hai mô hình tại đúng ô đó. Hai
        bản gộp toàn cầu còn lệch nhau S mét ở đây thì không bên nào dám nhận
        chính xác hơn S.

    ⇒ tol = TOL_ABS_M + |d_GEBCO − d_ETOPO|, với TOL_ABS_M = 6 m gộp (a) 2 m
      và (b) sàn 4 m. Đo trên 362 điểm cả hai mô hình đều thấy nước: khoảng
      vênh giữa hai mô hình có trung vị 0,0 m · p90 2 m · p95 6 m · lớn nhất
      17 m; còn |Δ| so với khảo sát có trung vị 1,8 m · p90 5,0 m · p95 6,8 m.
      Sàn 6 m nằm ngay trên p90 của |Δ| — đủ rộng để không kết tội nhiễu thường

      ⚠️ SỐ TRÊN ĐO NGÀY 2026-08-31, TRƯỚC ĐỢT OCR MIỀN BẮC. Sau khi thêm 107
      tuyến cửa lạch phía Bắc, |Δ| thật là p85 5,1 · p90 6,6 · p95 8,3 m — tức
      sàn 6 m nay nằm ở khoảng p88, không còn "ngay trên p90".

      CỐ Ý KHÔNG NỚI HẰNG SỐ. Nguyên nhân p90 tăng là VẬT LÝ, không phải dữ
      liệu xấu: lưới 450 m không thấy lòng lạch đã nạo vét, nên ở cửa lạch mô
      hình luôn nói nông hơn khảo sát — mà Δ âm (khảo sát sâu hơn) vốn KHÔNG
      bao giờ bị kết tội. Nới sàn theo p90 mới là tự nới lỏng cổng vì một lý do
      không dính tới độ tin cậy. Kết cục thật vẫn 0/107 tuyến mới bị nghi lỗi.
      ngày, đủ hẹp để không nuốt một lỗi bóc. */
export const TOL_ABS_M = 6;

/*  ĐI QUÁ DẢI THA BỔNG VẪN CHƯA PHẢI LỖI — còn phải hỏi lệch về CHIỀU NÀO.

    Δ < 0 (khảo sát SÂU HƠN mô hình): chữ ký của nạo vét và vũng cảng đào sâu.
    Mô hình vệ tinh KHÔNG THỂ thấy hai thứ đó. Khảo sát ĐÚNG, mô hình CŨ. Không
    bao giờ kết tội chiều này — lỗi bóc kiểu "DHN - 0 6" tạo số NÔNG giả, không
    tạo số sâu giả.

    Δ > 0 (mô hình sâu hơn — khảo sát báo NÔNG): hai khả năng KHÁC HẲN nhau —
    điểm cạn thật trong vũng sâu (đúng thứ Thông báo hàng hải sinh ra để báo),
    hay số nông giả. Hai ngưỡng dưới đây tách chúng ra. */

/*  Trần độ sâu của CHÍNH nguồn này. Thông báo hàng hải nói về luồng — cửa biển
    — vũng cảng. Cả 557 số đo nằm trong 1,2–15,4 m; 105 tuyến nằm trong
    1,1–17,4 m; và ô mô hình SÂU NHẤT dưới một điểm khảo sát bất kỳ là 31 m.
    Chỗ mô hình nói sâu hơn 40 m là chỗ NGOÀI ĐỊA BÀN của nguồn: 40 m ≈ 2,3×
    số sâu nhất cả corpus và trên cả ô sâu nhất đo được, mà đường đẳng sâu 40 m
    ở thềm Việt Nam nằm cách bờ vài chục km — không cảng vụ nào ra đó cắm mốc
    luồng. Rơi vào đây thì hoặc toạ độ sai hoặc độ sâu sai; kiểu gì cũng phải
    mở lại PDF. Đây là chỗ ca "khảo sát 6 m, vệ tinh 200 m" rơi vào. */
export const OUT_OF_DOMAIN_M = 40;

/*  Ngưỡng thứ hai, bắt ca lệch to mà chưa tới 40 m. 20 m KHÔNG phải số tròn
    chọn bừa: nó lớn hơn TOÀN BỘ bao lệch đo được — gấp gần 3× p95 của |Δ|
    (6,8 m) và trên cả khoảng vênh lớn nhất giữa hai mô hình (17 m). Δ lớn nhất
    thật sự thấy trong corpus là 12,8 m. Nói cách khác: cổng này chỉ mở khi
    khoảng lệch VƯỢT RA NGOÀI mọi thứ mà dữ liệu thật từng thể hiện. */
export const BIG_GAP_M = 20;

/*  ── CỔNG THỨ HAI: CHỮ SỐ LẺ BỊ RƠI ────────────────────────────────────────
    Mô hình vệ tinh MÙ trước lỗi này (lệch chỉ 0,1–0,9 m, dưới mọi ngưỡng ở
    trên), nhưng chính dữ liệu tự khai ra. Đo hồi âm ghi tới 0,1 m, nên trong
    một thông báo bình thường tỉ lệ số ĐÚNG MÉT phải nhỏ. Đo thật trên 15 thông
    báo có điểm: 14 thông báo nằm trong 0–20%, đúng MỘT thông báo ở 94%
    (57/TBHH-TCTBĐATHHMN, 16/17 số nguyên). Mở PDF gốc đọc bằng mắt thì rõ lý
    do: bản song ngữ vẽ chữ số lẻ ở toạ độ khác nên bộ bóc dựng nó thành DÒNG
    RIÊNG — dòng "Chèn Độ sâu 8 5 …" là 8,5 m, vào file thành 8. Ngưỡng 0,8 nằm
    giữa hai cụm cách nhau rất xa (20% ↔ 94%), và sàn 8 điểm loại ca ngẫu nhiên
    (thông báo 3 điểm toàn số nguyên là chuyện thường). */
export const WHOLE_METRE_SHARE = 0.8;
export const WHOLE_METRE_MIN_N = 8;

/** z trên ngưỡng này thì mô hình đang nói ĐẤT, không nói nước — khớp DepthClass 0. */
export const LAND_Z = -2;

export const VERDICT = {
  MATCH: "khop",
  EXPLAINED: "giai-thich-duoc",
  SUSPECT: "nghi-loi",
  UNKNOWN: "khong-doi-chieu-duoc",
};

/**
 * Phân loại MỘT số đo sâu bằng hai mô hình.
 *
 * @param sauM    độ sâu khảo sát (m, dương)
 * @param gebcoZ  cao độ GEBCO (m, âm = dưới mực nước); null khi không lấy được
 * @param etopoZ  cao độ ETOPO (m, âm = dưới mực nước); null khi không lấy được
 *
 * ĐÒI CẢ HAI MÔ HÌNH CÙNG THẤY NƯỚC mới dám kết luận. Vì sao khắt khe vậy:
 * 195/557 điểm rơi vào sông — Lòng Tàu, Thị Vải, Soài Rạp, Năm Căn — nơi lòng
 * lạch hẹp hơn ô 450 m nên mô hình xếp cả vùng là ĐẤT. Bản nháp đầu của file
 * này kết tội chúng và ra 138 "nghi lỗi", gần như toàn bộ là oan: luồng
 * Cái Mép – Thị Vải sâu 13–14 m thật, chỉ là vệ tinh không thấy. Mô hình mâu
 * thuẫn nhau đất↔nước cũng vậy — nó nói MÔ HÌNH KHÔNG BIẾT, không nói dữ liệu
 * sai. Cả hai ca trả "không đối chiếu được", KHÔNG trả "khớp": im lặng cho qua
 * và tuyên vô tội là hai chuyện khác nhau.
 */
export function classifyDepth(sauM, gebcoZ, etopoZ) {
  if (!Number.isFinite(sauM)) {
    return { verdict: VERDICT.UNKNOWN, lyDo: "số đo sâu không đọc được" };
  }
  if (!Number.isFinite(gebcoZ) || !Number.isFinite(etopoZ)) {
    return { verdict: VERDICT.UNKNOWN, lyDo: "thiếu giá trị của một trong hai mô hình" };
  }
  const gWater = gebcoZ <= LAND_Z;
  const eWater = etopoZ <= LAND_Z;
  if (!gWater && !eWater) {
    return {
      verdict: VERDICT.UNKNOWN,
      lyDo:
        "cả hai mô hình xếp ô 450 m này là đất/bãi triều — lòng lạch hẹp hơn ô lưới, " +
        "mô hình không có ý kiến về độ sâu ở đây",
    };
  }
  if (gWater !== eWater) {
    return {
      verdict: VERDICT.UNKNOWN,
      lyDo: `hai mô hình mâu thuẫn đất↔nước tại ô này (GEBCO ${gebcoZ} m, ETOPO ${etopoZ.toFixed(1)} m)`,
    };
  }

  const dG = -gebcoZ;
  const dE = -etopoZ;
  const dMin = Math.min(dG, dE); // bên NÔNG HƠN làm chứng — luôn nghiêng về tha bổng
  const dMax = Math.max(dG, dE);
  const tol = TOL_ABS_M + (dMax - dMin);
  const delta = dMin - sauM;

  if (dMin > OUT_OF_DOMAIN_M) {
    return {
      verdict: VERDICT.SUSPECT,
      lyDo:
        `cả hai mô hình nói ${dMin.toFixed(0)}–${dMax.toFixed(0)} m — ngoài địa bàn ` +
        `luồng/vũng cảng (trần ${OUT_OF_DOMAIN_M} m) mà thông báo ghi ${sauM} m`,
      delta,
      tol,
    };
  }
  if (delta >= BIG_GAP_M) {
    return {
      verdict: VERDICT.SUSPECT,
      lyDo: `cả hai mô hình sâu hơn khảo sát ${delta.toFixed(1)} m — vượt mọi bao lệch đo được (trần ${BIG_GAP_M} m)`,
      delta,
      tol,
    };
  }
  if (Math.abs(delta) <= tol) {
    return { verdict: VERDICT.MATCH, lyDo: null, delta, tol };
  }
  if (delta < 0) {
    return {
      verdict: VERDICT.EXPLAINED,
      lyDo: `khảo sát sâu hơn mô hình ${(-delta).toFixed(1)} m — chữ ký nạo vét/vũng đào; ô 450 m không phân giải nổi luồng`,
      delta,
      tol,
    };
  }
  return {
    verdict: VERDICT.EXPLAINED,
    lyDo: `mô hình sâu hơn ${delta.toFixed(1)} m — điểm cạn thật trong vũng sâu, ô 450 m san phẳng mất`,
    delta,
    tol,
  };
}

/**
 * Cổng thứ hai, chạy trên CẢ THÔNG BÁO chứ không trên từng điểm: tỉ lệ số đo
 * đúng mét chẵn. Trả `null` khi không đủ điểm để nói.
 */
export function wholeMetreFlag(depthsM) {
  const ds = depthsM.filter((d) => Number.isFinite(d));
  if (ds.length < WHOLE_METRE_MIN_N) return null;
  const whole = ds.filter((d) => Math.abs(d - Math.round(d)) < 1e-9).length;
  const share = whole / ds.length;
  if (share < WHOLE_METRE_SHARE) return null;
  return {
    share: Math.round(share * 100) / 100,
    n: ds.length,
    whole,
    lyDo:
      `${whole}/${ds.length} số đo của thông báo này là mét chẵn (${(share * 100).toFixed(0)}%) — ` +
      "máy hồi âm ghi tới 0,1 m và mọi thông báo khác trong bộ nằm ở 0–20%. " +
      "Chữ số lẻ rơi mất lúc bóc PDF.",
  };
}

/* ── 2. THANG TIN CẬY — CÙNG CÔNG THỨC src/lib/provenance.ts ────────────── */

/*  Bản sao hằng số, KHÔNG phải bản sao ý tưởng: scripts/*.mjs không nạp được
    "@/lib" nên không gọi thẳng confidenceOf() được. Mối nối là test —
    soundings-verify.test.ts import provenance.ts thật và bắt lệch từng số,
    thêm một ca chạy song song hai bản trên cùng đầu vào. Giống hệt cách
    depth-grid.test.ts giữ script sinh lưới khỏi trôi khỏi DEPTH_META. */
export const CONFIDENCE_WEIGHTS = { agreement: 40, method: 25, offset: 20, freshness: 15 };
export const OFFSET_FULL_M = 150;
export const OFFSET_ZERO_M = 3000;
export const FRESH_FULL_DAYS = 365;
export const FRESH_ZERO_DAYS = 365 * 5;
export const METHOD_SCORE = {
  "remote-sensing": 1,
  "survey-compilation": 0.75,
  authored: 0.5,
  crowd: 0.35,
};

/*  Thông báo hàng hải đo bằng máy hồi âm 200 kHz, quy về số 0 hải đồ — đo
    TRỰC TIẾP, hạng cao hơn mọi hạng đang có trong provenance.ts. Nhưng
    provenance.ts KHÔNG thuộc phạm vi file này (và "tbhh" còn chưa đăng ký
    trong SOURCES — cổng ở fairway-depth.test.ts cố ý giữ nó đỏ). Nên lấy hạng
    ĐÃ CÓ gần nhất là "survey-compilation" 0,75 và ghi rõ: điểm tin cậy dưới
    đây là CẬN DƯỚI, không phải điểm thật. Khi nào provenance.ts đăng ký
    "tbhh" thì con số này chỉ tăng, không giảm — nên không có ca nào bị tha
    oan vì chỗ này. */
export const TBHH_METHOD = "survey-compilation";

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
function ramp(v, full, zero) {
  if (!Number.isFinite(v)) return 0;
  if (v <= full) return 1;
  if (v >= zero) return 0;
  return (zero - v) / (zero - full);
}
export function daysBetween(fromISO, toISO) {
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return (b - a) / 86_400_000;
}

/**
 * Điểm tin cậy 0..100 + bậc A/B/C/D — CÙNG công thức `confidenceOf`.
 * `originMethod` là hạng phương pháp của nguồn GỐC (xem TBHH_METHOD).
 */
export function confidenceScore(crossChecks, originMethod, originAt, today) {
  const agreedIds = [...new Set(crossChecks.filter((c) => c.agreed).map((c) => c.source))];
  const confirmations = agreedIds.length;
  const agreementScore = confirmations >= 2 ? 1 : confirmations === 1 ? 0.7 : 0;
  const methodScore = METHOD_SCORE[originMethod];
  const offsets = crossChecks
    .filter((c) => c.agreed && c.offsetM != null && Number.isFinite(c.offsetM))
    .map((c) => c.offsetM);
  const worstOffsetM = offsets.length ? Math.max(...offsets) : null;
  const offsetScore = worstOffsetM == null ? 0 : ramp(worstOffsetM, OFFSET_FULL_M, OFFSET_ZERO_M);

  const parts = {
    agreement: agreementScore * CONFIDENCE_WEIGHTS.agreement,
    method: methodScore * CONFIDENCE_WEIGHTS.method,
    offset: offsetScore * CONFIDENCE_WEIGHTS.offset,
    freshness: 0,
  };
  let total = CONFIDENCE_WEIGHTS.agreement + CONFIDENCE_WEIGHTS.method + CONFIDENCE_WEIGHTS.offset;
  if (today) {
    const age = daysBetween(originAt, today);
    const freshScore = Number.isNaN(age) ? 0 : ramp(Math.max(age, 0), FRESH_FULL_DAYS, FRESH_ZERO_DAYS);
    parts.freshness = freshScore * CONFIDENCE_WEIGHTS.freshness;
    total += CONFIDENCE_WEIGHTS.freshness;
  }
  const raw = parts.agreement + parts.method + parts.offset + parts.freshness;
  const score = Math.round(clamp01(raw / total) * 100);
  const band = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";
  return { score, band, parts, confirmations, worstOffsetM };
}

/**
 * GỘP NGUỒN CÙNG HỌ TRƯỚC KHI CHẤM ĐIỂM — ETOPO và GEBCO KHÔNG độc lập.
 *
 * Đây không phải phỏng đoán về xuất xứ mà là số ĐO ĐƯỢC: trên 362 điểm cả hai
 * cùng thấy nước, khoảng vênh giữa chúng có TRUNG VỊ 0,0 m — nghĩa là quá nửa
 * số ô hai bên trả về y hệt nhau. Đếm chúng thành "2 nguồn độc lập" sẽ đẩy
 * `agreement` (trọng số lớn nhất, 40 điểm) lên mức đầy bằng một sự trùng khớp
 * không có thông tin. Nên gộp về MỘT xác nhận, giữ bản có vênh vị trí XẤU NHẤT.
 *
 * `confidenceScore` KHÔNG biết gì về chuyện này — nó vẫn là bản sao đúng từng
 * dòng của `confidenceOf`, và test giữ hai bên bằng nhau. Việc gộp nằm ở chỗ
 * GỌI, đúng nơi có kiến thức về nguồn.
 */
export const SOURCE_FAMILY = { gebco: "bathy-global", etopo: "bathy-global" };

export function collapseFamilies(crossChecks) {
  const best = new Map();
  for (const c of crossChecks) {
    const fam = SOURCE_FAMILY[c.source] ?? c.source;
    const cur = best.get(fam);
    if (!cur || (c.offsetM ?? -1) > (cur.offsetM ?? -1)) best.set(fam, c);
  }
  return [...best.values()];
}

/* ── 3. MẠNG ───────────────────────────────────────────────────────────── */

const UA = "SDFish-verify-soundings/1.0 (+https://github.com/Long-Forfun/ForFish)";
const ERDDAP = "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.json";
const ODB_GEBCO = "https://api.odb.ntu.edu.tw/gebco";
const GEBCO_BATCH = 100;

async function getJson(url, { tries = 3, timeoutMs = 120_000, label = "" } = {}) {
  let last = "";
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json,*/*" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await res.text();
      if (res.ok) {
        try {
          return { ok: true, data: JSON.parse(body) };
        } catch {
          return { ok: false, error: `${label}: phản hồi không phải JSON (${body.slice(0, 80)})` };
        }
      }
      last = `HTTP ${res.status}`;
      if (res.status < 500) return { ok: false, error: `${label} ${last}` };
    } catch (e) {
      last = e.message;
    }
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return { ok: false, error: `${label} ${last}`.trim() };
}

/* ── 4. NẠP DỮ LIỆU CẦN SOI ────────────────────────────────────────────── */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = (...s) => join(ROOT, ...s);

export const FILES = [
  "soundings.v1.json",
  "soundings-cangvu.v1.json",
  "fairway-depths.v1.json",
];

/** Mọi mục cần đối chiếu, dạng phẳng. `probes` là các toạ độ phải hỏi mô hình. */
export function collectTargets(soundings, cangvu, fairway) {
  const out = [];
  const addPoints = (file, fi) => {
    (file.diem ?? []).forEach((d, i) => {
      const [lon, lat, dm, ti] = d;
      const nt = file.thongBao?.[ti];
      out.push({
        kind: "diem",
        tep: fi,
        i,
        so: nt?.so ?? null,
        ngay: nt?.ngay ?? null,
        pdf: nt?.pdf ?? null,
        ten: null,
        sauM: Math.round((Number(dm) / 10) * 10) / 10,
        probes: [{ lat, lon }],
      });
    });
    (file.tuyen ?? []).forEach((t, i) => {
      if (t.sau === null || t.sau === undefined) return;
      const nt = file.thongBao?.[t.tb];
      out.push({
        kind: "tuyen",
        tep: fi,
        i,
        so: nt?.so ?? null,
        ngay: nt?.ngay ?? null,
        pdf: nt?.pdf ?? null,
        ten: t.ten ?? null,
        sauM: Math.round((Number(t.sau) / 10) * 10) / 10,
        probes: (t.diem ?? []).map(([lon, lat]) => ({ lat, lon })),
      });
    });
  };
  addPoints(soundings, 0);
  addPoints(cangvu, 1);
  (fairway.doan ?? []).forEach((r, i) => {
    const [ri, ni, dm, , lon1, lat1, lon2, lat2, ten] = r;
    const nt = fairway.thongBao?.[ni];
    out.push({
      kind: "doan",
      tep: 2,
      i,
      so: nt?.so ?? null,
      ngay: nt?.ngay ?? null,
      pdf: nt?.pdf ?? null,
      ten: `${fairway.tuyen?.[ri]?.ten ?? ""} — ${ten}`.trim(),
      sauM: Math.round((Number(dm) / 10) * 10) / 10,
      probes: sampleLine({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 }, 12),
    });
  });
  return out;
}

/** N điểm đều nhau trên đoạn thẳng (kể cả hai đầu) — đủ dày để không trượt ô 450 m. */
export function sampleLine(a, b, n) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const t = n === 1 ? 0 : k / (n - 1);
    out.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
  }
  return out;
}

/* ── 5. HỎI MÔ HÌNH ────────────────────────────────────────────────────── */

const keyOf = (p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;

async function fetchGebco(points, cache, log) {
  const need = points.filter((p) => cache.gebco[keyOf(p)] === undefined);
  for (let i = 0; i < need.length; i += GEBCO_BATCH) {
    const lot = need.slice(i, i + GEBCO_BATCH);
    const qs = new URLSearchParams({
      lon: lot.map((p) => p.lon.toFixed(6)).join(","),
      lat: lot.map((p) => p.lat.toFixed(6)).join(","),
      mode: "point", // thiếu cờ này API nội suy thành TRẮC DIỆN
    });
    const r = await getJson(`${ODB_GEBCO}?${qs}`, { label: "GEBCO", timeoutMs: 90_000 });
    if (!r.ok) {
      log(`  GEBCO lô ${i / GEBCO_BATCH + 1}: LỖI — ${r.error}`);
      continue;
    }
    const z = r.data?.z ?? [];
    if (z.length !== lot.length) {
      log(`  GEBCO lô ${i / GEBCO_BATCH + 1}: trả ${z.length} số cho ${lot.length} điểm — BỎ lô`);
      continue;
    }
    lot.forEach((p, k) => {
      cache.gebco[keyOf(p)] = Number.isFinite(z[k]) ? z[k] : null;
    });
    log(`  GEBCO ${Math.min(i + GEBCO_BATCH, need.length)}/${need.length}`);
  }
}

/**
 * ETOPO theo Ô LƯỚI, không theo điểm: gom các điểm về ô 0,1° rồi kéo trọn ô
 * (24×24 ô 15″). 1.307 điểm rơi vào ~52 ô ⇒ 52 lượt gọi thay vì 1.307, mà giá
 * trị vẫn là giá trị ô THẬT (ERDDAP trả kèm toạ độ tâm ô, không nội suy).
 */
const TILE_DEG = 0.1;
const tileKey = (p) => `${Math.floor(p.lat / TILE_DEG)}_${Math.floor(p.lon / TILE_DEG)}`;

async function fetchEtopo(points, cache, log) {
  const tiles = new Map();
  for (const p of points) {
    const k = tileKey(p);
    if (!tiles.has(k)) tiles.set(k, p);
  }
  const todo = [...tiles.keys()].filter((k) => !cache.etopoTiles[k]);
  let done = 0;
  for (const k of todo) {
    const [ti, tj] = k.split("_").map(Number);
    const s = ti * TILE_DEG;
    const w = tj * TILE_DEG;
    // Nới nửa ô mỗi phía để điểm sát mép ô 0,1° vẫn có ô lưới của nó.
    const pad = STEP_15S;
    const url =
      `${ERDDAP}?z%5B(${(s - pad).toFixed(6)}):1:(${(s + TILE_DEG + pad).toFixed(6)})%5D` +
      `%5B(${(w - pad).toFixed(6)}):1:(${(w + TILE_DEG + pad).toFixed(6)})%5D`;
    const r = await getJson(url, { label: `ETOPO ô ${k}`, timeoutMs: 180_000 });
    done++;
    if (!r.ok) {
      log(`  ETOPO ô ${k}: LỖI — ${r.error}`);
      continue;
    }
    const rows = r.data?.table?.rows ?? [];
    const cell = {};
    for (const [lat, lon, z] of rows) {
      cell[`${Math.round((lat - GRID_META.lat0) / GRID_META.step)}_${Math.round((lon - GRID_META.lon0) / GRID_META.step)}`] =
        Number.isFinite(z) ? z : null;
    }
    cache.etopoTiles[k] = cell;
    log(`  ETOPO ${done}/${todo.length} ô (${rows.length} ô lưới)`);
  }
}

function etopoAt(cache, lat, lon) {
  const t = cache.etopoTiles[tileKey({ lat, lon })];
  if (!t) return undefined;
  const i = Math.round((lat - GRID_META.lat0) / GRID_META.step);
  const j = Math.round((lon - GRID_META.lon0) / GRID_META.step);
  const v = t[`${i}_${j}`];
  return v === undefined ? undefined : v;
}

/* ── 6. CHẠY ───────────────────────────────────────────────────────────── */

function loadCache(path) {
  if (existsSync(path)) {
    try {
      const c = JSON.parse(readFileSync(path, "utf8"));
      return { gebco: c.gebco ?? {}, etopoTiles: c.etopoTiles ?? {} };
    } catch {
      /* kho hỏng thì dựng lại từ đầu — không để kho hỏng làm hỏng cả lượt chạy */
    }
  }
  return { gebco: {}, etopoTiles: {} };
}

function saveCache(path, cache) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cache));
}

/**
 * Với TUYẾN và ĐOẠN: độ sâu khống chế là chỗ NÔNG NHẤT của cả đoạn, nên phía
 * mô hình cũng phải lấy ô NÔNG NHẤT dọc đoạn — nhưng chỉ trong những ô CÓ NƯỚC
 * theo cả hai mô hình. So với trung bình sẽ tạo ra lệch giả ở mọi đoạn dài; so
 * với ô đất sẽ tạo ra lệch giả ở mọi đoạn chạy trong sông.
 * Đòi ít nhất một nửa số ô lấy mẫu là nước, nếu không thì mô hình không đủ nhìn
 * thấy đoạn này để nói gì.
 */
function pickAlongLine(per) {
  const water = per.filter(
    (p) => Number.isFinite(p.g) && Number.isFinite(p.e) && p.g <= LAND_Z && p.e <= LAND_Z,
  );
  if (!per.length || water.length * 2 < per.length) {
    return { g: null, e: null, phu: water.length / Math.max(1, per.length) };
  }
  // z LỚN NHẤT = ô nông nhất. Lấy theo ô, không lấy max riêng từng mô hình —
  // hai mô hình phải nói về CÙNG một ô thì khoảng vênh giữa chúng mới có nghĩa.
  let best = water[0];
  for (const p of water) if (Math.min(p.g, p.e) > Math.min(best.g, best.e)) best = p;
  return { g: best.g, e: best.e, phu: water.length / per.length, at: best };
}

async function main() {
  const argv = process.argv.slice(2);
  const argOf = (n, d) => {
    const i = argv.indexOf(n);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
  };
  const statsOnly = argv.includes("--stats");
  const offline = argv.includes("--offline");
  const cachePath = argOf("--cache", join(tmpdir(), "sdfish-verify-soundings-cache.json"));
  const today = new Date().toISOString().slice(0, 10);
  const log = (s) => console.log(s);

  const soundings = JSON.parse(readFileSync(P("public/data/soundings.v1.json"), "utf8"));
  const cangvu = JSON.parse(readFileSync(P("public/data/soundings-cangvu.v1.json"), "utf8"));
  const fairway = JSON.parse(readFileSync(P("public/data/fairway-depths.v1.json"), "utf8"));
  const bin = new Uint8Array(readFileSync(P("public/data/depth-grid.v1.bin")));

  const targets = collectTargets(soundings, cangvu, fairway);
  const allProbes = [];
  const seen = new Set();
  for (const t of targets) {
    for (const p of t.probes) {
      const k = keyOf(p);
      if (!seen.has(k)) {
        seen.add(k);
        allProbes.push(p);
      }
    }
  }
  log(`ĐỐI CHIẾU SỐ ĐO SÂU — ${today}`);
  log(
    `  ${targets.length} mục (${targets.filter((t) => t.kind === "diem").length} điểm · ` +
      `${targets.filter((t) => t.kind === "tuyen").length} tuyến · ` +
      `${targets.filter((t) => t.kind === "doan").length} đoạn) → ${allProbes.length} toạ độ phải hỏi`,
  );

  const cache = loadCache(cachePath);
  if (!offline) {
    log(`\n── hỏi mô hình (kho tạm: ${cachePath}) ──`);
    await fetchGebco(allProbes, cache, log);
    saveCache(cachePath, cache);
    await fetchEtopo(allProbes, cache, log);
    saveCache(cachePath, cache);
  } else {
    log(`\n── chế độ --offline: chỉ dùng kho tạm ${cachePath} ──`);
  }

  // ── cổng thứ hai chạy TRƯỚC, trên cả thông báo ──
  // Kết quả của nó ĐÈ LÊN phán quyết vệ tinh của từng điểm trong thông báo đó:
  // vệ tinh mù trước lỗi rơi chữ số lẻ (dưới 1 m), nên "khớp" ở đây không phải
  // bằng chứng vô tội.
  const noticeFlag = new Map();
  for (const [fi, file] of [
    [0, soundings],
    [1, cangvu],
  ]) {
    const byNotice = new Map();
    for (const d of file.diem ?? []) {
      const so = file.thongBao?.[d[3]]?.so;
      if (!so) continue;
      if (!byNotice.has(so)) byNotice.set(so, []);
      byNotice.get(so).push(Number(d[2]) / 10);
    }
    for (const [so, ds] of byNotice) {
      const f = wholeMetreFlag(ds);
      if (f) noticeFlag.set(`${fi}|${so}`, f);
    }
  }

  // ── đối chiếu từng mục ──
  const rows = [];
  for (const t of targets) {
    const per = t.probes.map((p) => ({
      lat: p.lat,
      lon: p.lon,
      g: cache.gebco[keyOf(p)] ?? null,
      e: etopoAt(cache, p.lat, p.lon) ?? null,
    }));
    const one = t.kind === "diem";
    const sel = one
      ? { g: per[0]?.g ?? null, e: per[0]?.e ?? null, phu: null, at: per[0] }
      : pickAlongLine(per);
    let c = classifyDepth(t.sauM, sel.g, sel.e);
    if (!one && sel.phu !== null && sel.g === null) {
      c = {
        verdict: VERDICT.UNKNOWN,
        lyDo: `chỉ ${(sel.phu * 100).toFixed(0)}% ô dọc đoạn có nước theo cả hai mô hình — mô hình không nhìn thấy đoạn này`,
      };
    }

    const flag = noticeFlag.get(`${t.tep}|${t.so}`);
    if (flag) c = { ...c, verdict: VERDICT.SUSPECT, lyDo: flag.lyDo, coDoc: c.lyDo ?? null };

    // Vênh vị trí = khoảng cách từ điểm đo tới TÂM Ô mà mô hình trả lời. Giá
    // trị mô hình thuộc về tâm ô chứ không thuộc về điểm — vênh THẬT, không
    // phải hình thức. Nửa đường chéo ô 15″ ≈ 318 m ⇒ luôn rơi trong dải
    // OFFSET_FULL_M…OFFSET_ZERO_M nên nó thật sự đổi điểm.
    const ref = sel.at ?? per[0] ?? null;
    const offsetM = ref ? Math.round(haversineM(ref, cellCentre(ref.lat, ref.lon))) : null;
    const agreed = c.verdict === VERDICT.MATCH;
    const crossChecks = [];
    if (Number.isFinite(sel.g)) {
      crossChecks.push({ source: "gebco", agreed, offsetM: agreed ? offsetM : null, at: today });
    }
    if (Number.isFinite(sel.e)) {
      crossChecks.push({ source: "etopo", agreed, offsetM: agreed ? offsetM : null, at: today });
    }
    const conf = confidenceScore(
      collapseFamilies(crossChecks),
      TBHH_METHOD,
      t.ngay ?? today,
      today,
    );

    rows.push({
      kind: t.kind,
      tep: t.tep,
      i: t.i,
      so: t.so,
      ngay: t.ngay,
      pdf: t.pdf,
      ten: t.ten,
      sauM: t.sauM,
      gebcoM: Number.isFinite(sel.g) ? Math.round(-sel.g * 10) / 10 : null,
      etopoM: Number.isFinite(sel.e) ? Math.round(-sel.e * 10) / 10 : null,
      lop: one && per[0] ? depthClassAt(bin, per[0].lat, per[0].lon) : null,
      lonLat: ref ? [Math.round(ref.lon * 1e5) / 1e5, Math.round(ref.lat * 1e5) / 1e5] : null,
      verdict: c.verdict,
      lyDo: c.lyDo,
      coDoc: c.coDoc ?? null,
      delta: Number.isFinite(c.delta) ? Math.round(c.delta * 10) / 10 : null,
      offsetM,
      crossChecks,
      tinCay: conf.score,
      bac: conf.band,
    });
  }

  report(rows, noticeFlag, log);
  if (statsOnly) return;

  const out = buildOutput(rows, noticeFlag, today, { soundings, cangvu, fairway });
  const dest = P("public/data/soundings-verified.v1.json");
  writeFileSync(dest, JSON.stringify(out));
  log(`\n→ ${dest} (${(readFileSync(dest).length / 1024).toFixed(0)} KB)`);
}

function report(rows, noticeFlag, log) {
  const by = (v) => rows.filter((r) => r.verdict === v);
  log(`\n── KẾT QUẢ (${rows.length} mục) ──`);
  for (const [v, name] of [
    [VERDICT.MATCH, "KHỚP"],
    [VERDICT.EXPLAINED, "LỆCH GIẢI THÍCH ĐƯỢC"],
    [VERDICT.SUSPECT, "NGHI LỖI BÓC"],
    [VERDICT.UNKNOWN, "KHÔNG ĐỐI CHIẾU ĐƯỢC"],
  ]) {
    const g = by(v);
    log(`  ${name}: ${g.length} (${((g.length / rows.length) * 100).toFixed(1)}%)`);
  }
  const why = {};
  for (const r of by(VERDICT.UNKNOWN)) {
    const k = (r.lyDo ?? "?").slice(0, 46);
    why[k] = (why[k] ?? 0) + 1;
  }
  log(`  · vì sao không đối chiếu được:`);
  for (const [k, n] of Object.entries(why).sort((a, b) => b[1] - a[1])) log(`      ${n} — ${k}…`);

  const deltas = rows.filter((r) => Number.isFinite(r.delta)).map((r) => r.delta).sort((a, b) => a - b);
  if (deltas.length) {
    const q = (p) => deltas[Math.min(deltas.length - 1, Math.floor(p * deltas.length))];
    log(
      `\n  Δ = mô_hình − khảo_sát trên ${deltas.length} mục so được (m): ` +
        `min ${deltas[0]} · p05 ${q(0.05)} · p50 ${q(0.5)} · p95 ${q(0.95)} · max ${deltas[deltas.length - 1]}`,
    );
  }
  const bands = {};
  for (const r of rows) bands[r.bac] = (bands[r.bac] ?? 0) + 1;
  log(`  bậc tin cậy: ${Object.entries(bands).sort().map(([k, v]) => `${k}=${v}`).join(" · ")}`);

  if (noticeFlag.size) {
    log(`\n── THÔNG BÁO BỊ CỜ "CHỮ SỐ LẺ RƠI" ──`);
    for (const [k, f] of noticeFlag) log(`  ${k.split("|")[1]} — ${f.whole}/${f.n} số nguyên`);
  }
  const sus = by(VERDICT.SUSPECT);
  if (sus.length) {
    log(`\n── NGHI LỖI (${sus.length}) ──`);
    const seen = new Set();
    for (const r of sus) {
      const k = `${r.tep}|${r.so}|${r.lyDo}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const n = sus.filter((x) => `${x.tep}|${x.so}|${x.lyDo}` === k).length;
      log(`  [${FILES[r.tep]}] ${r.so ?? "?"} ${r.ngay ?? ""} — ${n} mục`);
      log(`     ${r.lyDo}`);
      if (r.pdf) log(`     ${r.pdf}`);
    }
  }
}

function buildOutput(rows, noticeFlag, today, src) {
  return {
    v: 1,
    nguon:
      "Đối chiếu số đo sâu Thông báo hàng hải với hai mô hình độ sâu độc lập: " +
      "ETOPO 2022 15″ (NOAA NCEI, public domain) và GEBCO Grid 15″ (qua ODB NTU)",
    nhan:
      "Kết quả ĐỐI CHIẾU, không phải số đo mới. Dùng để soi lỗi bóc trong dữ liệu khảo sát — " +
      "KHÔNG dùng thay số đo sâu, và KHÔNG thay hải đồ.",
    layNgay: today,
    tep: FILES,
    moHinh: [
      { source: "etopo", nhan: "ETOPO 2022 15″", url: ERDDAP, buoc: "15 giây cung (~450 m)", chuan: "mực nước trung bình" },
      { source: "gebco", nhan: "GEBCO Grid 15″ (ODB NTU)", url: `${ODB_GEBCO}?lon=…&lat=…&mode=point`, buoc: "15 giây cung (~450 m)", chuan: "mực nước trung bình" },
    ],
    nguong: {
      tolAbsM: TOL_ABS_M,
      outOfDomainM: OUT_OF_DOMAIN_M,
      bigGapM: BIG_GAP_M,
      landZ: LAND_Z,
      wholeMetreShare: WHOLE_METRE_SHARE,
      wholeMetreMinN: WHOLE_METRE_MIN_N,
      giaiThich:
        `Dải tha bổng |Δ| ≤ ${TOL_ABS_M} m + khoảng vênh giữa hai mô hình tại chính ô đó. ` +
        "Sàn 6 m gộp chuẩn mực nước (số 0 hải đồ dưới mực trung bình 1–2 m) và ô 450 m nuốt luồng nạo vét; " +
        "phần cộng thêm là sai số mà chính hai mô hình tự khai ra khi lệch nhau. " +
        "Δ âm (khảo sát sâu hơn) không bao giờ bị kết tội — đó là chữ ký nạo vét. " +
        `Chỉ kết tội khi cả hai mô hình cùng thấy nước VÀ nói sâu hơn ${OUT_OF_DOMAIN_M} m (ngoài địa bàn ` +
        `luồng/vũng cảng), hoặc cùng sâu hơn khảo sát ${BIG_GAP_M} m. Cổng thứ hai: thông báo có ` +
        `≥ ${WHOLE_METRE_MIN_N} điểm mà ≥ ${WHOLE_METRE_SHARE * 100}% là mét chẵn thì cả thông báo bị nghi rơi chữ số lẻ.`,
      khongDoiChieuDuoc:
        "Ô 450 m không phân giải nổi lòng lạch: ở sông Lòng Tàu, Thị Vải, Soài Rạp, Năm Căn cả hai mô hình " +
        "xếp vùng là ĐẤT. Ở đó mô hình KHÔNG có ý kiến — trả 'không đối chiếu được', không trả 'khớp'.",
    },
    tomTat: {
      tong: rows.length,
      khop: rows.filter((r) => r.verdict === VERDICT.MATCH).length,
      giaiThichDuoc: rows.filter((r) => r.verdict === VERDICT.EXPLAINED).length,
      nghiLoi: rows.filter((r) => r.verdict === VERDICT.SUSPECT).length,
      khongDoiChieuDuoc: rows.filter((r) => r.verdict === VERDICT.UNKNOWN).length,
    },
    thongBaoNghi: [...noticeFlag.entries()].map(([k, f]) => ({
      tep: Number(k.split("|")[0]),
      so: k.split("|")[1],
      soNguyen: f.whole,
      tong: f.n,
      lyDo: f.lyDo,
    })),
    nguonGoc: {
      soundings: { layNgay: src.soundings.layNgay, diem: src.soundings.diem.length },
      cangvu: { layNgay: src.cangvu.layNgay, diem: src.cangvu.diem.length },
      fairway: { layNgay: src.fairway.layNgay, doan: src.fairway.doan.length },
    },
    muc: rows.map((r) => ({
      tep: r.tep,
      loai: r.kind,
      i: r.i,
      so: r.so,
      ngay: r.ngay,
      ten: r.ten,
      lonLat: r.lonLat,
      sauM: r.sauM,
      gebcoM: r.gebcoM,
      etopoM: r.etopoM,
      lop: r.lop,
      delta: r.delta,
      kq: r.verdict,
      lyDo: r.lyDo,
      coDoc: r.coDoc,
      tinCay: r.tinCay,
      bac: r.bac,
      xacNhan: r.crossChecks,
    })),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
