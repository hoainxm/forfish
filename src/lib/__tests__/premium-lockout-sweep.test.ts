import { describe, it, expect } from "vitest";

import { featureAccessDecision, type FeatureAccessInput } from "../tier";

/*  QUÉT NGÕ CỤT PREMIUM — chủ dự án 2026-09-02: *"test xem còn lỗi premium ko
    ăn vô dẫn đến user ko dùng đc dù là pre"*.

    KHÔNG thử lẻ vài ca rồi kết luận. Quét TOÀN BỘ tổ hợp trạng thái mà một máy
    thật có thể rơi vào, rồi hỏi đúng một câu: **có trạng thái nào khiến người
    ĐÃ TRẢ TIỀN không mở được công cụ không, mà chính máy đó có đủ cơ sở để
    biết họ là premium?**

    Vì sao câu hỏi phải kèm vế sau: có những ca KHOÁ LÀ ĐÚNG — máy chưa từng
    biết hạng và cũng không hỏi được ai thì "checking" là câu trả lời trung
    thực, không phải lỗi. Cái đáng gọi là lỗi là khi máy CÓ bằng chứng premium
    (dấu đã lưu, hoặc câu trả lời tươi) mà vẫn khoá.

    Rail ẩn Đến điểm/Điểm đã lưu/Dẫn đường khi kết quả khác "open"
    (`premiumTools = fishAccess === "open"`, ra-khoi-controls) — nên "không
    open" ở đây nghĩa là bà con KHÔNG đặt được điểm đến. */

const BOOL = [true, false] as const;
const MARKS = ["premium", "basic", "unknown"] as const;
const PREM = [true, false, null] as const;

/** Mọi tổ hợp trạng thái máy — 2^5 × 3 × 3 = 288 ca. */
function moiTrangThai(): FeatureAccessInput[] {
  const out: FeatureAccessInput[] = [];
  for (const authReady of BOOL)
    for (const hasUser of BOOL)
      for (const online of BOOL)
        for (const authErrored of BOOL)
          for (const hasOfflineIdentity of BOOL)
            for (const cachedMark of MARKS)
              for (const premium of PREM)
                out.push({
                  configured: true,
                  authReady,
                  hasUser,
                  online,
                  authErrored,
                  hasOfflineIdentity,
                  cachedMark,
                  premium,
                  premiumExpiredOnly: false,
                  // hạn còn xa — để ca "hết hạn" không lẫn vào phép quét này
                  premiumMarkUntil: "2027-12-31T00:00:00+07:00",
                });
  return out;
}

/*  TRẠNG THÁI CÓ THẬT KHÔNG — phép quét Descartes đẻ ra cả tổ hợp không bao
    giờ xảy ra, và một test đỏ vì trạng thái ma là test tồi.
    `premium` là CÂU TRẢ LỜI TƯƠI của phiên này; nó chỉ có khi đang có người
    đăng nhập. `premium === true` mà `hasUser === false` là mâu thuẫn tự thân. */
function coThat(i: FeatureAccessInput): boolean {
  if (i.premium !== null && !i.hasUser) return false;
  return true;
}

/*  ĐÃ NGÃ NGŨ CHƯA — hai ca dưới đây KHOÁ LÀ ĐÚNG, không tính là ngõ cụt:

    1. `authReady === false`: phiên chưa kiểm xong. "checking" ở đây là câu trả
       lời trung thực và chỉ kéo dài vài mili giây; đòi "open" lúc này là đòi
       app đoán trước khi biết.
    2. `!hasUser && !hasOfflineIdentity`: máy KHÔNG còn thuộc về ai — bà con đã
       bấm Đăng xuất, hoặc bấm "Gỡ tài khoản khỏi máy này". Dấu premium cũ nằm
       lại một mình KHÔNG được mở khoá, nếu không thì đưa máy cho người khác là
       họ dùng được quyền của mình. Mời đăng nhập mới đúng.

    Cắt hai ca này KHÔNG làm phép quét rỗng ruột: phần còn lại vẫn phủ đủ ba
    cảnh thật ngoài hiện trường — mở app nguội, mất sóng giữa biển, rụng phiên
    khi bắt wifi ở cảng. */
function daNgaNgu(i: FeatureAccessInput): boolean {
  if (!i.authReady) return false;
  if (!i.hasUser && i.hasOfflineIdentity !== true) return false;
  return true;
}

