import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { DEVICE_TOKEN_HEADER } from "@/lib/device-token";
import type { AssistantReply, DeviceSnapshot } from "@/lib/assistant/types";

/*
  Khuôn dùng chung cho bộ TRỢ LÝ. Không có luật nghiệp vụ ở đây — chỉ đăng nhập
  persona, gọi route, gieo dữ liệu vào máy, và mở tấm che đúng đường bà con đi.

  Cố ý KHÔNG dùng lại `tests/e2e/san/helpers.ts` cho phần URL: file đó chốt cổng
  3031 của bộ chợ, còn bộ này chạy cổng riêng để hai bộ sống chung. Phần đo chạm
  (`tapViolations`) thì DÙNG LẠI — luật 56px là một, không được có hai bản.
*/

import { MIN_TAP, tapViolations, DEVICE_TOKEN_KEY } from "../san/helpers";

export { MIN_TAP, tapViolations, DEVICE_TOKEN_KEY };

/** Header chuỗi cứng THẬT của app (`src/lib/device-token.ts`).
 *  ⚠️ 14 §8 ghi `x-forfish-token` — sai; lấy theo hằng của code, không theo doc. */
export const TOKEN_HEADER = DEVICE_TOKEN_HEADER;

/** Persona kho file (12 §5.3) — SĐT là danh tính, không lấy từ body.
 *  Chia theo NGÂN SÁCH LƯỢT: mỗi 200 (kể cả giả lập) ăn một lượt của SĐT đó. */
export const PERSONA = {
  buyerBa: "0901000001", // basic — bảng ý định + mọi ca UI
  buyerTu: "0901000002", // premium — ca an toàn nội dung + dự báo >3 ngày
  buyerNam: "0901000003", // basic — ca đếm `remaining`
  admin: "0909000000", // ca vét quota (đếm tới hết trần)
} as const;

/** Phải khớp `ASSISTANT_DAILY_LIMIT` mà config đặt cho webServer. */
export const DAILY_LIMIT = Number(process.env.ASSISTANT_DAILY_LIMIT ?? 30);

export const BASE_URL =
  process.env.PLAYWRIGHT_TEST_BASE_URL ?? `http://localhost:${process.env.TROLY_PORT ?? 3033}`;
export const url = (p: string) => (/^https?:\/\//.test(p) ? p : `${BASE_URL}${p}`);

export const TROLY_PATH = "/api/tro-ly";

export interface ApiRes<T = Record<string, unknown>> {
  status: number;
  headers: Record<string, string>;
  body: T & { ok?: boolean; code?: string; reply?: AssistantReply; remaining?: number };
  /** Nguyên văn để khẳng định "máy chủ KHÔNG nhắc lại chuỗi nhạy cảm". */
  raw: string;
}

/** Gọi route JSON. KHÔNG ném khi lỗi HTTP — ca tự khẳng định status + code. */
export async function call<T = Record<string, unknown>>(
  request: APIRequestContext,
  method: "GET" | "POST",
  path: string,
  opts: { token?: string; data?: unknown; headers?: Record<string, string>; raw?: string } = {},
): Promise<ApiRes<T>> {
  const res = await request.fetch(url(path), {
    method,
    headers: {
      ...(opts.token ? { [TOKEN_HEADER]: opts.token } : {}),
      ...(opts.raw === undefined ? {} : { "content-type": "application/json" }),
      ...(opts.headers ?? {}),
    },
    ...(opts.raw !== undefined
      ? { data: opts.raw }
      : opts.data === undefined
        ? {}
        : { data: opts.data as object }),
  });
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { ok: false, code: "not_json" };
  }
  return {
    status: res.status(),
    headers: res.headers(),
    body: body as ApiRes<T>["body"],
    raw: text,
  };
}

/** Đăng nhập persona (12 §6.4) → chuỗi `sdf_…`. Hỏng ⇒ dừng ngay với câu rõ ràng. */
export async function devLogin(request: APIRequestContext, phone: string): Promise<string> {
  const res = await call<{ token?: string }>(request, "POST", "/api/dev/login", { data: { phone } });
  expect(
    res.status,
    `POST /api/dev/login ${phone} — cần MARKET_STORE=file (dev-market.mjs). Trả về: ${res.raw.slice(0, 200)}`,
  ).toBe(200);
  const token = res.body.token;
  expect(typeof token, "chuỗi dev phải là string").toBe("string");
  return token as string;
}

