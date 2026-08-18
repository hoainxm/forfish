import { describe, expect, it, beforeEach } from "vitest";

// localStorage mock (env node — không jsdom), khớp mẫu forecast-cache.test
const _ls = (() => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
})();
(globalThis as unknown as { window: unknown }).window = { localStorage: _ls };
(globalThis as unknown as { localStorage: Storage }).localStorage = _ls;

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  parseBackup,
  exportOfflineData,
  importOfflineData,
  summarizeBackup,
  isBackupable,
  backupGroupSpec,
  NEVER_BACKUP_PREFIXES,
  FORECAST_PREFIXES,
  SETTINGS_KEYS,
  TRANSFER_KEYS,
} from "../offline-backup";

beforeEach(() => localStorage.clear());

describe("parseBackup", () => {
  it("nhận đúng định dạng v1", () => {
    const b = parseBackup(JSON.stringify({ v: 1, savedAt: 1, ls: { a: "b" } }));
    expect(b?.ls.a).toBe("b");
  });

  it("từ chối JSON hỏng / sai version / thiếu ls", () => {
    expect(parseBackup("{không phải json")).toBeNull();
    expect(parseBackup(JSON.stringify({ v: 2, ls: {} }))).toBeNull();
    expect(parseBackup(JSON.stringify({ v: 1 }))).toBeNull();
    expect(parseBackup(JSON.stringify({ v: 1, ls: null }))).toBeNull();
  });
});

/*  BA CA DƯỚI ĐÂY TỪNG KHOÁ CỨNG MỘT HÀNH VI MẤT AN TOÀN — sửa 2026-08-02
    (vòng soát chéo). Bản trước `importOfflineData` chỉ chặn khi
    `opts.confirmed === false`; gọi `importOfflineData(json)` KHÔNG cờ là GHI
    THẲNG vào máy. Ba ca này lại khẳng định đúng cái đó là chuẩn
    (`expect(r.ok).toBe(true)` sau một lời gọi không cờ) ⇒ test đang CANH CHO
    CỔNG HỞ, và bất kỳ ai sửa cho cổng chặt lại sẽ thấy test đỏ rồi tưởng mình
    sai.

    Cổng opt-in không phải cổng: chỗ gọi mới nào (màn cài đặt, deep-link, bản
    Capacitor) quên truyền cờ là đè tủ giấy tờ + sổ mối quen không hỏi ai —
    đúng cảnh mà sheet xác nhận dựng ra để chặn. Nay THIẾU CỜ = KHÔNG GHI, và
    ca đầu tiên bên dưới canh thẳng điều đó.  */
describe("export → import round-trip (localStorage)", () => {
  it("THIẾU cờ xác nhận → KHÔNG ghi một khoá nào (trước đây ghi thẳng)", async () => {
    const json = JSON.stringify({
      v: 1,
      savedAt: 1,
      mode: "forecast",
      ls: { "forfish.fc.grid.d3": "GRID" },
    });
    const r = await importOfflineData(json); // KHÔNG truyền confirmed
    expect(r.ok).toBe(false);
    expect(r.needsConfirm).toBe(true);
    expect(r.keys).toBe(0);
    expect(localStorage.getItem("forfish.fc.grid.d3")).toBeNull();
  });

  it("gom dữ liệu forfish.* NHƯNG loại dấu quyền tier, phục hồi lại đúng", async () => {
    localStorage.setItem("forfish.fc.grid.d3", "GRID");
    localStorage.setItem("forfish.tier.premium.v1", "1"); // dấu premium — KHÔNG gom
    localStorage.setItem("khac.khong-lien-quan", "BỎ"); // không phải forfish → không gom

    const json = await exportOfflineData();
    const parsed = parseBackup(json);
    // chỉ dữ liệu dự báo, KHÔNG có forfish.tier.*
    expect(Object.keys(parsed!.ls)).toEqual(["forfish.fc.grid.d3"]);

    // xoá sạch (giả lập máy xoá cache) rồi phục hồi
    localStorage.clear();
    const r = await importOfflineData(json, { confirmed: true });
    expect(r.ok).toBe(true);
    expect(r.keys).toBe(1);
    expect(r.failed).toBe(0);
    expect(localStorage.getItem("forfish.fc.grid.d3")).toBe("GRID");
  });

  it("import tệp có LẪN dấu premium → KHÔNG mở khoá (leo thang quyền)", async () => {
    // tệp do người khác sửa tay, cố nhét dấu premium
    const json = JSON.stringify({
      v: 1,
      savedAt: 1,
      ls: { "forfish.fc.grid.d3": "GRID", "forfish.tier.premium.v1": "1" },
    });
    const r = await importOfflineData(json, { confirmed: true });
    expect(r.ok).toBe(true);
    expect(r.keys).toBe(1); // chỉ ghi grid, KHÔNG ghi dấu tier
    expect(localStorage.getItem("forfish.tier.premium.v1")).toBeNull();
  });

  it("import tệp hỏng → ok:false, không ghi gì", async () => {
    const r = await importOfflineData("rác", { confirmed: true });
    expect(r.ok).toBe(false);
    expect(r.keys).toBe(0);
  });
});

