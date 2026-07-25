/**
 * SINH SÁCH HƯỚNG DẪN CÓ ẢNH — chụp màn hình THẬT của app rồi đánh số lên
 * đúng vị trí từng nút, kèm mô tả nút đó làm gì.
 *
 *   npm run guide            (cần dev server đang chạy ở localhost:3000)
 *
 * Đầu ra:  public/huong-dan.html  +  public/huong-dan/<màn>.png
 * Nội dung (lời + danh sách nút) nằm ở scripts/guide-content.mjs — sửa ở đó.
 *
 * Vì sao chụp bằng script chứ không chụp tay: UI đổi thì chạy lại một lệnh là
 * sách khớp lại, không bao giờ có ảnh cũ mô tả nút đã đổi.
 *
 * Màn khoá sau đăng nhập (Giấy tờ, Dịch vụ, Bạn thuyền, Hiệu quả, Công nợ)
 * được chụp bằng cách GIẢ PHIÊN ĐĂNG NHẬP NGAY TRONG TRÌNH DUYỆT CHỤP:
 * đặt cookie phiên giả + chặn lời gọi kiểm tra tài khoản của Supabase và trả
 * về một người dùng mẫu. KHÔNG dùng tài khoản thật, KHÔNG sửa code auth của
 * app, không có gì trong này lọt vào bản chạy thật.
 */
import puppeteer from "puppeteer";
import sharp from "sharp";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { prose, screens, sdvicoAssets, seed } from "./guide-content.mjs";

const BASE = process.env.GUIDE_BASE_URL ?? "http://localhost:3000";
const REF = "znzgugvfhgmiszqgjulk"; // project ref Supabase (chỉ để đặt tên cookie)
const OUT_DIR = resolve("public/huong-dan");
const OUT_HTML = resolve("public/huong-dan.html");
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2 };

const CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

// ─────────────────────────────────────────────────────── phiên giả để chụp

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const EXP = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
const DEMO_PHONE = "0909123456";
const DEMO_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: `${DEMO_PHONE}@sdvico.local`,
  phone: "",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Nguyễn Văn Hai" },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
const FAKE_JWT = [
  b64url({ alg: "HS256", typ: "JWT" }),
  b64url({
    sub: DEMO_USER.id,
    email: DEMO_USER.email,
    role: "authenticated",
    aud: "authenticated",
    exp: EXP,
    iat: Math.floor(Date.now() / 1000),
    session_id: "11111111-1111-4111-8111-111111111111",
  }),
  "stub",
].join(".");
const SESSION_COOKIE =
  "base64-" +
  Buffer.from(
    JSON.stringify({
      access_token: FAKE_JWT,
      token_type: "bearer",
      expires_in: 31536000,
      expires_at: EXP,
      refresh_token: "stub-refresh",
      user: DEMO_USER,
    }),
  ).toString("base64url");

const CORS = {
  "Access-Control-Allow-Origin": BASE,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// ─────────────────────────────────────────────────────────────────── chụp

async function preparePage(page) {
  await page.setViewport(VIEWPORT);
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes(`${REF}.supabase.co/auth/v1/user`)) {
      return req.method() === "OPTIONS"
        ? req.respond({ status: 204, headers: CORS, body: "" })
        : req.respond({
            status: 200,
            contentType: "application/json",
            headers: CORS,
            body: JSON.stringify(DEMO_USER),
          });
    }
    if (url.includes("/api/me/sdvico")) {
      return req.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sdvicoAssets),
      });
    }
    req.continue();
  });

  await page.setCookie({
    name: `sb-${REF}-auth-token`,
    value: SESSION_COOKIE,
    domain: new URL(BASE).hostname,
    path: "/",
  });

  await page.evaluateOnNewDocument(() => {
    // giấu huy hiệu dev-tools của Next (chỉ có khi chạy dev) — không phải giao
    // diện bà con nhìn thấy, lọt vào ảnh là gây hiểu nhầm
    const css = document.createElement("style");
    css.textContent =
      "nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.append(css));
  });

  await page.evaluateOnNewDocument((s) => {
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put("forfish.boats.v1", s.boats);
    localStorage.setItem("forfish.currentBoat.v1", s.currentBoat);
    put("forfish.documents.v1", s.documents);
    put("forfish.crew.v1", s.crew);
    put("forfish.trips.v1", s.trips);
    put("forfish.debts.v1", s.debts);
    put("forfish.products.v1", s.products);
    put("forfish.maintenance.v1", s.maintenance);
    // đã xem hướng dẫn trên màn → lớp chỉ dẫn không che ảnh chụp
    put("forfish.tour.v1", ["trang-chu", "ra-khoi", "tau", "ban-thuyen", "tien", "cang"]);
  }, seed);
}

