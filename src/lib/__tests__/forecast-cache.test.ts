import { describe, it, expect, beforeEach } from "vitest";

/*
  localStorage mock (env node — không jsdom), khớp mẫu boat-store.test.
  QUOTA = số bản tối đa giả lập; vượt thì ném như máy thật (QuotaExceededError)
  để thử đúng đường "máy hết chỗ" — chỗ từng kẹt vĩnh viễn.
*/
let QUOTA = Infinity;
/* Trần theo DUNG LƯỢNG (byte UTF-16 = 2 × ký tự, như máy thật) — máy chật vì
   dung lượng chứ không vì số mục; đó đúng là trục mà bản cũ dọn nhầm (bỏ 4 bản
   điểm ~3 KB rồi tưởng đủ chỗ cho một lưới 16 ngày ~800 KB). Infinity = tắt,
   để các test cũ chạy như trước. */
let QUOTA_BYTES = Infinity;
/* SỨC ÉP NẰM Ở KHO KHÁC (T2): trên WebKit/iOS localStorage dùng CHUNG hạn ngạch
   origin với Cache API — ô bản đồ 12 MB vừa tải làm `setItem` ném BẤT KỂ
   localStorage còn trống bao nhiêu. Cờ này dựng đúng cảnh đó. */
let ALWAYS_FULL = false;
const _ls = (() => {
  const m = new Map<string, string>();
  const usedBytes = () => {
    let n = 0;
    for (const [k, v] of m) n += (k.length + v.length) * 2;
    return n;
  };
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (ALWAYS_FULL) {
        const e = new Error("QuotaExceededError");
        e.name = "QuotaExceededError";
        throw e;
      }
      if (!m.has(k) && m.size >= QUOTA) {
        const e = new Error("QuotaExceededError");
        e.name = "QuotaExceededError";
        throw e;
      }
      const cur = m.has(k) ? (k.length + m.get(k)!.length) * 2 : 0;
      if (usedBytes() - cur + (k.length + String(v).length) * 2 > QUOTA_BYTES) {
        const e = new Error("QuotaExceededError");
        e.name = "QuotaExceededError";
        throw e;
      }
      m.set(k, String(v));
    },
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as unknown as Storage;
})();
(globalThis as unknown as { window: unknown }).window = { localStorage: _ls };
(globalThis as unknown as { localStorage: Storage }).localStorage = _ls;

import {
  saveForecast,
  loadForecast,
  loadAll,
  lastStorageFullAt,
  beginForecastWrites,
  coordId,
  noteForecastKept,
  savedAgoLabel,
} from "../forecast-cache";

const countNs = (ns: string) => {
  let n = 0;
  for (let i = 0; i < localStorage.length; i++) {
    if (localStorage.key(i)?.startsWith(`forfish.fc.${ns}.`)) n++;
  }
  return n;
};

beforeEach(() => {
  localStorage.clear();
  QUOTA = Infinity;
  QUOTA_BYTES = Infinity;
  ALWAYS_FULL = false;
});

describe("save/load round-trip", () => {
  it("lưu rồi đọc lại đúng data + savedAt", () => {
    saveForecast("point", "a", { x: 1 }, 1000);
    const c = loadForecast<{ x: number }>("point", "a");
    expect(c?.data.x).toBe(1);
    expect(c?.savedAt).toBe(1000);
  });
  it("chưa lưu → null", () => {
    expect(loadForecast("point", "zzz")).toBeNull();
  });
  it("ghi đè bản mới", () => {
    saveForecast("point", "a", { x: 1 }, 1000);
    saveForecast("point", "a", { x: 2 }, 2000);
    expect(loadForecast<{ x: number }>("point", "a")?.data.x).toBe(2);
  });
});

describe("loadAll", () => {
  it("trả mọi bản trong namespace, mới nhất trước", () => {
    saveForecast("point", "a", { v: "cũ" }, 1000);
    saveForecast("point", "b", { v: "mới" }, 5000);
    saveForecast("point", "c", { v: "giữa" }, 3000);
    const all = loadAll<{ v: string }>("point");
    expect(all.map((e) => e.id)).toEqual(["b", "c", "a"]);
    expect(all[0].data.v).toBe("mới");
  });
  it("namespace khác không lẫn", () => {
    saveForecast("point", "a", { v: 1 }, 1000);
    expect(loadAll("grid")).toEqual([]);
  });
});

describe("trim MAX_ENTRIES", () => {
  it("giữ tối đa 40 bản mới nhất, xoá cũ nhất", () => {
    for (let i = 0; i < 50; i++) saveForecast("point", `p${i}`, { i }, i);
    expect(countNs("point")).toBe(40);
    expect(loadForecast("point", "p0")).toBeNull(); // cũ nhất bị xoá
    expect(loadForecast("point", "p49")).not.toBeNull(); // mới nhất còn
  });

  it("dọn TRƯỚC khi ghi → không bao giờ vượt trần dù ghi liên tục", () => {
    for (let i = 0; i < 45; i++) {
      expect(saveForecast("point", `p${i}`, { i }, i)).toBe(true);
      expect(countNs("point")).toBeLessThanOrEqual(40);
    }
  });

  it("ghi đè id cũ không đẩy số bản lên", () => {
    for (let i = 0; i < 40; i++) saveForecast("point", `p${i}`, { i }, i);
    saveForecast("point", "p10", { i: 999 }, 5000);
    expect(countNs("point")).toBe(40);
    expect(loadForecast<{ i: number }>("point", "p10")?.data.i).toBe(999);
  });
});