// ── Snapshot mẫu ─────────────────────────────────────────────────────────────
/**
 * Snapshot TỐI THIỂU hợp lệ theo `DeviceSnapshot` (14 §3.1), đã ở dạng
 * `stripForServer` (không SĐT shop, không tên tàu, ≤3 ngày thời tiết).
 * Ca nào cần nhồi thêm thì `{...snapshot(), weather: …}`.
 */
export function snapshot(over: Partial<DeviceSnapshot> = {}): DeviceSnapshot {
  const now = Date.now();
  return {
    takenAt: now,
    route: "/",
    online: true,
    premium: false,
    home: { portId: "quy-nhon", portName: "Quy Nhơn", province: "Gia Lai" },
    // MỘT ngày (hôm nay, giờ VN) — ngày phải tính theo đồng hồ chạy test, không
    // hằng hoá: chốt ngày là bộ test tự hỏng vào hôm sau.
    weather: seaDays(1),
    storm: { savedAt: now - 3600_000, storms: [] },
    tide: null,
    boat: null,
    docs: [],
    maintenance: [],
    crew: { count: 8, issues: 2 },
    cart: { lines: 0, titles: [] },
    orders: null,
    fishPrices: null,
    fuel: null,
    inboxUnread: 0,
    placeNames: [],
    ...over,
  };
}

/** yyyy-mm-dd theo giờ VN — cùng cách `todayIsoVN` của app tính, để ngày trong
 *  snapshot khớp ngày máy chủ dò (`w.days.find(x => x.date === target)`). */
export const isoVN = (offsetDays = 0, now = Date.now()) =>
  new Date(now + 7 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);

/**
 * Bản lưu dự báo `n` ngày kể từ HÔM NAY (giờ VN) cho snapshot của route.
 * Ca nào cần con số thật (sóng/gió/điểm) thì dùng cái này thay `snapshot()` mặc
 * định — mặc định chỉ có 1 ngày, không đủ cho câu "ngày mai".
 */
export function seaDays(n = 3, savedAgoMs = 2 * 3600_000): DeviceSnapshot["weather"] {
  const now = Date.now();
  return {
    portId: "quy-nhon",
    portName: "Quy Nhơn",
    savedAt: now - savedAgoMs,
    days: Array.from({ length: n }, (_, i) => ({
      date: isoVN(i, now),
      score: 82 - i * 10,
      level: (i === 0 ? "good" : i === 1 ? "caution" : "bad") as "good" | "caution" | "bad",
      waveMaxM: 0.8 + i * 0.4,
      waveEstimated: false,
      windMaxKmh: 25 + i * 5,
      gustMaxKmh: 34 + i * 5,
      precipMm: 0,
      wmoCode: 1,
    })),
  };
}

export function askBody(text: string, over: Partial<DeviceSnapshot> = {}, route = "/") {
  return { text, route, snapshot: snapshot({ route, ...over }) };
}

/** Một lượt hỏi hợp lệ. */
export function askApi(
  request: APIRequestContext,
  token: string | undefined,
  text: string,
  over: Partial<DeviceSnapshot> = {},
  route = "/",
) {
  return call(request, "POST", TROLY_PATH, { token, data: askBody(text, over, route) });
}

/** Câu trả lời trong `reply` — gộp `speak` + `text` để soát chuỗi một lượt. */
export function replyStrings(res: ApiRes): string {
  const r = res.body.reply;
  return r ? `${r.speak ?? ""}\n${r.text ?? ""}` : "";
}

/** Id món seed theo TÊN (id là uuid sinh mới mỗi lần seed, không hằng hoá được). */
export async function findProductId(request: APIRequestContext, title: string): Promise<string> {
  const res = await call<{ items: { id: string; title: string }[] }>(
    request,
    "GET",
    `/api/cho/san-pham?pageSize=50&q=${encodeURIComponent(title)}`,
  );
  expect(res.status, `GET /api/cho/san-pham?q=${title}`).toBe(200);
  const found = (res.body.items ?? []).find((p) => p.title === title);
  expect(found, `không thấy món seed "${title}" trên chợ`).toBeTruthy();
  return found!.id;
}

