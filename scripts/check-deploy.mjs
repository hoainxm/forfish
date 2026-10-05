#!/usr/bin/env node
/*
  KIỂM SAU DEPLOY — chạy một phát biết bản mới đã lên domain chưa, và (tuỳ chọn)
  làm mới snapshot dự báo cá rồi xác nhận "ngừ ồ" đã xuất hiện.

  Vì sao có: deploy lên sdfish.sdvico.vn xong vẫn phải kiểm TAY ba thứ —
  (1) mã bản máy chủ đã khớp commit vừa đẩy chưa, (2) cron đã ghi lại snapshot
  cá chưa, (3) snapshot mới đã chứa loài vừa sửa chưa. Script gom cả ba.

  Thuần Node ≥ 18 (global fetch), KHÔNG cần cài gì, KHÔNG phụ thuộc code app.

  DÙNG:
    node scripts/check-deploy.mjs                         # kiểm /api/version (mặc định prod)
    node scripts/check-deploy.mjs --url https://sdfish.sdvico.vn
    node scripts/check-deploy.mjs --expect <commit12>     # chỉ định mã chờ (mặc định: git HEAD)
    node scripts/check-deploy.mjs --refresh               # gọi cron làm mới snapshot (cần CRON_SECRET)
    node scripts/check-deploy.mjs --refresh --fish        # làm mới rồi kiểm "ngừ ồ" (cần SDFISH_TOKEN)

  BIẾN MÔI TRƯỜNG:
    BASE_URL       = như --url (ưu tiên cờ --url nếu có)
    CRON_SECRET    = bí mật cron (chính là CRON_SECRET trong shared/.env.production) — cần cho --refresh
    SDFISH_TOKEN   = chuỗi đăng nhập của MỘT máy đã login (localStorage key `forfish.token.v1`,
                     mở DevTools → Application → Local Storage trên máy đã đăng nhập) — cần cho --fish
    EXPECT_BUILD   = như --expect

  MÃ THOÁT: 0 = mọi phép kiểm BẮT BUỘC đạt; 1 = có phép kiểm hỏng. Phép tuỳ chọn
  (cron/fish) thiếu thông tin thì BỎ QUA (không làm hỏng), chỉ nhắc cách bật.
*/

import { execSync } from "node:child_process";

// ---- đọc cờ + env ------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
};

const BASE = (opt("--url") || process.env.BASE_URL || "https://sdfish.sdvico.vn").replace(/\/+$/, "");
const DO_REFRESH = flag("--refresh");
const DO_FISH = flag("--fish");
const TIMEOUT_MS = Number(opt("--timeout") || 60000);

// mã bản CHỜ: --expect → EXPECT_BUILD → 12 ký tự đầu của commit HEAD (next.config
// nhúng NEXT_PUBLIC_BUILD_ID = GITHUB_SHA.slice(0,12))
function headBuild12() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim().slice(0, 12);
  } catch {
    return null;
  }
}
const EXPECT = (opt("--expect") || process.env.EXPECT_BUILD || headBuild12() || "").trim();

// ---- tiện ích ---------------------------------------------------------------
const C = { ok: "\x1b[32m", bad: "\x1b[31m", warn: "\x1b[33m", dim: "\x1b[2m", off: "\x1b[0m" };
const line = (sym, color, msg) => console.log(`${color}${sym}${C.off} ${msg}`);
const pass = (m) => line("✓", C.ok, m);
const fail = (m) => line("✗", C.bad, m);
const warn = (m) => line("•", C.warn, m);
const dim = (m) => console.log(`${C.dim}  ${m}${C.off}`);

