import { describe, expect, it } from "vitest";
import { beaufort } from "@/lib/marine-weather";
import {
  capGioSangKmh,
  catThanBanTin,
  htmlToText,
  parseCapGio,
  parseGioBanTinTiepTheo,
  parseGioPhatTin,
  parseNchmfBulletin,
  parseToaDo,
  pickLatestNchmfBulletin,
} from "@/lib/storms-vn";

/*  NGUỒN TIN BÃO VIỆT NAM (NCHMF) — parse bản tin CHỮ.
 *
 *  Vì sao có: GDACS không phủ áp thấp nhiệt đới mới hình thành. Ngày 18/8/2026
 *  người của SDVICO báo "đài dự báo áp thấp nhiệt đới trên Biển Đông mà app
 *  chưa cập nhật"; đo lại GDACS thì 0 sự kiện trong khung Biển Đông, trong khi
 *  NCHMF đã phát bản tin. Nguồn là TRANG HTML nên dễ vỡ — mọi ca dưới đây dựng
 *  từ bản tin THẬT (đã rút gọn), không phải chuỗi tự nghĩ ra.
 */

/** Trích nguyên văn bản tin NCHMF 08h00 ngày 18/8/2026 (post53205) */
const BAN_TIN_THAT =
  "Dự báo thời tiết ngày và đêm 18/08/2026 TIN ÁP THẤP NHIỆT ĐỚI TRÊN BIỂN ĐÔNG " +
  "📍 Hiện trạng áp thấp nhiệt đới: 🔹 Hồi 07 giờ , vị trí tâm áp thấp nhiệt đới " +
  "ở khoảng 19,8°N; 117,6°E , trên vùng biển phía Đông khu vực Bắc Biển Đông . " +
  "🔹 Cường độ: cấp 6 (39–49km/h), giật cấp 8. " +
  "🔹 Hướng và tốc độ di chuyển: chậm theo hướng Tây, tốc độ khoảng 5km/h. " +
  "📍 Dự báo diễn biến áp thấp nhiệt đới (trong 24 đến 48 giờ tới): " +
  "07 giờ ngày 19/8 Tây, khoảng 10 km/h 19,9N-115,3E; trên vùng biển phía Đông " +
  "khu vực Bắc Biển Đông Cấp 6, giật cấp 8 19,0-21,0N; 114,5-118,5E " +
  "07 giờ ngày 20/8 Tây Tây Bắc, khoảng 10 km/h 20,1N-113,2E; cách đảo Hải Nam " +
  "(Trung Quốc) khoảng 740 km về phía Đông Đông Bắc Cấp 6, giật cấp 8 " +
  "📍 Tin phát lúc: 08h00 ngày 18/8 📍 Bản tin tiếp theo: 14h00 ngày 18/8";

const NOW = new Date("2026-08-18T03:00:00Z"); // 10h giờ VN

describe("parseToaDo — hai lối viết toạ độ trong bản tin", () => {
  it("đọc được tâm hiện tại (°N;°E) và các vị trí dự báo (N-E)", () => {
    const d = parseToaDo(BAN_TIN_THAT);
    expect(d[0]).toEqual({ lat: 19.8, lon: 117.6 });
    expect(d).toContainEqual({ lat: 19.9, lon: 115.3 });
    expect(d).toContainEqual({ lat: 20.1, lon: 113.2 });
  });

  it("lối viết cũ 'độ Vĩ Bắc / độ Kinh Đông' vẫn đọc được", () => {
    const d = parseToaDo("vị trí tâm bão ở vào khoảng 15,7 độ Vĩ Bắc; 111,2 độ Kinh Đông");
    expect(d).toEqual([{ lat: 15.7, lon: 111.2 }]);
  });

  it("KHÔNG nhặt bừa số trong câu (cấp gió, tốc độ, sóng)", () => {
    const d = parseToaDo("Cấp 6 (39–49km/h), giật cấp 8; sóng cao 2,0–3,5m, biển động");
    expect(d).toEqual([]);
  });

  it("toạ độ ngoài khung Biển Đông bị bỏ (đọc nhầm số khác)", () => {
    expect(parseToaDo("45,0°N; 160,0°E")).toEqual([]);
  });
});

