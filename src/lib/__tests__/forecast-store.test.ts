import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

/*  ═══ VÌ SAO PHẢI CÓ IndexedDB GIẢ ═══
    Node không có IndexedDB, nên `forecast-store` tự lùi về localStorage và
    TOÀN BỘ 1609 test cũ vẫn xanh mà KHÔNG chạm một dòng nào của nhánh mới. Đó
    là "xanh vì không thử", đúng thứ nguy hiểm nhất trong một mạch đổi tầng lưu
    trữ. Kho giả dưới đây cố tình cho BƠM LỖI (mở hỏng · mở treo · ghi hỏng) để
    soi mấy ca mà máy bà con mới gặp: hết chỗ đĩa, Safari riêng tư, tab khác
    đang giữ kho.  */

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

/** Nội dung "đĩa" của kho giả */
const dia = new Map<string, string>();
let moHong = false;
let moTreo = false;
let ghiHong = false;
/** bơm lỗi ĐỌC — đúng nhánh đẻ ra lỗi CHẶN nặng nhất, bản đầu không bơm được */
let docHong = false;
/** giữ giao dịch GHI chậm lại — để dựng cửa sổ di trú mà test ghi chen vào */
let ghiChamMs = 0;

type Cb = (() => void) | null;

function taoDbThat() {
  return {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => undefined,
    transaction(_n: string, mode: string) {
      const docs: Array<() => void> = [];
      const ghis: Array<() => void> = [];
      const tx = {
        oncomplete: null as Cb,
        onerror: null as Cb,
        onabort: null as Cb,
        objectStore: () => ({
          getAllKeys() {
            const r: { result?: unknown } = {};
            docs.push(() => (r.result = [...dia.keys()]));
            return r;
          },
          getAll() {
            const r: { result?: unknown } = {};
            docs.push(() => (r.result = [...dia.values()]));
            return r;
          },
          put(v: string, k: string) {
            ghis.push(() => dia.set(k, v));
          },
          delete(k: string) {
            ghis.push(() => dia.delete(k));
          },
        }),
      };
      setTimeout(() => {
        if (mode === "readwrite" && ghiHong) {
          tx.onerror?.();
          return;
        }
        if (mode === "readonly" && docHong) {
          tx.onerror?.();
          return;
        }
        for (const f of docs) f();
        for (const f of ghis) f();
        tx.oncomplete?.();
      }, mode === "readwrite" ? ghiChamMs : 0);
      return tx;
    },
  };
}

function gaKhoGia() {
  (globalThis as unknown as { indexedDB: unknown }).indexedDB = {
    open() {
      const req: {
        result?: unknown;
        onsuccess: Cb;
        onerror: Cb;
        onupgradeneeded: Cb;
        onblocked: Cb;
      } = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        onblocked: null,
      };
      if (moTreo) return req; // IM LUÔN — đúng cảnh Safari riêng tư / tab khác giữ kho
      setTimeout(() => {
        if (moHong) {
          req.onerror?.();
          return;
        }
        req.result = taoDbThat();
        req.onupgradeneeded?.();
        req.onsuccess?.();
      }, 0);
      return req;
    },
  };
}

import {
  FC_PREFIX,
  fcGet,
  fcKeys,
  fcMeta,
  fcRemove,
  fcSet,
  forecastStoreBackend,
  forecastStoreFlush,
  forecastStoreReady,
  forecastStoreState,
  subscribeForecastStore,
  __resetForecastStore,
} from "../forecast-store";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const K = `${FC_PREFIX}grid.d16`;

beforeEach(() => {
  localStorage.clear();
  dia.clear();
  moHong = false;
  moTreo = false;
  ghiHong = false;
  docHong = false;
  ghiChamMs = 0;
  gaKhoGia();
  __resetForecastStore();
});

afterEach(() => {
  vi.useRealTimers();
  __resetForecastStore();
});