/** Đo vị trí từng nút được đánh số (đơn vị %, để ảnh co giãn vẫn đúng chỗ). */
async function measure(page, marks) {
  return page.evaluate((list) => {
    window.scrollTo(0, 0);
    // đo theo ĐÚNG khung được chụp (clientWidth/Height), không theo scrollHeight
    const docW = document.documentElement.clientWidth;
    const docH = document.documentElement.clientHeight;
    const pick = (m) => {
      if (m.sel) {
        for (const sel of m.sel.split(",")) {
          const el = document.querySelector(sel.trim());
          if (el) return el;
        }
      }
      if (m.text) {
        const root = m.scope ? document.querySelector(m.scope) : document;
        if (!root) return null;
        const nodes = [...root.querySelectorAll("button, a, input, label")];
        return (
          nodes.find((n) => (n.innerText || n.value || "").trim().includes(m.text)) ?? null
        );
      }
      return null;
    };
    return list.map((m) => {
      const el = pick(m);
      if (!el) return { found: false };
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return { found: false };
      return {
        found: true,
        x: ((r.left + window.scrollX) / docW) * 100,
        y: ((r.top + window.scrollY) / docH) * 100,
        w: (r.width / docW) * 100,
        h: (r.height / docH) * 100,
      };
    });
  }, marks);
}