/*
  LỖI đã sửa (2026-07-25): trim() nằm SAU setItem trong CÙNG khối try → máy đầy
  thì setItem ném QuotaExceeded, trim KHÔNG BAO GIỜ chạy → kẹt vĩnh viễn, cả
  chuyến biển không lưu thêm được bản nào mà UI vẫn im.
*/
describe("máy hết chỗ (QuotaExceeded)", () => {
  it("đầy → bỏ bản cũ nhất rồi ghi lại được, KHÔNG kẹt vĩnh viễn", () => {
    QUOTA = 10;
    for (let i = 0; i < 10; i++) {
      expect(saveForecast("point", `p${i}`, { i }, i)).toBe(true);
    }
    // đã chật cứng: bản mới vẫn phải vào được (nhờ dọn bản cũ nhất)
    expect(saveForecast("point", "moi", { i: 99 }, 9999)).toBe(true);
    expect(loadForecast<{ i: number }>("point", "moi")?.data.i).toBe(99);
    expect(loadForecast("point", "p0")).toBeNull(); // cũ nhất nhường chỗ
    // và lần sau vẫn ghi được (không kẹt)
    expect(saveForecast("point", "moi2", { i: 100 }, 10000)).toBe(true);
  });

  /*  ═══ ĐỔI CHÍNH SÁCH 2026-08-02i — MỖI LỚP CHỈ ĂN TRONG CHÍNH NÓ ═══

      Chủ dự án chốt: *"chỉ dọn khi down được 1 bản ghi mới thôi (online và down
      về thành công) thì nó luôn tối ưu và đảm bảo cái offline luôn đủ info truy
      cập được mọi lúc trong 16 ngày đã down về. Hành vi qua ngày 2, 3, 4 … 16
      offline là giống nhau, đều đọc từ bản ghi local thôi."*

      Chính sách cũ (`DROP_RANK`, dọn XUYÊN LỚP) nghe hợp lý — bỏ thứ rẻ giữ thứ
      quý — nhưng nó phá đúng lời hứa trên: ghi một lưới gió mới có thể xoá điểm
      ghim / lớp dải màu / giá cá, tức **ăn vào chính cái gói 16 ngày vừa tải**.
      Hậu quả không phải "mất một lớp rẻ" mà là **gói đó không còn đủ info**, và
      ngày thứ mấy của chuyến mở ra thấy gì thì tuỳ lượt ghi nào tình cờ chạy
      trước. Ngày 2 khác ngày 9 — đúng thứ lời hứa cấm.

      Luật mới: nạn nhân phải CÙNG LỚP với thứ đang ghi. Lưới thay lưới, điểm
      ghim thay điểm ghim — đúng nghĩa "bản mới thế chỗ bản nó thay thế". Không
      còn nạn nhân cùng lớp ⇒ TỪ CHỐI GHI, báo "máy hết chỗ" (cùng luật đã áp
      cho dữ liệu bà con tự gõ).

      Mấy ca dưới đây trước kia khoá chính sách xuyên lớp; nay khoá chính sách
      mới, và khoá luôn chiều ngược: **không lớp nào được đụng lớp khác.** */
  /*  ⚠️ SIẾT LẠI 2026-08-02j (vòng soát chéo bắt lỗi CHẶN): luật "chỉ ăn trong
      chính lớp mình" làm các lớp CHỈ CÓ MỘT BẢN — `storm.latest`,
      `fishmark.latest`, `seascalar.ssha` — **không bao giờ ghi được khi máy
      đầy**, vì chính nó là `keep` nên danh sách nạn nhân luôn rỗng. Bản tin bão
      600 byte trượt trong khi một lớp dải màu 20 KB nằm nguyên.
      Nay: thiếu nạn nhân cùng lớp thì được ăn lớp RẺ HƠN HẲN, NHƯNG có SÀN CỨNG
      — không bao giờ đụng lưới gió/sóng, bản đồ cá, tin bão. */
  it("thiếu nạn nhân cùng lớp → ăn lớp RẺ HƠN, nhưng KHÔNG đụng lớp cốt lõi", () => {
    QUOTA = 4;
    saveForecast("grid", "d16", { i: 0 }, 0);
    saveForecast("point", "a", { i: 1 }, 100);
    saveForecast("price", "port", { i: 2 }, 200);
    saveForecast("storm", "latest", { i: 3 }, 300);
    // lớp dải màu (bậc 2) ⇒ ăn được `price` (bậc 0), KHÔNG đụng cốt lõi
    expect(saveForecast("scalar", "cloud", { v: 1 }, 400)).toBe(true);
    expect(loadForecast("price", "port"), "lớp rẻ nhất phải nhường").toBeNull();
    for (const [ns, id] of [
      ["grid", "d16"],
      ["storm", "latest"],
    ] as const) {
      expect(loadForecast(ns, id), `${ns} CỐT LÕI bị ăn`).not.toBeNull();
    }
  });

  /*  Ca sinh ra cả vế "thiếu nạn nhân cùng lớp": TIN BÃO chỉ có một id, mà nó là
      thứ duy nhất trong kho dính TÍNH MẠNG — không ghi được là hỏng nặng nhất. */
  it("TIN BÃO luôn ghi được: ăn lớp rẻ, không bao giờ trượt vì máy đầy", () => {
    QUOTA = 3;
    saveForecast("price", "port", { i: 0 }, 0);
    saveForecast("point", "a", { i: 1 }, 100);
    saveForecast("scalar", "cloud", { i: 2 }, 200);
    expect(
      saveForecast("storm", "latest", { ok: true }, 300),
      "bản tin bão trượt vì máy đầy — hỏng nặng nhất có thể",
    ).toBe(true);
    expect(loadForecast("storm", "latest")).not.toBeNull();
  });

  it("bản đồ cá mới KHÔNG được xoá tin bão / lưới gió — SÀN CỨNG", () => {
    QUOTA = 3;
    saveForecast("storm", "latest", { ok: true }, 0);
    saveForecast("grid", "d16", { i: 1 }, 100);
    saveForecast("curdepth", "t150", { i: 2 }, 200);
    // bản đồ cá (bậc 5) ăn được `curdepth` (bậc 3, dưới sàn), KHÔNG đụng hai lớp trên
    expect(saveForecast("fishmark", "m", { v: 1 }, 300)).toBe(true);
    expect(loadForecast("storm", "latest"), "TIN BÃO bị ăn").not.toBeNull();
    expect(loadForecast("grid", "d16"), "LƯỚI GIÓ bị ăn").not.toBeNull();
  });

  it("TRONG cùng lớp thì bản mới vẫn thay được bản cũ — không kẹt vĩnh viễn", () => {
    QUOTA = 5;
    for (let i = 0; i < 5; i++) saveForecast("point", `p${i}`, { i }, i);
    expect(saveForecast("point", "moi", { v: 1 }, 999)).toBe(true);
    expect(loadForecast("point", "p0")).toBeNull(); // bản cũ NHẤT cùng lớp
    expect(loadForecast("point", "moi")).not.toBeNull();
  });

  it("khung NGẮN không giết khung DÀI dù cùng lớp `grid`", () => {
    QUOTA = 2;
    saveForecast("grid", "d16", { i: 0 }, 0); // savedAt giờ cron → trông cũ nhất
    saveForecast("grid", "d7", { i: 1 }, 100);
    // ghi d3 (khung ngắn nhất) — KHÔNG được ăn d16
    saveForecast("grid", "d3", { i: 2 }, 200);
    expect(loadForecast("grid", "d16"), "khung 16 ngày bị khung 3 ngày ăn").not.toBeNull();
  });

  it("chỉ cần vài KB thì CHỈ bỏ 1 bản, không bỏ tối thiểu 4 bản như trước", () => {
    QUOTA = 5;
    for (let i = 0; i < 5; i++) saveForecast("point", `p${i}`, { i }, i);
    expect(saveForecast("point", "moi", { v: 1 }, 999)).toBe(true);
    expect(loadForecast("point", "p0")).toBeNull(); // đúng 1 bản nhường chỗ
    for (const id of ["p1", "p2", "p3", "p4"]) {
      expect(loadForecast("point", id)).not.toBeNull();
    }
  });

  /*
    MỐC HẾT CHỖ LÀ MỐC SỰ CỐ, KHÔNG PHẢI TUỔI SỐ LIỆU (sửa 2026-08-02).
    Bản cũ của test này khẳng định `lastStorageFullAt() === 4242` — tức khoá lại
    hành vi SAI: `saveForecast(GRID_NS, id, snap, snap.savedAt)` truyền GIỜ CHẠY
    CRON (mấy giờ trước) ⇒ `full = lastStorageFullAt() >= startedAt` luôn false
    ⇒ bà con KHÔNG bao giờ thấy dòng "Máy hết chỗ nhớ" dù lưới 16 ngày không hề
    lưu được.
  */
  it("hết chỗ thật → trả false + ghi mốc SỰ CỐ (giờ máy), không phải tuổi số liệu", () => {
    QUOTA = 0;
    const t0 = Date.now();
    // 4242 = tuổi số liệu (mốc cron 1970) — KHÔNG được lọt vào mốc sự cố
    expect(saveForecast("point", "a", { v: 1 }, 4242)).toBe(false);
    expect(lastStorageFullAt()).toBeGreaterThanOrEqual(t0);
    expect(lastStorageFullAt()).not.toBe(4242);
  });

  it("mốc hết chỗ đủ để pretrip thấy 'máy hết chỗ' dù số liệu mang tuổi cũ", () => {
    QUOTA = 0;
    const startedAt = Date.now(); // như runPretrip
    saveForecast("grid", "d16", { v: 1 }, startedAt - 5 * 60 * 60 * 1000);
    expect(lastStorageFullAt() >= startedAt).toBe(true);
  });

  it("lưu được thì KHÔNG đánh dấu hết chỗ", () => {
    const before = lastStorageFullAt();
    expect(saveForecast("point", "a", { v: 1 }, 777777)).toBe(true);
    expect(lastStorageFullAt()).toBe(before);
  });
});