/*  MÁY CÓ BẰNG CHỨNG PREMIUM KHÔNG — và bằng chứng phải KHÔNG BỊ BÁC BỎ.

    Dấu đã lưu là bằng chứng, NHƯNG chỉ khi chưa có câu trả lời tươi nào nói
    ngược. `premium === false` = máy chủ VỪA nói tài khoản này hạng thường (bị
    hạ hạng ở /quan-tri chẳng hạn) — lúc đó khoá là ĐÚNG, và bản quét đầu tiên
    của tôi tính nhầm ca này thành lỗi. */
function coBangChungPremium(i: FeatureAccessInput): boolean {
  if (i.premium === true) return true;
  return i.premium === null && i.cachedMark === "premium";
}

describe("QUÉT: máy CÓ bằng chứng premium mà vẫn bị khoá công cụ", () => {
  it("phép quét KHÔNG rỗng ruột — chốt số ca thật sự được soi", () => {
    /*  Lọc chặt quá thì test xanh vì chẳng soi gì. Chốt con số để lần sau ai
        nới điều kiện lọc (làm số ca tụt) là thấy ngay. */
    const soCa = moiTrangThai()
      .filter(coThat)
      .filter(daNgaNgu)
      .filter(coBangChungPremium).length;
    expect(soCa).toBeGreaterThanOrEqual(30);
  });

  it("không còn ngõ cụt nào — mọi trạng thái có bằng chứng đều ra 'open'", () => {
    const ketToi = moiTrangThai()
      .filter(coThat)
      .filter(daNgaNgu)
      .filter(coBangChungPremium)
      .filter((i) => featureAccessDecision(i) !== "open")
      .map((i) => ({
        ket: featureAccessDecision(i),
        authReady: i.authReady,
        hasUser: i.hasUser,
        online: i.online,
        authErrored: i.authErrored,
        danhTinh: i.hasOfflineIdentity,
        dau: i.cachedMark,
        tuoi: i.premium,
      }));
    expect(ketToi).toEqual([]);
  });
});

describe("QUÉT: khoá ĐÚNG vẫn phải khoá (vá không được mở bừa)", () => {
  it("chưa từng biết hạng + không có bằng chứng ⇒ KHÔNG BAO GIỜ ra 'open'", () => {
    const moBua = moiTrangThai()
      .filter(coThat)
      .filter((i) => i.cachedMark === "unknown" && i.premium !== true)
      .filter((i) => featureAccessDecision(i) === "open");
    expect(moBua).toEqual([]);
  });

  it("đã tra được và ĐÚNG LÀ hạng thường ⇒ không ca nào ra 'open'", () => {
    const moBua = moiTrangThai()
      .filter(coThat)
      .filter((i) => i.cachedMark === "basic" && i.premium === false)
      .filter((i) => featureAccessDecision(i) === "open");
    expect(moBua).toEqual([]);
  });
});

describe("BỐN CA THẬT NGOÀI HIỆN TRƯỜNG", () => {
  const nen = {
    configured: true,
    authReady: true,
    hasUser: true,
    online: true,
    authErrored: false,
    hasOfflineIdentity: true,
    premiumExpiredOnly: false,
    premiumMarkUntil: "2027-12-31T00:00:00+07:00",
  };

  it("vừa đăng nhập, máy chủ đã trả tier ⇒ mở ngay", () => {
    expect(
      featureAccessDecision({ ...nen, premium: true, cachedMark: "premium" }),
    ).toBe("open");
  });

  it("MỞ APP NGUỘI: chưa có câu trả lời tươi, chỉ có dấu đã lưu ⇒ vẫn mở", () => {
    // đây là ca đã vá 2026-08-31 (aef2319) — chốt lại để không hồi quy
    expect(
      featureAccessDecision({ ...nen, premium: null, cachedMark: "premium" }),
    ).toBe("open");
  });

  it("GIỮA BIỂN mất sóng, phiên rụng, máy còn nhớ chủ ⇒ vẫn mở", () => {
    expect(
      featureAccessDecision({
        ...nen,
        online: false,
        hasUser: false,
        premium: null,
        cachedMark: "premium",
      }),
    ).toBe("open");
  });

  it("CÒN SÓNG mà phiên rụng (wifi cảng): dấu premium CÓ HẠN ⇒ mở; KHÔNG hạn ⇒ không mở", () => {
    const roiPhien = {
      ...nen,
      hasUser: false,
      premium: null,
      cachedMark: "premium" as const,
    };
    expect(featureAccessDecision(roiPhien)).toBe("open");
    // dấu không hạn mở cửa này thì tài khoản bị hạ hạng ở /quan-tri vẫn "open"
    // VĨNH VIỄN — luật E4 cố ý chặn, quét lại để không ai nới ra
    expect(
      featureAccessDecision({ ...roiPhien, premiumMarkUntil: null }),
    ).not.toBe("open");
  });
});