describe("dời kho từ localStorage sang IndexedDB", () => {
  it("chép xuống đĩa XONG rồi mới xoá bản localStorage", async () => {
    localStorage.setItem(K, "luoi-16-ngay");
    await forecastStoreReady();
    await forecastStoreFlush();
    expect(forecastStoreBackend()).toBe("idb");
    expect(dia.get(K)).toBe("luoi-16-ngay"); // đã nằm xuống đĩa
    expect(localStorage.getItem(K)).toBeNull(); // rồi mới dọn
    expect(fcGet(K)).toBe("luoi-16-ngay"); // và vẫn đọc ra được
  });

  it("ĐĨA TỪ CHỐI thì KHÔNG xoá một bản localStorage nào", async () => {
    localStorage.setItem(K, "luoi-16-ngay");
    ghiHong = true;
    await forecastStoreReady();
    /* Luật xuyên suốt kho offline: "phải down được cái mới nó mới xoá cái cũ".
       Đĩa hỏng mà vẫn dọn localStorage là mất trắng gói 16 ngày. */
    expect(localStorage.getItem(K)).toBe("luoi-16-ngay");
    expect(fcGet(K)).toBe("luoi-16-ngay");
    expect(forecastStoreBackend()).toBe("ls");
  });

  it("bản đĩa ĐÃ CÓ thì xoá bản localStorage thừa", async () => {
    dia.set(K, "ban-tren-dia");
    localStorage.setItem(K, "ban-cu-thua");
    await forecastStoreReady();
    expect(localStorage.getItem(K)).toBeNull();
    expect(fcGet(K)).toBe("ban-tren-dia");
  });
});

describe("không bao giờ treo", () => {
  it("mở kho IM LUÔN thì hết trần chờ là lùi về localStorage", async () => {
    vi.useFakeTimers();
    moTreo = true;
    const p = forecastStoreReady();
    let xong = false;
    void p.then(() => (xong = true));
    await vi.advanceTimersByTimeAsync(4100);
    await p;
    expect(xong).toBe(true);
    expect(forecastStoreBackend()).toBe("ls");
  });

  it("mở kho hỏng thì app vẫn chạy trên localStorage", async () => {
    moHong = true;
    await forecastStoreReady();
    expect(forecastStoreBackend()).toBe("ls");
    fcSet(K, "x");
    expect(fcGet(K)).toBe("x");
    expect(localStorage.getItem(K)).toBe("x");
  });

  it("gọi ready() nhiều lượt song song chỉ nạp một lần", async () => {
    localStorage.setItem(K, "v");
    await Promise.all([
      forecastStoreReady(),
      forecastStoreReady(),
      forecastStoreReady(),
    ]);
    expect(forecastStoreBackend()).toBe("idb");
  });
});

describe("gương RAM không được nói dối", () => {
  it("flush trả TRUE khi đã nằm xuống đĩa", async () => {
    await forecastStoreReady();
    fcSet(K, "abc");
    expect(await forecastStoreFlush()).toBe(true);
    expect(dia.get(K)).toBe("abc");
  });

  it("flush trả FALSE khi đĩa từ chối — và GIỮ hàng chờ để thử lại", async () => {
    await forecastStoreReady();
    expect(forecastStoreBackend()).toBe("idb");
    ghiHong = true;
    fcSet(K, "abc");
    expect(await forecastStoreFlush()).toBe(false);
    expect(dia.has(K)).toBe(false);
    /* Đọc trong phiên này vẫn ra (gương giữ) — nhưng mẻ tải sẵn đã biết là CHƯA
       bền nhờ flush=false, nên không ghi mốc "đã tải xong". */
    expect(fcGet(K)).toBe("abc");
    // đĩa hết nghẽn ⇒ lượt sau phải ghi được, không mất bản nào
    ghiHong = false;
    expect(await forecastStoreFlush()).toBe(true);
    expect(dia.get(K)).toBe("abc");
  });
});