/*
  PHẠM VI ĐẾM GHI (2026-08-02) — mẻ tải sẵn phải biết mình VỪA giữ được gì THẬT,
  không được đọc kho (kho có sẵn bản 3 hôm trước → khoá 6 giờ oan). Và phải đếm
  THEO MẺ: nút "Tải lại" từng lớp trong popup không bị cờ `running` chặn, bản nó
  ghi được mà lọt vào bộ đếm của mẻ tự động thì mẻ hỏng sạch vẫn ra "xanh".
*/
describe("beginForecastWrites — đếm việc GHI theo TỪNG MẺ", () => {
  it("chỉ tăng khi ghi ĐƯỢC; máy đầy thì không tăng", () => {
    const s = beginForecastWrites();
    saveForecast("point", "a", { v: 1 }, 100);
    saveForecast("point", "b", { v: 2 }, 200);
    saveForecast("grid", "d3", { v: 3 }, 300);
    expect(s.counts.point).toBe(2);
    expect(s.counts.grid).toBe(1);

    QUOTA = 0;
    localStorage.clear();
    expect(saveForecast("point", "c", { v: 4 }, 400)).toBe(false);
    expect(s.counts.point).toBe(2); // ghi trượt thì không tính
    s.end();
  });

  it("đóng phạm vi rồi thì bản ghi sau KHÔNG cộng vào nữa", () => {
    const s = beginForecastWrites();
    saveForecast("point", "a", { v: 1 }, 100);
    s.end();
    saveForecast("point", "b", { v: 2 }, 200);
    expect(s.counts.point).toBe(1);
  });

  /* LỖI K5: hai mẻ chồng nhau — mẻ TỰ ĐỘNG đang chạy thì bà con chạm "Tải lại"
     một lớp trong popup. Bản do NÚT ghi được không được tính cho mẻ tự động. */
  it("mẻ lồng nhau: bản ghi trong mẻ TRONG không lọt sang mẻ NGOÀI", () => {
    const auto = beginForecastWrites();
    saveForecast("point", "a", { v: 1 }, 100); // của mẻ tự động
    const tay = beginForecastWrites(); // bà con bấm "Tải lại"
    saveForecast("grid", "d3", { v: 2 }, 200);
    saveForecast("grid", "d16", { v: 3 }, 300);
    tay.end();
    saveForecast("point", "b", { v: 4 }, 400); // lại của mẻ tự động
    auto.end();
    expect(tay.counts).toEqual({ grid: 2 });
    expect(auto.counts).toEqual({ point: 2 });
    expect(auto.counts.grid).toBeUndefined(); // KHÔNG được ra "xanh" nhờ nút bấm
  });

  it("không có mẻ nào mở → ghi vẫn chạy, chỉ là không ai đếm", () => {
    expect(saveForecast("point", "z", { v: 1 }, 100)).toBe(true);
  });

  /* "Kho đang giữ bản TỐT HƠN nên khỏi ghi" ≠ "hỏng vì sóng" — đếm riêng, nếu
     không thì cửa 2 phút mở lại ở mỗi lần liếc điện thoại (~3 MB/lượt). */
  it("kept đếm riêng khỏi counts", () => {
    const s = beginForecastWrites();
    noteForecastKept("grid");
    noteForecastKept("grid");
    noteForecastKept("scalar");
    s.end();
    expect(s.kept).toEqual({ grid: 2, scalar: 1 });
    expect(s.counts).toEqual({});
    noteForecastKept("grid"); // ngoài phạm vi → bỏ qua êm, không ném
    expect(s.kept.grid).toBe(2);
  });
});