/*  MÁY HẾT CHỖ: ĐỒ TỰ GÕ ĐI TRƯỚC, VÀ SỐ KHOÁ HỎNG PHẢI ĐẾM ĐƯỢC.
    Bản trước duyệt `Object.entries(b.ls)` theo thứ tự trong tệp ⇒ 2,5–3 MB dự
    báo xuống trước, tới `forfish.documents.v1` thì máy đầy, `setItem` ném và
    `catch {}` RỖNG nuốt im ⇒ sheet đóng như thành công, tủ giấy tờ rỗng.  */
describe("nhập lúc máy CHẬT CHỖ", () => {
  /** localStorage giả có TRẦN số khoá — ghi quá trần là ném như QuotaExceeded */
  function cappedStorage(max: number): Storage {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
      setItem: (k: string, v: string) => {
        if (!m.has(k) && m.size >= max) throw new Error("QuotaExceededError");
        m.set(k, String(v));
      },
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
      key: (i: number) => [...m.keys()][i] ?? null,
      get length() {
        return m.size;
      },
    } as Storage;
  }

  it("giấy tờ + mối quen ghi TRƯỚC dự báo, và số khoá hỏng được BÁO ra", async () => {
    const cap = cappedStorage(2); // chỉ giữ nổi 2 khoá
    const w = (globalThis as unknown as { window: { localStorage: Storage } }).window;
    const real = w.localStorage;
    w.localStorage = cap;
    try {
      const r = await importOfflineData(
        JSON.stringify({
          v: 1,
          savedAt: 1,
          mode: "transfer",
          ls: {
            // cố ý xếp dự báo LÊN ĐẦU tệp — đúng ca đã làm mất tủ giấy tờ
            "forfish.fc.grid.d3": "GRID",
            "forfish.fc.scalar.cloud.d16": "MAY",
            "forfish.documents.v1": "[1,2,3]",
            "forfish.buyers.v1": "[1,2]",
          },
        }),
        { confirmed: true },
      );
      expect(r.ok).toBe(true);
      // hai chỗ còn lại phải là ĐỒ TỰ GÕ, không phải dự báo
      expect(cap.getItem("forfish.documents.v1")).toBe("[1,2,3]");
      expect(cap.getItem("forfish.buyers.v1")).toBe("[1,2]");
      expect(cap.getItem("forfish.fc.grid.d3")).toBeNull();
      // và KHÔNG được nuốt im: đếm đủ 2 khoá hỏng để màn hình báo đỏ
      expect(r.keys).toBe(2);
      expect(r.failed).toBe(2);
    } finally {
      w.localStorage = real;
    }
  });
});

/*  ============================================================================
    DANH SÁCH CHO PHÉP — CỔNG CHẶN KHUÔN (2026-08-02, audit vòng 2 T5 + C-C5).

    Bản trước dùng DANH SÁCH CẤM (chỉ chặn tier + identity) nên mọi khoá khác
    MẶC ĐỊNH LỌT vào tệp: tin nhắm riêng, CCCD 12 số của từng bạn thuyền, tủ
    giấy tờ, điểm ghim luồng cá, MÃ MÁY, 4 khoá nhịp. Mà tệp thì bà con AirDrop
    / Zalo cho nhau vì tưởng là "chuyện dự báo".

    Ca dưới đây nhồi ĐỦ mặt khoá đang sống trong `ops/state-registry.md` rồi đòi
    tệp ra ĐÚNG BẰNG danh sách cho phép.

    ĐÍNH CHÍNH 2026-08-02 (vòng soát chéo): chú thích cũ ở chỗ này viết "ai thêm
    khoá `forfish.*` mới thì ca này ĐỎ" — KHÔNG ĐÚNG. `ALL_KEYS` là danh sách GÕ
    TAY nằm trong chính file test, không ai đối chiếu nó với `forfish.*` thật
    trong `src/`; thử thêm `forfish.crewsecret.v1` + `setItem` vào một file
    `src/lib/` thì 1511/1511 vẫn xanh. Cái ratchet THẬT nằm ở cụm
    "CỔNG QUÉT `src/`" cuối file này: nó đọc mã nguồn, moi mọi chuỗi
    `"forfish.…"` ra rồi bắt khoá nào cũng phải được XẾP LOẠI rõ ràng.  */