// ── Màn hình ─────────────────────────────────────────────────────────────────
/** Đăng nhập bằng TRANG `/dev` — đúng đường dev đi, không nhét thẳng chuỗi. */
export async function loginViaDevPage(page: Page, phone: string): Promise<void> {
  await page.goto(url("/dev"));
  const row = page.locator("li").filter({ hasText: phone }).first();
  const nut = row.getByRole("button", { name: /Đăng nhập/i });
  // Lần chạy lạnh phải chờ `next dev` biên dịch cả `/dev` lẫn `/api/dev/personas`.
  await expect(nut, `hàng persona ${phone} ở /dev`).toBeVisible({ timeout: 60_000 });
  await nut.click();
  await expect
    .poll(async () => page.evaluate(() => window.localStorage.getItem("forfish.token.v1")), {
      timeout: 15_000,
    })
    .not.toBeNull();
}

/**
 * Gieo dữ liệu vào máy TRƯỚC khi trang chạy (`addInitScript` chạy sớm hơn mọi
 * script của app) — để `gomSnapshot` đọc được ngay lượt hỏi đầu tiên.
 * Giá trị là object; helper tự `JSON.stringify`.
 */
export async function seedDevice(page: Page, kv: Record<string, unknown>): Promise<void> {
  await page.addInitScript((entries) => {
    for (const [k, v] of entries as [string, unknown][]) {
      try {
        window.localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
      } catch {
        /* máy hết chỗ trong test = lỗi test, để ca tự đỏ ở bước sau */
      }
    }
  }, Object.entries(kv));
}

/** Bản lưu dự báo biển của một cảng — khuôn `{ts, days}` của `lib/sea.ts` (v3). */
export function seaCache(portId: string, savedAgoMs: number) {
  return {
    [`forfish.sea.${portId}.v3`]: {
      ts: Date.now() - savedAgoMs,
      days: [0, 1, 2, 3].map((i) => ({
        date: new Date(Date.now() + i * 86400_000).toISOString().slice(0, 10),
        score: 82 - i * 10,
        waveMaxM: 0.8 + i * 0.3,
        waveEstimated: false,
        windMaxKmh: 25 + i * 5,
        gustMaxKmh: 34 + i * 5,
        precipMm: 0,
        wmoCode: 1,
      })),
    },
  };
}

/**
 * TẮT HẲN NHẬN GIỌNG của trình duyệt TRƯỚC khi trang chạy.
 *
 * Chromium của Playwright CÓ `webkitSpeechRecognition`, nhưng nó gọi dịch vụ
 * nhận giọng của Google — trong sandbox test lượt gọi đó trả lỗi `network` hay
 * `not-allowed` tuỳ máy, tuỳ mạng. Tấm che phản ứng khác nhau theo từng mã lỗi
 * ⇒ ca nào cũng đứng trên cát.
 *
 * Gỡ hẳn hai hàm tạo = máy "không nghe được" (13 §5.4 dòng 2, AC-T34). Đó KHÔNG
 * phải né tránh: 14 §0 chốt #4 nói nhận giọng cần máy chủ Apple/Google, nên mất
 * sóng ngoài biển là mic chết — ca thường của bà con, và là ca duy nhất tự động
 * hoá được trung thực. Mic thật đo tay: nhóm E của docs/test-cases.
 */
export async function tatMic(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
  });
}