describe("flush hỏi ĐÚNG MẺ CỦA MÌNH", () => {
  /*  ⚠️ Tự soát vòng 6. Từ khi `xaHangChoXuongLs()` có trần 64 KB, mục LỚN ở
      lại hàng chờ vĩnh viễn trên nhánh `ls` — đúng thiết kế. Nhưng nếu `flush`
      hỏi CẢ hàng chờ thì một lưới kẹt làm dòng TIN BÃO vừa tải trót lọt cũng
      bị `runLayer` NÉM, bấm lại bao nhiêu lần cũng đỏ. */
  it("một lưới kẹt KHÔNG được làm hỏng phán quyết của tin bão", async () => {
    /*  Mục chỉ KẸT được nếu ghi trong CỬA SỔ DI TRÚ (lúc đó backend đã là
        "idb" nên `fcSet` vào hàng chờ), rồi di trú hỏng và lật về "ls". Đây
        đúng là phiên nâng cấp mà MỌI máy đi qua một lần. */
    localStorage.setItem(K, JSON.stringify({ savedAt: 1, data: {} }));
    ghiHong = true; // giao dịch di trú sẽ hỏng
    ghiChamMs = 50; // giữ cửa sổ di trú mở đủ lâu để ghi chen vào
    const p = forecastStoreReady();
    for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
    const bao = `${FC_PREFIX}storm.latest`;
    const luoi = `${FC_PREFIX}grid.d7`; // KHÁC khoá cũ đã gieo ở trên
    expect(forecastStoreBackend()).toBe("idb");
    fcSet(bao, JSON.stringify({ savedAt: 9, data: {} })); // vài chục byte
    fcSet(luoi, JSON.stringify({ savedAt: 9, data: "x".repeat(100_000) }));
    await p; // di trú hỏng ⇒ lật "ls" ⇒ xả hàng chờ (có trần 64 KB)
    expect(forecastStoreBackend()).toBe("ls");

    // tin bão nhỏ ⇒ đã xuống localStorage thật
    expect(localStorage.getItem(bao)).toContain('"savedAt":9');
    // lưới quá trần ⇒ Ở LẠI hàng chờ, KHÔNG đổ ngược vào thùng 5 MB
    expect(localStorage.getItem(luoi)).toBeNull();

    // mẻ CHỈ CÓ tin bão ⇒ phải XONG, không bị lưới kẹt kéo theo
    expect(await forecastStoreFlush([bao])).toBe(true);
    // mẻ có lưới ⇒ nói THẬT là chưa bền
    expect(await forecastStoreFlush([luoi])).toBe(false);
    // hỏi cả kho ⇒ vẫn false (giữ nguyên nghĩa cũ)
    expect(await forecastStoreFlush()).toBe(false);

    /*  ⚠️ VÒNG 6 BẮT BẢN VÁ VÒNG 6 CÒN HỞ: bà con chạm "Tải lại" ĐÚNG lớp
        lưới. Nhánh `ls` ghi 100 KB xuống localStorage trót lọt — nhưng nếu mục
        cũ cùng khoá còn kẹt hàng chờ thì `conKetLai` vẫn false ⇒ dòng vẫn ĐỎ,
        bấm bao nhiêu lần cũng đỏ. Đúng khuôn "nút bấm không được gì". */
    fcSet(luoi, JSON.stringify({ savedAt: 20, data: "y".repeat(100_000) }));
    expect(localStorage.getItem(luoi)).toContain('"savedAt":20');
    expect(await forecastStoreFlush([luoi])).toBe(true);
  });
});