describe("parseCapGio — cấp bão, KHÔNG lấy cấp giật", () => {
  it("bản tin thật: cấp 6 (giật cấp 8 không tính)", () => {
    expect(parseCapGio(BAN_TIN_THAT)).toBe(6);
  });

  it("lấy cấp MẠNH NHẤT khi bản tin nêu nhiều mốc", () => {
    expect(parseCapGio("cấp 8, giật cấp 11 … mạnh lên cấp 10, giật cấp 12")).toBe(10);
  });

  it("không có cấp nào → null, KHÔNG đoán", () => {
    expect(parseCapGio("áp thấp nhiệt đới suy yếu thành vùng áp thấp")).toBeNull();
  });
});

describe("parseGioPhatTin", () => {
  it("'Tin phát lúc: 08h00 ngày 18/8' → 08:00 giờ VN = 01:00 UTC", () => {
    const ms = parseGioPhatTin(BAN_TIN_THAT, NOW);
    expect(new Date(ms!).toISOString()).toBe("2026-08-18T01:00:00.000Z");
  });

  it("bản tin cuối tháng 12 đọc sang năm mới KHÔNG bị nhảy tới tương lai", () => {
    const now = new Date("2027-01-01T02:00:00Z");
    const ms = parseGioPhatTin("Tin phát lúc: 22h00 ngày 31/12", now)!;
    expect(ms).toBeLessThan(now.getTime());
    expect(new Date(ms).getUTCFullYear()).toBe(2026);
  });
});

/*  MỐC "BẢN TIN TIẾP THEO" LÀ NHỊP QUÉT CỦA APP (2026-08-18).
 *  Nguồn tự khai khi nào có tin kế, nên app không phải chép cứng bảng tần suất
 *  của QĐ 18/2021 — chép cứng thì sai đúng lúc cơ quan dự báo leo thang nhịp,
 *  mà đó là lúc nguy hiểm nhất. Đọc trượt mốc này ⇒ app quét sai nhịp: hoặc
 *  liên tục (đập nguồn), hoặc thưa quá (đường đi đứt quãng). */
describe("parseGioBanTinTiepTheo — nhịp do nguồn tự khai", () => {
  const PHAT = Date.UTC(2026, 7, 18, 1); // 08h00 giờ VN 18/8

  it("bản tin thật: hẹn 14h00 ngày 18/8 = 07:00 UTC", () => {
    const ms = parseGioBanTinTiepTheo(BAN_TIN_THAT, PHAT, NOW)!;
    expect(new Date(ms).toISOString()).toBe("2026-08-18T07:00:00.000Z");
    // đúng 6 giờ sau giờ phát — nhịp bão còn trên Biển Đông
    expect((ms - PHAT) / 3600_000).toBe(6);
  });

  it("bản tin không ghi mốc kế → null (chỗ gọi dùng đường lùi)", () => {
    expect(parseGioBanTinTiepTheo("Tin phát lúc: 08h00 ngày 18/8", PHAT, NOW)).toBeNull();
  });

  it("bản tin 31/12 hẹn tin kế 01/01 → sang NĂM SAU, không lùi một năm", () => {
    const phat = Date.UTC(2026, 11, 31, 15); // 22h00 VN 31/12
    const ms = parseGioBanTinTiepTheo(
      "Bản tin tiếp theo: 04h00 ngày 1/1",
      phat,
      new Date(phat),
    )!;
    /*  04h00 giờ VN ngày 1/1/2027 = 21:00 UTC ngày 31/12/2026 — mốc ĐÚNG nằm ở
        năm UTC 2026, nên phải soi theo giờ VN chứ không theo `getUTCFullYear`. */
    expect(new Date(ms + 7 * 3600_000).toISOString()).toBe("2027-01-01T04:00:00.000Z");
    expect(ms).toBeGreaterThan(phat);
  });

  it("mốc rơi TRƯỚC giờ phát → null, không trả một mốc đã quá hạn", () => {
    // trả mốc quá khứ thì cổng nhịp thấy "tới giờ rồi" ở MỌI lượt ⇒ quét liên tục
    expect(
      parseGioBanTinTiepTheo("Bản tin tiếp theo: 02h00 ngày 18/8", PHAT, NOW),
    ).toBeNull();
  });
});