/*
  DỌN THEO BYTE, KHÔNG THEO SỐ BẢN (sửa 2026-07-31): lớp nặng chạy CUỐI trong
  mẻ tải sẵn (độ mặn · nước dâng · dòng chảy tầng sâu · lưới 16 ngày) trước đây
  không bao giờ lưu được — bỏ 12 bản điểm ghim tí xíu vẫn không ra nổi chỗ cho
  một bản mấy trăm KB.
*/
describe("máy hết chỗ — dọn theo DUNG LƯỢNG", () => {
  const big = (n: number) => "x".repeat(n);

  it("bản NẶNG vẫn vào được: bỏ bao nhiêu bản tí hon cũng bỏ, miễn đủ chỗ", () => {
    /*  CÙNG LỚP (2026-08-02i): lớp mới không được ăn lớp khác, nên ca "bản nặng
        vào được" phải dựng trong CHÍNH lớp đó. */
    QUOTA_BYTES = 14000;
    for (let i = 0; i < 12; i++)
      saveForecast("grid", `d${i}`, { blob: big(500) }, i);
    expect(saveForecast("grid", "d16", { blob: big(6000) }, 9999)).toBe(true);
    expect(loadForecast("grid", "d16")).not.toBeNull();
  });

  it("chỉ bỏ vừa đủ — bản mới nhất còn nguyên", () => {
    QUOTA_BYTES = 14000;
    for (let i = 0; i < 40; i++) saveForecast("point", `p${i}`, { i }, i);
    saveForecast("grid", "d3", { blob: big(500) }, 5000);
    // bản MỚI cùng lớp `point` — chỉ được ăn trong `point`
    expect(saveForecast("point", "moi", { blob: big(5000) }, 9999)).toBe(true);
    expect(loadForecast("point", "p0")).toBeNull(); // cũ nhất nhường chỗ
    expect(loadForecast("point", "p39")).not.toBeNull(); // mới hơn còn
    expect(loadForecast("grid", "d3"), "lớp khác bị ăn").not.toBeNull();
  });

  it("ghi đè bản NẶNG của chính mình không tự xoá mình rồi mất chỗ", () => {
    QUOTA_BYTES = 13000;
    saveForecast("grid", "d16", { blob: big(6000) }, 1000);
    expect(saveForecast("grid", "d16", { blob: big(6000) }, 2000)).toBe(true);
    expect(loadForecast<{ blob: string }>("grid", "d16")?.savedAt).toBe(2000);
  });
});