describe("cửa đọc / ghi", () => {
  it("gương chưa nạp thì fcGet vẫn đọc được bản còn ở localStorage", () => {
    localStorage.setItem(K, "ban-cu");
    // CỐ Ý không await ready() — đây đúng là cửa sổ lúc vừa mở app
    expect(fcGet(K)).toBe("ban-cu");
  });

  it("fcRemove xoá ở CẢ HAI kho", async () => {
    localStorage.setItem(K, "v");
    await forecastStoreReady();
    fcSet(K, "v2");
    await forecastStoreFlush();
    fcRemove(K);
    await forecastStoreFlush();
    expect(fcGet(K)).toBeNull();
    expect(localStorage.getItem(K)).toBeNull();
    expect(dia.has(K)).toBe(false);
  });

  it("fcKeys gộp cả hai kho, không trùng", async () => {
    await forecastStoreReady();
    fcSet(`${FC_PREFIX}a.1`, "x");
    localStorage.setItem(`${FC_PREFIX}b.1`, "y");
    localStorage.setItem("forfish.documents.v1", "khong-phai-du-bao");
    const ks = fcKeys().sort();
    expect(ks).toEqual([`${FC_PREFIX}a.1`, `${FC_PREFIX}b.1`]);
  });

  it("chạm TRẦN RAM thì NÉM đúng khuôn hết chỗ (không phình tới lúc bị giết)", async () => {
    await forecastStoreReady();
    // trần 12 MB ký tự ⇒ hai bản 5 MB lọt, bản thứ ba phải bị chặn
    const to = "x".repeat(5 * 1024 * 1024);
    fcSet(`${FC_PREFIX}a.1`, to);
    fcSet(`${FC_PREFIX}a.2`, to);
    expect(() => fcSet(`${FC_PREFIX}a.3`, to)).toThrow();
  });

  it("ghi ĐÈ cùng khoá không cộng dồn vào trần RAM", async () => {
    await forecastStoreReady();
    const to = "x".repeat(5 * 1024 * 1024);
    for (let i = 0; i < 8; i++) fcSet(`${FC_PREFIX}a.1`, to);
    expect(fcGet(`${FC_PREFIX}a.1`)?.length).toBe(to.length);
  });
});

/*  ═══ SỔ MỤC LỤC — TRỤ CHÍNH CỦA KIẾN TRÚC, PHẢI CÓ CỔNG GÁC ═══
    Ba ca dưới đây khoá đúng ba lỗi mà vòng soát 2026-08-02k bắt được. Không có
    chúng thì bản vá chỉ là lời hứa: kho giả bản đầu KHÔNG bơm được lỗi ĐỌC, tức
    đúng nhánh đẻ ra lỗi CHẶN nặng nhất. */
describe("sổ mục lục", () => {
  it("ĐỌC KHO HỎNG ≠ KHO RỖNG — không đè sổ, không báo 'sẵn sàng'", async () => {
    localStorage.setItem(K, JSON.stringify({ savedAt: 111, data: { a: 1 } }));
    await forecastStoreReady(); // lượt đầu: di trú xuống đĩa + dựng sổ
    await forecastStoreFlush();
    expect(fcMeta(K)?.savedAt).toBe(111);
    const soDaLuu = localStorage.getItem("forfish.fcindex.v1");
    expect(soDaLuu).toBeTruthy();

    // phiên sau: đĩa còn nguyên nhưng ĐỌC hỏng (máy bận, quá trần chờ)
    __resetForecastStore();
    docHong = true;
    await forecastStoreReady();
    /*  Sổ PHẢI còn nguyên — bản đầu đè thành "{}" nên phiên sau cũng mất nốt. */
    expect(localStorage.getItem("forfish.fcindex.v1")).toBe(soDaLuu);
    expect(fcMeta(K)?.savedAt).toBe(111);
    /*  Và TUYỆT ĐỐI không được báo "san-sang": màn Chuẩn bị đi biển chỉ được
        kết luận "máy chưa có dữ liệu" ở đúng trạng thái đó. */
    expect(forecastStoreState()).toBe("khong-mo-duoc");
  });

  it("ghi TRONG LÚC đang nạp không bị lượt nạp nuốt mất", async () => {
    dia.set(K, JSON.stringify({ savedAt: 100, data: { cu: true } }));
    const p = forecastStoreReady();
    // đúng cửa sổ nạp: /api/storms trả từ kho service worker trong ~50 ms
    fcSet(`${FC_PREFIX}storm.latest`, JSON.stringify({ savedAt: 900, data: {} }));
    await p;
    expect(fcMeta(`${FC_PREFIX}storm.latest`)?.savedAt).toBe(900);
    expect(fcMeta(K)?.savedAt).toBe(100); // bản trên đĩa vẫn còn
  });

  it("sổ ghi KHÔNG ĐƯỢC thì vẫn khai đúng, không tự xoá sạch", async () => {
    await forecastStoreReady();
    fcSet(K, JSON.stringify({ savedAt: 555, data: {} }));
    expect(fcMeta(K)?.savedAt).toBe(555);
    /*  Safari riêng tư / localStorage bị chặn ⇒ INDEX_KEY không bao giờ tồn
        tại. Bản đầu thấy vắng là nuốt sạch sổ ⇒ mọi `savedAt` về 0 ⇒ chip "đã
        cũ" vĩnh viễn và `rankedVictims` mất thứ tự "cũ trước". */
    localStorage.removeItem("forfish.fcindex.v1");
    expect(fcMeta(K)?.savedAt).toBe(555);
    expect(fcKeys()).toContain(K);
  });
});