const ALL_KEYS = [
  // dự báo — tải lại được, không nói gì về người dùng
  "forfish.fc.point.10_109",
  "forfish.fc.grid.d3",
  "forfish.fc.storm.latest",
  "forfish.fc.scalar.cloud.d16",
  "forfish.fc.curdepth.mid.d3",
  "forfish.fc.seascalar.ssha",
  "forfish.fc.fishmark.latest",
  "forfish.fc.price.port",
  "forfish.fc.price.fuel",
  "forfish.sea.vung-tau.v3",
  // cài đặt xem — vô hại
  "forfish.displaymode.v1",
  "forfish.home.v1",
  "forfish.port.v1",
  "forfish.maplayer.v1",
  "forfish.mapPrefs.v1",
  // bà con tự gõ — CHỈ chế độ "chuyển sang máy mới"
  "forfish.documents.v1",
  "forfish.boats.v1",
  "forfish.currentBoat.v1",
  "forfish.boat.v1",
  "forfish.places.v1",
  "forfish.maintenance.v1",
  "forfish.products.v1",
  "forfish.buyers.v1",
  "forfish.sdvico-boat.v1",
  // KHÔNG BAO GIỜ vào tệp
  "forfish.crew.v1",
  "forfish.inbox.v1",
  "forfish.inbox.v2",
  "forfish.inbox.read.v1",
  "forfish.identity.v1",
  "forfish.tier.premium.v1",
  "forfish.tier.until.v1",
  "forfish.device.v1",
  "forfish.heartbeat.v1",
  "forfish.heartbeat.v2",
  "forfish.heartbeat.retry.v1",
  "forfish.heartbeat.sig.v1",
  "forfish.heartbeat.fails.v1",
  "forfish.heartbeat.5xx.v1",
  // máy-riêng / mốc điều phối — cố ý BỎ dù trông vô hại
  "forfish.installNudge.dismissed.v1",
  "forfish.pwa-frame.390x844",
  "forfish.pretrip.lastRunAt.v1",
  // sổ chuyến biển: tính năng đã BỎ 2026-07-27, khoá chỉ còn trong cascade xoá
  // tàu (lib/boat-cascade.ts) — không sao lưu, không phục hồi
  "forfish.trips.v1",
];

const FORECAST_EXPECTED = [
  "forfish.displaymode.v1",
  "forfish.fc.curdepth.mid.d3",
  "forfish.fc.fishmark.latest",
  "forfish.fc.grid.d3",
  "forfish.fc.point.10_109",
  "forfish.fc.price.fuel",
  "forfish.fc.price.port",
  "forfish.fc.scalar.cloud.d16",
  "forfish.fc.seascalar.ssha",
  "forfish.fc.storm.latest",
  "forfish.home.v1",
  "forfish.mapPrefs.v1",
  "forfish.maplayer.v1",
  "forfish.port.v1",
  "forfish.sea.vung-tau.v3",
];

const TRANSFER_ONLY = [
  "forfish.boat.v1",
  "forfish.boats.v1",
  "forfish.buyers.v1",
  "forfish.currentBoat.v1",
  "forfish.documents.v1",
  "forfish.maintenance.v1",
  "forfish.places.v1",
  "forfish.products.v1",
  "forfish.sdvico-boat.v1",
];

/** KHÔNG BAO GIỜ vào tệp — dù chế độ nào, dù ai thêm gì sau này */
const FORBIDDEN = [
  "forfish.crew.v1",
  "forfish.inbox.v1",
  "forfish.inbox.v2",
  "forfish.inbox.read.v1",
  "forfish.identity.v1",
  "forfish.tier.premium.v1",
  "forfish.tier.until.v1",
  "forfish.device.v1",
  "forfish.heartbeat.v1",
  "forfish.heartbeat.v2",
  "forfish.heartbeat.retry.v1",
  "forfish.heartbeat.sig.v1",
  "forfish.heartbeat.fails.v1",
  "forfish.heartbeat.5xx.v1",
];

