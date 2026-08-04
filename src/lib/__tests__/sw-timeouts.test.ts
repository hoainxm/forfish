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
    `sw-cache-policy.test.ts` và `push-message.test.ts` đang dùng.

    ⚠️ TEST BẰNG CHỮ KHÔNG BẮT ĐƯỢC LỖI CÚ PHÁP: bộ này vẫn XANH trên một
    `sw.js` gãy. Cổng cú pháp là `node --check public/sw.js` trong
    `.github/workflows/ci.yml` — đừng gỡ bước đó.  */

const SW = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

/*  BỘ DÒ DUY NHẤT, QUÉT MỘT LƯỢT THEO TRẠNG THÁI (viết lại 2026-08-02c).

    LỖI ĐÃ SỬA — bộ dò cũ MÙ và cổng không biết: nó chạy hai lượt `replace`,
    lượt comment KHỐI TRƯỚC lượt comment DÒNG. Trong `sw.js` có những dòng
    `// … /api/… ` — chuỗi `/*`-giả đó nằm trong comment DÒNG nhưng lượt đầu
    thấy nó là DẤU MỞ KHỐI và nuốt tới `*​/` kế tiếp, tức nuốt luôn MÃ THẬT ở
    giữa. Đo được lúc phát hiện: `sw.js` 57.174 ký tự · bản lọc cũ 19.046 ·
    bản lọc "chữa cháy" 19.694 ⇒ 648 ký tự mã thật bị nuốt, mất nguyên một lời
    gọi `putWithRoom(`. File test khi đó ĐÃ BIẾT lỗi (nó đẻ ra `CODE_COUNT` để
    chữa cho các phép ĐẾM) nhưng `describe` đầu vẫn xài bản mù.

    Nay: một lượt trái-sang-phải, `//` và `/*` cái nào tới trước thì cái đó
    thắng — đúng như engine JS đọc. Một bộ dò cho cả file, không còn cặp lệch
    nhau. Giữ lại xuống dòng để số dòng và các regex có `\n` không đổi nghĩa. */
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === "//") {
      const nl = src.indexOf("\n", i);
      i = nl === -1 ? src.length : nl;
      continue;
    }
    if (two === "/*") {
      const end = src.indexOf("*/", i + 2);
      const chunk = src.slice(i, end === -1 ? src.length : end + 2);
      // giữ nguyên số dòng
      out += chunk.replace(/[^\n]/g, "");
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    out += src[i];
    i += 1;
  }
  return out;
}

const CODE = stripComments(SW);

/** Thân của một `function TÊN(...) { … }` (cân ngoặc nhọn). */
function fnBody(src: string, name: string): string | null {
  const m = new RegExp(`function ${name}\\s*\\(`).exec(src);
  if (!m) return null;
  const open = src.indexOf("{", m.index);
  if (open === -1) return null;
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, j + 1);
    }
  }
  return null;
}

/** Mọi đối số của các lời gọi `needle` (needle phải kết bằng "("), cân ngoặc. */
function callArgs(src: string, needle: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const i = src.indexOf(needle, from);
    if (i === -1) break;
    let j = i + needle.length;
    let depth = 1;
    while (j < src.length && depth > 0) {
      if (src[j] === "(") depth++;
      else if (src[j] === ")") depth--;
      j++;
    }
    out.push(src.slice(i + needle.length, j - 1));
    from = j;
  }
  return out;
}

/*  Thân THẬT của một nhánh `event.respondWith(...)`. Đối số có thể là một lời
    gọi hàm (`tileFirst(event)`) — lúc đó phải lần vào thân hàm đó, không thì
    cổng chỉ nhìn thấy 12 ký tự và tưởng nhánh nào cũng đạt. */