describe("ba trạng thái phải MECE", () => {
  /*  ⚠️ ĐÂY LÀ KẼ ĐỂ LỌT MỘT LỖI CHẶN QUA BA VÒNG SOÁT (2026-08-02k).
      Bản trước suy trạng thái bằng `backend === "ls" && guong.size === 0`. Mà
      trên máy localStorage LÀ KHO THẬT (Safari riêng tư / WebView cũ), `fcSet`
      cố ý không nạp gương ⇒ `guong.size` vĩnh viễn 0 ⇒ kẹt "khong-mo-duoc"
      suốt đời máy ⇒ chip màn Chuẩn bị đi biển đứng nguyên "Đang mở kho dữ
      liệu…" mãi mãi. Không ca test nào chạm nhánh đó. */
  it("localStorage LÀ kho thật (không có IndexedDB) ⇒ vẫn 'san-sang'", async () => {
    moHong = true;
    await forecastStoreReady();
    expect(forecastStoreBackend()).toBe("ls");
    fcSet(K, JSON.stringify({ savedAt: 42, data: { a: 1 } }));
    expect(fcGet(K)).toContain('"savedAt":42');
    expect(forecastStoreState()).toBe("san-sang");
    // và phải GIỮ NGUYÊN thế ở phiên sau, không trôi dần sang "khong-mo-duoc"
    __resetForecastStore();
    moHong = true;
    await forecastStoreReady();
    expect(forecastStoreState()).toBe("san-sang");
  });

  /*  ⚠️ CỬA MÀ VÒNG 5 BẮT ĐƯỢC — 1632 test xanh KHÔNG hề chạm tới nó.
      Bộ test có bơm được `docHong` (đọc kho hỏng) nhưng KHÔNG có ca nào bơm
      `moTreo`/`moHong` KÈM SỔ MỤC LỤC CÒN DỮ LIỆU — tức đúng cửa thứ hai mà bản
      vá V1 để hở. Đây là ca thật của MỌI máy từ phiên thứ hai trở đi. */
  it("MỞ kho quá trần chờ + sổ khai có dữ liệu ⇒ 'khong-mo-duoc'", async () => {
    vi.useFakeTimers();
    // phiên 1: dựng sổ + đưa dữ liệu xuống đĩa
    localStorage.setItem(K, JSON.stringify({ savedAt: 7, data: { a: 1 } }));
    const p1 = forecastStoreReady();
    await vi.advanceTimersByTimeAsync(100);
    await p1;
    await forecastStoreFlush();
    expect(localStorage.getItem(K)).toBeNull(); // đã dọn, đúng thiết kế
    expect(fcMeta(K)?.savedAt).toBe(7); // sổ vẫn khai có

    // phiên 2: `indexedDB.open` IM LUÔN (iOS vừa đánh thức tiến trình)
    __resetForecastStore();
    moTreo = true;
    const p2 = forecastStoreReady();
    await vi.advanceTimersByTimeAsync(4100);
    await p2;
    /*  Sổ khai 1 mục mà không lấy ra được ⇒ PHẢI nói "chưa mở được kho".
        Trả "san-sang" ở đây là màn Chuẩn bị đi biển bung thẻ TO "máy chưa có
        dữ liệu đi biển" giữa biển, trong khi đĩa còn nguyên gói 16 ngày. */
    expect(forecastStoreState()).toBe("khong-mo-duoc");
  });

  it("máy mới tinh, kho rỗng ⇒ 'san-sang' (trống KHÁC hỏng)", async () => {
    await forecastStoreReady();
    expect(forecastStoreState()).toBe("san-sang");
  });

  it("lật idb→ls giữa chừng thì XẢ hàng chờ, flush không kẹt false", async () => {
    localStorage.setItem(K, JSON.stringify({ savedAt: 1, data: {} }));
    ghiHong = true; // giao dịch di trú hỏng ⇒ lật về nhánh ls
    await forecastStoreReady();
    expect(forecastStoreBackend()).toBe("ls");
    fcSet(`${FC_PREFIX}storm.latest`, JSON.stringify({ savedAt: 9, data: {} }));
    /*  Bản trước: hàng chờ còn nguyên ⇒ flush false VĨNH VIỄN ⇒ mẻ tải sẵn luôn
        kết luận "Máy hết chỗ nhớ" + khoá 6 giờ, trong khi localStorage ghi tốt. */
    expect(await forecastStoreFlush()).toBe(true);
    expect(fcGet(`${FC_PREFIX}storm.latest`)).toContain('"savedAt":9');
  });
});