describe("danh sách CHO PHÉP (khoá mới mặc định KHÔNG lọt)", () => {
  beforeEach(() => {
    for (const k of ALL_KEYS) localStorage.setItem(k, `V:${k}`);
  });

  it("nhồi đủ mọi mặt khoá đang sống (≥35)", () => {
    expect(ALL_KEYS.length).toBeGreaterThanOrEqual(35);
    expect(new Set(ALL_KEYS).size).toBe(ALL_KEYS.length);
  });

  it("chế độ 'Lưu dự báo ra tệp' cho ra ĐÚNG BẰNG allowlist dự báo + cài đặt", async () => {
    const parsed = parseBackup(await exportOfflineData("forecast"));
    expect(Object.keys(parsed!.ls).sort()).toEqual(FORECAST_EXPECTED);
    expect(parsed!.mode).toBe("forecast");
  });

  it("chế độ 'Chuyển sang máy mới' = dự báo + đúng 9 khoá bà con tự gõ", async () => {
    const parsed = parseBackup(await exportOfflineData("transfer"));
    expect(Object.keys(parsed!.ls).sort()).toEqual(
      [...FORECAST_EXPECTED, ...TRANSFER_ONLY].sort(),
    );
    expect(parsed!.mode).toBe("transfer");
  });

  it("mặc định (không truyền chế độ) là 'forecast' — không tự mang đồ riêng ra ngoài", async () => {
    const parsed = parseBackup(await exportOfflineData());
    expect(Object.keys(parsed!.ls).sort()).toEqual(FORECAST_EXPECTED);
  });
});

describe("CCCD · tin nhắn · mã máy · nhịp — KHÔNG vào tệp ở CẢ HAI chế độ", () => {
  beforeEach(() => {
    for (const k of ALL_KEYS) localStorage.setItem(k, `V:${k}`);
  });

  for (const mode of ["forecast", "transfer"] as const) {
    it(`chế độ ${mode}: không có khoá cấm nào trong tệp`, async () => {
      const parsed = parseBackup(await exportOfflineData(mode));
      const keys = Object.keys(parsed!.ls);
      for (const bad of FORBIDDEN) expect(keys).not.toContain(bad);
      // và luật thuần cũng phải nói y vậy (đường nào cũng chặn)
      for (const bad of FORBIDDEN) expect(isBackupable(bad, mode)).toBe(false);
    });
  }

  it("NHẬP: tệp sửa tay nhét CCCD / mã máy / nhịp → KHÔNG ghi khoá nào", async () => {
    localStorage.clear();
    const ls: Record<string, string> = { "forfish.fc.grid.d3": "GRID" };
    for (const bad of FORBIDDEN) ls[bad] = "CỦA MÁY KHÁC";
    const r = await importOfflineData(
      JSON.stringify({ v: 1, savedAt: 1, mode: "transfer", ls }),
      { confirmed: true },
    );
    expect(r.keys).toBe(1);
    for (const bad of FORBIDDEN) expect(localStorage.getItem(bad)).toBeNull();
  });
});

