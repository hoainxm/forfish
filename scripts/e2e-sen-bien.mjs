#!/usr/bin/env node
// RÀ SOÁT LUỒNG SEN BIỂN + ĐANG CHẠY + DẪN ĐƯỜNG trên bản build thật (2026-10-16).
//
// Chạy:  npx next build   (biến Supabase RỖNG ⇒ demo mode, xem dưới)
//        node scripts/e2e-sen-bien.mjs [--only a,b,...] [--port 3200] [--out ~/ra-soat-shots]
//        (luồng i: tự nghe sau tóm tắt · n: đo độ trễ nói–nghe, ghi do-tre-$E2E_LABEL.json)
//
// Dựng: `next start` + Chromium headless 375×812 (chạm, vi-VN), GPS giả ngoài
// biển gần Sa Huỳnh, speechSynthesis giả 2 giọng vi-VN (ghi lại mọi câu đọc),
// micro giả (bài test "nói" bằng `say()`), chuỗi giả `forfish.token.v1`, Open-
// Meteo thật — bị 429 thì tự thay bằng số giả (E2E_OPENMETEO=mock để luôn giả).
// Ảnh chụp + ket-qua.json ra thư mục --out. Thoát 1 nếu có luồng LỖI.
//
// Đây là kịch bản RÀ SOÁT (đọc ảnh + kết quả), không phải bộ Vitest: nó cần
// build production + Chromium, nên không chạy trong `npm test`.

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const PORT = Number(arg("port", "3200"));
const BASE = `http://localhost:${PORT}`;
const OUT = resolve(arg("out", join(homedir(), "ra-soat-shots")).replace(/^~/, homedir()));
const ONLY = arg("only", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const METEO = process.env.E2E_OPENMETEO ?? "auto"; // auto | mock | real
mkdirSync(OUT, { recursive: true });

// Ngoài biển, đông-bắc cảng Sa Huỳnh (14,67 N · 109,07 E) chừng 10 km — tàu ĐỨNG
const SEA = { latitude: 14.72, longitude: 109.15 };
const CRUISE_NEAR_SA_HUYNH = { lat: 14.72, lon: 109.15, heading: 20, speedMs: 3, moving: true };
const STILL_NEAR_SA_HUYNH = { lat: 14.72, lon: 109.15 };
// tây đảo Lý Sơn, chạy hướng đông ~12 hải lý/giờ — phía trước là đảo
const LY_SON_APPROACH = { lat: 15.38, lon: 109.06, heading: 90, speedMs: 6, moving: true };
const TOKEN = "sdf_" + "e2eRaSoatSenBien0123456789abcdefghijklmnopq".slice(0, 43);

// ── máy chủ ────────────────────────────────────────────────────────────────
async function startServer() {
  const env = {
    ...process.env,
    // demo mode: rỗng (chuỗi rỗng ĐÃ định nghĩa ⇒ .env.local không đè được)
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    PORT: String(PORT),
  };
  // gọi thẳng bin next + nhóm tiến trình riêng ⇒ kill(-pid) dọn sạch cả next-server
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const t0 = Date.now();
  while (Date.now() - t0 < 60_000) {
    try {
      const r = await fetch(`${BASE}/api/version`);
      if (r.status < 500) return { child, log: () => log };
    } catch {
      /* chưa lên */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  stopServer(child);
  throw new Error("next start không lên sau 60 s:\n" + log);
}

function stopServer(child) {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

// ── Open-Meteo giả (đúng dạng nhiều vị trí) ────────────────────────────────
function fakeMeteo(urlStr) {
  const u = new URL(urlStr);
  const lats = (u.searchParams.get("latitude") ?? "14.7").split(",").map(Number);
  const lons = (u.searchParams.get("longitude") ?? "108.9").split(",").map(Number);
  const days = Math.min(16, Number(u.searchParams.get("forecast_days") ?? "7") || 7);
  const unix = u.searchParams.get("timeformat") === "unixtime";
  const val = (name, i) => {
    if (/direction/.test(name)) return 45;
    if (/wave_height|swell_wave_height|wind_wave_height/.test(name)) return 0.8 + 0.2 * Math.sin(i / 6);
    if (/period/.test(name)) return 6;
    if (/current_velocity/.test(name)) return 0.5;
    if (/wind_speed|wind_gusts/.test(name)) return 14 + 4 * Math.sin(i / 8);
    if (/precipitation_probability/.test(name)) return 10;
    if (/precipitation|rain|showers/.test(name)) return 0;
    if (/cape/.test(name)) return 50;
    if (/temperature/.test(name)) return 28;
    if (/weather_code/.test(name)) return 1;
    if (/cloud/.test(name)) return 30;
    if (/visibility/.test(name)) return 20000;
    if (/pressure/.test(name)) return 1010;
    if (/humidity/.test(name)) return 75;
    return 1;
  };
  const start = new Date();
  start.setUTCHours(-7, 0, 0, 0); // 00:00 giờ VN hôm nay
  const hours = [];
  for (let h = 0; h < days * 24; h++) hours.push(new Date(start.getTime() + h * 3600e3));
  const fmt = (d) =>
    unix
      ? Math.floor(d.getTime() / 1000)
      : new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 16);
  const block = (key, step) => {
    const vars = (u.searchParams.get(key) ?? "").split(",").filter(Boolean);
    if (!vars.length) return null;
    const times = step === 24 ? hours.filter((_, i) => i % 24 === 0) : hours;
    const o = {
      time: times.map((d) => (step === 24 && !unix ? fmt(d).slice(0, 10) : fmt(d))),
    };
    for (const v of vars) o[v] = times.map((_, i) => val(v, i * (step === 24 ? 24 : 1)));
    return o;
  };
  const one = (la, lo) => {
    const o = {
      latitude: la,
      longitude: lo,
      utc_offset_seconds: 25200,
      timezone: "Asia/Ho_Chi_Minh",
      timezone_abbreviation: "+07",
      elevation: 0,
    };
    const hourly = block("hourly", 1);
    if (hourly) o.hourly = hourly;
    const daily = block("daily", 24);
    if (daily) o.daily = daily;
    const cur = (u.searchParams.get("current") ?? "").split(",").filter(Boolean);
    if (cur.length) {
      o.current = { time: fmt(new Date()), interval: 900 };
      for (const v of cur) o.current[v] = val(v, 0);
    }
    return o;
  };
  const all = lats.map((la, i) => one(la, lons[i] ?? lons[0]));
  return all.length === 1 ? all[0] : all;
}

// ── script cài vào trang TRƯỚC mọi thứ: giọng giả, micro giả, nhật ký ───────
const INIT = ({ token, gps: init_gps }) => {
  try {
    if (!localStorage.getItem("forfish.token.v1")) localStorage.setItem("forfish.token.v1", token);
  } catch {}
  // speechSynthesis giả: 2 giọng vi-VN, ghi lại câu đọc
  const spoken = (window.__spoken = []);
  // mốc ĐỌC XONG (giọng giả + mp3) và mốc micro — đo độ trễ nói–nghe (luồng i, n)
  const ends = (window.__ends = []);
  window.__srLog = [];
  const voices = [
    { name: "Giọng nữ (giả)", lang: "vi-VN", voiceURI: "vi-1", localService: true, default: true },
    { name: "Giọng nam (giả)", lang: "vi-VN", voiceURI: "vi-2", localService: true, default: false },
  ];
  const listeners = {};
  let speaking = false;
  const synth = {
    get speaking() {
      return speaking;
    },
    pending: false,
    paused: false,
    getVoices: () => voices,
    speak(u) {
      spoken.push({ t: Date.now(), text: u.text, kind: "tts" });
      speaking = true;
      setTimeout(() => u.onstart?.({}), 5);
      // thời lượng giả tỉ lệ nghịch với rate — câu đáp 1,12 ngắn hơn thật
      setTimeout(
        () => {
          speaking = false;
          ends.push({ t: Date.now(), text: u.text, kind: "tts" });
          u.onend?.({});
        },
        Math.min(3000, 40 * (u.text?.length ?? 10)) / (u.rate || 1),
      );
    },
    cancel() {
      speaking = false;
    },
    pause() {},
    resume() {},
    addEventListener(k, f) {
      (listeners[k] ??= []).push(f);
    },
    removeEventListener() {},
    onvoiceschanged: null,
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  if (!window.SpeechSynthesisUtterance) {
    window.SpeechSynthesisUtterance = function (text) {
      this.text = text;
    };
  }
  // mp3 Sen Biển: tts.ts tải clip → blob: URL ⇒ gắn lại tên file để nhật ký đọc được
  const blobSrc = new Map();
  const realBlob = Response.prototype.blob;
  Response.prototype.blob = function () {
    const url = this.url;
    return realBlob.call(this).then((b) => {
      if (/\.mp3/.test(url)) b.__src = url.replace(location.origin, "");
      return b;
    });
  };
  const realCOU = URL.createObjectURL;
  URL.createObjectURL = function (b) {
    const u = realCOU.call(URL, b);
    if (b && b.__src) blobSrc.set(u, b.__src);
    return u;
  };
  const realPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    // `src` chứ không `currentSrc`: lúc play() chạy, currentSrc còn là clip TRƯỚC
    const raw = this.src || this.currentSrc || "";
    const src = blobSrc.get(raw) ?? raw;
    if (src && !src.startsWith("data:")) {
      window.__audioEl = this; // thẻ <audio> Sen Biển (không nằm trong DOM)
      spoken.push({ t: Date.now(), text: src, kind: "mp3" });
      this.addEventListener("ended", () => ends.push({ t: Date.now(), text: src, kind: "mp3" }), { once: true });
    }
    return realPlay.call(this).catch((e) => {
      spoken.push({ t: Date.now(), text: `mp3-loi:${e?.name}`, kind: "mp3-err" });
      throw e;
    });
  };
  // micro giả: bài test đẩy câu vào window.__say
  window.__say = [];
  class FakeSR {
    lang = "vi-VN";
    onresult = null;
    onerror = null;
    onend = null;
    onstart = null;
    start() {
      window.__listening = (window.__listening ?? 0) + 1;
      window.__srLog.push({ t: Date.now(), ev: "start", synthBusy: synth.speaking, audioBusy: !!window.__audioEl && !window.__audioEl.paused && !window.__audioEl.ended });
      setTimeout(() => this.onstart?.(), 10);
      if (!navigator.onLine || window.__offline) {
        setTimeout(() => this.onerror?.({ error: "network" }), 300);
        return;
      }
      const t0 = Date.now();
      this._iv = setInterval(() => {
        if (window.__say.length) {
          clearInterval(this._iv);
          const r = [{ transcript: window.__say.shift() }];
          r.isFinal = true;
          window.__srLog.push({ t: Date.now(), ev: "final", text: r[0].transcript });
          this.onresult?.({ results: [r] });
          setTimeout(() => this.onend?.(), 20);
        } else if (Date.now() - t0 > 7000) {
          clearInterval(this._iv);
          window.__srLog.push({ t: Date.now(), ev: "no-speech" });
          this.onerror?.({ error: "no-speech" });
        }
      }, 100);
    }
    stop() {}
    abort() {
      clearInterval(this._iv);
      window.__srLog.push({ t: Date.now(), ev: "abort" });
      this.onerror?.({ error: "aborted" });
    }
  }
  window.SpeechRecognition = window.webkitSpeechRecognition = FakeSR;
  // GPS giả: bài test đặt window.__gps = {lat, lon, heading, speedMs, moving}; phát mỗi giây
  const gps = (window.__gps = window.__gps ?? { lat: 0, lon: 0, heading: null, speedMs: 0, moving: false });
  Object.assign(gps, init_gps);
  const watchers = new Map();
  let wid = 1;
  const fix = () => ({
    coords: {
      latitude: gps.lat,
      longitude: gps.lon,
      accuracy: 8,
      altitude: null,
      altitudeAccuracy: null,
      heading: gps.moving ? gps.heading : null,
      speed: gps.moving ? gps.speedMs : 0,
    },
    timestamp: Date.now(),
  });
  setInterval(() => {
    if (gps.moving && gps.speedMs > 0 && gps.heading != null) {
      const d = gps.speedMs; // mét / giây
      const h = (gps.heading * Math.PI) / 180;
      gps.lat += (d * Math.cos(h)) / 111320;
      gps.lon += (d * Math.sin(h)) / (111320 * Math.cos((gps.lat * Math.PI) / 180));
    }
    for (const ok of watchers.values()) ok(fix());
  }, 1000);
  const geo = {
    getCurrentPosition: (ok) => setTimeout(() => ok(fix()), 50),
    watchPosition: (ok) => {
      const id = wid++;
      watchers.set(id, ok);
      setTimeout(() => ok(fix()), 50);
      return id;
    },
    clearWatch: (id) => watchers.delete(id),
  };
  Object.defineProperty(navigator, "geolocation", { value: geo, configurable: true });
  window.__errors = [];
  addEventListener("error", (e) => window.__errors.push(String(e.message)));
  // ghi lỗi của Web Worker (worker tìm đường): Playwright không bắt console trong worker
  window.__workers = [];
  const RealWorker = window.Worker;
  window.Worker = function (url, opts) {
    const w = new RealWorker(url, opts);
    const rec = { url: String(url).slice(0, 200), errors: [] };
    window.__workers.push(rec);
    w.addEventListener("error", (e) => rec.errors.push(String(e.message || "error")));
    return w;
  };
  window.Worker.prototype = RealWorker.prototype;
};

// ── một phiên trình duyệt ───────────────────────────────────────────────────
const results = [];
let browser;
async function newCtx({ meteo = METEO, storage, gps = { lat: SEA.latitude, lon: SEA.longitude } } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    geolocation: { ...SEA, accuracy: 10 },
    permissions: ["geolocation", "microphone"],
    serviceWorkers: process.env.E2E_NO_SW ? "block" : "allow",
    ...(storage ? { storageState: storage } : {}),
  });
  await ctx.addInitScript(INIT, { token: TOKEN, gps: { lat: gps.lat, lon: gps.lon, heading: gps.heading ?? null, speedMs: gps.speedMs ?? 0, moving: !!gps.moving } });
  const net = { meteo: [], meteo429: 0, data: [], failed: [], console: [] };
  ctx.__net = net;
  await ctx.route(/open-meteo\.com/, async (route) => {
    const url = route.request().url();
    net.meteo.push(url.slice(0, 90));
    if (meteo === "500") return route.fulfill({ status: 503, body: "down" });
    if (meteo === "429") {
      net.meteo429++;
      return route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: true, reason: "Hourly API request limit exceeded. Please try again in the next hour." }),
      });
    }
    if (meteo !== "mock") {
      try {
        const r = await route.fetch({ timeout: 15000 });
        if (r.status() !== 429) return route.fulfill({ response: r });
        net.meteo429++;
      } catch {
        /* mạng thật hỏng ⇒ số giả */
      }
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeMeteo(url)) });
  });
  ctx.on("requestfailed", (r) => net.failed.push(`${r.failure()?.errorText} ${r.url().slice(0, 120)}`));
  net.tileZ = [];
  ctx.on("request", (r) => {
    const u = r.url();
    // lượt tải của service worker (cài vỏ) đếm riêng — chỉ đếm lượt TRANG xin
    const fromSw = !!r.serviceWorker();
    const m = u.match(/\/api\/tiles\/[^/]+\/(\d+)\//);
    if (m && !fromSw) net.tileZ.push({ t: Date.now(), z: Number(m[1]) });
    if (u.startsWith(BASE) && /\/data\/|\.mp3|\/api\//.test(u)) (fromSw ? (net.sw ??= []) : net.data).push(u.slice(BASE.length));
  });
  ctx.on("response", (res) => {
    if (res.status() >= 400 && res.url().startsWith(BASE)) (net.bad ??= []).push(`${res.status()} ${res.url().slice(BASE.length, BASE.length + 120)}`);
  });
  return ctx;
}
function watchPage(page, net) {
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") net.console.push(`[${m.type()}] ${m.text().slice(0, 300)}`);
  });
  page.on("worker", (w) => {
    net.console.push(`[worker] ${w.url().slice(0, 160)}`);
    w.on?.("console", (m) => net.console.push(`[worker-${m.type()}] ${m.text().slice(0, 300)}`));
  });
  page.on("pageerror", (e) => net.console.push(`[pageerror] ${String(e.message).slice(0, 300)}`));
}
async function shot(page, name) {
  const f = join(OUT, `${name}.png`);
  await page.screenshot({ path: f });
  return f;
}
// mp3 → câu gốc (danh mục giọng Sen Biển) để nhật ký đọc được bằng chữ
const CLIPS = (() => {
  const c = JSON.parse(readFileSync("src/data/giong-sen-bien.json", "utf8"));
  return new Map(c.items.map((i) => [`${c.dir}/${i.id}.mp3`, i.text]));
})();
const spoken = (page) =>
  page
    .evaluate(() => window.__spoken.filter((s) => s.text && s.text.trim()).map((s) => [s.kind, s.text]))
    .then((l) => l.map(([k, t]) => (k === "mp3" ? `mp3: ${CLIPS.get(t.split("?")[0]) ?? t}` : `${k}: ${t}`)))
    .catch(() => []);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function openMap(page, path = "/ngu-truong") {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas.maplibregl-canvas", { timeout: 90_000 });
  await page
    .getByText("Đang mở bản đồ biển…")
    .waitFor({ state: "hidden", timeout: 60_000 })
    .catch(() => {});
}
async function waitSpoken(page, re, ms = 30_000, since = null) {
  const t0 = Date.now();
  const n0 = since === null ? 0 : typeof since === "number" ? since : (await spoken(page)).length;
  while (Date.now() - t0 < ms) {
    const s = (await spoken(page)).slice(n0);
    const hit = s.find((x) => re.test(x));
    if (hit) return hit;
    await sleep(300);
  }
  return null;
}