describe("parseNchmfBulletin — bản tin thật 18/8/2026", () => {
  const s = parseNchmfBulletin(BAN_TIN_THAT, NOW, "https://x/post53205.html")!;

  it("dựng được cơn với tâm + cấp + giờ phát tin", () => {
    expect(s).not.toBeNull();
    expect(s.lat).toBe(19.8);
    expect(s.lon).toBe(117.6);
    expect(s.kindLabel).toBe("Áp thấp nhiệt đới");
    expect(s.windKmh).toBe(43); // GIỮA dải cấp 6 — quy ngược lại đúng cấp 6
    expect(s.updated).toBe("2026-08-18T01:00:00.000Z");
  });

  it("track = tâm hiện tại + vị trí dự báo (để chặn tuyến cắt hành lang)", () => {
    expect(s.track[0]).toEqual([117.6, 19.8]);
    expect(s.track).toContainEqual([115.3, 19.9]);
    expect(s.track.length).toBeGreaterThanOrEqual(3);
  });

  it("id ổn định theo BẢN TIN, không theo giờ đọc", () => {
    const lai = parseNchmfBulletin(BAN_TIN_THAT, new Date(), "https://x/post53205.html")!;
    expect(lai.id).toBe(s.id);
  });

  it("ATNĐ cấp 6 = 'watch' (app vẫn chặn tuyến, chốt 2026-07-26); bão ≥ cấp 8 = 'danger'", () => {
    expect(s.alert).toBe("watch");
    const bao = parseNchmfBulletin(
      "TIN BÃO KHẨN CẤP (CƠN BÃO SỐ 5) Hồi 13 giờ, vị trí tâm bão số 5 ở khoảng " +
        "16,2°N; 110,5°E. Cường độ: cấp 12, giật cấp 15. Tin phát lúc: 14h00 ngày 18/8",
      NOW,
    )!;
    expect(bao.alert).toBe("danger");
    expect(bao.kindLabel).toBe("Bão mạnh");
    expect(bao.name).toBe("số 5");
    // ATNĐ không có tên riêng → để RỖNG, giao diện tự lo câu chữ
    expect(s.name).toBe("");
  });

  it("thiếu toạ độ → null (thà không có tin còn hơn tin sai chỗ)", () => {
    expect(
      parseNchmfBulletin("Áp thấp nhiệt đới đã suy yếu thành vùng áp thấp.", NOW),
    ).toBeNull();
  });

  it("KHÔNG bịa vùng ảnh hưởng: bản tin VN cho khung toạ độ, không phải polygon", () => {
    expect(s.areas).toEqual([]);
  });
});

/*  MENU TRANG KHÔNG ĐƯỢC LÀM ĐỔI NGHĨA BẢN TIN.
 *
 *  Lỗi thật, bắt được 2026-08-18 khi soi bản tin trực tiếp: `htmlToText` bóc cả
 *  thanh điều hướng của nchmf.gov.vn, và thanh đó LUÔN có mục "Bão - Áp thấp
 *  nhiệt đới". Phép `có "bão" && không có "áp thấp nhiệt đới"` vì thế luôn ra
 *  false ⇒ giữa cơn bão cấp 12, màn hình bà con vẫn ghi "Áp thấp nhiệt đới".
 *  Im lặng tuyệt đối: không sập, không log — chỉ nói nhẹ đi một cấp thiên tai. */