describe("XÁC NHẬN trước khi ĐÈ", () => {
  it("chưa xác nhận → KHÔNG ghi một khoá nào", async () => {
    localStorage.clear();
    const json = JSON.stringify({
      v: 1,
      savedAt: 1,
      mode: "transfer",
      ls: { "forfish.fc.grid.d3": "GRID", "forfish.documents.v1": "[]" },
    });
    const r = await importOfflineData(json, { confirmed: false });
    expect(r.ok).toBe(false);
    expect(r.needsConfirm).toBe(true);
    expect(r.keys).toBe(0);
    expect(localStorage.getItem("forfish.fc.grid.d3")).toBeNull();
    expect(localStorage.getItem("forfish.documents.v1")).toBeNull();
  });

  it("summarizeBackup đếm ĐÚNG từng nhóm để sheet nói thật", () => {
    const b = parseBackup(
      JSON.stringify({
        v: 1,
        savedAt: 1_700_000_000_000,
        mode: "transfer",
        ls: {
          "forfish.fc.grid.d3": "GRID",
          "forfish.fc.storm.latest": "BAO",
          "forfish.documents.v1": JSON.stringify([1, 2, 3]),
          "forfish.boats.v1": JSON.stringify([1]),
          "forfish.places.v1": JSON.stringify([1, 2]),
          "forfish.crew.v1": JSON.stringify([1, 2, 3, 4]), // khoá cấm → không đếm
        },
        fish: { ok: true },
      }),
    )!;
    const s = summarizeBackup(b);
    const byId = (id: string) => s.groups.find((g) => g.id === id);
    expect(s.layers).toBe(2);
    expect(byId("forecast")?.file).toBe(2);
    expect(byId("documents")?.file).toBe(3);
    expect(byId("boats")?.file).toBe(1);
    expect(byId("places")?.file).toBe(2);
    expect(s.fish).toBe(true);
    expect(byId("fish")).toBeTruthy();
    expect(s.keys).toBe(5); // crew KHÔNG nằm trong số sẽ ghi
    // và sheet phải NÓI RA rằng sổ bạn thuyền trong tệp bị bỏ qua
    expect(s.skipped).toContain("sổ bạn thuyền (CCCD)");
  });

  /*  MỌI KHOÁ GHI ĐƯỢC PHẢI CÓ MẶT TRONG BẢNG ĐẾM (vòng soát chéo 2026-08-02).
      Bản trước sheet dựng chữ từ một danh sách GÕ TAY trong
      `pretrip-auto-notify.tsx`, thiếu `products.v1` (đồ trên tàu) và
      `buyers.v1` (SỔ NẬU VỰA + số điện thoại) ⇒ sheet hứa "Sẽ GHI ĐÈ: 12 lớp
      dự báo · 2 tàu", bà con bấm Đè, sổ mối quen bay không một lời báo.  */
  it("mọi khoá TỰ GÕ đều hiện trong bảng đếm — không sót nhóm nào", () => {
    const ls: Record<string, string> = {};
    for (const k of TRANSFER_KEYS) ls[k] = JSON.stringify([1, 2]);
    const s = summarizeBackup(
      parseBackup(JSON.stringify({ v: 1, savedAt: 1, mode: "transfer", ls }))!,
    );
    // đủ 9 khoá tự gõ → đủ 9 nhóm `personal`, không nhóm nào là khoá lạ
    expect(s.groups.filter((g) => g.kind === "personal")).toHaveLength(
      TRANSFER_KEYS.length,
    );
    expect(s.groups.filter((g) => g.unknown)).toEqual([]);
    // KHÔNG nhóm nào được mang tên khoá thô (dấu hiệu quên khai nhóm)
    for (const g of s.groups) expect(g.name.startsWith("forfish.")).toBe(false);
  });

  it("đếm CẢ HAI VẾ: tệp có 3 giấy mà máy đang có 12 → nói rõ mất 9", () => {
    localStorage.clear();
    localStorage.setItem("forfish.documents.v1", JSON.stringify(Array(12).fill(1)));
    const s = summarizeBackup(
      parseBackup(
        JSON.stringify({
          v: 1,
          savedAt: 1,
          mode: "transfer",
          ls: { "forfish.documents.v1": JSON.stringify([1, 2, 3]) },
        }),
      )!,
    );
    const g = s.groups.find((x) => x.id === "documents")!;
    expect(g.file).toBe(3);
    expect(g.device).toBe(12);
    expect(g.lost).toBe(9);
  });

  /*  ĐẢO CHIỀU MẶC ĐỊNH CỦA TỆP ĐỜI CŨ (sửa 2026-08-02, vòng soát chéo).
      Ca này TRƯỚC ĐÂY tên là "tệp ĐỜI CŨ vẫn phục hồi được đồ tự gõ" và khoá
      cứng `mode` mặc định = `transfer`. Nhưng MỌI tệp đang lưu hành trên máy bà
      con đều là tệp đời cũ, mà họ AirDrop/Zalo tệp cho nhau vì tưởng là "chuyện
      dự báo" ⇒ tủ giấy tờ, danh sách tàu, đồ trên tàu và SỔ MỐI QUEN của người
      gửi ghi đè máy người nhận, sheet không nói đó là đồ người khác. Nay tệp
      thiếu `mode` = `forecast` (hẹp nhất), và phần đồ tự gõ trong đó phải được
      NÓI THẲNG là bị bỏ qua.  */
  it("tệp ĐỜI CŨ (không có mode) chỉ phục hồi DỰ BÁO, và nói rõ đã bỏ qua gì", async () => {
    localStorage.clear();
    const json = JSON.stringify({
      v: 1,
      savedAt: 1,
      ls: {
        "forfish.fc.grid.d3": "GRID",
        "forfish.documents.v1": "[]",
        "forfish.buyers.v1": "[]",
        "forfish.crew.v1": "CCCD",
        "forfish.device.v1": "MÃ MÁY",
      },
    });
    const s = summarizeBackup(parseBackup(json)!);
    expect(s.mode).toBe("forecast");
    expect(s.skipped).toContain("tủ giấy tờ");
    expect(s.skipped).toContain("sổ mối quen (nậu vựa + số điện thoại)");
    expect(s.skipped).toContain("sổ bạn thuyền (CCCD)");
    expect(s.skipped).toContain("mã máy");

    const r = await importOfflineData(json, { confirmed: true });
    expect(r.keys).toBe(1);
    expect(localStorage.getItem("forfish.fc.grid.d3")).toBe("GRID");
    // đồ RIÊNG của máy người gửi KHÔNG được đổ vào máy người nhận
    expect(localStorage.getItem("forfish.documents.v1")).toBeNull();
    expect(localStorage.getItem("forfish.buyers.v1")).toBeNull();
    expect(localStorage.getItem("forfish.crew.v1")).toBeNull();
    expect(localStorage.getItem("forfish.device.v1")).toBeNull();
  });
});