// ── thao tác chung ─────────────────────────────────────────────────────────
async function unlockAudio(page) {
  // app mở khoá loa ở cú pointerdown đầu tiên. KHÔNG chạm bản đồ: chạm là chọn
  // điểm (TRỎ) — Chromium chạy cờ autoplay nên sự kiện tổng hợp là đủ
  await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  await sleep(600);
}
const hudVisible = (page) =>
  page.getByRole("button", { name: "Dừng", exact: true }).first().isVisible().catch(() => false);
async function stopCruise(page) {
  const b = page.getByRole("button", { name: "Dừng", exact: true }).first();
  if (await b.isVisible().catch(() => false)) {
    await b.click();
    await b.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
    await sleep(800);
  }
}
const sameSet = (a, b) => a.length === b.length && b.every((x) => a.includes(x));
async function railLabels(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.left > 280 && r.top > 120 && r.bottom < 720 && getComputedStyle(b).visibility !== "hidden";
      })
      .map((b) => (b.innerText || "").replace(/\s+/g, " ").trim())
      .filter(Boolean),
  );
}
async function hudGeometry(page) {
  return page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), h: Math.round(r.height), cy: Math.round(r.top + r.height / 2) };
    };
    const own = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
    const all = [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().width > 0);
    const stop = all.find((b) => b.tagName === "BUTTON" && b.textContent?.trim() === "Dừng");
    const title = all.find((e) => /^Đang (chạy|dẫn đường)$/i.test(own(e)) && e.getBoundingClientRect().left < 200 && e.getBoundingClientRect().top < 300);
    let hud = stop;
    while (hud && hud.getBoundingClientRect().height < 90) hud = hud.parentElement;
    const tau = all.find((e) => /^tàu$/i.test(own(e)) && e.getBoundingClientRect().left < 120);
    let coord = tau;
    while (coord && coord.getBoundingClientRect().width < 250) coord = coord.parentElement;
    const dock = [...document.querySelectorAll("nav")].pop();
    return { stop: box(stop), title: box(title), hud: box(hud), coord: box(coord), dock: box(dock) };
  });
}
/** ghim tàu (NavBoatMarker) có nằm trong vùng bản đồ nhìn thấy: dưới HUD, trên dock */
async function boatOnScreen(page) {
  await sleep(1500);
  const g = await hudGeometry(page);
  const b = await page.evaluate(() => {
    const img = [...document.querySelectorAll('img[src*="boat-marker"]')].find((i) => i.getBoundingClientRect().width > 0);
    if (!img) return null;
    const r = img.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), x: Math.round(r.left + r.width / 2) };
  });
  const hudBottom = g.hud?.bottom ?? 0;
  const dockTop = g.dock?.top ?? 812;
  return { ok: !!b && b.top >= hudBottom && b.bottom <= dockTop && b.x > 0 && b.x < 375, boat: b, hudBottom, dockTop };
}
async function senSheetOpen(page) {
  return page.getByRole("dialog", { name: "Sen Biển" }).isVisible().catch(() => false);
}
async function sheetHas(page, name) {
  return page.getByRole("dialog", { name: "Sen Biển" }).getByRole("button", { name, exact: true }).isVisible().catch(() => false);
}
/** "Nói" một câu vào thẻ Sen Biển đang mở; trả câu thẻ hiện (role=status),
    hoặc — thẻ tự đóng/đổi (đi, dừng, chờ "đi") — các câu Sen Biển vừa đọc */