/*
  NHƯỜNG CHỖ CHO DỮ LIỆU TỰ NHẬP — chọn nạn nhân theo GIÁ TRỊ, không theo tuổi
  (sửa 2026-08-01). `savedAt` của lớp nặng là GIỜ CHẠY CRON của snapshot, còn
  bản điểm-chạm tí hon lưu bằng Date.now ⇒ xếp theo tuổi thì lớp nặng luôn đứng
  đầu hàng bị bỏ: một ghi chú 3 KB xoá nguyên lưới gió/sóng 16 ngày.
*/

/*
  T3 — MẺ TẢI SẴN TỰ XOÁ THỨ NÓ VỪA GHI RỒI VẪN KHOÁ 6 GIỜ (2026-08-02).
  `saveForecast` chỉ CỘNG `counts[ns]`; ba đường xoá (trim · dropOldest ·
  dropOldest) không đường nào TRỪ. Bước ghi điểm ghim xong
  (`gained.point = 3`), bước ghi lớp dải màu làm `setItem` ném ⇒ dropOldest xoá
  luôn ba bản `point` VỪA ghi ⇒ `gained.point` vẫn 3 ⇒ khoá 6 giờ, mà dòng báo
  lại xanh "Đã lưu dự báo mới về máy." vì `savedSummary()` chạy sau và thấy kho
  trống ⇒ `untilIso = null`.
*/
describe("phạm vi đếm ghi — TRỪ CÔNG khi bản vừa ghi bị xoá đi", () => {
  const big = (n: number) => "x".repeat(n);

  it("bản point vừa ghi bị chính lớp point dọn → counts.point trừ đúng", () => {
    QUOTA_BYTES = 4000;
    const s = beginForecastWrites();
    for (const id of ["a", "b", "c"]) {
      expect(saveForecast("point", id, { blob: big(500) }, 100)).toBe(true);
    }
    expect(s.counts.point).toBe(3);
    // bản point MỚI, nặng ⇒ ăn bản point cũ của chính mẻ này
    saveForecast("point", "nang", { blob: big(1500) }, 200);
    s.end();
    expect(s.counts.point, "công không được đếm THỪA").toBeLessThanOrEqual(
      countNs("point"),
    );
  });

  it("trim (quá 40 bản) cũng phải trừ công", () => {
    const s = beginForecastWrites();
    for (let i = 0; i < 45; i++) saveForecast("point", `p${i}`, { i }, i);
    s.end();
    expect(countNs("point")).toBe(40);
    expect(s.counts.point).toBe(40); // 45 lần ghi − 5 bản bị trim
  });

  /*  Kích dọn bằng ĐÚNG ĐƯỜNG THẬT — ghi lúc kho đã đầy — chứ không gọi tay hàm
      dọn nữa: đường "dữ liệu tự gõ mượn chỗ của dự báo" đã xoá hẳn 2026-08-02h
      (xem `user-store.test.ts`), nên gọi tay là kiểm một thứ không còn tồn tại. */
  it("dọn chỗ lúc GHI cũng phải trừ công", () => {
    QUOTA = 2;
    const s = beginForecastWrites();
    saveForecast("point", "a", { i: 1 }, 100);
    saveForecast("point", "b", { i: 2 }, 200);
    // kho đầy ⇒ bản point MỚI ép dọn bản point CŨ NHẤT ("a") — cùng lớp
    saveForecast("point", "c", { i: 3 }, 300);
    s.end();
    expect(loadForecast("point", "a")).toBeNull();
    expect(s.counts.point).toBe(2);
  });

  /* BẤT BIẾN chốt cả họ lỗi này: sau MỌI chuỗi ghi/xoá, công đếm được không bao
     giờ được LỚN HƠN số bản thật còn nằm trong kho. Đếm thiếu thì cùng lắm thử
     lại; đếm THỪA là khoá 6 giờ oan giữa lúc cần dự báo. */
  it("bất biến: counts[ns] ≤ số bản THẬT còn trong kho", () => {
    QUOTA_BYTES = 9000;
    const s = beginForecastWrites();
    for (let i = 0; i < 12; i++) {
      saveForecast("point", `p${i}`, { blob: big(300) }, i);
      saveForecast("scalar", `s${i}`, { blob: big(400) }, i);
    }
    s.end();
    for (const ns of ["point", "scalar", "grid"]) {
      expect(s.counts[ns] ?? 0).toBeLessThanOrEqual(countNs(ns));
    }
  });
});