describe("vòng 7 — khuôn 'nút bấm không được gì' ở tầng cuối", () => {
  it("một mục đĩa từ chối KHÔNG được kéo cả kho xuống theo", async () => {
    await forecastStoreReady();
    expect(forecastStoreBackend()).toBe("idb");
    const bao = `${FC_PREFIX}storm.latest`;
    const luoi = `${FC_PREFIX}grid.d16`;
    ghiHong = true;
    fcSet(luoi, JSON.stringify({ savedAt: 1, data: "x".repeat(1000) }));
    await forecastStoreFlush([luoi]); // hỏng — mục vào diện "đĩa từ chối hẳn"
    ghiHong = false;
    fcSet(bao, JSON.stringify({ savedAt: 2, data: {} }));
    /*  Tin bão PHẢI xuống được, dù trước đó có một mục đĩa từ chối. Bản trước
        `flush` gác bằng phán quyết TOÀN KHO nên dòng tin bão đỏ oan. */
    expect(await forecastStoreFlush([bao])).toBe(true);
    expect(dia.has(bao)).toBe(true);
  });

  it("đĩa lành lại thì mục từng bị từ chối được CỨU, không vứt đi", async () => {
    await forecastStoreReady();
    const luoi = `${FC_PREFIX}grid.d16`;
    ghiHong = true;
    fcSet(luoi, JSON.stringify({ savedAt: 1, data: "x".repeat(1000) }));
    expect(await forecastStoreFlush([luoi])).toBe(false);
    ghiHong = false;
    expect(await forecastStoreFlush([luoi])).toBe(true);
    expect(dia.has(luoi)).toBe(true);
  });

  it("kho lành lại bằng MỘT LƯỢT GHI thì màn hình được báo", async () => {
    localStorage.setItem(K, JSON.stringify({ savedAt: 1, data: {} }));
    await forecastStoreReady();
    await forecastStoreFlush();
    __resetForecastStore();
    moTreo = true;
    vi.useFakeTimers();
    const p = forecastStoreReady();
    await vi.advanceTimersByTimeAsync(4100);
    await p;
    vi.useRealTimers();
    expect(forecastStoreState()).toBe("khong-mo-duoc");
    let goi = 0;
    subscribeForecastStore(() => (goi += 1));
    expect(goi).toBe(0); // chưa mở được ⇒ ĐẬU LẠI chờ, không bắn rồi thôi
    fcSet(K, JSON.stringify({ savedAt: 9, data: {} })); // một lớp vừa tải về
    expect(forecastStoreState()).toBe("san-sang");
    expect(goi).toBe(1); // và màn hình PHẢI được báo để đọc lại
  });
});