/*  BẢN ĐỒ CÁ TRONG TỆP SAO LƯU — chỉ nhận bản CÒN DÙNG ĐƯỢC (audit B7).
    Kho service worker có thể đang giữ một phản hồi `{ok:false}` (từ thời route
    trả 200 kèm lỗi — nay đã sửa thành 503, nhưng máy bà con vẫn còn bản cũ).
    Gói rác vào tệp rồi phục hồi = ghi rác đè lên bản DUY NHẤT của lớp cá.  */
describe("phần bản đồ cá trong tệp", () => {
  type FakeCache = {
    match: (u: unknown) => Promise<Response | undefined>;
    put: (u: unknown, r: Response) => Promise<void>;
  };
  function fakeCaches(initial: unknown): { store: { value: unknown } } {
    const store = { value: initial };
    const cache: FakeCache = {
      match: async () =>
        store.value === undefined
          ? undefined
          : new Response(JSON.stringify(store.value)),
      put: async (_u, r) => {
        store.value = await r.json();
      },
    };
    (globalThis as unknown as { caches: unknown }).caches = {
      open: async () => cache,
    };
    return { store };
  }

  it("XUẤT: bỏ qua bản {ok:false} trong kho", async () => {
    fakeCaches({ ok: false });
    const parsed = parseBackup(await exportOfflineData());
    expect(parsed?.fish).toBeUndefined();
    delete (globalThis as unknown as { caches?: unknown }).caches;
  });

  it("XUẤT: gói bản {ok:true}", async () => {
    fakeCaches({ ok: true, cells: [1] });
    const parsed = parseBackup(await exportOfflineData());
    expect(parsed?.fish).toMatchObject({ ok: true });
    delete (globalThis as unknown as { caches?: unknown }).caches;
  });

  it("NHẬP: tệp mang {ok:false} KHÔNG được đè lên bản tốt đang có", async () => {
    const { store } = fakeCaches({ ok: true, cells: [1] });
    const r = await importOfflineData(
      JSON.stringify({ v: 1, savedAt: 1, ls: {}, fish: { ok: false } }),
      { confirmed: true },
    );
    expect(r.fishRestored).toBe(false);
    expect(store.value).toMatchObject({ ok: true }); // bản tốt còn nguyên
    delete (globalThis as unknown as { caches?: unknown }).caches;
  });

  it("NHẬP: tệp mang bản tốt thì ghi vào kho", async () => {
    /*  `new Request("/api/…")` cần base URL: trình duyệt lấy từ document, còn
        môi trường test node thì ném. Thay tạm bằng một lớp tối giản để test đo
        đúng thứ cần đo (có ghi vào kho không), không đo chuyện base URL. */
    const RealRequest = globalThis.Request;
    (globalThis as unknown as { Request: unknown }).Request = class {
      url: string;
      constructor(u: string) {
        this.url = u;
      }
    };
    const { store } = fakeCaches({ ok: true, cells: [1] });
    try {
      const r = await importOfflineData(
        JSON.stringify({
          v: 1,
          savedAt: 1,
          ls: {},
          fish: { ok: true, cells: [9] },
        }),
        { confirmed: true },
      );
      expect(r.fishRestored).toBe(true);
      expect(store.value).toMatchObject({ cells: [9] });
    } finally {
      (globalThis as unknown as { Request: unknown }).Request = RealRequest;
      delete (globalThis as unknown as { caches?: unknown }).caches;
    }
  });
});