async function captureScreen(browser, screen) {
  const page = await browser.newPage();
  await preparePage(page);
  await page.goto(BASE + screen.url, { waitUntil: "networkidle2", timeout: 60000 });
  if (screen.click) {
    await page.waitForSelector(screen.click, { timeout: 15000 }).catch(() => {});
    await page.click(screen.click).catch(() => {});
  }
  await new Promise((r) => setTimeout(r, screen.settle ?? 2000));

  // Cao bằng cả trang RỒI mới chụp, thay vì screenshot fullPage: dock và các
  // lớp nổi dùng `position: fixed` — chụp fullPage thì trình duyệt dựng chúng
  // ở đáy ảnh dài, trong khi toạ độ đo được là theo khung 844px → số bị lệch
  // khỏi nút. Cùng một khung thì đo đâu vẽ đó.
  if (screen.tallShot !== false) {
    const docH = await page.evaluate(() => document.documentElement.scrollHeight);
    if (docH > VIEWPORT.height) {
      await page.setViewport({ ...VIEWPORT, height: Math.min(docH, 4000) });
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  // WebP thay PNG: cùng bộ ảnh PNG nặng ~5,7 MB (bản đồ là ảnh vệ tinh) —
  // nặng cho repo và cho cache offline của PWA. WebP q80 giữ chữ vẫn sắc.
  const file = `${screen.id}.webp`;
  const shotBuf = await page.screenshot({ type: "png" });
  await sharp(shotBuf).webp({ quality: 80 }).toFile(resolve(OUT_DIR, file));

  const rects = await measure(page, screen.marks ?? []);
  const dims = await page.evaluate(() => ({
    w: document.documentElement.clientWidth,
    h: document.documentElement.clientHeight,
  }));

  const marks = [];
  const missing = [];
  (screen.marks ?? []).forEach((m, i) => {
    if (rects[i]?.found) marks.push({ ...m, ...rects[i], n: marks.length + 1 });
    else missing.push(m.label);
  });
  // Nút không tìm thấy thường do nhãn đã đổi chữ — in ra nhãn ĐANG CÓ trên màn
  // để sửa guide-content.mjs cho khớp, khỏi phải mò.
  const seen = missing.length
    ? await page.evaluate(() =>
        [...document.querySelectorAll("button, a")]
          .map((e) => e.innerText.trim().replace(/\s+/g, " "))
          .filter(Boolean)
          .slice(0, 24),
      )
    : [];
  await page.close();
  return { id: screen.id, file, dims, marks, missing, seen };
}

// ────────────────────────────────────────────────────────────── sinh HTML

const esc = (s) =>
  String(s).replace(/&(?![a-z#]+;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function figure(screen, shot) {
  const badges = shot.marks
    .map(
      (m) =>
        `<span class="mk" style="left:${m.x.toFixed(2)}%;top:${m.y.toFixed(2)}%;width:${m.w.toFixed(2)}%;height:${m.h.toFixed(2)}%"><b>${m.n}</b></span>`,
    )
    .join("");
  const rows = shot.marks
    .map(
      (m) =>
        `<tr><td class="num">${m.n}</td><td class="btn">${esc(m.label)}</td><td>${esc(m.desc)}</td></tr>`,
    )
    .join("");
  return `
<section id="${screen.id}">
  <h2>${esc(screen.title)}</h2>
  <p class="lead">${esc(screen.lead)}</p>
  <figure class="shot">
    <div class="frame">
      <img src="huong-dan/${shot.file}" alt="Ảnh màn ${esc(screen.title)}" width="${shot.dims.w}" height="${shot.dims.h}">
      ${badges}
    </div>
    <figcaption>Ảnh chụp từ chính app — số trên ảnh ứng với bảng bên dưới.</figcaption>
  </figure>
  <div class="scroll">
  <table>
    <tr><th>#</th><th>Nút</th><th>Làm gì</th></tr>
    ${rows}
  </table>
  </div>
  ${screen.note ? `<div class="note">${screen.note}</div>` : ""}
  ${screen.warn ? `<div class="warn">${esc(screen.warn)}</div>` : ""}
</section>`;
}

function proseSection(p) {
  const blocks = (p.blocks ?? [])
    .map((b) => {
      if (b.note) return `<div class="note">${b.note}</div>`;
      const h = b.h3 ? `<h3>${esc(b.h3)}</h3>` : "";
      if (b.steps) return `${h}<ol class="steps">${b.steps.map((s) => `<li>${s}</li>`).join("")}</ol>`;
      return `${h}<p>${b.p}</p>`;
    })
    .join("");
  const items = (p.items ?? [])
    .map((i) => `<h3>${esc(i.q)}</h3><p>${i.a}</p>`)
    .join("");
  return `
<section id="${p.id}">
  <h2>${esc(p.title)}</h2>
  ${p.lead ? `<p class="lead">${esc(p.lead)}</p>` : ""}
  ${blocks}${items}
</section>`;
}

function buildHtml(shots) {
  const toc = [
    { id: prose.intro.id, title: prose.intro.title },
    ...screens.map((s) => ({ id: s.id, title: s.title })),
    { id: prose.faq.id, title: prose.faq.title },
  ]
    .map((t) => `<li><a href="#${t.id}">${esc(t.title)}</a></li>`)
    .join("");

  const body = screens
    .map((s) => figure(s, shots.find((x) => x.id === s.id)))
    .join("");

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Hướng dẫn dùng SDFish</title>
<meta name="description" content="Hướng dẫn dùng app SDFish — ảnh chụp từng màn, đánh số từng nút." />
<!-- FILE NÀY DO MÁY SINH RA — ĐỪNG SỬA TAY.
     Sửa lời ở scripts/guide-content.mjs rồi chạy: npm run guide -->
<style>
  :root{--navy:#14324f;--sea:#2e6b8a;--trim:#e4572e;--bg:#f3f6f8;--field:#eaeff3;
        --line:#dbe3ea;--ink:#1d2c38;--muted:#5b6b78}
  *{box-sizing:border-box}
  body{margin:0;padding:0 1rem 4rem;font-family:"Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif;
       font-size:18px;line-height:1.55;color:var(--ink);background:var(--bg)}
  .wrap{max-width:46rem;margin:0 auto}
  header.top{margin:0 -1rem 1.5rem;padding:2rem 1.25rem 1.75rem;
    background:linear-gradient(150deg,var(--navy) 35%,var(--sea));color:#fff;border-radius:0 0 1.75rem 1.75rem}
  header.top p.kicker{margin:0;font-size:.8rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.65)}
  header.top h1{margin:.25rem 0 .5rem;font-size:2rem;line-height:1.15}
  header.top p.sub{margin:0;color:rgba(255,255,255,.85);font-size:1.0625rem}
  nav.toc{background:#fff;border-radius:1.25rem;padding:1rem 1.25rem;margin-bottom:1.5rem;box-shadow:0 6px 18px -10px rgba(10,30,50,.4)}
  nav.toc h2{margin:0 0 .5rem;font-size:1.125rem;color:var(--navy)}
  nav.toc ol{margin:0;padding-left:1.25rem}
  nav.toc li{margin:.35rem 0}
  a{color:var(--sea)}
  section{background:#fff;border-radius:1.25rem;padding:1.25rem;margin-bottom:1.25rem;box-shadow:0 6px 18px -10px rgba(10,30,50,.35)}
  section>h2{margin:0 0 .25rem;font-size:1.5rem;color:var(--navy);line-height:1.2}
  section>p.lead{margin:0 0 1rem;color:var(--muted)}
  h3{margin:1.5rem 0 .5rem;font-size:1.1875rem;color:var(--navy)}
  figure.shot{margin:0 0 1rem}
  .frame{position:relative;display:block;max-width:320px;margin:0 auto;border-radius:1rem;overflow:hidden;
         border:1px solid var(--line);box-shadow:0 10px 26px -14px rgba(10,30,50,.6);background:#fff}
  .frame img{display:block;width:100%;height:auto}
  .mk{position:absolute;border:3px solid var(--trim);border-radius:.6rem;box-shadow:0 0 0 2px rgba(255,255,255,.85)}
  .mk b{position:absolute;left:-.55rem;top:-.55rem;min-width:1.5rem;height:1.5rem;padding:0 .25rem;
        display:flex;align-items:center;justify-content:center;background:var(--trim);color:#fff;
        border-radius:999px;font-size:.8125rem;line-height:1;box-shadow:0 1px 4px rgba(0,0,0,.35)}
  figcaption{margin-top:.5rem;text-align:center;font-size:.875rem;color:var(--muted)}
  table{width:100%;border-collapse:collapse;margin:.5rem 0 1rem;font-size:1.0625rem}
  th,td{text-align:left;vertical-align:top;padding:.65rem .5rem;border-bottom:1px solid var(--line)}
  th{background:var(--field);color:var(--navy);font-size:.9375rem;text-transform:uppercase;letter-spacing:.05em}
  td.num{width:2.25rem;text-align:center;font-weight:700;color:var(--trim)}
  td.btn{font-weight:700;color:var(--navy)}
  .note{background:#fff8e6;border-left:5px solid #b8860b;padding:.85rem 1rem;border-radius:.5rem;margin:1rem 0;font-size:1rem}
  .warn{background:#fdeceb;border-left:5px solid var(--trim);padding:.85rem 1rem;border-radius:.5rem;margin:1rem 0;font-size:1rem}
  ol.steps{padding-left:1.4rem}
  ol.steps li{margin:.5rem 0}
  .scroll{overflow-x:auto}
  footer{max-width:46rem;margin:2rem auto 0;color:var(--muted);font-size:.9375rem;text-align:center}
  @media print{
    body{background:#fff;font-size:12pt;padding:0}
    header.top{background:none;color:#000;border-radius:0;padding:0 0 1rem;margin:0 0 1rem;border-bottom:2px solid #000}
    header.top p.kicker,header.top p.sub{color:#333}
    section,nav.toc{box-shadow:none;border:1px solid #999;break-inside:avoid;page-break-inside:avoid}
    .frame{max-width:250px;box-shadow:none}
    a{color:#000;text-decoration:none}
  }
</style>
</head>
<body>
<div class="wrap">

<header class="top">
  <p class="kicker">SDFish · Bạn của ngư dân</p>
  <h1>Hướng dẫn dùng app</h1>
  <p class="sub">Ảnh chụp từng màn của app, đánh số từng nút kèm mô tả nút đó làm gì. Bà con đọc phần nào cần phần đó.</p>
</header>

<nav class="toc">
  <h2>Nội dung</h2>
  <ol>${toc}</ol>
</nav>

${proseSection(prose.intro)}
${body}
${proseSection(prose.faq)}

</div>
<footer>
  <p>SDFish — app đồng hành của ngư dân Việt Nam. Mọi số liệu giá cá, mức phạt, dự báo biển đều là <b>tham khảo</b>.<br>
  Ảnh minh hoạ chụp bằng dữ liệu mẫu, không phải số liệu thật của bà con.</p>
</footer>
</body>
</html>
`;
}

// ──────────────────────────────────────────────────────────────────── main

const reachable = await fetch(BASE, { method: "HEAD" })
  .then((r) => r.ok || r.status < 500)
  .catch(() => false);
if (!reachable) {
  console.error(`Không mở được ${BASE}. Chạy "npm run dev" trước rồi chạy lại lệnh này.`);
  process.exit(1);
}

const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
mkdirSync(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  headless: "new",
  ...(executablePath ? { executablePath } : {}),
});

const shots = [];
for (const screen of screens) {
  process.stdout.write(`chụp ${screen.id} … `);
  try {
    const shot = await captureScreen(browser, screen);
    shots.push(shot);
    console.log(
      `${shot.marks.length} nút${shot.missing.length ? ` — KHÔNG THẤY: ${shot.missing.join(", ")}` : ""}`,
    );
    if (shot.missing?.length) console.log(`   nhãn đang có: ${(shot.seen ?? []).join(" | ")}`);
  } catch (e) {
    console.log(`LỖI: ${e.message}`);
    shots.push({ id: screen.id, file: `${screen.id}.png`, dims: { w: 390, h: 844 }, marks: [], missing: [] });
  }
}
await browser.close();

writeFileSync(OUT_HTML, buildHtml(shots), "utf8");

const missing = shots.flatMap((s) => s.missing.map((m) => `${s.id}: ${m}`));
console.log(
  JSON.stringify(
    {
      html: OUT_HTML,
      anh: shots.length,
      tongNutDanhSo: shots.reduce((n, s) => n + s.marks.length, 0),
      nutKhongTimThay: missing,
    },
    null,
    2,
  ),
);