async function getJson(path, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "cache-control": "no-store", ...headers },
      signal: ctrl.signal,
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* không phải JSON (proxy chèn HTML…) */
    }
    return { status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

let failures = 0;

// ---- 1) /api/version (BẮT BUỘC) ---------------------------------------------
console.log(`\nKiểm deploy: ${BASE}`);
console.log(`Mã bản chờ : ${EXPECT || "(không xác định — truyền --expect)"}\n`);

let serverBuild = null;
try {
  const r = await getJson("/api/version");
  serverBuild = typeof r.body?.build === "string" ? r.body.build : null;
  if (r.status !== 200) {
    fail(`/api/version trả HTTP ${r.status} — máy chủ chưa phản hồi đúng`);
    failures++;
  } else if (!serverBuild) {
    fail(`/api/version trả mã RỖNG — build thiếu NEXT_PUBLIC_BUILD_ID (GITHUB_SHA lúc build)`);
    dim("Bản IIS phải build TRONG GitHub Actions để có GITHUB_SHA; build tay thì set NEXT_PUBLIC_BUILD_ID.");
    failures++;
  } else if (EXPECT && serverBuild !== EXPECT) {
    fail(`Máy chủ đang chạy mã ${serverBuild} — CHƯA phải bản chờ ${EXPECT}`);
    dim("Deploy chưa swap xong, hoặc service chưa restart. Đợi/kiểm lại bước deploy.");
    failures++;
  } else if (EXPECT) {
    pass(`/api/version = ${serverBuild} — KHỚP bản vừa đẩy`);
  } else {
    warn(`/api/version = ${serverBuild} (không có mã chờ để đối chiếu)`);
  }
} catch (e) {
  fail(`/api/version không gọi được: ${e?.name === "AbortError" ? "hết giờ" : e?.message || e}`);
  failures++;
}

// ---- 2) cron làm mới snapshot (TUỲ CHỌN: --refresh) --------------------------
if (DO_REFRESH) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    warn("--refresh bỏ qua: thiếu CRON_SECRET (lấy từ shared/.env.production).");
  } else {
    try {
      const r = await getJson("/api/cron/refresh-fish", { authorization: `Bearer ${secret}` });
      if (r.status === 200 && r.body?.ok) {
        pass(`cron refresh-fish OK — saved=${r.body.saved} · reason=${r.body.reason} · targetDate=${r.body.targetDate}`);
        if (r.body.saved === false) dim(`Không ghi đè: ${r.body.reason} (bản cũ ngang/mới hơn) — vẫn là snapshot hiện hành.`);
      } else if (r.status === 401) {
        fail("cron refresh-fish 401 — CRON_SECRET sai, hoặc máy chủ chưa đặt secret.");
        failures++;
      } else {
        fail(`cron refresh-fish HTTP ${r.status} — ${JSON.stringify(r.body)}`);
        failures++;
      }
    } catch (e) {
      fail(`cron refresh-fish không gọi được: ${e?.name === "AbortError" ? "hết giờ" : e?.message || e}`);
      failures++;
    }
  }
}

// ---- 3) kiểm "ngừ ồ" trong dự báo cá (TUỲ CHỌN: --fish) ----------------------
if (DO_FISH) {
  const token = process.env.SDFISH_TOKEN;
  if (!token) {
    warn("--fish bỏ qua: thiếu SDFISH_TOKEN (localStorage `forfish.token.v1` của máy đã đăng nhập premium).");
  } else {
    try {
      const r = await getJson("/api/fish-forecast", { "x-sdfish-token": token });
      if (r.status === 401) {
        fail("/api/fish-forecast 401 — token sai/hết hạn (máy bị đá?).");
        failures++;
      } else if (r.status === 403) {
        fail("/api/fish-forecast 403 — tài khoản CHƯA premium (dự báo cá là tính năng premium).");
        failures++;
      } else if (r.status !== 200 || !r.body?.ok) {
        fail(`/api/fish-forecast HTTP ${r.status} — ${JSON.stringify(r.body)?.slice(0, 120)}`);
        failures++;
      } else {
        const species = Array.isArray(r.body.species) ? r.body.species : [];
        const hasOo = species.includes("ngừ ồ");
        const nguList = species.filter((s) => typeof s === "string" && s.includes("ngừ")).join(", ");
        dim(`targetDate=${r.body.targetDate} · ${species.length} loài · nhóm ngừ: ${nguList || "(không có)"}`);
        if (hasOo) pass('Snapshot ĐÃ chứa "ngừ ồ" — bản mới đã vào dự báo cá.');
        else {
          fail('Snapshot CHƯA có "ngừ ồ" — cron chưa chạy lại bằng code mới (thử --refresh), hoặc deploy chưa xong.');
          failures++;
        }
      }
    } catch (e) {
      fail(`/api/fish-forecast không gọi được: ${e?.name === "AbortError" ? "hết giờ" : e?.message || e}`);
      failures++;
    }
  }
}

// ---- tổng kết ---------------------------------------------------------------
console.log("");
if (failures === 0) {
  pass("TẤT CẢ phép kiểm bắt buộc ĐẠT.");
  process.exit(0);
} else {
  fail(`${failures} phép kiểm HỎNG — xem trên.`);
  process.exit(1);
}