/*  ============================================================================
    CỔNG QUÉT `src/` — RATCHET THẬT (2026-08-02, vòng soát chéo).

    Cụm test phía trên tự nhận là ratchet ("thêm khoá mới là ĐỎ") nhưng nó chỉ
    so `ALL_KEYS` — một danh sách gõ tay TRONG file test — với chính danh sách
    cho phép. Thử lách: thêm `forfish.crewsecret.v1` + `localStorage.setItem`
    vào một file `src/lib/` rồi chạy `npx vitest run` ⇒ 1511/1511 VẪN XANH. Khoá
    mới chui vào tệp sao lưu (nếu tên nó bắt đầu bằng `forfish.fc.`) hoặc lặng
    lẽ nằm ngoài mọi phân loại mà không ai phải trả lời câu "chia cho máy khác
    có sao không".

    Cổng này đọc MÃ NGUỒN THẬT: moi mọi chuỗi `"forfish.…"` trong `src/` (trừ
    thư mục test), rồi đòi mỗi khoá phải rơi vào ĐÚNG MỘT ô:
      · dự báo / cài đặt xem / đồ tự gõ  → vào tệp (allowlist trong lib)
      · `NEVER_BACKUP_PREFIXES`          → cấm tuyệt đối
      · `EXCLUDED`                        → cố ý bỏ, KÈM LÝ DO ghi ngay dưới đây
    Chưa xếp loại ⇒ ĐỎ. Muốn xanh thì phải tự tay khai, tức là phải đọc và trả
    lời câu hỏi kia — đó là toàn bộ mục đích.

    Cổng quét-bằng-chữ mà không có CA ĐỐI CHỨNG thì chết câm là xanh vĩnh viễn
    (bài học đã ghi ở `no-bare-abort-timeout.test.ts`), nên bên dưới có đủ:
    (a) bộ moi khoá phải BẮT ĐƯỢC một khoá lạ trong chuỗi mẫu;
    (b) khoá lạ phải rơi vào ô "chưa xếp loại";
    (c) số khoá quét được > 20 và số file quét được > 50 — đường dẫn không lệch.
    ========================================================================= */

/** Khoá `forfish.*` CỐ Ý không vào tệp, kèm lý do (đọc được ở đây, không phải đoán) */
const EXCLUDED: Array<[string, string]> = [
  [
    "forfish.installNudge.dismissed.v1",
    "máy MỚI chưa cài mà đã tắt lời nhắc cài",
  ],
  [
    "forfish.installNudge.v2",
    "đếm số lần nhắc cài + đã tắt (2026-08-18 S7) — cùng lý do với khoá cũ: chuyện của MÁY NÀY, chép sang máy mới là im lời nhắc cài đúng máy cần nhắc",
  ],
  ["forfish.pwa-frame.", "số đo màn hình MÁY KHÁC — đè vào là lệch khung"],
  [
    "forfish.pretrip.lastRunAt.v1",
    "mốc tải sẵn: đè vào là khoá 6 giờ, máy vừa phục hồi không tự kéo dự báo mới",
  ],
  [
    "forfish.trips.v1",
    "sổ chuyến biển đã BỎ 2026-07-27, khoá chỉ còn trong cascade xoá tàu",
  ],
  [
    "forfish.kicked.v1",
    "mốc MÁY NÀY bị máy khác đăng nhập đá (2026-08-18 G1) — chép sang máy khác là bật thẻ đỏ 'bị đá' cho máy chưa từng bị; đăng nhập lại là tự xoá",
  ],
];

type KeyClass =
  | "forecast"
  | "settings"
  | "transfer"
  | "never"
  | "excluded"
  | "unclassified";

function classifyKey(k: string): KeyClass {
  if (FORECAST_PREFIXES.some((p) => k.startsWith(p))) return "forecast";
  if (SETTINGS_KEYS.includes(k)) return "settings";
  if (TRANSFER_KEYS.includes(k)) return "transfer";
  if (NEVER_BACKUP_PREFIXES.some((p) => k.startsWith(p))) return "never";
  for (const [pat] of EXCLUDED) {
    if (pat.endsWith(".") ? k.startsWith(pat) : k === pat) return "excluded";
  }
  return "unclassified";
}

/**
 * Moi mọi khoá `forfish.…` nằm trong chuỗi/ template của một file mã.
 * Template `` `forfish.sea.${port}.v3` `` cho ra phần CỐ ĐỊNH `forfish.sea.` —
 * đủ để đối chiếu với danh sách theo tiền tố.
 */
function extractKeys(src: string): string[] {
  const out = new Set<string>();
  for (const m of src.matchAll(/["'`]forfish\.[A-Za-z0-9._-]*/g)) {
    const k = m[0].slice(1);
    if (k.length > "forfish.".length) out.add(k);
  }
  return [...out];
}

function walkSrc(dir: string, hit: (f: string) => void): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name === "__tests__") continue; // fixture của test không phải mã chạy thật
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkSrc(p, hit);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) hit(p);
  }
}

