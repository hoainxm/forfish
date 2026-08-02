import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*  CỔNG CHẶN KHUÔN K1 — "MỌI NHÁNH CỦA SERVICE WORKER PHẢI CÓ ĐỒNG HỒ".

    Ca hại nhất ngoài khơi KHÔNG phải mất sóng hẳn — mất sóng hẳn thì `fetch`
    reject ngay và `.catch` cứu được. Ca hại là **"sóng sống mà chết"** (cách bờ
    40–60 hải lý: bắt tay được, có IP, nhưng không gói tin nào ra internet):
    `fetch` **treo, không resolve, không reject** ⇒ `.catch` KHÔNG BAO GIỜ chạy
    ⇒ promise trong `respondWith` không settle ⇒ màn hình đứng tới lúc trình
    duyệt tự bỏ cuộc (Chrome ~300 giây, iOS lâu hơn).

    Đã dính đúng khuôn này 3 đợt liên tiếp, mỗi đợt vá được một nhánh rồi đợt
    sau lại lộ ra nhánh khác (điều hướng 2026-07-31 → RSC 2026-08-01 → asset +
    ô bản đồ + /api 2026-08-02). Test này đọc thẳng `public/sw.js` và bắt lại cả
    khuôn, để lần thứ tư không phải chờ một chuyến biển mới phát hiện.

    Vì sao test bằng CHỮ chứ không chạy thật: `sw.js` là script service worker
    thuần (`self.addEventListener`), không import được vào vitest. Cùng cách với
    `sw-cache-policy.test.ts` và `push-message.test.ts` đang dùng.  */

const SW = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