/*
  HỒI QUY DO CHÍNH BẢN VÁ T3 ĐẺ RA (2026-08-02) — TRỪ CÔNG NHẦM BẢN.
  Bản vá T3 trừ công theo NAMESPACE: không so id, không so mốc. Mà nạn nhân xếp
  CŨ TRƯỚC ⇒ thứ bị dọn gần như luôn là bản của CHUYẾN TRƯỚC, chẳng liên quan mẻ
  đang chạy. Mẻ ghi 3 điểm ghim rồi ghi lớp dải màu ⇒ 3 bản đời cũ ra đi ⇒
  `gained.point` về 0 trong khi 3 bản MỚI còn nguyên trong máy ⇒ không ghi mốc 6
  giờ ⇒ mỗi lần bà con liếc điện thoại là một mẻ ~3 MB tiền sóng.
*/
describe("phạm vi đếm ghi — chỉ trừ bản của CHÍNH mẻ này", () => {
  const big = (n: number) => "x".repeat(n);
  /** dựng cảnh: chuyến trước để lại bản NẶNG, mẻ này ghi bản nhẹ rồi ghi lớp màu */
  const runBatch = () => {
    QUOTA_BYTES = 7000;
    for (const id of ["cu1", "cu2", "cu3"])
      saveForecast("point", id, { blob: big(800) }, 100); // của chuyến TRƯỚC
    const s = beginForecastWrites();
    for (const id of ["moi1", "moi2", "moi3"])
      expect(saveForecast("point", id, { blob: big(100) }, 900)).toBe(true);
    expect(s.counts.point).toBe(3);
    // bản point MỚI, nặng ⇒ ăn bản point ĐỜI CŨ (cùng lớp)
    saveForecast("point", "nang", { blob: big(1000) }, 1000);
    s.end();
    return s;
  };

  it("bản điểm ĐỜI CŨ bị dọn → công của mẻ này còn NGUYÊN", () => {
    const s = runBatch();
    expect(loadForecast("point", "cu1")).toBeNull(); // bản cũ đã nhường chỗ
    expect(loadForecast("point", "moi3")).not.toBeNull(); // bản MỚI còn nguyên
    expect(s.counts.point).toBe(4); // 3 bản mới + bản "nang" — không bản nào của mẻ bị ăn
  });

  it("đếm số bản phải XOÁ để có chỗ (dòng báo cần, để đổ đúng bệnh)", () => {
    expect(runBatch().evicted).toBe(1);
  });

  it("dọn thường lệ (quá 40 bản điểm) KHÔNG phải là máy hết chỗ", () => {
    const s = beginForecastWrites();
    for (let i = 0; i < 45; i++) saveForecast("point", `p${i}`, { i }, i);
    s.end();
    expect(countNs("point")).toBe(40);
    expect(s.evicted).toBe(0); // trim là chuyện bình thường, đừng dọa bà con
  });

  /* MẺ LỒNG NHAU: một lần cộng chỉ được trừ MỘT lần, và trừ đúng mẻ đã cộng.
     Luật cũ trừ trên MỌI phạm vi đang mở ⇒ mẻ tự động mất bản của nó thì nút
     "Tải lại" cũng bị trừ oan bản mà nó vẫn đang giữ. */
  it("mẻ NGOÀI mất bản của mình, mẻ TRONG giữ nguyên công bản còn sống", () => {
    const auto = beginForecastWrites();
    saveForecast("point", "a", { blob: big(50) }, 100); // của mẻ tự động
    const tay = beginForecastWrites(); // bà con chạm "Tải lại"
    saveForecast("point", "b", { blob: big(50) }, 900);
    // kho đầy ⇒ cú ghi kế (CÙNG LỚP) ép dọn bản cũ nhất = "a"
    QUOTA = 2;
    saveForecast("point", "c", { blob: big(50) }, 1000);
    tay.end();
    auto.end();
    expect(loadForecast("point", "a")).toBeNull();
    expect(loadForecast("point", "b")).not.toBeNull();
    expect(auto.counts.point).toBe(0);
    expect(tay.counts.point).toBe(2); // 'b' + 'c', cả hai còn sống
  });
});

/*
  C-5 ĐƯỜNG 2 — KHUNG NGẮN GIẾT KHUNG DÀI (2026-08-02).
  `grid.d3` và `grid.d16` CÙNG bậc 4, mà `savedAt` của d16 là giờ chạy cron nên
  hay trông "cũ" hơn ⇒ bước ghi d3 (chạy TRƯỚC trong PRETRIP_GRID_DAYS) chọn
  đúng d16 làm nạn nhân. Máy còn mỗi lưới 3 ngày trong khi tàu đi 10 ngày, mà
  chip vẫn XANH "Đã lưu đủ dự báo — tới ngày 18/8" (ngày lấy từ lớp điểm ghim).
*/
describe("lưới gió/sóng — khung NGẮN không được hy sinh khung DÀI", () => {
  const big = (n: number) => "x".repeat(n);

  it("ghi grid.d3 lúc kho đầy KHÔNG được xoá grid.d16", () => {
    QUOTA_BYTES = 5000;
    saveForecast("grid", "d16", { blob: big(2000) }, 1000); // giờ cron → "cũ"
    expect(saveForecast("grid", "d3", { blob: big(2000) }, 9000)).toBe(false);
    expect(loadForecast("grid", "d16")).not.toBeNull(); // thứ cứu người còn nguyên
    expect(lastStorageFullAt()).toBeGreaterThan(0); // và có nói thật "hết chỗ"
  });

  /*  ĐỔI 2026-08-02i — hai vế, và vế thứ hai mới là điều đáng nói.

      (a) `d3` làm tươi CHÍNH NÓ vẫn chạy: `setItem` cùng khoá là thay chỗ, không
          cần đuổi ai. Đây là đường thường ngày, không được kẹt.
      (b) `d3` KHÔNG được lấy chỗ của `d16` (khung dài) **và cũng không được lấy
          chỗ của lớp khác** (`point`). Trước 2026-08-02i nó ăn được `point` —
          tức một lưới 3 ngày xoá điểm ghim của bà con để tự nhét mình vào. */
  it("d3 làm tươi chính nó thì chạy; KHÔNG ăn d16, KHÔNG ăn lớp khác", () => {
    QUOTA_BYTES = 9000;
    saveForecast("grid", "d16", { blob: big(1200) }, 1000);
    saveForecast("grid", "d3", { blob: big(1200) }, 2000);
    saveForecast("point", "a", { blob: big(1200) }, 2500);
    // (a) thay chính mình, cùng cỡ → phải chạy
    expect(saveForecast("grid", "d3", { blob: big(1200) }, 9000)).toBe(true);
    // (b) đòi thêm chỗ → thà TỪ CHỐI, không ăn d16 cũng không ăn point
    expect(saveForecast("grid", "d3", { blob: big(4000) }, 9500)).toBe(false);
    expect(loadForecast("grid", "d16"), "khung DÀI bị khung ngắn ăn").not.toBeNull();
    expect(loadForecast("point", "a"), "lớp khác bị ăn").not.toBeNull();
  });

  it("khung DÀI vẫn được nhận chỗ của khung NGẮN (chiều ngược lại vẫn chạy)", () => {
    QUOTA_BYTES = 5000;
    saveForecast("grid", "d3", { blob: big(2000) }, 1000);
    expect(saveForecast("grid", "d16", { blob: big(2000) }, 9000)).toBe(true);
    expect(loadForecast("grid", "d3")).toBeNull();
    expect(loadForecast("grid", "d16")).not.toBeNull();
  });
});