async function senAsk(page, text) {
  // chờ loa rảnh (câu đáp trước đọc xong) — không thì câu cũ lẫn vào câu đáp mới
  for (let i = 0, last = -1, same = 0; i < 40 && same < 8; i++) {
    const n = (await spoken(page)).length;
    same = n === last ? same + 1 : 0;
    last = n;
    await sleep(250);
  }
  const sheet = page.getByRole("dialog", { name: "Sen Biển" });
  const before = await sheet.getByRole("status").innerText({ timeout: 300 }).catch(() => "");
  const n0 = (await spoken(page)).length;
  await page.evaluate((t) => window.__say.push(t), text);
  await sleep(500);
  const pending = await page.evaluate(() => window.__say.length);
  if (pending) {
    const mic = sheet.getByRole("button", { name: /^(Chạm rồi nói|Nói)$/ });
    if (await mic.isVisible().catch(() => false)) await mic.click();
    else {
      // thẻ đang ở chế độ gõ
      await page.evaluate(() => window.__say.pop());
      await sheet.getByRole("textbox").fill(text);
      await sheet.getByRole("button", { name: "Gửi" }).click();
    }
  }
  const t0 = Date.now();
  while (Date.now() - t0 < 8000) {
    await sleep(250);
    const now = await sheet.getByRole("status").innerText({ timeout: 200 }).catch(() => "");
    if (now && now !== before) return now;
    const said = (await spoken(page)).slice(n0);
    if (said.length && Date.now() - t0 > 1500) return said.map((x) => x.replace(/^(tts|mp3): /, "")).join(" ");
  }
  return null;
}
/** mở Sen Biển (icon nổi hoặc cá trong HUD) rồi nói */
async function senAskFresh(page, text) {
  if (!(await senSheetOpen(page))) {
    const icon = page.getByRole("button", { name: /^Sen Biển — nói/ }).first();
    await icon.click({ timeout: 10_000 });
    await page.getByRole("dialog", { name: "Sen Biển" }).waitFor({ timeout: 5000 });
  }
  return senAsk(page, text);
}
async function closeRouteAndSen(page) {
  const close = page.getByRole("button", { name: "Đóng Sen Biển" });
  if (await close.isVisible().catch(() => false)) await close.click();
  await sleep(300);
  // thoát khung dẫn đường (tuyến vẫn để trên bản đồ) — khung mở thì icon Sen Biển ẩn
  const exit = page.getByRole("button", { name: "Thoát chế độ dẫn đường" });
  if (await exit.isVisible().catch(() => false)) await exit.click();
  await sleep(800);
}
async function openSettings(page) {
  const show = page.getByRole("button", { name: "Hiện lớp bản đồ" });
  if (await show.isVisible().catch(() => false)) await show.click();
  await page.getByRole("button", { name: /^Cài đặt/ }).first().click();
  await sleep(600);
}
/** Dẫn đường bằng tay: định vị → chạm chỗ trên biển → Dẫn đường tới chỗ này → Tính lộ trình */
async function manualRoute(page, { check, r, tag }) {
  await page.getByRole("button", { name: "Vị trí của tôi (GPS)" }).click().catch(() => {});
  await sleep(3500);
  // định vị xong tàu nằm ~1/3 trên màn, sheet đáy che nửa dưới ⇒ chạm biển phía
  // đông-bắc tàu, phía TRÊN sheet
  await page.mouse.click(240, 200);
  await sleep(2500);
  // mở khung dẫn đường từ rail — điểm đến = chỗ vừa chạm
  const open = page.getByRole("button", { name: "Dẫn đường — mở bảng tính lộ trình" });
  const hasOpen = await open.isVisible().catch(() => false);
  check("có nút rail 'Lộ trình'", hasOpen);
  if (!hasOpen) {
    r.shots.push(await shot(page, `${tag}-khong-co-nut`));
    return { ok: false, msg: "không thấy nút Lộ trình" };
  }
  await open.click();
  await sleep(1500);
  const calc = page.getByRole("button", { name: /^(Tính lộ trình|Tính lại)$/ }).first();
  await calc.scrollIntoViewIfNeeded().catch(() => {});
  const hasCalc = await calc.isVisible().catch(() => false);
  check("có nút 'Tính lộ trình'", hasCalc);
  if (!hasCalc) {
    r.shots.push(await shot(page, `${tag}-khong-co-tinh`));
    return { ok: false, msg: "không thấy nút Tính lộ trình" };
  }
  await calc.click();
  const t0 = Date.now();
  let body = "";
  while (Date.now() - t0 < 120_000) {
    await sleep(1000);
    body = await page.locator("body").innerText();
    if (/Đang tính toán/.test(body)) continue;
    if (/Các điểm trên tuyến|Chưa tìm được đường|Chưa tính được|quá gần/.test(body)) break;
  }
  r.shots.push(await shot(page, `${tag}-ket-qua`));
  const ok = /Các điểm trên tuyến/.test(body);
  const msg = (body.match(/[^\n]*(lít|Chưa tìm được đường|Chưa tính được|quá gần|quá tải)[^\n]*/) ?? [""])[0];
  check("Tính lộ trình ra tuyến", ok, msg);
  return { ok, msg };
}
/** zoom hiện tại của MapLibre — dò qua React fiber của khung bản đồ (react-map-gl
    giữ map trong state hook), không cần app phơi biến toàn cục */