const MENU_TRANG =
  "Trang chủ Dự báo Thời tiết nguy hiểm Bão - Áp thấp nhiệt đới " +
  "Rủi ro thiên tai Mưa lớn Rủi ro thiên tai khác Kiến thức KTTV " +
  "Bão & Áp thấp nhiệt đới Hải văn Nước dâng Sóng Dòng chảy ";

describe("catThanBanTin — menu trang không được đội lốt nội dung bản tin", () => {
  const TIN_BAO =
    "TIN BÃO KHẨN CẤP (CƠN BÃO SỐ 5) Hồi 13 giờ, vị trí tâm bão số 5 ở khoảng " +
    "16,2°N; 110,5°E. Cường độ: cấp 12, giật cấp 15. Tin phát lúc: 14h00 ngày 18/8";

  it("TIN BÃO có menu ở đầu vẫn là BÃO, không tụt xuống áp thấp", () => {
    const s = parseNchmfBulletin(MENU_TRANG + TIN_BAO, NOW)!;
    expect(s.kindLabel).toBe("Bão mạnh");
    expect(s.name).toBe("số 5");
  });

  it("bản tin ATNĐ có menu vẫn là ATNĐ (không lật ngược sang bão)", () => {
    const s = parseNchmfBulletin(MENU_TRANG + BAN_TIN_THAT, NOW)!;
    expect(s.kindLabel).toBe("Áp thấp nhiệt đới");
    expect(s.lat).toBe(19.8);
  });

  it("giữ TIÊU ĐỀ bản tin (chỗ ghi 'bão số N'), chỉ bỏ phần trước nó", () => {
    const than = catThanBanTin(MENU_TRANG + TIN_BAO);
    expect(than.startsWith("TIN BÃO KHẨN CẤP")).toBe(true);
    expect(than).not.toContain("Trang chủ");
  });

  it("không tìm thấy mốc thân → trả NGUYÊN VĂN, thà đọc thừa còn hơn cắt mất tin", () => {
    const t = "Chuỗi không có mốc giờ nào cả";
    expect(catThanBanTin(t)).toBe(t);
  });
});

/*  MỘT NGUỒN, HAI CÁCH VIẾT, CÁCH NHAU 6 TIẾNG (đo thật 18/8/2026).
 *  Bản 08h00 và bản 14h00 của CÙNG cơn, CÙNG trang, viết khác nhau ở đúng hai
 *  chỗ parser bám vào. Bản đầu chỉ đọc được kiểu 08h00 ⇒ tới 14h00 là
 *  `parseGioPhatTin` trả null ⇒ cron ghi kho trả 503 và KHÔNG BAO GIỜ ghi được
 *  bản tin nào nữa — im lặng, vì 503 trông y hệt "nguồn đang bảo trì". */
const BAN_TIN_14H =
  "TIN ÁP THẤP NHIỆT ĐỚI TRÊN BIỂN ĐÔNG Hồi 13 giờ ngày 18/8 , vị trí tâm áp thấp " +
  "nhiệt đới ở vào khoảng 19,5 độ Vĩ Bắc; 116,3 độ Kinh Đông, trên vùng biển phía " +
  "Đông khu vực Bắc Biển Đông. Sức gió mạnh nhất vùng gần tâm áp thấp nhiệt đới " +
  "mạnh cấp 6 (39-49km/h), giật cấp 8 . Di chuyển theo hướng Tây với tốc độ khoảng " +
  "20km/h. 📍 Bản tin tiếp theo được phát lúc 20h00 ngày 18/8. 📍 Tin phát lúc: 14h00";