/*  `reclaimForecastSpace` ĐÃ XOÁ HẲN (2026-08-02h) cùng với cả tầng "dữ liệu bà
    con tự gõ mượn chỗ của dự báo". Luật thay thế: hết chỗ thì TỪ CHỐI GHI và nói
    thật — cổng chặn khuôn nằm ở `__tests__/user-store.test.ts`.
    Mấy ca cũ ở đây (bậc hy sinh, chừa tin bão) không còn đối tượng để kiểm. */


/*
  T2 — SỨC ÉP Ở KHO KHÁC MÀ ĐI DỌN localStorage (2026-08-02).
  Điều kiện dừng cũ là "không còn gì để xoá", KHÔNG phải "xoá không ăn thua" ⇒
  mất gần trọn kho dự báo mà vẫn không ghi nổi một byte.
*/
describe("dọn không ăn thua thì DỪNG — đừng đốt kho dự báo vô ích", () => {
  const big = (n: number) => "x".repeat(n);

  it("setItem luôn ném dù còn chỗ → chỉ dọn 1 lượt, kho không về 0", () => {
    for (let i = 0; i < 6; i++) saveForecast("point", `p${i}`, { blob: big(400) }, i);
    expect(countNs("point")).toBe(6);
    ALWAYS_FULL = true;
    const t0 = Date.now();
    expect(saveForecast("scalar", "cloud", { v: 1 }, 9000)).toBe(false);
    expect(countNs("point")).toBeGreaterThanOrEqual(5); // KHÔNG dọn sạch kho
    expect(lastStorageFullAt()).toBeGreaterThanOrEqual(t0); // và nói thật
  });
});

describe("coordId", () => {
  it("gộp về lưới 0.25°", () => {
    expect(coordId(10.36, 108.09)).toBe(coordId(10.30, 108.12)); // cùng ô 0.25
    expect(coordId(10.0, 108.0)).toBe("10.00_108.00");
  });
});

describe("savedAgoLabel", () => {
  it("phút / giờ / ngày", () => {
    expect(savedAgoLabel(0, 5 * 60000)).toBe("lưu 5 phút trước");
    expect(savedAgoLabel(0, 3 * 3600000)).toBe("lưu 3 giờ trước");
    expect(savedAgoLabel(0, 2 * 86400000)).toBe("lưu 2 ngày trước");
  });
});


/*  ═══ MẤT SÓNG THÌ KHÔNG XOÁ GÌ HẾT ═══ (chủ dự án chốt 2026-08-02i)

    "Đã lưu offline mà chưa online lại thì cứ dùng kho offline chứ xoá cái gì?
    Offline thì làm sao tăng kích thước kho offline nữa mà phải xoá?"

    Kiểm được bằng mã: mọi lời gọi `saveForecast` đều nằm sau một lượt fetch
    THÀNH CÔNG, nên offline kho dự báo không thể phình. Cổng này biến lập luận đó
    thành luật, để ai thêm một đường ghi chạy offline sau này cũng không vô tình
    ăn vào kho của bà con. */
describe("mất sóng → KHÔNG xoá một bản dự báo nào", () => {
  /* `navigator` trong node là getter-only ⇒ phải `defineProperty`, không gán được */
  const setOnline = (v: boolean) => {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: v },
      configurable: true,
      writable: true,
    });
  };

  it("offline + máy đầy → từ chối ghi, kho còn NGUYÊN", () => {
    setOnline(false);
    QUOTA = 2;
    saveForecast("grid", "d16", { i: 1 }, 100);
    saveForecast("point", "a", { i: 2 }, 200);
    expect(saveForecast("fishmark", "m", { i: 3 }, 300)).toBe(false);
    expect(loadForecast("grid", "d16"), "LƯỚI bị ăn khi mất sóng").not.toBeNull();
    expect(loadForecast("point", "a"), "điểm ghim bị ăn khi mất sóng").not.toBeNull();
    setOnline(true);
  });

  it("CÓ sóng + máy đầy → vẫn được nhường chỗ như cũ", () => {
    setOnline(true);
    QUOTA = 2;
    saveForecast("point", "a", { i: 1 }, 100);
    saveForecast("point", "b", { i: 2 }, 200);
    // cùng lớp `point` — chỗ duy nhất còn được nhường (xem eligibleVictims)
    expect(saveForecast("point", "c", { i: 3 }, 300)).toBe(true);
    expect(loadForecast("point", "a")).toBeNull();
  });
});