describe("CỔNG QUÉT src/ — mọi khoá forfish.* phải được xếp loại", () => {
  const files: string[] = [];
  walkSrc(join(process.cwd(), "src"), (f) => files.push(f));
  const found = new Map<string, string[]>(); // khoá → file nhắc tới
  for (const f of files) {
    for (const k of extractKeys(readFileSync(f, "utf8"))) {
      found.set(k, [...(found.get(k) ?? []), f]);
    }
  }

  it("CA ĐỐI CHỨNG: bộ moi khoá bắt được khoá lạ trong mã", () => {
    const sample = [
      'const K = "forfish.crewsecret.v1";',
      "localStorage.setItem(K, JSON.stringify(x));",
      "const g = `forfish.sea.${port}.v3`;",
    ].join("\n");
    const keys = extractKeys(sample);
    expect(keys).toContain("forfish.crewsecret.v1");
    expect(keys).toContain("forfish.sea.");
  });

  it("CA ĐỐI CHỨNG: khoá lạ rơi vào ô 'chưa xếp loại'", () => {
    expect(classifyKey("forfish.crewsecret.v1")).toBe("unclassified");
    // còn khoá đã khai thì KHÔNG được rơi vào đó (cổng không báo bừa)
    expect(classifyKey("forfish.fc.grid.d3")).toBe("forecast");
    expect(classifyKey("forfish.buyers.v1")).toBe("transfer");
    expect(classifyKey("forfish.crew.v1")).toBe("never");
    expect(classifyKey("forfish.trips.v1")).toBe("excluded");
  });

  it("CA ĐỐI CHỨNG: quét được đủ file + đủ khoá (đường dẫn không lệch)", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(found.size).toBeGreaterThan(20);
  });

  it("KHÔNG khoá forfish.* nào trong src/ còn chưa xếp loại", () => {
    const bad: string[] = [];
    for (const [k, fs] of found) {
      if (classifyKey(k) === "unclassified") bad.push(`${k}  (${fs.join(", ")})`);
    }
    expect(
      bad,
      [
        "Khoá `forfish.*` mới chưa được xếp loại. Trả lời câu hỏi:",
        '"khoá này chia cho MÁY KHÁC có sao không?" rồi khai vào ĐÚNG một chỗ:',
        "  · vào tệp được → FORECAST_PREFIXES / SETTINGS_KEYS / TRANSFER_KEYS",
        "    (lib/offline-backup.ts) + khai nhóm hiển thị ở PERSONAL_SPECS",
        "  · KHÔNG BAO GIỜ vào tệp → NEVER_BACKUP_PREFIXES (lib/offline-backup.ts)",
        "  · cố ý bỏ → EXCLUDED trong file test này, KÈM LÝ DO",
        "",
        bad.join("\n"),
      ].join("\n"),
    ).toEqual([]);
  });
});

/*  DANH SÁCH CẤM TỰ NÓ PHẢI CHẶN — không nhờ allowlist đỡ hộ.
    Thử lách: bỏ `"forfish.crew."` khỏi `NEVER_BACKUP_PREFIXES` ⇒ mọi ca cũ VẪN
    XANH, vì `isBackupable` xong đã bị allowlist chặn rồi. Nghĩa là LỚP HAI —
    lớp duy nhất còn đứng nếu ai đó lỡ thêm `crew.v1` vào TRANSFER_KEYS — chưa
    hề được đo. Ca dưới đây soi thẳng vào danh sách.  */
describe("NEVER_BACKUP_PREFIXES tự nó", () => {
  const MUST_BLOCK = [
    "forfish.crew.v1",
    "forfish.crew.warn.v1",
    "forfish.inbox.v2",
    "forfish.inbox.read.v1",
    "forfish.identity.v1",
    "forfish.tier.premium.v1",
    "forfish.device.v1",
    "forfish.heartbeat.5xx.v1",
  ];

  it("chặn thẳng CCCD · hộp thư · tài khoản · tier · mã máy · nhịp", () => {
    for (const k of MUST_BLOCK) {
      expect(
        NEVER_BACKUP_PREFIXES.some((p) => k.startsWith(p)),
        `${k} phải bị NEVER_BACKUP_PREFIXES chặn (đừng dựa vào allowlist đỡ hộ)`,
      ).toBe(true);
    }
  });

  it("khoá cấm KHÔNG được đồng thời nằm trong danh sách cho phép", () => {
    const allow = [...SETTINGS_KEYS, ...TRANSFER_KEYS];
    for (const k of allow) {
      expect(
        NEVER_BACKUP_PREFIXES.some((p) => k.startsWith(p)),
        `${k} vừa cho phép vừa cấm — hai danh sách đang đá nhau`,
      ).toBe(false);
    }
    // và mọi khoá tự gõ đều phải có NHÓM HIỂN THỊ (quên khai = sheet in tên thô)
    for (const k of allow) expect(backupGroupSpec(k).unknown).toBeFalsy();
  });
});
