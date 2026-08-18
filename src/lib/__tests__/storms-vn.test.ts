import { describe, expect, it } from "vitest";
import {
  htmlToText,
  parseCapGio,
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

describe("parseNchmfBulletin — bản tin thật 18/8/2026", () => {
  const s = parseNchmfBulletin(BAN_TIN_THAT, NOW, "https://x/post53205.html")!;

  it("dựng được cơn với tâm + cấp + giờ phát tin", () => {
    expect(s).not.toBeNull();
    expect(s.lat).toBe(19.8);
    expect(s.lon).toBe(117.6);
    expect(s.kindLabel).toBe("Áp thấp nhiệt đới");
    expect(s.windKmh).toBe(49); // trần cấp 6 — thà nói mạnh hơn
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