/*  ═══ DỌN HẾT CŨNG KHÔNG ĐỦ ⇒ KHÔNG ĐƯỢC XOÁ GÌ ═══ (2026-08-02i)

    Cầu dao cũ chỉ nổ SAU khi đã giải phóng đủ byte. Tổng nạn nhân hợp lệ mà nhỏ
    hơn chỗ cần thì vòng xoá sạch danh sách rồi mới chịu thua — mất hết mà không
    ghi được gì. Ca thật: máy gần đầy, mẻ tải sẵn ghi `grid.d16` (~1,6 MB), nạn
    nhân cùng lớp chỉ có `d3` + `d7` (vài trăm KB) ⇒ tàu ra khơi KHÔNG CÒN lưới
    gió/sóng nào. */
describe("dọn hết cũng không đủ → KHÔNG xoá một bản nào", () => {
  const big = (n: number) => "x".repeat(n);

  it("ghi không được ⇒ TRẢ LẠI HẾT, kho y như chưa đụng vào", () => {
    QUOTA_BYTES = 6000;
    saveForecast("grid", "d3", { blob: big(300) }, 100);
    saveForecast("grid", "d7", { blob: big(300) }, 200);
    // d16 to hơn tổng d3+d7 rất nhiều ⇒ dọn hết cũng không đủ
    expect(saveForecast("grid", "d16", { blob: big(5000) }, 300)).toBe(false);
    // …và mọi bản bị gỡ ra phải được trả lại NGUYÊN VẸN
    expect(loadForecast("grid", "d3"), "d3 mất trắng").not.toBeNull();
    expect(loadForecast("grid", "d7"), "d7 mất trắng").not.toBeNull();
    expect(
      (loadForecast("grid", "d3")?.data as { blob: string }).blob.length,
      "trả lại mà nội dung sai",
    ).toBe(300);
  });

  it("đủ chỗ thì vẫn nhường như thường (không chặn oan)", () => {
    QUOTA_BYTES = 6000;
    saveForecast("grid", "d3", { blob: big(1200) }, 100);
    saveForecast("grid", "d7", { blob: big(1200) }, 200);
    expect(saveForecast("grid", "d16", { blob: big(1500) }, 300)).toBe(true);
  });
});

/*  ═══ HOÀN TÁC PHẢI TRẢ LẠI CẢ CÔNG ĐẾM ═══ (2026-08-02j)

    `dropOne` trừ công (`debitScopes`) và đếm `evicted` lúc gỡ bản ra. Nếu cú ghi
    cuối vẫn hỏng thì `hoanTac` trả bản về kho — nhưng nếu không cộng lại công
    thì `counts[ns]` NHỎ HƠN số bản thật đang nằm trong máy, và mẻ tải sẵn tưởng
    mình chẳng giữ được gì ⇒ không ghi mốc ⇒ mỗi lần bà con liếc điện thoại lại
    bắn lại cả mẻ ~3 MB tiền sóng. Đúng bài học đã ghi ở `debitScopes`. */
describe("hoàn tác — kho VÀ công đếm đều phải về như cũ", () => {
  const big = (n: number) => "x".repeat(n);

  it("ghi hỏng → bản về kho, công đếm về theo, `evicted` không đếm oan", () => {
    QUOTA_BYTES = 6000;
    const s = beginForecastWrites();
    expect(saveForecast("grid", "d3", { blob: big(300) }, 100)).toBe(true);
    expect(saveForecast("grid", "d7", { blob: big(300) }, 200)).toBe(true);
    expect(s.counts.grid).toBe(2);
    // quá to ⇒ dọn hết cũng không đủ ⇒ hoàn tác
    expect(saveForecast("grid", "d16", { blob: big(5000) }, 300)).toBe(false);
    s.end();
    expect(loadForecast("grid", "d3"), "d3 không được trả về").not.toBeNull();
    expect(loadForecast("grid", "d7"), "d7 không được trả về").not.toBeNull();
    expect(s.counts.grid, "công đếm bị trừ oan ⇒ vòng tải lại vô tận").toBe(2);
    expect(s.evicted, "đếm 'máy hết chỗ' oan dù đã trả lại hết").toBe(0);
  });

  /* BẤT BIẾN chung: công đếm KHÔNG BAO GIỜ được lớn hơn số bản thật trong kho */
  it("bất biến: counts[ns] ≤ số bản THẬT, kể cả sau hoàn tác", () => {
    QUOTA_BYTES = 6000;
    const s = beginForecastWrites();
    saveForecast("grid", "d3", { blob: big(300) }, 100);
    saveForecast("grid", "d7", { blob: big(300) }, 200);
    saveForecast("grid", "d16", { blob: big(5000) }, 300);
    s.end();
    expect(s.counts.grid ?? 0).toBeLessThanOrEqual(countNs("grid"));
  });
});