/** Đo ô chạm CHỈ TRONG một vùng (tấm che) — nền sau tấm che không phải việc của ca này. */
export async function tapViolationsIn(page: Page, selector: string): Promise<string[]> {
  return page.evaluate(
    ([sel, min]) => {
      const root = document.querySelector(sel as string);
      if (!root) return [`không thấy vùng "${sel}" để đo`];
      const out: string[] = [];
      for (const el of Array.from(root.querySelectorAll('button, a, input[type="checkbox"]'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        const name = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40);
        if (r.height >= (min as number) && r.width >= (min as number)) continue;
        out.push(`${el.tagName.toLowerCase()} "${name}" = ${Math.round(r.width)}×${Math.round(r.height)}px`);
      }
      return out;
    },
    [selector, MIN_TAP] as const,
  );
}

/** Nút nổi trợ lý (nhãn khoá theo 13 §5.1 A11y). */
export const fab = (page: Page) => page.getByRole("button", { name: "Sen Biển — bấm để nói" });
/** Tấm che (14 §7.2: `role=dialog aria-modal aria-label="Sen Biển"`). */
export const SHEET_SELECTOR = '[role="dialog"][aria-label="Sen Biển"]';
export const sheet = (page: Page) => page.getByRole("dialog", { name: "Sen Biển" });
export const chipGroup = (page: Page) => page.getByRole("group", { name: "Câu hỏi sẵn" });

/** Mở tấm che đúng đường bà con đi: một chạm nút nổi. */
export async function openAssistant(page: Page): Promise<void> {
  await expect(fab(page), "nút nổi Sen Biển phải hiện trên màn app ngư dân").toBeVisible();
  await fab(page).click();
  await expect(sheet(page)).toBeVisible();
}

/** Gõ một câu rồi gửi (đường của bà con khi mic không dùng được — ca thường
 *  ngoài biển, và là đường DUY NHẤT trong chromium headless: không có
 *  `SpeechRecognition` nên tấm che mở thẳng ô gõ). */
export async function askUi(page: Page, text: string): Promise<void> {
  const box = sheet(page).getByLabel("Gõ câu muốn hỏi");
  await expect(box, "ô gõ phải là hàng chính khi máy không nghe được").toBeVisible();
  await box.fill(text);
  await sheet(page).getByRole("button", { name: "Gửi" }).click();
}

/**
 * Cắt sóng THẬT SỰ: `context.setOffline` chặn request nhưng KHÔNG bắn sự kiện
 * `offline` vào trang, mà `useOnline`/`isOffline` nghe đúng sự kiện đó. Thiếu
 * bước này thì ca "mất sóng" chạy với UI vẫn tưởng còn sóng.
 */
export async function catSong(page: Page, ctx: { setOffline(v: boolean): Promise<void> }, off: boolean) {
  await ctx.setOffline(off);
  await page.evaluate((v) => {
    Object.defineProperty(window.navigator, "onLine", { get: () => !v, configurable: true });
    window.dispatchEvent(new Event(v ? "offline" : "online"));
  }, off);
}

/**
 * CHỜ CHO XONG MỘT LƯỢT rồi trả về chữ đang hiện trên tấm che.
 *
 * Không đọc `innerText` ngay: tấm che luôn có sẵn chữ ("Sen Biển", chip), nên đọc
 * sớm là ca nào cũng xanh mà chẳng kiểm gì.
 *
 * Mốc "xong" đọc theo ĐÚNG cây DOM của `assistant-sheet.tsx`: cả ba trạng thái
 * cuối (đang nghĩ · lỗi · đã trả lời) nằm trong CÙNG một vùng `aria-live`.
 * Xong = vùng đó có chữ VÀ dòng `role=status` ("Đang nghĩ…" / "Hơi lâu…") đã
 * tắt. Kẹt ở "Đang nghĩ…" là lỗi thật (14 §5.4: không nhánh nào được để state
 * đứng ở `thinking`), nên để ca đỏ ở đây chứ không nới.
 */
export async function answerText(page: Page): Promise<string> {
  const panel = sheet(page);
  const live = panel.locator('[aria-live="polite"]').first();
  await expect
    .poll(
      async () => {
        const [chu, dangNghi] = await Promise.all([
          live.innerText().catch(() => ""),
          panel.getByRole("status").count(),
        ]);
        return chu.trim().length > 0 && dangNghi === 0;
      },
      {
        timeout: 25_000,
        message: "trợ lý phải trả lời hoặc nói lỗi, không im và không kẹt ở 'Đang nghĩ…'",
      },
    )
    .toBe(true);
  return panel.innerText();
}

/** Chữ của RIÊNG câu trả lời (bong bóng chữ TO) — không lẫn chip/tiêu đề. */
export async function replyBubbleText(page: Page): Promise<string> {
  await answerText(page);
  return sheet(page).locator("p.display").first().innerText();
}