async function mapZoom(page) {
  return page.evaluate(() => {
    const el = document.querySelector(".maplibregl-map");
    if (!el) return null;
    const seen = new Set();
    const probe = (v, d = 0) => {
      if (!v || typeof v !== "object" || seen.has(v) || d > 3) return null;
      seen.add(v);
      if (typeof v.getZoom === "function" && typeof v.getCenter === "function") return v.getZoom();
      for (const k of ["map", "_map", "current", "mapLib", "getMap"]) {
        const x = k === "getMap" && typeof v.getMap === "function" ? v.getMap() : v[k];
        const z = probe(x, d + 1);
        if (z != null) return z;
      }
      return null;
    };
    for (let n = el; n; n = n.parentElement) {
      const key = Object.keys(n).find((k) => k.startsWith("__reactFiber"));
      for (let f = key ? n[key] : null, i = 0; f && i < 80; f = f.return, i++) {
        for (let h = f.memoizedState, j = 0; h && j < 60; h = h.next, j++) {
          const z = probe(h.memoizedState);
          if (z != null) return z;
        }
        const z = probe(f.stateNode);
        if (z != null) return z;
      }
      if (key) break;
    }
    return null;
  });
}
/** Chạm 2 lần lên bản đồ; trả { zoomed, detail } — so zoom MapLibre trước/sau */
async function dblTap(page, at) {
  await page.mouse.move(at.x, at.y);
  await sleep(2000);
  const z0 = await mapZoom(page);
  await page.mouse.dblclick(at.x, at.y);
  await sleep(2500);
  const z1 = await mapZoom(page);
  return { zoomed: z0 != null && z1 != null && z1 - z0 > 0.5, known: z0 != null, detail: `zoom ${z0?.toFixed(2)} → ${z1?.toFixed(2)}` };
}
/** mic bật (lượt nghe mới) sau mốc `n` của __srLog — chờ tối đa `ms` */
async function waitListen(page, n, ms, minT = 0) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const hit = await page
      .evaluate(([k, m]) => window.__srLog.slice(k).find((e) => e.ev === "start" && e.t >= m) ?? null, [n, minT])
      .catch(() => null);
    if (hit) return hit;
    await sleep(50);
  }
  return null;
}
/** mốc ĐỌC XONG gần nhất của câu khớp `re` (tên file mp3 hoặc chữ giọng máy) */
async function endOf(page, re, ms = 10_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const hit = await page.evaluate((src) => window.__ends.filter((e) => new RegExp(src).test(e.text)).at(-1) ?? null, re.source).catch(() => null);
    if (hit) return hit;
    await sleep(50);
  }
  return null;
}
async function flow(id, title, fn) {
  if (ONLY.length && !ONLY.includes(id)) return;
  const r = { id, title, ok: false, checks: [], shots: [], notes: [] };
  results.push(r);
  const check = (name, ok, detail = "") => {
    r.checks.push({ name, ok: !!ok, detail: String(detail).slice(0, 400) });
    console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` — ${String(detail).slice(0, 160)}` : ""}`);
  };
  console.log(`\n[${id}] ${title}`);
  try {
    await fn({ check, r });
    r.ok = r.checks.length > 0 && r.checks.every((c) => c.ok);
  } catch (e) {
    check("không ném lỗi", false, e?.stack ?? e);
  }
}

// ── các luồng ───────────────────────────────────────────────────────────────
async function main() {
  const server = await startServer();
  browser = await chromium.launch({
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  try {

    await flow("a", "Mở /ngu-truong ⇒ tự Đang chạy, bản tin mở đầu, cảnh báo phía trước có TÊN đảo/bãi", async ({ check, r }) => {
      // tàu chạy về hướng đông, phía trước là đảo Lý Sơn (Quảng Ngãi, ngoài Sa Huỳnh)
      const ctx = await newCtx({ gps: LY_SON_APPROACH });
      const page = await ctx.newPage();
      watchPage(page, ctx.__net);
      await openMap(page);
      await unlockAudio(page);
      check("HUD Đang chạy tự hiện (không bấm gì)", await hudVisible(page));
      const first = await waitSpoken(page, /^(tts|mp3): .{3,}/, 25_000);
      check("có bản tin mở đầu", first, first);
      r.shots.push(await shot(page, "a1-tu-dang-chay"));
      const ten = await waitSpoken(page, /Phía trước chừng .* là .*Lý Sơn/, 150_000);
      const phiaTruoc = (await spoken(page)).filter((x) => /Phía trước/.test(x));
      check("cảnh báo phía trước gọi TÊN (đảo Lý Sơn)", ten, ten ?? phiaTruoc.join(" / "));
      r.shots.push(await shot(page, "a2-phia-truoc-co-ten"));
      const dup = await page.evaluate(() => {
        const t = (e) => (e.innerText || "").replace(/\s+/g, " ").trim().replace(/[.!?…]+$/, "");
        const alerts = [...document.querySelectorAll('[role="alert"],button[aria-label="Thu gọn thông báo này"]')].map(t);
        // câu đang đọc = KHỐI div[role=status] (dòng tin cũng role=status nhưng là button)
        const stat = [...document.querySelectorAll('div[role="status"]')].map(t);
        return stat.filter((x) => x && alerts.includes(x));
      });
      check("HUD không in một câu hai lần (thẻ cảnh báo + câu đang đọc)", dup.length === 0, dup.join(" | "));
      const boat = await boatOnScreen(page);
      check("tàu hiện trên bản đồ, dưới HUD, trên dock", boat.ok, JSON.stringify(boat));
      r.notes.push(...(await spoken(page)).slice(0, 12));
      await ctx.close();
    });

    await flow("b", "Đang chạy: rail chỉ Lớp/Vị trí/Đang chạy, HUD gọn, không đè ô toạ độ / dock", async ({ check, r }) => {
      const ctx = await newCtx({ gps: CRUISE_NEAR_SA_HUYNH });
      const page = await ctx.newPage();
      watchPage(page, ctx.__net);
      await openMap(page);
      await unlockAudio(page);
      await sleep(3000);
      const rail = await railLabels(page);
      check("rail đúng 3 nút Lớp bản đồ / Vị trí / Đang chạy", sameSet(rail, ["Lớp bản đồ", "Vị trí", "Đang chạy"]), rail.join(" | "));
      const g = await hudGeometry(page);
      check("Dừng nằm ở hàng đầu HUD", g.stop && g.title && Math.abs(g.stop.cy - g.title.cy) < 20, JSON.stringify({ stop: g.stop, title: g.title }));
      check("HUD không đè ô toạ độ", g.hud && g.coord && g.hud.bottom <= g.coord.top + 1, JSON.stringify({ hud: g.hud, coord: g.coord }));
      check("HUD không tụt xuống dock", g.hud && g.dock && g.hud.bottom < g.dock.top, JSON.stringify({ hud: g.hud, dock: g.dock }));
      check("HUD gọn (≤ 55% chiều cao màn, kể cả thẻ bản tin)", g.hud && g.hud.h <= 812 * 0.55, g.hud && g.hud.h);
      r.shots.push(await shot(page, "b1-hud-dang-chay"));
      const boat = await boatOnScreen(page);
      check("tàu hiện trên bản đồ, dưới HUD, trên dock", boat.ok, JSON.stringify(boat));
      // re-render HUD theo GPS: đếm số lần đổi DOM của HUD trong 10 s chạy
      const mut = await page.evaluate(async () => {
        const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Dừng");
        let el = btn;
        while (el && el.getBoundingClientRect().width < 300) el = el.parentElement;
        if (!el) return -1;
        let n = 0;
        const mo = new MutationObserver((l) => (n += l.length));
        mo.observe(el, { subtree: true, childList: true, characterData: true, attributes: true });
        await new Promise((r) => setTimeout(r, 10_000));
        mo.disconnect();
        return n;
      });
      r.notes.push(`HUD đổi DOM ${mut} lần / 10 s GPS 1 Hz`);
      check("HUD không vẽ lại dồn dập theo GPS (< 60 đổi DOM / 10 s)", mut >= 0 && mut < 60, mut);
      await ctx.close();
    });

    await flow("c", "Sen Biển: icon nổi / cá trong HUD → thẻ gọn → cảng / điểm ghim / toạ độ / trùng tên / tên không có", async ({ check, r }) => {
      const ctx = await newCtx({ gps: STILL_NEAR_SA_HUYNH });
      await ctx.addInitScript(() => {
        if (!localStorage.getItem("forfish.places.v1"))
          localStorage.setItem(
            "forfish.places.v1",
            JSON.stringify([
              { id: "14.850,109.050", name: "Bãi Ông Tư", lat: 14.85, lon: 109.05, kind: "spot" },
              { id: "14.750,109.100", name: "Sa Huỳnh", lat: 14.75, lon: 109.1, kind: "spot" },
            ]),
          );
      });
      const page = await ctx.newPage();
      watchPage(page, ctx.__net);
      await openMap(page);
      await unlockAudio(page);
      await sleep(1500);
      // khi đang chạy: cá nằm trong HUD
      const fishHud = page.getByRole("button", { name: "Sen Biển — nói lệnh" });
      check("đang chạy: cá Sen Biển trong HUD", await fishHud.isVisible().catch(() => false));
      check("đang chạy: KHÔNG có icon nổi", !(await page.getByRole("button", { name: "Sen Biển — nói chỗ muốn tới" }).isVisible().catch(() => false)));
      await stopCruise(page);
      const icon = page.getByRole("button", { name: "Sen Biển — nói chỗ muốn tới" });
      check("dừng chạy: icon nổi hiện", await icon.isVisible().catch(() => false));
      r.shots.push(await shot(page, "c1-icon-noi"));
      await icon.click();
      const sheet = page.getByRole("dialog", { name: "Sen Biển" });
      await sheet.waitFor({ timeout: 5000 });
      const sb = await sheet.boundingBox();
      check("thẻ gọn (≤ 80% rộng, ≤ 35% cao màn)", sb && sb.width <= 375 * 0.8 && sb.height <= 812 * 0.35, JSON.stringify(sb));
      r.shots.push(await shot(page, "c2-the-gon"));

      // tên không có
      let rep = await senAsk(page, "dẫn tới hòn Ba Mươi Sáu");
      check("tên không có ⇒ nói thật, không đi", rep && !/Đang vẽ đường/.test(rep) && !(await sheetHas(page, "Đi")), rep);
      r.shots.push(await shot(page, "c3-ten-khong-co"));
      // trùng tên: cảng Sa Huỳnh + điểm ghim "Sa Huỳnh"
      rep = await senAsk(page, "về Sa Huỳnh");
      const opts = await sheet.locator("button").filter({ hasText: /cảng cá|điểm đã ghim/ }).allInnerTexts();
      check("trùng tên ⇒ hỏi chọn (≥2 lựa chọn)", opts.length >= 2, `${rep} | ${opts.join(" / ")}`);
      r.shots.push(await shot(page, "c4-trung-ten"));
      // điểm ghim
      rep = await senAsk(page, "đi Bãi Ông Tư");
      check("điểm ghim ⇒ đi", rep && /Ông Tư/.test(rep) && /vẽ đường/i.test(rep), rep);
      await waitSpoken(page, /Tới (Bãi Ông Tư|điểm này)|Chưa vẽ được/, 120_000);
      r.shots.push(await shot(page, "c5-diem-ghim"));
      await closeRouteAndSen(page);
      // toạ độ
      rep = await senAskFresh(page, "14 độ 50 phút bắc 109 độ 15 phút đông");
      check("toạ độ ⇒ đọc lại toạ độ + đi", rep && /14 độ 50 phút Bắc.*109 độ 15 phút Đông/.test(rep), rep);
      await waitSpoken(page, /Tới (điểm này|Điểm)|Chưa vẽ được/, 120_000);
      r.shots.push(await shot(page, "c6-toa-do"));
      await closeRouteAndSen(page);
      // tên cảng
      rep = await senAskFresh(page, "dẫn về cảng Quy Nhơn");
      check("tên cảng ⇒ đi", rep && /Quy Nhơn/.test(rep) && /vẽ đường/i.test(rep), rep);
      r.notes.push(...(await spoken(page)).slice(-14));
      await ctx.close();
    });

    await flow("d", "Tự vẽ đường → tóm tắt + Đi/Thôi → 'đi' → dẫn → còn bao xa / im / bật tiếng / nhắc lại / dừng", async ({ check, r }) => {
      const ctx = await newCtx({ gps: STILL_NEAR_SA_HUYNH });
      const page = await ctx.newPage();
      watchPage(page, ctx.__net);
      await openMap(page);
      await unlockAudio(page);
      await stopCruise(page);
      await senAskFresh(page, "dẫn về cảng Sa Huỳnh");
      const tom = await waitSpoken(page, /Tới Sa Huỳnh|Chưa vẽ được/, 120_000);
      check("tự vẽ đường + đọc tóm tắt", tom && /Tới Sa Huỳnh/.test(tom), tom);
      const sheet = page.getByRole("dialog", { name: "Sen Biển" });
      const hasGo = await sheet.getByRole("button", { name: "Đi", exact: true }).isVisible().catch(() => false);
      const hasNo = await sheet.getByRole("button", { name: "Thôi", exact: true }).isVisible().catch(() => false);
      check("thẻ có Đi + Thôi", hasGo && hasNo);
      const title = await sheet.locator("p").first().boundingBox();
      check("tóm tắt ≤ 2 dòng", title && title.height <= 2 * 1.375 * 16 + 4, title && title.height);
      r.shots.push(await shot(page, "d1-tom-tat-di-thoi"));
      // "Thôi" rồi nói lại, lần này "đi" bằng giọng
      await sheet.getByRole("button", { name: "Thôi", exact: true }).click();
      check("Thôi ⇒ nói chưa chạy", await waitSpoken(page, /chưa chạy/i, 5000));
      await closeRouteAndSen(page);
      await senAskFresh(page, "dẫn về cảng Sa Huỳnh");
      await waitSpoken(page, /Nói đi để bắt đầu/, 120_000, true);
      const nDi = (await spoken(page)).length;
      await senAsk(page, "đi");
      const bd = await waitSpoken(page, /Bắt đầu dẫn đường/, 10_000, nDi);
      check("'đi' ⇒ bắt đầu dẫn đường (nghe được câu đáp)", bd, bd ?? (await spoken(page)).slice(nDi).join(" / "));
      await waitSpoken(page, /Sen Biển canh và đọc cảnh báo/, 10_000, nDi);
      const sauDi = (await spoken(page)).slice(nDi);
      const iTron = sauDi.findIndex((x) => /Sen Biển canh và đọc cảnh báo/.test(x));
      const iBanTin = sauDi.findIndex((x) => /Bản tin lúc|Máy chưa có tin bão/.test(x));
      check("câu đáp 'đi' đọc TRỌN, bản tin không cắt ngang", iTron >= 0 && (iBanTin < 0 || iBanTin > iTron), sauDi.slice(0, 4).join(" / "));
      r.notes.push("sau 'đi': " + (await page.evaluate((n) => window.__spoken.filter((s) => s.text && s.text.trim()).slice(n).map((s) => `${s.t % 100000} ${s.kind}: ${s.text}`).join(" / "), nDi)));
      await sleep(1500);
      check("HUD 'Đang dẫn đường'", await page.getByText("Đang dẫn đường", { exact: true }).first().isVisible().catch(() => false));
      r.shots.push(await shot(page, "d2-dang-dan-duong"));
      const fish = page.getByRole("button", { name: "Sen Biển — nói lệnh" });
      const cmd = async (text) => {
        if (!(await page.getByRole("dialog", { name: "Sen Biển" }).isVisible().catch(() => false))) await fish.click();
        return senAsk(page, text);
      };
      const far = await cmd("còn bao xa");
      check("còn bao xa ⇒ 'Còn … chừng …'", far && /^Còn .*(hải lý|km|m)/.test(far), far);
      r.shots.push(await shot(page, "d3-con-bao-xa"));
      const mute = await cmd("im đi");
      check("im ⇒ tắt giọng", mute && /(tắt|im|không đọc)/i.test(mute), mute);
      const unm = await cmd("bật tiếng");
      check("bật tiếng ⇒ bật lại", unm && /(bật|đọc)/i.test(unm), unm);
      const n0 = (await spoken(page)).length;
      const rep = await cmd("nhắc lại");
      await sleep(1500);
      const after = (await spoken(page)).slice(n0);
      check("nhắc lại ⇒ đọc lại câu vừa rồi", /Đọc lại/.test(rep ?? "") && after.length > 0, `${rep} | ${after.join(" / ")}`);
      const stop = await cmd("dừng");
      await sleep(1500);
      check("dừng ⇒ hết HUD, hết khung dẫn đường", !(await hudVisible(page)) && !(await page.getByText("Đang dẫn đường", { exact: true }).first().isVisible().catch(() => false)), stop);
      r.shots.push(await shot(page, "d4-dung"));
      r.notes.push(...(await spoken(page)).slice(-16));
      await ctx.close();
    });

    await flow("i", "Tự nghe sau tóm tắt: đọc XONG mới bật mic, 'Đang nghe…', nói 'đi' ⇒ dẫn đường KHÔNG chạm; im 5 s ⇒ tắt êm", async ({ check, r }) => {
      const ctx = await newCtx({ gps: STILL_NEAR_SA_HUYNH });
      const page = await ctx.newPage();
      watchPage(page, ctx.__net);
      await openMap(page);
      await unlockAudio(page);
      await stopCruise(page);
      const sheet = page.getByRole("dialog", { name: "Sen Biển" });
      // lượt 1: im lặng — mic tự bật rồi tự tắt êm, nút Đi/Thôi còn nguyên
      await senAskFresh(page, "dẫn về cảng Sa Huỳnh"); // chạm mic một lần (micro được cho phép)
      const nSr1 = await page.evaluate(() => window.__srLog.length);
      await waitSpoken(page, /Nói đi để bắt đầu/, 120_000);
      const lis1 = await waitListen(page, nSr1, 8000);
      const end1 = await endOf(page, /noi_di\.mp3|Nói đi để bắt đầu/);
      check("mic tự bật SAU khi câu tóm tắt đọc xong", lis1 && end1 && lis1.t >= end1.t, lis1 && end1 ? `xong ${end1.t % 100000} → mic ${lis1.t % 100000} (+${lis1.t - end1.t} ms)` : `${JSON.stringify(lis1)} ${JSON.stringify(end1)}`);
      check("lúc mic bật loa đã im (không thu tiếng máy)", lis1 && !lis1.synthBusy && !lis1.audioBusy, JSON.stringify(lis1));
      check("thẻ hiện 'Đang nghe…'", await sheet.getByText("Đang nghe…").isVisible().catch(() => false));
      r.shots.push(await shot(page, "i1-dang-nghe"));
      await sleep(5800);
      const log1 = await page.evaluate((n) => window.__srLog.slice(n), nSr1);
      check("im 5 s ⇒ mic tự tắt", log1.some((e) => e.ev === "abort"), log1.map((e) => e.ev).join(","));
      check("tắt êm: không 'chưa nghe rõ', Đi/Thôi vẫn đó, hết 'Đang nghe…'",
        !(await sheet.getByText(/chưa nghe rõ/).isVisible().catch(() => false)) &&
        (await sheetHas(page, "Đi")) && (await sheetHas(page, "Thôi")) &&
        !(await sheet.getByText("Đang nghe…").isVisible().catch(() => false)));
      r.shots.push(await shot(page, "i2-im-tat-em"));
      // lượt 2: nói "đi" vào lượt tự nghe — KHÔNG chạm gì
      await sheet.getByRole("button", { name: "Thôi", exact: true }).click();
      await waitSpoken(page, /chưa chạy/i, 5000);
      await closeRouteAndSen(page);
      const icon = page.getByRole("button", { name: /^Sen Biển — nói/ }).first();
      await icon.click({ timeout: 10_000 });
      await sheet.waitFor({ timeout: 5000 });
      await senAsk(page, "dẫn về cảng Sa Huỳnh");
      const nSp = (await spoken(page)).length;
      const nSr2 = await page.evaluate(() => window.__srLog.length);
      await waitSpoken(page, /Nói đi để bắt đầu/, 120_000, nSp);
      const lis2 = await waitListen(page, nSr2, 8000);
      check("lượt 2: mic tự bật sau tóm tắt", !!lis2);
      let clicks = 0;
      await page.exposeFunction("__countClick", () => clicks++).catch(() => {});
      await page.evaluate(() => document.addEventListener("click", () => window.__countClick?.(), true));
      const nDi = (await spoken(page)).length;
      await page.evaluate(() => window.__say.push("đi"));
      const bd = await waitSpoken(page, /Bắt đầu dẫn đường/, 10_000, nDi);
      check("nói 'đi' ⇒ 'Bắt đầu dẫn đường' — không chạm", bd && clicks === 0, `${bd} · chạm=${clicks}`);
      await page.getByRole("button", { name: "Dừng", exact: true }).first().waitFor({ timeout: 10_000 }).catch(() => {});
      check("HUD dẫn đường hiện (nút Dừng)", await hudVisible(page));
      r.shots.push(await shot(page, "i3-di-khong-cham"));
      await ctx.close();
    });

    await flow("n", "Đo độ trễ một vòng nói–nghe: tóm tắt → 'đi' → dẫn (ms)", async ({ check, r }) => {
      const runs = [];
      for (let k = 0; k < 3; k++) {
        const ctx = await newCtx({ gps: STILL_NEAR_SA_HUYNH });
        const page = await ctx.newPage();
        watchPage(page, ctx.__net);
        await openMap(page);
        await unlockAudio(page);
        await stopCruise(page);
        const nSp = (await page.evaluate(() => window.__spoken.length));
        const nSr = await page.evaluate(() => window.__srLog.length);
        await senAskFresh(page, "dẫn về cảng Sa Huỳnh");
        await waitSpoken(page, /Nói đi để bắt đầu/, 120_000);
        const end = await endOf(page, /noi_di\.mp3|Nói đi để bắt đầu/, 15_000);
        const tom = await page.evaluate((n) => window.__spoken.slice(n).find((s) => /Tới Sa Huỳnh/.test(s.text)), nSp);
        // bản mới tự nghe; bản cũ không ⇒ "người" chạm nút Nói NGAY (0 ms nghĩ — có lợi cho bản cũ)
        let lis = await waitListen(page, nSr, 1500, tom?.t ?? 0);
        let tap = false;
        if (!lis) {
          tap = true;
          await page.getByRole("dialog", { name: "Sen Biển" }).getByRole("button", { name: /^(Nói|Nghe…)$/ }).click();
          lis = await waitListen(page, nSr, 3000, tom?.t ?? 0);
        }
        // HUD = nút "Dừng" (đã Dừng chạy ở đầu luồng). KHÔNG dò chữ "Đang dẫn đường":
        // nút rail của khung dẫn đường cũng mang đúng chữ đó khi khung mở
        const hudOn = () => hudVisible(page);
        const hudTruoc = await hudOn();
        const nDi = await page.evaluate(() => window.__spoken.length);
        const tPush = await page.evaluate(() => {
          window.__say.push("đi");
          return Date.now();
        });
        const t0 = Date.now();
        let fin = null;
        let bd = null;
        let hud = null;
        while (Date.now() - t0 < 15_000 && !(bd && hud)) {
          fin ??= await page.evaluate((m) => window.__srLog.find((e) => e.ev === "final" && e.t >= m) ?? null, tPush);
          bd ??= await page.evaluate((n) => window.__spoken.slice(n).find((s) => /bat_dau_dan|Bắt đầu dẫn đường/.test(s.text)) ?? null, nDi);
          if (!hud && (await hudOn())) hud = { t: await page.evaluate(() => Date.now()) };
          await sleep(50);
        }
        if (hudTruoc) r.notes.push(`lượt ${k}: chữ 'Đang dẫn đường' đã hiện TRƯỚC khi nói 'đi' — mốc HUD không tin được`);
        // câu đáp ngắn: "còn bao xa" — từ nghe xong tới bắt đầu đọc đáp
        const fish = page.getByRole("button", { name: "Sen Biển — nói lệnh" });
        if (!(await page.getByRole("dialog", { name: "Sen Biển" }).isVisible().catch(() => false))) await fish.click().catch(() => {});
        await sleep(2500);
        const nFar = await page.evaluate(() => window.__spoken.length);
        const nSrFar = await page.evaluate(() => window.__srLog.length);
        await senAsk(page, "còn bao xa");
        const finFar = await page.evaluate((n) => window.__srLog.slice(n).find((e) => e.ev === "final") ?? null, nSrFar);
        const far = await page.evaluate((n) => window.__spoken.slice(n).find((s) => /^Còn /.test(s.text) || /\.mp3/.test(s.text)) ?? null, nFar);
        const farEnd = await page.evaluate((n) => window.__ends.filter((e) => e.t >= (window.__spoken[n]?.t ?? 0)).at(-1) ?? null, nFar);
        const one = {
          tap,
          tomTatDocMs: tom && end ? end.t - tom.t : null,
          xongToiMicMs: end && lis ? lis.t - end.t : null,
          ngheXongToiDapMs: fin && bd ? bd.t - fin.t : null,
          vongTomTatDiDanMs: tom && hud ? hud.t - tom.t : null,
          xongTomTatToiHudMs: end && hud ? hud.t - end.t : null,
          noiDiToiNgheXongMs: fin ? fin.t - tPush : null,
          conBaoXaDapMs: finFar && far ? far.t - finFar.t : null,
          conBaoXaDocMs: far && farEnd ? farEnd.t - far.t : null,
        };
        runs.push(one);
        r.notes.push(JSON.stringify(one));
        await ctx.close();
      }
      const med = (k) => {
        const v = runs.map((x) => x[k]).filter((x) => x != null).sort((a, b) => a - b);
        return v.length ? v[Math.floor(v.length / 2)] : null;
      };
      const sum = Object.fromEntries(Object.keys(runs[0]).filter((k) => k !== "tap").map((k) => [k, med(k)]));
      sum.tap = runs.some((x) => x.tap);
      r.notes.push("TRUNG VỊ: " + JSON.stringify(sum));
      writeFileSync(join(OUT, `do-tre-${process.env.E2E_LABEL ?? "build"}.json`), JSON.stringify({ runs, median: sum }, null, 2));
      check("đo đủ 3 lượt", runs.every((x) => x.vongTomTatDiDanMs != null && x.ngheXongToiDapMs != null), JSON.stringify(sum));
    });

    await flow("e", "Dẫn đường bằng tay: Tính lộ trình, điểm trên tuyến, 429, thiếu dự báo, chạm 2 lần không zoom", async ({ check, r }) => {
      const ctx = await newCtx({ gps: STILL_NEAR_SA_HUYNH });
      const page = await ctx.newPage();
      watchPage(page, ctx.__net);
      await openMap(page);
      await unlockAudio(page);
      await stopCruise(page);
      const out = await manualRoute(page, { check, r, tag: "e1" });
      if (out.ok) {
        const pts = page.getByText(/Các điểm trên tuyến/).first();
        check("có 'Các điểm trên tuyến'", await pts.isVisible().catch(() => false));
        if (await pts.isVisible().catch(() => false)) {
          await pts.click();
          await sleep(800);
          r.shots.push(await shot(page, "e2-diem-tren-tuyen"));
          const rows = await page.locator("text=/\\d+°\\d+′/").count();
          check("danh sách điểm có toạ độ", rows >= 2, rows);
        }
      }
      // chạm 2 lần trong chế độ dẫn đường: bản đồ KHÔNG phóng to
      const z = await dblTap(page, { x: 140, y: 200 });
      check("chạm 2 lần (đang dẫn đường) không zoom", z.known && !z.zoomed, z.detail);
      await ctx.close();

      // 429
      const ctx2 = await newCtx({ gps: STILL_NEAR_SA_HUYNH, meteo: "429" });
      const p2 = await ctx2.newPage();
      watchPage(p2, ctx2.__net);
      await openMap(p2);
      await unlockAudio(p2);
      await stopCruise(p2);
      const o2 = await manualRoute(p2, { check: () => {}, r, tag: "e3-429" });
      const body2 = await p2.locator("body").innerText();
      // 656e3ce: gió sóng tuyến lấy từ server mình (routegrid) — điện thoại không gọi
      // Open-Meteo nữa, nên 429 ở Open-Meteo KHÔNG được làm bà con thấy "quá tải"
      check("Open-Meteo 429 không lọt ra màn (tuyến lấy gió sóng từ server mình)", !/quá tải/.test(body2), (body2.match(/[^\n]*quá tải[^\n]*/) ?? [""])[0]);
      check("429 vẫn ra tuyến (theo hải đồ)", o2.ok, o2.msg);
      r.shots.push(await shot(p2, "e3-429-qua-tai"));
      await ctx2.close();

      // thiếu dự báo (Open-Meteo hỏng hẳn) vẫn ra tuyến
      const ctx3 = await newCtx({ gps: STILL_NEAR_SA_HUYNH, meteo: "500" });
      const p3 = await ctx3.newPage();
      watchPage(p3, ctx3.__net);
      await openMap(p3);
      await unlockAudio(p3);
      await stopCruise(p3);
      const o3 = await manualRoute(p3, { check: () => {}, r, tag: "e4-thieu-du-bao" });
      const body3 = await p3.locator("body").innerText();
      check("thiếu dự báo vẫn ra tuyến", o3.ok && !/Chưa tìm được đường/.test(body3), o3.msg);
      await ctx3.close();

      // ngoài dẫn đường: chạm 2 lần vẫn zoom như cũ
      const ctx4 = await newCtx({ gps: STILL_NEAR_SA_HUYNH });
      const p4 = await ctx4.newPage();
      await openMap(p4);
      await unlockAudio(p4);
      await stopCruise(p4);
      const z4 = await dblTap(p4, { x: 140, y: 200 });
      check("xem thường: chạm 2 lần vẫn zoom (đối chứng)", z4.zoomed, z4.detail);
      await ctx4.close();
    });

    await flow("f", "Mất mạng: mở lại bản đồ, Sen Biển ô gõ, mp3 vẫn phát, hiểu ý vẫn chạy", async ({ check, r }) => {
      const ctx = await newCtx({ gps: STILL_NEAR_SA_HUYNH });
      const page = await ctx.newPage();
      watchPage(page, ctx.__net);
      await openMap(page);
      await unlockAudio(page);
      // chờ SW nhận trang + tải sẵn model & mp3 (hẹn 8 s sau khi mở)
      await page.evaluate(() => navigator.serviceWorker?.ready.then(() => true)).catch(() => false);
      await sleep(25_000);
      const warmed = ctx.__net.data.filter((u) => /sen-bien-ngram|\.mp3/.test(u)).length;
      r.notes.push(`đã tải sẵn ${warmed} lượt model/mp3 khi còn sóng`);
      await ctx.setOffline(true);
      await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
      // micro giả không tự biết mất mạng khi navigator.onLine còn true — báo cho nó
      await page.evaluate(() => (window.__offline = true)).catch(() => {});
      const ok = await page
        .waitForSelector("canvas.maplibregl-canvas", { timeout: 60_000 })
        .then(() => true)
        .catch(() => false);
      check("mất mạng: mở lại được bản đồ", ok);
      await sleep(4000);
      await unlockAudio(page);
      r.shots.push(await shot(page, "f1-mat-mang-mo-lai"));
      await stopCruise(page);
      // nhãn icon đổi THEO TRẠNG THÁI từ 2026-10-19 (lib/sen-bien-state.ts `senAria`):
      // "Sen Biển — chạm để nói" / "đang nói" / "đang nghe" / "không nghe được — chạm để gõ"
      // (± "· đang canh dẫn đường"). Mở lại bản đồ là đang đọc bản tin ⇒ thường "đang nói".
      const icon = page.getByRole("button", { name: /^Sen Biển/ }).first();
      await icon.click({ timeout: 10_000 });
      await sleep(1000);
      const input = page.getByRole("textbox", { name: "Nhắn Sen Biển" });
      r.notes.push(`navigator.onLine khi mất mạng = ${await page.evaluate(() => navigator.onLine)}`);
      const imgOk = await page.evaluate(() =>
        [...document.querySelectorAll('img[src="/icons/sen-bien.png"]')].every((i) => i.complete && i.naturalWidth > 0),
      );
      check("mất sóng: ảnh con cá Sen Biển vẫn hiện (không vỡ)", imgOk);
      /* Từ 2026-10-18 mất sóng thì bong bóng NÓI "Mất sóng nên máy chưa nghe được. Bà con
         chạm ô chat để gõ." kèm nút "Nhắn chữ" — chạm như bà con, không tự bung ô gõ. */
      if (!(await input.isVisible().catch(() => false))) {
        await page.getByRole("button", { name: "Nhắn chữ" }).first().click({ timeout: 8000 }).catch(() => {});
      }
      check(
        "mất sóng: Sen Biển chuyển sang ô gõ",
        await input
          .waitFor({ timeout: 8000 })
          .then(() => true)
          .catch(() => false),
      );
      r.shots.push(await shot(page, "f2-o-go"));
      const n0 = (await spoken(page)).length;
      await input.fill("dẫn về cảng Sa Huỳnh");
      await page.getByRole("button", { name: "Gửi" }).click();
      /* Từ giọng ghép mảnh (2026-10-18) câu xác nhận là mp3 "Đang vẽ đường." thay vì
         "Đi Sa Huỳnh…"; tóm tắt tuyến có thể chỉ hiện chữ trên ngăn dẫn đường
         ("N hải lý · M phút") — nhận cả hai, chữ trên màn là bằng chứng tuyến đã vẽ. */
      const hieu = await waitSpoken(page, /Đi Sa Huỳnh|Đang vẽ đường/, 10_000, n0);
      check("mất sóng: hiểu ý vẫn chạy", hieu, hieu);
      const tom = await waitSpoken(page, /Tới Sa Huỳnh|Chưa vẽ được/, 60_000);
      const tuyenTrenMan = await page
        .getByText(/\d+ hải lý · \d+ (phút|giờ)/)
        .first()
        .isVisible()
        .catch(() => false);
      check(
        "mất sóng: vẫn vẽ được đường tới Sa Huỳnh",
        (tom && /Tới Sa Huỳnh/.test(tom)) || (tuyenTrenMan && !/Chưa vẽ được/.test(tom ?? "")),
        tom ?? (tuyenTrenMan ? "tuyến hiện trên ngăn dẫn đường" : null),
      );
      const wk = await page.evaluate(() => window.__workers.filter((w) => /turbopack-worker/.test(w.url)));
      check("mất sóng: worker tìm đường dựng được (không lỗi)", wk.length > 0 && wk.every((w) => w.errors.length === 0), JSON.stringify(wk.map((w) => w.errors)));
      // một câu cố định có mp3: "Dạ, chưa chạy…" khi bấm Thôi
      const thoi = page.getByRole("dialog", { name: "Sen Biển" }).getByRole("button", { name: "Thôi", exact: true });
      if (await thoi.isVisible().catch(() => false)) await thoi.click();
      await sleep(2500);
      const after = (await spoken(page)).slice(n0);
      const mp3 = after.filter((x) => x.startsWith("mp3: "));
      const mp3err = after.filter((x) => x.startsWith("mp3-err"));
      check("mất sóng: mp3 vẫn phát (từ kho SW)", mp3.length > 0 && mp3err.length === 0, after.join(" / "));
      r.shots.push(await shot(page, "f3-mat-mang-ve-duong"));
      await ctx.close();
    });

    await flow("g", "Cài đặt → Giọng đọc: tắt 'Mở bản đồ là tự đọc' ⇒ mở lại không tự chạy", async ({ check, r }) => {
      const ctx = await newCtx({ gps: STILL_NEAR_SA_HUYNH });
      const page = await ctx.newPage();
      watchPage(page, ctx.__net);
      await openMap(page);
      await unlockAudio(page);
      await stopCruise(page);
      await openSettings(page);
      const sw = page.getByRole("switch", { name: /Mở bản đồ là tự đọc/ });
      await sw.scrollIntoViewIfNeeded();
      r.shots.push(await shot(page, "g1-cai-dat-giong"));
      check("công tắc đang Bật", (await sw.getAttribute("aria-checked")) === "true");
      await sw.click();
      check("bấm ⇒ Tắt", (await sw.getAttribute("aria-checked")) === "false");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("canvas.maplibregl-canvas", { timeout: 90_000 });
      await sleep(5000);
      await unlockAudio(page);
      check("mở lại: KHÔNG tự Đang chạy", !(await hudVisible(page)));
      r.shots.push(await shot(page, "g2-mo-lai-khong-tu-chay"));
      // bật lại cho máy về mặc định
      await openSettings(page);
      await page.getByRole("switch", { name: /Mở bản đồ là tự đọc/ }).click();
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("canvas.maplibregl-canvas", { timeout: 90_000 });
      await sleep(5000);
      check("bật lại ⇒ mở là tự chạy", await hudVisible(page));
      await ctx.close();
    });

    await flow("h", "Request lúc mở bản đồ: không trùng tải, không lỗi console", async ({ check, r }) => {
      const ctx = await newCtx({ gps: STILL_NEAR_SA_HUYNH });
      const page = await ctx.newPage();
      watchPage(page, ctx.__net);
      await openMap(page);
      await unlockAudio(page);
      await sleep(25_000);
      // tính một tuyến để worker tìm đường chạy
      await stopCruise(page);
      await manualRoute(page, { check: () => {}, r, tag: "h-tuyen" });
      const workers = await page.evaluate(() => window.__workers);
      r.notes.push(...workers.map((w) => `worker ${w.url} lỗi: ${w.errors.join(" | ") || "không"}`));
      check("worker không lỗi", workers.every((w) => w.errors.length === 0), JSON.stringify(workers));
      const count = {};
      for (const u of ctx.__net.data) {
        // /api: id trong query là file khác nhau; /data + mp3: bỏ query
        const k = u.startsWith("/api/") ? u : u.split("?")[0];
        count[k] = (count[k] ?? 0) + 1;
      }
      // .pmtiles đọc theo khúc (Range) nên nhiều lượt là đúng
      const dup = Object.entries(count).filter(([k, n]) => n > 1 && !/\/api\/tiles\/|\.pmtiles$/.test(k));
      writeFileSync(
        join(OUT, "h-requests.json"),
        JSON.stringify({ count, sw: ctx.__net.sw?.length ?? 0, bad: ctx.__net.bad, failed: ctx.__net.failed, console: ctx.__net.console }, null, 2),
      );
      /*  /api: nhiều màn tự hỏi (banner bão + bản đồ…), không thuộc phạm vi rà.
          Đảo / rạn / luồng ×2 là ĐÚNG: lớp vẽ MapLibre (luồng worker) + bộ canh
          Đang chạy (luồng chính) — hai nơi khác luồng, cả hai trúng kho SW. */
      const TWO_OK = ["/data/vn-islands.v1.json", "/data/coral-reefs.v1.json", "/data/vn-sea-lanes.v1.json"];
      const dupBad = dup.filter(([k, n]) => !k.startsWith("/api/") && !(TWO_OK.includes(k) && n <= 2));
      r.notes.push(`trùng (chấp nhận): ${dup.filter((d) => !dupBad.includes(d)).map(([k, n]) => `${k}×${n}`).join(", ")}`);
      check("không tải trùng file dữ liệu / mp3 / model", dupBad.length === 0, dupBad.map(([k, n]) => `${k}×${n}`).join(", "));
      check("model hiểu ý tải đúng 1 lượt", count["/data/sen-bien-ngram.v6.bin"] === 1, count["/data/sen-bien-ngram.v6.bin"]);
      const big = ["/data/sen-bien-ngram.v6.bin", "/data/vn-islands.v1.json", "/data/coral-reefs.v1.json"];
      for (const b of big) r.notes.push(`${b}: ${count[b] ?? 0} lượt`);
      // lỗi do MÔI TRƯỜNG chạy thử (demo mode không khoá dữ liệu, máy không có kho
      // snapshot dự báo, nguồn ô hải đồ ngoài chập chờn) — ghi lại, không tính
      // 50x routegrid: demo mode không có kho weather_snapshot để server lưu ô (máy thật có)
      const ENV = [/^404 \/api\/weather-snapshot/, /^50\d \/api\/weather-snapshot\?id=routegrid/, /^503 \/api\/data-key/, /^50\d \/api\/tiles\//, /^(401|503) \/api\/me\//];
      const bad = [...new Set(ctx.__net.bad ?? [])];
      const badReal = bad.filter((b) => !ENV.some((re) => re.test(b)));
      r.notes.push(`HTTP lỗi do môi trường: ${bad.filter((b) => !badReal.includes(b)).join(", ")}`);
      check("không có request lỗi (ngoài lỗi môi trường demo)", badReal.length === 0, badReal.join(", "));
      const errs = ctx.__net.console.filter(
        (c) => /\[(error|pageerror)\]/.test(c) && !/Failed to load resource/.test(c) && !/Lỗi tải bản đồ: .*\/api\/tiles\//.test(c),
      );
      check("không lỗi console (ngoài request lỗi đã xét)", errs.length === 0, errs.slice(0, 5).join(" || "));
      check("không có 'Missing worker bootstrap config'", !ctx.__net.console.some((c) => /worker bootstrap/.test(c)));
      await ctx.close();
    });
  } finally {
    await browser.close();
    stopServer(server.child);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 2;
  })
  .finally(() => {
    writeFileSync(join(OUT, "ket-qua.json"), JSON.stringify(results, null, 2));
    const bad = results.filter((r) => !r.ok);
    console.log(`\n${results.length - bad.length}/${results.length} luồng ĐẠT. Ảnh + ket-qua.json: ${OUT}`);
    if (bad.length && !process.exitCode) process.exitCode = 1;
  });