describe("vòng 8 — cơ chế cô lập mục đĩa từ chối không được đẻ vòng lặp", () => {
  it("đĩa từ chối VĨNH VIỄN: có đáy, không quay vô tận, không mất mục nào", async () => {
    await forecastStoreReady();
    expect(forecastStoreBackend()).toBe("idb");
    ghiHong = true; // đĩa hỏng suốt
    const a = `${FC_PREFIX}point.a`;
    const b = `${FC_PREFIX}point.b`;
    fcSet(a, JSON.stringify({ savedAt: 1, data: {} }));
    fcSet(b, JSON.stringify({ savedAt: 2, data: {} }));
    // gọi flush nhiều lượt như `runLayer` vẫn làm sau TỪNG lớp
    for (let i = 0; i < 5; i++) expect(await forecastStoreFlush([a])).toBe(false);
    /*  KHÔNG mục nào được phép biến mất: đĩa từ chối thì chúng phải còn ở hàng
        chờ hoặc ở diện "đĩa từ chối hẳn", và đọc ra vẫn phải được (gương giữ). */
    expect(fcGet(a)).toContain('"savedAt":1');
    expect(fcGet(b)).toContain('"savedAt":2');

    // đĩa lành lại ⇒ CẢ HAI phải xuống được, không sót
    ghiHong = false;
    expect(await forecastStoreFlush([a, b])).toBe(true);
    expect(dia.has(a)).toBe(true);
    expect(dia.has(b)).toBe(true);
  });
});

describe("vòng 8 — mục bị đĩa từ chối KHÔNG được đông cứng", () => {
  /*  ⚠️ ĐIỂM MẤU CHỐT mà bộ test vòng 7 chưa bao giờ dựng: có MỘT LƯỢT GHI
      THÀNH CÔNG XEN GIỮA lượt hỏng và lượt `flush` kế tiếp. Đường `fcSet` đời
      thường (tin bão, giá, điểm chạm) ghi xuống đĩa qua `xepLichDay` mà KHÔNG
      kèm flush, nên khoảng giữa đó là chuyện thường ngày. */
  it("bản CŨ không được đè ngược lên bản MỚI đã nằm trên đĩa", async () => {
    await forecastStoreReady();
    const bao = `${FC_PREFIX}storm.latest`;
    ghiHong = true;
    fcSet(bao, JSON.stringify({ savedAt: 1, data: "tin-bao-cu" }));
    expect(await forecastStoreFlush([bao])).toBe(false);

    // đĩa lành, thẻ tin bão tự làm mới — KHÔNG kèm flush, đúng đường đời thường
    ghiHong = false;
    fcSet(bao, JSON.stringify({ savedAt: 2, data: "tin-bao-moi" }));
    await new Promise((r) => setTimeout(r, 80)); // để `xepLichDay` đẩy xuống
    expect(dia.get(bao)).toContain("tin-bao-moi");

    // mẻ tải sẵn kế tiếp gọi flush — TUYỆT ĐỐI không được lôi bản v1 ra đè lại
    expect(await forecastStoreFlush()).toBe(true);
    expect(dia.get(bao)).toContain("tin-bao-moi");
    expect(dia.get(bao)).not.toContain("tin-bao-cu");
  });

  /*  ⚠️ ĐIỂM MÙ CỦA CỔNG VÒNG 8: ca dưới đặt `ghiHong = false` TRƯỚC `fcRemove`,
      tức lệnh xoá luôn thành công ngay. Không ca nào để CHÍNH GIAO DỊCH XOÁ
      hỏng — mà `fcRemove` là đường dọn chỗ KHI MÁY ĐẦY, tức chạy đúng lúc giao
      dịch dễ hỏng nhất. Ca kế bên vá đúng điểm mù đó. */
  it("CHÍNH LỆNH XOÁ bị đĩa từ chối vẫn phải được thử lại", async () => {
    await forecastStoreReady();
    fcSet(K, JSON.stringify({ savedAt: 1, data: "luoi" }));
    await forecastStoreFlush();
    expect(dia.has(K)).toBe(true);

    ghiHong = true; // đĩa từ chối ĐÚNG lúc dọn chỗ
    fcRemove(K);
    expect(await forecastStoreFlush([K])).toBe(false); // nói thật: chưa xoá được

    ghiHong = false; // đĩa lành lại
    /*  Bản vòng 8 quên mất "đây là lệnh XOÁ" nên bỏ hẳn ⇒ flush trả TRUE nói
        dối, và phiên sau `nap()` đọc kho thấy K còn nguyên ⇒ mục đã xoá quay
        về, chiếm đúng chỗ mà lượt dọn tưởng đã giải phóng. */
    expect(await forecastStoreFlush([K])).toBe(true);
    expect(dia.has(K)).toBe(false);

    // và phiên sau phải KHÔNG thấy nó nữa
    __resetForecastStore();
    await forecastStoreReady();
    expect(fcGet(K)).toBeNull();
  });

  it("mục ĐÃ XOÁ không được sống lại trên đĩa", async () => {
    await forecastStoreReady();
    ghiHong = true;
    fcSet(K, JSON.stringify({ savedAt: 1, data: "luoi" }));
    expect(await forecastStoreFlush([K])).toBe(false);
    ghiHong = false;
    fcRemove(K); // đường dọn chỗ khi máy đầy — chạy ĐÚNG lúc này
    await forecastStoreFlush();
    expect(dia.has(K)).toBe(false);
    expect(fcGet(K)).toBeNull();
  });

  it("mục bị từ chối trong cửa sổ di trú KHÔNG mắc cạn trên nhánh ls", async () => {
    localStorage.setItem(K, JSON.stringify({ savedAt: 1, data: {} }));
    ghiHong = true;
    ghiChamMs = 50;
    const p = forecastStoreReady();
    for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
    const bao = `${FC_PREFIX}storm.latest`;
    fcSet(bao, JSON.stringify({ savedAt: 9, data: {} }));
    await forecastStoreFlush([bao]); // hỏng đơn-mục ⇒ vào diện "đĩa từ chối"
    await p; // di trú hỏng ⇒ lật sang nhánh ls
    expect(forecastStoreBackend()).toBe("ls");
    /*  Nhánh `ls` phải CỨU nó xuống localStorage — không thì dòng tin bão đỏ
        vĩnh viễn và bản 600 byte mất luôn. */
    expect(await forecastStoreFlush([bao])).toBe(true);
    expect(localStorage.getItem(bao)).toContain('"savedAt":9');
  });
});