/** Bỏ comment — file này giải thích chính khuôn lỗi bằng lời, quét thô sẽ nhầm */
const CODE = SW.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("service worker — mọi nhánh mạng phải có trần thời gian", () => {
  const clocks = [
    ["NAV_NETWORK_MS", "điều hướng"],
    ["NAV_GIVEUP_MS", "điều hướng — trang chưa có trong kho"],
    ["RSC_NETWORK_MS", "nội dung trang khi bấm dock (?_rsc=)"],
    ["ASSET_NETWORK_MS", "asset tĩnh (JS · CSS · font · /data)"],
    ["API_STALE_MS", "/api/* — có bản lưu thì đừng bắt chờ"],
    ["TILE_NETWORK_MS", "ô bản đồ"],
    ["ACK_TIMEOUT_MS", "biên nhận thông báo"],
  ] as const;

  for (const [name, what] of clocks) {
    it(`có đồng hồ cho ${what} (${name})`, () => {
      expect(new RegExp(`const ${name}\\s*=\\s*\\d+`).test(CODE)).toBe(true);
    });
  }

  it("mọi hằng đồng hồ đều ĐƯỢC DÙNG, không phải khai cho có", () => {
    for (const [name] of clocks) {
      const uses = CODE.split(name).length - 1;
      expect(uses, `${name} khai rồi bỏ đó`).toBeGreaterThan(1);
    }
  });

  it("KHÔNG còn nhánh asset trả thẳng `net` không qua đua đồng hồ (lỗi C-3)", () => {
    // hình dạng chính xác của lỗi cũ: `if (!isRsc) return net;`
    expect(/if\s*\(\s*!isRsc\s*\)\s*return\s+net\s*;/.test(CODE)).toBe(false);
  });

  it("trần asset phải RỘNG hơn trần điều hướng — chunk 1 MB trên 3G là chính đáng", () => {
    const num = (n: string) =>
      Number(new RegExp(`const ${n}\\s*=\\s*(\\d+)`).exec(CODE)?.[1]);
    expect(num("ASSET_NETWORK_MS")).toBeGreaterThan(num("NAV_NETWORK_MS"));
    expect(num("ASSET_NETWORK_MS")).toBeGreaterThan(num("RSC_NETWORK_MS"));
  });

  it("mọi cú ghi kho đi qua keepAlive (nằm trong waitUntil, iOS giết SW rất sớm)", () => {
    expect(/function keepAlive\(/.test(CODE)).toBe(true);
    // không còn kiểu bắn-rồi-quên `.then((c) => c.put(` ngoài keepAlive
    const puts = CODE.split("c.put(").length - 1;
    const keeps = CODE.split("keepAlive(").length - 1;
    expect(keeps, "số lần keepAlive quá ít so với số cú put").toBeGreaterThan(
      3,
    );
    expect(puts).toBeGreaterThan(0);
  });

  it("install dùng KHO TẠM, không ghi thẳng vào kho đang phục vụ (lỗi C-2)", () => {
    expect(/const SDFISH_STAGE_V\s*=/.test(CODE)).toBe(true);
    // `addAll` của vỏ sống-còn phải nhắm vào kho tạm
    expect(/stage\.addAll\(/.test(CODE)).toBe(true);
  });

  it("hai fontstack của bản đồ đều nằm trong vỏ sống-còn (lỗi A9)", () => {
    expect(CODE).toContain("/fonts/Noto%20Sans%20Regular/0-255.pbf");
    expect(CODE).toContain("/fonts/Noto%20Sans%20Bold/0-255.pbf");
  });

  it("mọi đồng hồ đi qua raceTimeout — có dọn timer, không để treo", () => {
    expect(/function raceTimeout\(/.test(CODE)).toBe(true);
    expect(/clearTimeout\(id\)/.test(CODE)).toBe(true);
    // không còn nhánh nào tự dựng đồng hồ rồi bỏ đó
    expect(/new Promise\(\(resolve\) => setTimeout\(resolve,/.test(CODE)).toBe(
      false,
    );
  });
});

/*  HỒI QUY 2026-08-02b — soát chéo bắt được, phải khoá lại.
    Bản vá C-2 (kho tạm lúc cài) suýt nữa tự tạo ra đúng loại lời-hứa-dối mà nó
    được viết ra để diệt: nhóm "có thì tốt" ăn-thua-đủ-cả-cụm, chỉ một chunk
    trượt là bốn màn dock KHÔNG được ghi vào kho. Ở máy đã cài rồi thì "giữ bản
    cũ" là đúng; ở LẦN CÀI ĐẦU TIÊN thì chẳng có bản cũ nào để giữ — kết quả là
    giữa biển bấm Tàu cá để lấy giấy tờ trình biên phòng thì rơi về Trang chủ,
    suốt cả chuyến, mà chip vẫn báo "sẵn sàng đi biển".  */
describe("service worker — cài đặt không được bỏ rơi bốn màn dock", () => {
  it("chỉ nhường cho bản cũ khi bản cũ THẬT SỰ có trong kho", () => {
    // hình dạng lỗi: bỏ qua trang mà không hỏi kho
    expect(
      /if \(!optRes\.ok && !u\.includes\("\."\)\) continue;/.test(CODE),
      "lại bỏ trang dock mà không kiểm kho",
    ).toBe(false);
    expect(/await c\.match\(u\)\)\) continue;/.test(CODE)).toBe(true);
  });

  it("nhóm phụ có ngân sách RIÊNG, nhỏ hơn ngân sách vỏ sống-còn", () => {
    const num = (n: string) =>
      Number(new RegExp(`const ${n}\\s*=\\s*(\\d+)`).exec(CODE)?.[1]);
    expect(num("OPTIONAL_PRECACHE_MAX_MS")).toBeGreaterThan(0);
    expect(num("OPTIONAL_PRECACHE_MAX_MS")).toBeLessThan(
      num("PRECACHE_MAX_MS"),
    );
  });

  it("bốn màn dock nằm trong danh sách dấu 'vỏ đã đủ' (chip không được nói dối)", () => {
    expect(/dockInCache/.test(CODE)).toBe(true);
    expect(
      /urls: \[\.\.\.CRITICAL_SHELL, \.\.\.critical\.urls, \.\.\.dockInCache\]/.test(
        CODE,
      ),
    ).toBe(true);
  });

  it("hết giờ mà KHÔNG còn việc thì vẫn tính là xong", () => {
    // `ok: !timedOut` thô làm mẻ 100% chunk đã có sẵn cũng bị gắn hỏng
    expect(/ok: !timedOut/.test(CODE)).toBe(false);
    expect(/timedOut && wave\.length > 0/.test(CODE)).toBe(true);
  });

  it("install hỏng thì dọn kho tạm, không để lại rác trên máy", () => {
    expect(/installShellClean/.test(CODE)).toBe(true);
  });
});