function branchBody(arg: string): string {
  const m = /^\s*([A-Za-z_$][\w$]*)\s*\(/.exec(arg);
  const callee = m ? fnBody(CODE, m[1]) : null;
  // GHÉP cả hai: đối số có thể tự nó là cuộc đua (`raceTimeout(net, …).then`),
  // và lúc đó `m[1]` lại trỏ đúng vào thân `raceTimeout` — thân đó dĩ nhiên
  // không chứa chữ "raceTimeout(" nên trả riêng nó là cổng kêu oan.
  return callee ? `${arg}\n${callee}` : arg;
}

const BRANCHES = callArgs(CODE, "event.respondWith(");

/*  CA ĐỐI CHỨNG — CỔNG KHÔNG ĐƯỢC CHẾT CÂM (thêm 2026-08-02c).
    Ba ca dưới đây không kiểm `sw.js` làm đúng hay sai; chúng kiểm CHÍNH BỘ DÒ
    còn nhìn thấy gì. Trước đây thiếu chúng nên bộ dò nuốt mất 648 ký tự mã mà
    26/26 vẫn xanh, và ca "KHÔNG còn nhánh asset trả thẳng net" vẫn xanh trên
    một `sw.js` RỖNG (assert `.toBe(false)` là vacuous — rỗng thì cái gì cũng
    "không có").  */
describe("cổng tự soi — bộ dò còn nhìn thấy mã không", () => {
  it("đọc được sw.js thật, không phải file rỗng/cụt", () => {
    expect(SW.length, "sw.js ngắn bất thường — đọc nhầm file?").toBeGreaterThan(
      40000,
    );
    // bỏ comment xong vẫn phải còn KHỐI LƯỢNG MÃ đáng kể
    expect(CODE.length).toBeGreaterThan(15000);
    // và còn nguyên các mốc mã (không bị nuốt như bộ dò cũ)
    for (const landmark of [
      'self.addEventListener("fetch"',
      'self.addEventListener("install"',
      "async function putWithRoom(",
      "function raceTimeout(",
      "const API_CACHE_ALLOW",
    ]) {
      expect(CODE, `bộ dò nuốt mất mốc mã: ${landmark}`).toContain(landmark);
    }
  });

  it("bộ dò không nhầm `/*` NẰM TRONG comment dòng là dấu mở khối", () => {
    const sample = [
      "keep1();",
      "// ghi chú nhắc tới /* trông như mở khối",
      "keep2();",
      "/* khối thật",
      "   còn trong khối */",
      "keep3();",
    ].join("\n");
    const cleaned = stripComments(sample);
    expect(cleaned).toContain("keep1()");
    expect(cleaned, "mã thật bị nuốt — đúng lỗi của bộ dò cũ").toContain(
      "keep2()",
    );
    expect(cleaned).toContain("keep3()");
    expect(cleaned).not.toContain("ghi chú");
    expect(cleaned).not.toContain("khối thật");

    // và chứng minh bộ dò CŨ (khối trước, dòng sau) mù đúng chỗ đó
    const naive = sample
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(naive, "bộ dò cũ lẽ ra phải mù ở đây").not.toContain("keep2()");
  });

  it("đếm được các nhánh respondWith (không phải 0 nhánh rồi kêu xanh)", () => {
    expect(BRANCHES.length).toBeGreaterThan(0);
    // bốn nhánh: ô bản đồ · điều hướng · /api · asset tĩnh
    expect(BRANCHES.length, "số nhánh respondWith đổi — soát lại cổng").toBe(4);
    for (const b of BRANCHES) expect(b.trim().length).toBeGreaterThan(0);
  });
});

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

  /*  CỔNG HÌNH DẠNG, KHÔNG PHẢI CỔNG ĐẾM TÊN (viết lại 2026-08-02c).
      Ca cũ chỉ đòi tên hằng xuất hiện >1 lần — mà `keepAliveLate(event, net,
      TILE_NETWORK_MS)` đã dùng tên đó rồi, nên đổi
      `return raceTimeout(net, TILE_NETWORK_MS).then(…)` thành `return
      net.then(…)` là MẤT SẠCH trần thời gian của nhánh ô bản đồ mà cổng không
      nhúc nhích (đã thử lách, cổng xanh). Nay kiểm ĐỐI SỐ THẬT của các lời gọi
      đồng hồ. */
  const clockArgs = [
    ...callArgs(CODE, "raceTimeout("),
    ...callArgs(CODE, "keepAliveLate("),
    ...callArgs(CODE, "timeoutSignal("),
  ].join("\n---\n");

  for (const name of [
    "NAV_NETWORK_MS",
    "NAV_GIVEUP_MS",
    "API_STALE_MS",
    "TILE_NETWORK_MS",
    "ACK_TIMEOUT_MS",
  ]) {
    it(`${name} được TRUYỀN THẬT vào một lời gọi đồng hồ`, () => {
      expect(
        clockArgs.includes(name),
        `${name} khai rồi bỏ đó — không nhánh nào đua với nó`,
      ).toBe(true);
    });
  }

  it("RSC_NETWORK_MS / ASSET_NETWORK_MS đi vào đồng hồ qua `limitMs`", () => {
    expect(
      /const limitMs = isRsc \? RSC_NETWORK_MS : ASSET_NETWORK_MS;/.test(CODE),
    ).toBe(true);
    expect(clockArgs.includes("limitMs")).toBe(true);
  });

  /*  CỔNG THẬT CHO TRẦN THỜI GIAN: mỗi nhánh `respondWith` phải có đường trả
      về đi qua `raceTimeout(` (trực tiếp, hoặc trong thân hàm mà nó gọi).
      Ba lối lách đã thử và bị cổng này bắt ĐỎ:
       · đổi `raceTimeout(net, TILE_NETWORK_MS).then(…)` → `net.then(…)`
       · đổi `raceTimeout(net, API_STALE_MS)` → `net`
       · thêm một nhánh `event.respondWith(fetch(req))` mới, không đồng hồ  */
  it("MỌI nhánh respondWith đều đi qua raceTimeout", () => {
    for (const [i, arg] of BRANCHES.entries()) {
      const body = branchBody(arg);
      expect(
        /raceTimeout\(/.test(body),
        `nhánh respondWith #${i + 1} trả thẳng mạng, không có trần thời gian: ${arg
          .trim()
          .slice(0, 60)}`,
      ).toBe(true);
    }
  });

  /*  RATCHET (không phải cổng hình dạng): số lời gọi `raceTimeout(` chỉ được
      TĂNG. Ca trên đã gác từng nhánh; ca này gác các cuộc đua PHỤ bên trong một
      nhánh (vd cuộc đua thứ hai NAV_GIVEUP_MS của điều hướng) mà cắt đi thì
      nhánh vẫn còn một `raceTimeout` nên ca trên không thấy. Thêm cuộc đua mới
      thì NÂNG con số này lên. */
  it("ratchet: số cuộc đua đồng hồ không được giảm", () => {
    const races = CODE.split("raceTimeout(").length - 1;
    expect(races, "một cuộc đua đồng hồ vừa bị gỡ").toBeGreaterThanOrEqual(7);
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

/*  CỔNG CHẶN KHUÔN K1b — "ĐỒNG HỒ CHẶN PHẢI CHẠY ĐƯỢC TRÊN MÁY CŨ".

    Khuôn (2026-08-02c): `AbortSignal.timeout` chỉ có từ Safari 16 / Chrome 103.
    Trên iPhone còn Safari 15 và WebView Android đời cũ — đúng nhóm máy của bà
    con — lời gọi trần ném `TypeError` ngay trong `.then`, rồi `.catch(()=>{})`
    cuối chuỗi nuốt sạch ⇒ biên nhận "đã nhận"/"đã đọc" KHÔNG BAO GIỜ được gửi,
    dựng lại đúng cảnh "đọc 0" mà 0024 (1b1aeb4) vừa vá. `src/lib/abort.ts` đã
    có đường lùi cho phần app; `sw.js` không import được nên phải có bản nội bộ.  */
describe("service worker — đồng hồ chặn có đường lùi cho máy cũ", () => {
  it("có helper timeoutSignal với đường lùi AbortController", () => {
    const body = fnBody(CODE, "timeoutSignal");
    expect(body, "sw.js thiếu helper timeoutSignal").toBeTruthy();
    expect(body!).toContain("new AbortController()");
    expect(body!).toMatch(/setTimeout\(/);
    expect(body!).toMatch(/\.abort\(\)/);
  });

  it("KHÔNG còn lời gọi AbortSignal.timeout TRẦN ngoài helper", () => {
    const helper = fnBody(CODE, "timeoutSignal") ?? "";
    const total = CODE.split("AbortSignal.timeout").length - 1;
    const inHelper = helper.split("AbortSignal.timeout").length - 1;
    expect(
      total - inHelper,
      "còn chỗ gọi AbortSignal.timeout trần — máy cũ ném TypeError, lỗi bị nuốt",
    ).toBe(0);
  });

  it("cả HAI cú biên nhận (đã nhận · đã đọc) đều dùng helper", () => {
    const signals = (CODE.match(/signal: timeoutSignal\(ACK_TIMEOUT_MS\)/g) ??
      []) as string[];
    expect(signals.length).toBe(2);
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

/*  CỔNG CHẶN KHUÔN K2 — "ĐĂNG KÝ GIỮ-SỐNG PHẢI LÀM TRƯỚC KHI CUỘC ĐUA XONG".

    Khuôn (2026-08-02, audit T2 — lỗi CHẶN): mọi nhánh mạng đăng ký `keepAlive`
    BÊN TRONG `.then` của `net` ("mạng về thì cất"). Từ khi mọi nhánh đều đua
    đồng hồ, `raceTimeout` thắng ⇒ promise của `respondWith` settle ⇒ tới lúc
    `net` về thật thì `event.waitUntil` ném `InvalidStateError`, `keepAlive`
    nuốt ⇒ CÚ GHI KHO KHÔNG ĐƯỢC BẢO VỆ, bản mới có thể không bao giờ vào kho.
    Nổ dày nhất ở điều hướng (NAV_NETWORK_MS = 2500 ms).  */
describe("service worker — giữ sống cho mẻ tải về SAU đồng hồ", () => {
  it("có helper keepAliveLate, và nó BỌC THÊM một đồng hồ (đừng ghim SW sống mãi)", () => {
    expect(/function keepAliveLate\(/.test(CODE)).toBe(true);
    // raceTimeout với trần GẤP ĐÔI: `raceTimeout` cố ý không hủy fetch, nên ca
    // "sóng sống mà chết" có thể làm `net` không bao giờ settle.
    expect(
      /function keepAliveLate\(event, net, limitMs\)\s*\{\s*return keepAlive\(\s*event,\s*raceTimeout\(net, limitMs \* 2\),?\s*\);/.test(
        CODE,
      ),
      "keepAliveLate phải là keepAlive(event, raceTimeout(net, limitMs * 2))",
    ).toBe(true);
  });

  it("ĐỦ BỐN nhánh dùng nó: ô bản đồ · điều hướng · /api · asset", () => {
    const uses = CODE.split("keepAliveLate(").length - 1 - 1; // trừ chỗ khai báo
    expect(uses, "thiếu nhánh nào đó chưa đăng ký giữ-sống").toBe(4);
    // đúng bốn trần, đúng bốn nhánh
    expect(/keepAliveLate\(event, net, TILE_NETWORK_MS\)/.test(CODE)).toBe(true);
    expect(/keepAliveLate\(event, net, NAV_GIVEUP_MS\)/.test(CODE)).toBe(true);
    expect(/keepAliveLate\(event, net, API_STALE_MS\)/.test(CODE)).toBe(true);
    expect(/keepAliveLate\(event, net, limitMs\)/.test(CODE)).toBe(true);
  });
});

/*  CỔNG CHẶN KHUÔN K3 — "KHO ĐẦY THÌ DỌN THEO BYTE, KHÔNG PHẢI THEO SỐ MỤC".

    Khuôn (2026-08-02, audit T1): ba nhánh cất đều `put` rồi mới `trim`, cả cụm
    nằm trong `keepAlive` = `.catch(()=>{})` ⇒ QuotaExceeded bị nuốt sạch.
    ĐẢO THỨ TỰ KHÔNG ĐỦ: `trimCache` đếm SỐ MỤC (trần 120) trong khi payload
    lưới vài MB làm hạn ngạch cạn từ rất lâu trước khi chạm 120 ⇒ trim giải
    phóng 0 byte. Phải bắt lỗi thật, dọn theo BYTE rồi THỬ LẠI — cùng lối với
    `saveForecast` bên localStorage.

    BA HỒI QUY của chính bản vá T1, khoá lại ở đây (2026-08-02c):
     (a) hạn ngạch là của CẢ ORIGIN ⇒ dọn kho này có thể giải phóng 0 byte hữu
         ích; phải ĐO BYTE và DỪNG khi dọn không ăn thua, đừng ăn tiếp vào bản
         `/api/fish-forecast` cũ ĐANG DÙNG ĐƯỢC.
     (b) sàn cứng `Math.max(8, …)` xoá sạch kho 3 mục.
     (c) `trim` nằm sau cú ghi lại ⇒ cú ghi lại ném là `trim` KHÔNG BAO GIỜ chạy,
         tức khuôn `trim`-sau-`put` còn nguyên ở đúng ca xấu nhất.  */
describe("service worker — cất được cả khi máy gần hết chỗ", () => {
  const putBody = fnBody(CODE, "putWithRoom") ?? "";
  const reclaimBody = fnBody(CODE, "reclaimRoom") ?? "";

  it("có putWithRoom: bắt lỗi, dọn một lô, THỬ LẠI một lần", () => {
    expect(/async function putWithRoom\(/.test(CODE)).toBe(true);
    expect(putBody.length, "không cắt được thân putWithRoom").toBeGreaterThan(
      100,
    );
    expect(putBody, "putWithRoom phải bắt lỗi put").toMatch(/catch\s*\{/);
    expect(
      (putBody.match(/await c\.put\(req, \w+\)/g) ?? []).length,
      "thiếu cú ghi lại sau khi dọn",
    ).toBe(2);
    // thân phản hồi có thể đã bị `put` hỏng đọc mất → phải có bản dự phòng,
    // không thì "thử lại" luôn ném TypeError và chẳng bao giờ cất được
    expect(putBody, "thiếu bản clone dự phòng cho lần thử lại").toMatch(
      /res\.clone\(\)/,
    );
  });

  it("(c) cú ghi lại có `try` RIÊNG ⇒ trim LUÔN chạy", () => {
    // hai khối try: một cho cú ghi đầu, một cho cú ghi lại
    expect((putBody.match(/try\s*\{/g) ?? []).length).toBe(2);
    const retryAt = putBody.indexOf("await c.put(req, spare)");
    const trimAt = putBody.indexOf("if (trimFn) await trimFn(c)");
    expect(retryAt, "không tìm thấy cú ghi lại").toBeGreaterThan(0);
    expect(trimAt, "không tìm thấy bước trim").toBeGreaterThan(0);
    expect(trimAt, "trim phải nằm SAU cú ghi lại, ngoài mọi try").toBeGreaterThan(
      retryAt,
    );
    // `trimCache(c, null)` sẽ xoá SẠCH kho — phải có cửa chặn
    expect(putBody).toMatch(/max != null/);
  });

  it("(a) dọn ĐO THEO BYTE và DỪNG khi không ăn thua", () => {
    expect(/async function bodyBytes\(/.test(CODE)).toBe(true);
    const bytes = fnBody(CODE, "bodyBytes") ?? "";
    expect(bytes, "phải ước byte thật").toMatch(/content-length|blob\(\)/);
    expect(reclaimBody.length, "thiếu hàm dọn chỗ").toBeGreaterThan(80);
    expect(reclaimBody, "dọn mà không đo byte").toMatch(/freed \+= /);
    expect(reclaimBody, "thiếu điều kiện dừng khi đã đủ chỗ").toMatch(
      /freed >= needBytes/,
    );
    // dọn xong vẫn ném ⇒ sức ép ở kho KHÁC ⇒ KHÔNG được dọn vòng nữa
    expect(
      (putBody.match(/reclaimRoom\(/g) ?? []).length,
      "chỉ được dọn MỘT vòng — dọn tiếp là ăn vào bản bà con đang dùng",
    ).toBe(1);
  });

  /*  LỚP CỐ ĐỊNH KHÔNG BAO GIỜ BỊ DỌN (chủ dự án chốt 2026-08-02h: "mấy cái
      thuộc về lớp cố định thì cần gì dọn").
      Vỏ app · nền bản đồ · đường bờ · độ sâu · font đi qua `precacheOne`, tức
      `putWithRoom(store, url, res, null)` — KHÔNG trần, KHÔNG trim. Chúng không
      bao giờ cũ, và mất là app không mở nổi giữa biển; đuổi vài chục KB ở đây
      để đổi lấy một cái app không chạy là lỗ nặng. Đường dọn hợp lệ duy nhất
      của lớp này là đổi tên kho lúc deploy rồi `activate` xoá nguyên khối.
      Cổng này canh đúng cái cửa đó, vì `reclaimRoom` phục vụ CHUNG cả kho ô bản
      đồ lẫn kho vỏ — mở nhầm một lần là mất cả hai. */
  it("kho KHÔNG trần/KHÔNG trim (lớp cố định) thì KHÔNG được dọn", () => {
    /*  GÁC THEO TÊN KHO, KHÔNG GÁC THEO THAM SỐ CHỖ GỌI (siết 2026-08-02h).
        Bản đầu suy "không trần + không trim ⇒ lớp cố định" — SAI, vì
        `SDFISH_STATIC_V` có HAI chỗ ghi và chỗ thứ hai truyền
        `max = STATIC_CACHE_MAX` ⇒ evictable ⇒ chunk khung sườn vẫn bị đuổi,
        cold-start offline là trắng màn. */
    /*  ⚠️ CHỈ KHO VỎ bị chặn dọn (siết lại 2026-08-02h, vòng soát chéo).
        Bản trước chặn cả `SDFISH_STATIC_V` — kho CHUNK BĂM TÊN — và đó là lỗi
        CHẶN do chính bản vá đẻ ra: đường CÀI ĐẶT trên máy gần đầy không còn cách
        lấy chỗ ⇒ `precacheShellAssets` thấy thiếu asset ⇒ install NÉM ⇒ service
        worker mới KHÔNG BAO GIỜ activate. Chunk bản build cũ nằm trong kho đó
        đúng là thứ đáng đuổi. */
    expect(putBody, "thiếu cổng gác theo TÊN KHO").toMatch(
      /cacheName !== SDFISH_CACHE_V/,
    );
    expect(
      putBody,
      "chặn nhầm kho chunk băm tên ⇒ máy gần đầy không cài được bản mới",
    ).not.toMatch(/cacheName === SDFISH_STATIC_V/);
    /*  Mọi CHỖ GỌI phải khai tên kho, không thì cổng mù. `callArgs` chỉ lấy đối
        số của các lời gọi; phần khai báo hàm không lọt vào đây. */
    const chiChoGoi = CODE.replace(/async function putWithRoom\([^)]*\)/, "");
    const thieuTen = callArgs(chiChoGoi, "putWithRoom(").filter(
      (a) => !/SDFISH_|,\s*store\s*$/.test(a),
    );
    expect(
      thieuTen,
      `chỗ gọi putWithRoom không khai tên kho ⇒ cổng lớp cố định mù: ${thieuTen.join(" | ")}`,
    ).toEqual([]);
    const goiDon = putBody.indexOf("reclaimRoom(");
    expect(goiDon, "không tìm thấy lượt dọn").toBeGreaterThan(0);
    // lượt dọn phải nằm sau một cửa có `evictable`
    expect(
      putBody.slice(0, goiDon),
      "dọn mà không hỏi kho có được phép dọn không",
    ).toMatch(/if \(spare && evictable\)/);
  });

  it("(b) KHÔNG có sàn cứng, và không bao giờ đuổi quá NỬA kho", () => {
    expect(
      /Math\.max\(\s*8/.test(putBody + reclaimBody),
      "sàn cứng 8 quay lại — kho 3 mục sẽ bị xoá sạch",
    ).toBe(false);
    /*  SÀN nào cũng cấm, không riêng số 8: `Math.max(n, ...)` ở đây luôn là một
        sàn, và sàn thì nuốt trần bất kể n bằng mấy. */
    expect(
      /Math\.max\(/.test(reclaimBody),
      "sàn cứng (Math.max) quay lại dưới dạng khác",
    ).toBe(false);
    expect(reclaimBody, "thiếu trần nửa kho").toMatch(/keys\.length >> 1/);
    expect(reclaimBody, "kho ít mục vẫn bị đuổi").toMatch(
      /keys\.length < RECLAIM_MIN_KEYS/,
    );
    expect(reclaimBody).toMatch(/await c\.delete\(keys\[i\]\)/);
  });

  it("bản dự phòng CHỈ cho thân nhỏ — clone tee giữ trọn thân trong RAM", () => {
    expect(/const SPARE_MAX_BYTES\s*=/.test(CODE)).toBe(true);
    expect(putBody, "clone vô điều kiện = nhân đôi RAM đỉnh mọi lần ghi").toMatch(
      /need <= SPARE_MAX_BYTES \? res\.clone\(\) : null/,
    );
  });

  it("MỌI nhánh cất có trần đều đi qua nó (ô bản đồ · /api · asset · cài đặt)", () => {
    const uses = CODE.split("putWithRoom(").length - 1 - 1; // trừ chỗ khai báo
    expect(uses, "còn nhánh cất chưa dọn chỗ khi máy đầy").toBe(5);
    expect(
      /putWithRoom\(c, req, copy, null, trimTileCache, SDFISH_TILE_V\)/.test(CODE),
    ).toBe(true);
    expect(
      /putWithRoom\(c, req, copy, API_CACHE_MAX, null, SDFISH_API_V\)/.test(CODE),
    ).toBe(true);
    expect(/putWithRoom\(c, req, copy, max, null, store\)/.test(CODE)).toBe(true);
    // đường CÀI ĐẶT trên máy gần đầy — chỗ cuối cùng còn giữ khuôn `put` trần
    const pre = fnBody(CODE, "precacheOne") ?? "";
    expect(pre.length).toBeGreaterThan(80);
    expect(
      (
        pre.match(
          /putWithRoom\(store, url, \w+, null, DON_KHI_DAY, SDFISH_STATIC_V\)/g,
        ) ?? []
      ).length,
      "precacheOne còn ghi kho bằng put trần, không bắt quota",
    ).toBe(2);
    expect(/await store\.put\(/.test(pre), "còn store.put trần").toBe(false);
  });

  it("KHO VỎ tuyệt đối KHÔNG bị đuổi mục — mục cũ nhất ở đó là / và /ngu-truong", () => {
    // hình dạng cấm: đưa thẳng kho vỏ vào putWithRoom
    expect(/SDFISH_CACHE_V[\s\S]{0,80}putWithRoom\(/.test(CODE)).toBe(false);
    // nhánh asset phải có cửa "kho không trần → put thường"
    expect(/max == null/.test(CODE)).toBe(true);
  });
});

/*  CỔNG CHẶN KHUÔN K4 — "BẢN ĐÃ CHUYỂN HƯỚNG KHÔNG ĐƯỢC NẰM TRONG KHO VỎ".

    Bẫy chờ (2026-08-02, audit R11): `Cache.put` KHÔNG ném với response redirect,
    nên install nhận im lặng. Bẫy nổ LÚC PHỤC VỤ — `navigationFirst` trả một
    entry `redirected = true` cho request điều hướng (redirect mode `manual`) ⇒
    trình duyệt coi là network error ⇒ MÀN TRẮNG OFFLINE.

    SỬA 2026-08-02c (soát chéo): bản đầu gộp `!hit || hit.redirected` rồi NÉM.
    Bất biến "không cất bản redirect" thì đúng, nhưng cái giá sai: thêm một cú
    redirect lên "/" (kể cả tạm ở tầng hosting) là install HỎNG trên MỌI máy,
    MỌI lần, không một lời cảnh báo — máy mới cài thì KHÔNG CÓ VỎ NÀO. Nay tách
    hai ca: `!hit` (máy hỏng thật) vẫn NÉM; `redirected` thì bỏ qua cú cất và
    HẠ CỜ `complete` để chip nói thật.  */
describe("service worker — không cất bản đã chuyển hướng vào kho vỏ", () => {
  it("cả hai vòng copy (vỏ sống-còn + nhóm dock) đều kiểm redirected", () => {
    expect((CODE.match(/hit\.redirected/g) ?? []).length).toBe(2);
  });

  it("vỏ sống-còn: THIẾU thì ném, REDIRECT thì bỏ qua chứ không sập install", () => {
    expect(
      /if \(!hit\) \{[\s\S]{0,120}throw new Error/.test(CODE),
      "mất cú ném khi kho tạm thiếu mục sống-còn",
    ).toBe(true);
    expect(
      /if \(hit\.redirected\) \{[\s\S]{0,120}continue;/.test(CODE),
      "redirect lại làm install hỏng hẳn trên mọi máy",
    ).toBe(true);
  });

  it("redirect ⇒ chip PHẢI đỏ (bỏ qua im lặng là chip xanh trên vỏ thiếu '/')", () => {
    expect(/criticalRedirected = true;/.test(CODE)).toBe(true);
    expect(
      /complete:[\s\S]{0,160}!criticalRedirected/.test(CODE),
      "cờ redirect không đi vào `complete` — chip sẽ nói dối",
    ).toBe(true);
  });
});