describe("cổng chặn khuôn", () => {
  it("khoá kho bền của bản đồ cá phải khớp FISH_NS/FISH_ID ở fish-predict", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/fish-predict.ts"),
      "utf8",
    );
    const ns = /export const FISH_NS = "([^"]+)"/.exec(src)?.[1];
    const id = /export const FISH_ID = "([^"]+)"/.exec(src)?.[1];
    expect(ns).toBeTruthy();
    expect(id).toBeTruthy();
    const backup = readFileSync(
      join(process.cwd(), "src/lib/offline-backup.ts"),
      "utf8",
    );
    /* offline-backup CỐ Ý không import fish-predict (kéo theo cụm nguồn vệ tinh
       chạy phía máy chủ), nên hai chỗ chỉ dính nhau bằng cổng này. Lệch nhau là
       tệp sao lưu mất bản đồ cá trong im lặng. */
    expect(backup).toContain(`\`\${FC_PREFIX}${ns}.${id}\``);
  });

  it("forecast-cache KHÔNG được đụng thẳng window.localStorage nữa", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/forecast-cache.ts"),
      "utf8",
    );
    /* Còn một lượt `window.localStorage` sót lại là kho tách làm đôi: một nửa
       dự báo ở IndexedDB, một nửa ở localStorage, và luật dọn đếm nhầm cả hai. */
    const dinh = src
      .split("\n")
      .filter((l) => /window\.localStorage/.test(l) && !/^\s*(\*|\/\/)/.test(l));
    expect(dinh).toEqual([]);
  });

  it("mọi namespace dự báo phải có bậc hy sinh trong DROP_RANK", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/forecast-cache.ts"),
      "utf8",
    );
    const bang = /const DROP_RANK: Record<string, number> = \{([\s\S]*?)\n\};/
      .exec(src)?.[1];
    expect(bang).toBeTruthy();
    // `fish` = bản đồ cá đầy đủ, mới vào kho bền 2026-08-02k
    for (const ns of ["price", "point", "scalar", "grid", "fish", "storm"]) {
      expect(bang).toMatch(new RegExp(`\\b${ns}:\\s*\\d`));
    }
  });
});