describe("hai cách viết của cùng một nguồn (bản 08h00 vs bản 14h00)", () => {
  it("'Tin phát lúc: 14h00' KHÔNG ghi ngày → lấy ngày của mốc quan trắc", () => {
    const ms = parseGioPhatTin(BAN_TIN_14H, NOW)!;
    expect(new Date(ms).toISOString()).toBe("2026-08-18T07:00:00.000Z"); // 14h VN
  });

  it("không có ngày ở đâu cả → lấy ngày VN hôm nay", () => {
    const ms = parseGioPhatTin("Tin phát lúc: 09h00", NOW)!;
    expect(new Date(ms).toISOString()).toBe("2026-08-18T02:00:00.000Z");
  });

  it("giờ phát suy từ đồng hồ mà rơi vào TƯƠNG LAI → là bản tin hôm qua", () => {
    // now = 10h VN 18/8; "22h00" không thể là tin sắp phát ⇒ 22h VN 17/8
    const ms = parseGioPhatTin("Tin phát lúc: 22h00", NOW)!;
    expect(new Date(ms).toISOString()).toBe("2026-08-17T15:00:00.000Z");
  });

  it("'Bản tin tiếp theo ĐƯỢC PHÁT LÚC 20h00' — chữ chèn giữa vẫn đọc được", () => {
    const phat = Date.UTC(2026, 7, 18, 7);
    const ms = parseGioBanTinTiepTheo(BAN_TIN_14H, phat, NOW)!;
    expect(new Date(ms).toISOString()).toBe("2026-08-18T13:00:00.000Z"); // 20h VN
  });

  it("mốc kế không ghi ngày và rơi trước giờ phát → hiểu là ngày hôm sau", () => {
    const phat = Date.UTC(2026, 7, 18, 13); // 20h VN 18/8
    const ms = parseGioBanTinTiepTheo("Bản tin tiếp theo được phát lúc 02h00", phat, NOW)!;
    expect(new Date(ms).toISOString()).toBe("2026-08-18T19:00:00.000Z"); // 02h VN 19/8
  });

  it("bản 14h00 đọc ra đủ tâm/cấp/hướng (cách viết 'Di chuyển theo hướng Tây')", () => {
    const s = parseNchmfBulletin(BAN_TIN_14H, NOW)!;
    expect(s.lat).toBe(19.5);
    expect(s.lon).toBe(116.3);
    expect(s.windKmh).toBe(43);
  });
});

/*  ⚠️ NGUỒN TRỘN HAI KIỂU MÃ UNICODE NGAY TRONG MỘT TỪ (đo thật 18/8/2026).
 *  Chữ "hướng" trên trang là `h ư ơ U+0301 n g` — "ơ" cộng DẤU SẮC RỜI, không
 *  phải "ớ" dựng sẵn (U+1EDB) như mọi chuỗi trong mã nguồn; mà "Tây" ngay cạnh
 *  lại dựng sẵn. Mọi regex tiếng Việt ở đây đều dính, và dính chỗ nào là tuỳ
 *  bản tin — nên nó không bao giờ đỏ đều. `htmlToText` chuẩn hoá NFC ở cửa duy
 *  nhất mọi parser đi qua. */
describe("htmlToText — chuẩn hoá NFC, không để dấu rời làm trượt regex", () => {
  /*  Dung tu MA KY TU, khong go thang: dau roi la thu VO HINH tren man hinh —
      trinh soan thao hay hook co the tu chuan hoa NFC va bien hai ca duoi
      thanh ca rong ma van xanh. Viet the nay thi khong ai lam hong duoc. */
  const roi = (...cp: number[]) => String.fromCodePoint(...cp);


  const HUONG_ROI = roi(0x68, 0x1b0, 0x1a1, 0x301, 0x6e, 0x67); // "huong", dau sac ROI
  const CAP_ROI = roi(0x63, 0x61, 0x302, 0x301, 0x70); // "cap", dau mu + sac ROI

  it("chuỗi dấu rời KHÔNG khớp regex dựng sẵn (đây là cái bẫy)", () => {
    expect(/hướng/u.test(HUONG_ROI)).toBe(false);
  });

  it("qua htmlToText thì khớp", () => {
    expect(/hướng/u.test(htmlToText(`<p>${HUONG_ROI} Tây</p>`))).toBe(true);
  });

  it("bản tin có dấu rời vẫn đọc ra hướng + cấp gió", () => {
    const tho =
      `<div>TIN ÁP THẤP NHIỆT ĐỚI Hồi 13 giờ ngày 18/8, vị trí tâm ở khoảng ` +
      `19,5 độ Vĩ Bắc; 116,3 độ Kinh Đông. Sức gió mạnh nhất ${CAP_ROI} 6 (39-49km/h), ` +
      `giật ${CAP_ROI} 8. Di chuyển theo ${HUONG_ROI} Tây với tốc độ khoảng 20km/h. ` +
      `Tin phát lúc: 14h00</div>`;
    const s = parseNchmfBulletin(htmlToText(tho), NOW)!;
    expect(s).not.toBeNull();
    expect(s.windKmh).toBe(43); // đọc được cấp 6 dù "cấp" viết dấu rời
  });
});

