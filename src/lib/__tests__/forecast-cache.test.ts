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
  reclaimForecastSpace,
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

  /*
    DỌN XUYÊN NAMESPACE THEO BẬC HY SINH (viết lại 2026-08-02). Bản cũ của test
    này dựng kho CHỈ CÓ grid — kịch bản suy biến, không phân biệt được bậc nào
    với bậc nào — mà TÊN test lại phát biểu chính sách NGƯỢC với DROP_RANK
    ("lưới gió nhường chỗ cho dự báo điểm"). Luật thật: LƯỚI GIÓ/SÓNG là an toàn
    tính mạng, giữa biển không tải lại được ⇒ bỏ SAU điểm-chạm.
  */
  it("dọn xuyên namespace: bỏ bản RẺ trước, lưới gió/sóng được chừa", () => {
    QUOTA = 4;
    saveForecast("grid", "d16", { i: 0 }, 0); // savedAt = giờ cron → trông "cũ nhất"
    saveForecast("point", "a", { i: 1 }, 100);
    saveForecast("point", "b", { i: 2 }, 200);
    saveForecast("point", "c", { i: 3 }, 300);
    expect(saveForecast("scalar", "cloud", { v: 1 }, 400)).toBe(true);
    // nạn nhân là bản điểm CŨ NHẤT, KHÔNG phải lưới 16 ngày
    expect(loadForecast("point", "a")).toBeNull();
    expect(loadForecast("grid", "d16")).not.toBeNull();
    expect(loadForecast("scalar", "cloud")).not.toBeNull();
  });

  it("TIN BÃO không bị hy sinh trước lưới gió (an toàn tính mạng, chỉ vài KB)", () => {
    QUOTA = 3;
    saveForecast("storm", "latest", { ok: true }, 0); // cũ nhất theo savedAt
    saveForecast("grid", "d16", { i: 1 }, 100);
    saveForecast("curdepth", "t150", { i: 2 }, 200);
    // ghi bản đồ cá GHIM (bậc 5) — được phép hy sinh thứ rẻ hơn nó
    expect(saveForecast("fishmark", "m", { v: 1 }, 300)).toBe(true);
    expect(loadForecast("storm", "latest")).not.toBeNull(); // bậc cao nhất
    expect(loadForecast("curdepth", "t150")).toBeNull(); // rẻ nhất → đi trước
  });

  /*
    TRẦN BẬC (lỗi K4-b, 2026-08-02): vòng dọn xếp đúng thứ tự nạn nhân nhưng
    KHÔNG có luật dừng, nên khi thứ rẻ không đủ chỗ nó cứ đi tiếp lên bậc quý
    hơn. Ghi một lớp dải màu "xem cho biết" lúc máy đầy là ăn sạch price →
    point → scalar → grid → fishmark → STORM: bản tin bão bị xoá để nhét một
    lớp màu. Nay thà KHÔNG GHI được và báo "máy hết chỗ" — nói thật.
  */
  describe("trần bậc — đừng hy sinh thứ QUÝ HƠN thứ đang ghi", () => {
    const big = (n: number) => "x".repeat(n);

    it("lớp dải màu KHÔNG được xoá tin bão / lưới gió / bản đồ cá ghim", () => {
      QUOTA_BYTES = 6000;
      saveForecast("storm", "latest", { blob: big(300) }, 0);
      saveForecast("grid", "d16", { blob: big(600) }, 100);
      saveForecast("fishmark", "m", { blob: big(300) }, 200);
      // lớp độ mặn to hơn phần trống còn lại → PHẢI trượt, không được ăn bậc trên
      expect(saveForecast("scalar", "salinity", { blob: big(2000) }, 300)).toBe(
        false,
      );
      expect(loadForecast("storm", "latest")).not.toBeNull();
      expect(loadForecast("grid", "d16")).not.toBeNull();
      expect(loadForecast("fishmark", "m")).not.toBeNull();
      expect(lastStorageFullAt()).toBeGreaterThan(0); // có báo "máy hết chỗ"
    });

    it("lớp dải màu VẪN được hy sinh thứ RẺ HƠN (giá cá, điểm ghim)", () => {
      QUOTA_BYTES = 6000;
      saveForecast("price", "port", { blob: big(400) }, 0);
      saveForecast("point", "a", { blob: big(400) }, 100);
      saveForecast("storm", "latest", { blob: big(200) }, 200);
      expect(saveForecast("scalar", "cloud", { blob: big(2000) }, 300)).toBe(true);
      expect(loadForecast("price", "port")).toBeNull();
      expect(loadForecast("storm", "latest")).not.toBeNull();
    });

    /* KHÔNG được dựng lại lỗi "kẹt vĩnh viễn" 2026-07-25: NGANG HÀNG là cùng
       hạng giá trị, bỏ bản CŨ để nhận bản MỚI cùng loại vẫn phải chạy được. */
    it("NGANG HÀNG vẫn nhường chỗ được — không kẹt vĩnh viễn", () => {
      QUOTA = 5;
      for (let i = 0; i < 5; i++) saveForecast("point", `p${i}`, { i }, i);
      expect(saveForecast("point", "moi", { v: 1 }, 999)).toBe(true);
      expect(loadForecast("point", "p0")).toBeNull();
      expect(loadForecast("point", "moi")).not.toBeNull();
    });
  });

  it("giá cá là thứ bỏ ĐẦU TIÊN (rẻ nhất trong bảng)", () => {
    QUOTA = 2;
    saveForecast("point", "a", { v: 1 }, 0); // cũ nhất theo savedAt
    saveForecast("price", "port", { v: 2 }, 900);
    expect(saveForecast("grid", "d3", { v: 3 }, 1000)).toBe(true);
    expect(loadForecast("price", "port")).toBeNull();
    expect(loadForecast("point", "a")).not.toBeNull();
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
    QUOTA_BYTES = 14000;
    for (let i = 0; i < 40; i++) saveForecast("point", `p${i}`, { i }, i);
    expect(saveForecast("grid", "d16", { blob: big(6000) }, 9999)).toBe(true);
    expect(loadForecast("grid", "d16")).not.toBeNull();
  });

  it("chỉ bỏ vừa đủ — bản mới nhất còn nguyên", () => {
    QUOTA_BYTES = 14000;
    for (let i = 0; i < 40; i++) saveForecast("point", `p${i}`, { i }, i);
    saveForecast("grid", "d3", { blob: big(500) }, 5000);
    expect(saveForecast("scalar", "cloud", { blob: big(5000) }, 9999)).toBe(true);
    expect(loadForecast("point", "p0")).toBeNull(); // cũ nhất nhường chỗ
    expect(loadForecast("point", "p39")).not.toBeNull(); // mới hơn còn
    expect(loadForecast("grid", "d3")).not.toBeNull();
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
describe("reclaimForecastSpace — bỏ thứ RẺ trước, chừa lưới gió/sóng", () => {
  const big = (n: number) => "x".repeat(n);

  it("lưới gió/sóng CŨ HƠN vẫn được chừa, bản điểm-chạm mới hơn nhường chỗ", () => {
    saveForecast("grid", "d16", { blob: big(2000) }, 1000); // savedAt = giờ cron
    saveForecast("point", "a", { blob: big(50) }, 9000); // savedAt = Date.now
    expect(reclaimForecastSpace(100)).toBe(1);
    expect(loadForecast("grid", "d16")).not.toBeNull();
    expect(loadForecast("point", "a")).toBeNull();
  });

  it("thứ tự hy sinh: điểm → dải màu → dòng chảy tầng → lưới → bản đồ cá ghim", () => {
    saveForecast("fishmark", "m", { blob: big(60) }, 1000);
    saveForecast("grid", "d16", { blob: big(60) }, 1000);
    saveForecast("curdepth", "t150", { blob: big(60) }, 1000);
    saveForecast("scalar", "cloud", { blob: big(60) }, 1000);
    saveForecast("point", "a", { blob: big(60) }, 1000);
    const gone: string[] = [];
    for (const [ns, id] of [
      ["point", "a"],
      ["scalar", "cloud"],
      ["curdepth", "t150"],
      ["grid", "d16"],
      ["fishmark", "m"],
    ] as const) {
      reclaimForecastSpace(0);
      if (loadForecast(ns, id) === null && !gone.includes(ns)) gone.push(ns);
    }
    expect(gone).toEqual(["point", "scalar", "curdepth", "grid", "fishmark"]);
  });

  it("cùng bậc thì bỏ bản CŨ trước", () => {
    saveForecast("point", "moi", { blob: big(50) }, 9000);
    saveForecast("point", "cu", { blob: big(50) }, 1000);
    reclaimForecastSpace(0);
    expect(loadForecast("point", "cu")).toBeNull();
    expect(loadForecast("point", "moi")).not.toBeNull();
  });

  it("kho trống → trả 0, không ném", () => {
    expect(reclaimForecastSpace(5000)).toBe(0);
  });
});

/*
  T3 — MẺ TẢI SẴN TỰ XOÁ THỨ NÓ VỪA GHI RỒI VẪN KHOÁ 6 GIỜ (2026-08-02).
  `saveForecast` chỉ CỘNG `counts[ns]`; ba đường xoá (trim · dropOldest ·
  reclaimForecastSpace) không đường nào TRỪ. Bước ghi điểm ghim xong
  (`gained.point = 3`), bước ghi lớp dải màu làm `setItem` ném ⇒ dropOldest xoá
  luôn ba bản `point` VỪA ghi ⇒ `gained.point` vẫn 3 ⇒ khoá 6 giờ, mà dòng báo
  lại xanh "Đã lưu dự báo mới về máy." vì `savedSummary()` chạy sau và thấy kho
  trống ⇒ `untilIso = null`.
*/
describe("phạm vi đếm ghi — TRỪ CÔNG khi bản vừa ghi bị xoá đi", () => {
  const big = (n: number) => "x".repeat(n);

  it("ba bản point vừa ghi bị dọn để nhường lớp dải màu → counts.point về 0", () => {
    QUOTA_BYTES = 4000;
    const s = beginForecastWrites();
    for (const id of ["a", "b", "c"]) {
      expect(saveForecast("point", id, { blob: big(500) }, 100)).toBe(true);
    }
    expect(s.counts.point).toBe(3);
    saveForecast("scalar", "cloud", { blob: big(1500) }, 200);
    s.end();
    expect(countNs("point")).toBe(0); // kho đã sạch bản điểm
    expect(s.counts.point).toBe(0); // …và công cũng phải sạch theo
  });

  it("trim (quá 40 bản) cũng phải trừ công", () => {
    const s = beginForecastWrites();
    for (let i = 0; i < 45; i++) saveForecast("point", `p${i}`, { i }, i);
    s.end();
    expect(countNs("point")).toBe(40);
    expect(s.counts.point).toBe(40); // 45 lần ghi − 5 bản bị trim
  });

  it("nhường chỗ cho dữ liệu tự nhập cũng phải trừ công", () => {
    const s = beginForecastWrites();
    saveForecast("point", "a", { blob: big(50) }, 100);
    saveForecast("point", "b", { blob: big(50) }, 200);
    reclaimForecastSpace(10); // bỏ 1 bản rẻ nhất
    s.end();
    expect(s.counts.point).toBe(1);
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
      if (i % 3 === 0) reclaimForecastSpace(1200);
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
    saveForecast("scalar", "cloud.d16", { blob: big(1000) }, 1000);
    s.end();
    return s;
  };

  it("bản điểm ĐỜI CŨ bị dọn → công của mẻ này còn NGUYÊN", () => {
    const s = runBatch();
    expect(loadForecast("point", "cu1")).toBeNull(); // bản cũ đã nhường chỗ
    expect(loadForecast("point", "moi3")).not.toBeNull(); // bản MỚI còn nguyên
    expect(s.counts.point).toBe(3); // ⇒ công phải còn nguyên theo
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
    reclaimForecastSpace(1); // bỏ bản RẺ + CŨ nhất = "a"
    tay.end();
    auto.end();
    expect(loadForecast("point", "a")).toBeNull();
    expect(loadForecast("point", "b")).not.toBeNull();
    expect(auto.counts.point).toBe(0);
    expect(tay.counts.point).toBe(1);
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

  it("d3 vẫn được hy sinh thứ RẺ HƠN — không kẹt vô cớ", () => {
    QUOTA_BYTES = 7000;
    saveForecast("grid", "d16", { blob: big(1200) }, 1000);
    saveForecast("point", "a", { blob: big(1200) }, 2000);
    expect(saveForecast("grid", "d3", { blob: big(1200) }, 9000)).toBe(true);
    expect(loadForecast("grid", "d16")).not.toBeNull();
    expect(loadForecast("point", "a")).toBeNull();
  });

  it("khung DÀI vẫn được nhận chỗ của khung NGẮN (chiều ngược lại vẫn chạy)", () => {
    QUOTA_BYTES = 5000;
    saveForecast("grid", "d3", { blob: big(2000) }, 1000);
    expect(saveForecast("grid", "d16", { blob: big(2000) }, 9000)).toBe(true);
    expect(loadForecast("grid", "d3")).toBeNull();
    expect(loadForecast("grid", "d16")).not.toBeNull();
  });
});

/*
  T8 — `reclaimForecastSpace` KHÔNG CÓ TRẦN BẬC: duyệt hết `rankedVictims()`,
  không `ceiling`, không `break` — đối lập thẳng với dropOldest. Ghi tủ giấy tờ /
  sổ thuyền viên đủ lớn là dọn tới TIN BÃO. Bỏ tin bão (vài KB) chẳng dôi ra chỗ
  nào mà lấy mất đúng thứ cứu người.
*/
describe("reclaimForecastSpace — KHÔNG bao giờ đụng tin bão", () => {
  const big = (n: number) => "x".repeat(n);

  it("kho chỉ có tin bão → không bỏ gì cả, dù xin bao nhiêu chỗ", () => {
    saveForecast("storm", "latest", { blob: big(200) }, 1000);
    expect(reclaimForecastSpace(999999)).toBe(0);
    expect(loadForecast("storm", "latest")).not.toBeNull();
  });

  it("có lưới + tin bão → lưới nhường chỗ, tin bão còn nguyên", () => {
    saveForecast("storm", "latest", { blob: big(200) }, 1000);
    saveForecast("grid", "d16", { blob: big(2000) }, 1000);
    expect(reclaimForecastSpace(999999)).toBe(1);
    expect(loadForecast("grid", "d16")).toBeNull();
    expect(loadForecast("storm", "latest")).not.toBeNull();
  });
});

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
