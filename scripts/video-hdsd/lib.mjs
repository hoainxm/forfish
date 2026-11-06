// Bộ máy quay chung: mở app thật (localhost:3000, Supabase thật) bằng tài khoản test, con trỏ giả + gợn chạm.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(new URL("../../package.json", import.meta.url));
export const { chromium } = require("playwright");
const HERE = new URL(".", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
/** Mã nguồn kịch bản (thư mục này) */
export const SRC = HERE;
/** Kho làm việc NGOÀI git (test-reports/ đã ignore): tok-<sđt>.txt, tts-cache/, fonts/, mask.png, out/ */
export const DIR = (process.env.HDSD_DIR || HERE + "../../test-reports/video-hdsd/").replace(/\\/g, "/");
export const BASE = process.env.BASE || "http://localhost:3000";
export const VW = 402, VH = 874;

export async function moPhien(phone, { video = null, vai = null } = {}) {
  const tok = readFileSync(`${DIR}tok-${phone}.txt`, "utf8").trim();
  const b = await chromium.launch({ channel: "chrome", args: ["--hide-scrollbars"] });
  const ctx = await b.newContext({
    viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: false,
    locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh",
    geolocation: { latitude: 13.7695, longitude: 109.2340 }, permissions: ["geolocation"],
    userAgent: "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  });
  await ctx.addInitScript(([t, phone, vai]) => {
    try {
      if (!localStorage.getItem("forfish.token.v1")) {
        localStorage.setItem("forfish.token.v1", t);
        localStorage.setItem("forfish.identity.v1", JSON.stringify({ phone, key: phone, boundAt: Date.now() }));
        if (vai) localStorage.setItem("forfish.vai.v1", JSON.stringify({ vai, luc: Date.now() }));
      }
    } catch {}
    // máy quay không có micro thật ⇒ tắt nhận giọng để Sen Biển mở thẳng ô nhắn chữ (không hiện "Micro bị chặn")
    try { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined }); Object.defineProperty(window, "SpeechRecognition", { value: undefined }); } catch {}
    const css = "nextjs-portal{display:none!important} [data-nextjs-toast]{display:none!important}";
    const add = () => {
      if (document.getElementById("__hide")) return;
      const s = document.createElement("style"); s.id = "__hide"; s.textContent = css; document.head.appendChild(s);
      if (document.getElementById("__cur")) return;
      const c = document.createElement("div"); c.id = "__cur";
      c.style.cssText = "position:fixed;z-index:2147483647;width:30px;height:30px;border-radius:50%;background:rgba(255,140,0,.38);border:3px solid #ff7a00;pointer-events:none;transform:translate(-50%,-50%);left:-60px;top:-60px;transition:left .05s linear,top .05s linear;box-shadow:0 0 0 2px rgba(255,255,255,.7)";
      document.body.appendChild(c);
      addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
      addEventListener("mousedown", (e) => {
        const r = document.createElement("div");
        r.style.cssText = `position:fixed;z-index:2147483647;width:16px;height:16px;border-radius:50%;border:3px solid #ff7a00;pointer-events:none;transform:translate(-50%,-50%);left:${e.clientX}px;top:${e.clientY}px;transition:all .5s ease-out;opacity:1`;
        document.body.appendChild(r);
        requestAnimationFrame(() => { r.style.width = "72px"; r.style.height = "72px"; r.style.opacity = "0"; });
        setTimeout(() => r.remove(), 650);
      }, true);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add); else add();
  }, [tok, phone, vai]);
  const page = await ctx.newPage();
  if (video) {
    // GHI HÌNH qua CDP screencast: khung đúng pixel thật (dsf 2 ⇒ 804×1748), lưu JPEG kèm mốc giờ
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(video, { recursive: true });
    const cdp = await ctx.newCDPSession(page);
    const frames = [];
    cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
      const f = video + "f" + String(frames.length).padStart(6, "0") + ".jpg";
      writeFileSync(f, Buffer.from(data, "base64"));
      frames.push({ f, t: metadata.timestamp });
      cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: VW * 2, maxHeight: VH * 2, everyNthFrame: 1 });
    page.__frames = frames;
    page.__stopCast = () => cdp.send("Page.stopScreencast").catch(() => {});
  }
  page.on("pageerror", (e) => console.log("  pageerror:", e.message.slice(0, 160)));
  return { b, ctx, page };
}

let cx = VW / 2, cy = VH * 0.6;
export async function diChuot(page, x, y, ms = 650) {
  const n = Math.max(8, Math.round(ms / 16));
  const x0 = cx, y0 = cy;
  for (let i = 1; i <= n; i++) {
    const t = i / n, e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e);
    await page.waitForTimeout(16);
  }
  cx = x; cy = y;
}

/** Chạm vào phần tử: trôi con trỏ tới, dừng một nhịp, bấm. `loc` là Locator hoặc selector. */
export async function cham(page, loc, { truoc = 350, sau = 700, timeout = 12000 } = {}) {
  const l = (typeof loc === "string" ? page.locator(loc) : loc).filter({ visible: true }).first();
  await l.waitFor({ state: "visible", timeout });
  await l.scrollIntoViewIfNeeded().catch(() => {});
  const bb = await l.boundingBox();
  if (!bb) throw new Error("không thấy hộp: " + loc);
  await diChuot(page, bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.waitForTimeout(truoc);
  await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up();
  await page.waitForTimeout(sau);
}

export async function chamXY(page, x, y, { truoc = 350, sau = 700 } = {}) {
  await diChuot(page, x, y);
  await page.waitForTimeout(truoc);
  await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up();
  await page.waitForTimeout(sau);
}

/** Cuộn mượt `dy` px (dương = xuống) trong `ms`. */
export async function cuon(page, dy, ms = 1200) {
  await diChuot(page, VW / 2, VH * 0.55, 300);
  const n = Math.max(10, Math.round(ms / 30));
  for (let i = 0; i < n; i++) { await page.mouse.wheel(0, dy / n); await page.waitForTimeout(30); }
}

export async function go(page, l, text, delay = 55) {
  const el = typeof l === "string" ? page.locator(l).first() : l.first();
  await cham(page, el, { sau: 250 });
  await el.focus().catch(() => {});
  await page.keyboard.type(text, { delay });
  if (!(await el.inputValue().catch(() => "x"))) await el.fill(text).catch(() => {});
}

export async function den(page, path, cho = 2500) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(cho);
}

/** Bỏ tờ Đồng ý điều khoản nếu đang che (làm lúc khởi động, trước khi quay cảnh). */
export async function boDongY(page) {
  const n = page.getByRole("button", { name: "Đồng ý" });
  if (await n.count()) { await n.first().click().catch(() => {}); await page.waitForTimeout(800); }
}

export const dock = (page, ten) => page.locator(`nav[aria-label="Điều hướng chính"] a[aria-label^="${ten}"]`);