describe("pickLatestNchmfBulletin", () => {
  const html = `
    <a href="https://www.nchmf.gov.vn/kttv/vi-VN/1/ban-tin-du-bao-song-post53098.html">sóng</a>
    <a href="https://www.nchmf.gov.vn/kttv/vi-VN/1/tin-ap-thap-nhiet-doi-tren-bien-dong-post53205.html">ATNĐ</a>
    <a href="https://www.nchmf.gov.vn/kttv/vi-VN/1/tin-ap-thap-nhiet-doi-tren-bien-dong-post53100.html">ATNĐ cũ</a>`;

  it("lấy bản tin bão/ATNĐ có số post LỚN NHẤT, bỏ bản tin không liên quan", () => {
    expect(pickLatestNchmfBulletin(html)).toContain("post53205");
  });

  it("bỏ qua 'tin cuối cùng' (bản tin KẾT THÚC, không phải bão đang có)", () => {
    const h =
      html +
      `<a href="https://www.nchmf.gov.vn/kttv/vi-VN/1/tin-cuoi-cung-ve-ap-thap-nhiet-doi-post53999.html">cuối</a>`;
    expect(pickLatestNchmfBulletin(h)).toContain("post53205");
  });

  it("trang không có bản tin bão nào → null (trời yên, nói được)", () => {
    expect(
      pickLatestNchmfBulletin(`<a href="https://x/kttv/vi-VN/1/ban-tin-thuy-van-post1.html">x</a>`),
    ).toBeNull();
  });
});

describe("htmlToText", () => {
  it("bỏ script/style + giải mã thực thể + gộp khoảng trắng", () => {
    const t = htmlToText(
      "<div>Hồi 07 giờ<script>var x=1</script> &nbsp; 19,8&#176;N;\n 117,6°E</div>",
    );
    expect(t).toBe("Hồi 07 giờ 19,8°N; 117,6°E");
    expect(t).not.toContain("var x");
  });
});

/*  KHỚP HAI CHIỀU VỚI THANG CỦA APP — lỗi thật, thấy ngay trên màn 18/8:
    bản đầu lấy cận TRÊN của cấp (cấp 6 → 49 km/h) nhưng `beaufort()` cắt cấp 7
    tại ≥49, nên banner in "49 km/giờ (cấp 7)" trong khi đài đọc CẤP 6. Sai một
    cấp ở bản tin bão là bà con hết tin app. */
describe("capGioSangKmh — quy ngược phải ra ĐÚNG cấp bản tin nói", () => {
  it("mọi cấp 6..12: beaufort(capGioSangKmh(c)) === c", () => {
    for (let c = 6; c <= 12; c++) {
      const kmh = capGioSangKmh(c)!;
      expect(kmh).toBeGreaterThan(0);
      expect(beaufort(kmh)).toBe(c);
    }
  });

  it("cấp 6 KHÔNG được ra 49 (ranh giới cấp 7 của app)", () => {
    expect(capGioSangKmh(6)).toBeLessThan(49);
  });

  it("ngoài dải 6..17 → null, không đoán", () => {
    expect(capGioSangKmh(5)).toBeNull();
    expect(capGioSangKmh(18)).toBeNull();
    expect(capGioSangKmh(NaN)).toBeNull();
  });
});
