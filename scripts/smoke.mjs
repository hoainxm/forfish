// SMOKE TEST SAU DEPLOY (rà Codex đợt 2, 2026-10-19) — "biết chính xác bản nào
// chạy, dữ liệu từ đâu, lỗi ở bước nào".
//
//   node scripts/smoke.mjs <gốc web> [--build <sha>] [--strict]
//   vd: node scripts/smoke.mjs https://sdfish.sdvico.vn --build $(git rev-parse --short HEAD)
//
// Kiểm, mỗi dòng một kết quả ĐẠT / LỖI / CẢNH BÁO:
//   1. trang chủ trả 200
//   2. /api/version có mã bản; có --build thì phải khớp
//   3. /api/status: ngày fit tham số mô hình + tuổi bản dự báo cá / lưới thời tiết
//      (`duLieu` cu = cron đứng ⇒ CẢNH BÁO, không phải LỖI: route vẫn tự tính live)
//   4. file dữ liệu phát ra là BẢN MÃ (SDF2; tide-stations SDF1) — dữ liệu rõ ra
//      production là LỖI
//   5. route dữ liệu có gác: /api/fish-forecast không chuỗi thiết bị ⇒ 401
//
// Thoát 1 khi có LỖI; --strict thì CẢNH BÁO cũng tính là lỗi. Chỉ đọc, không ghi
// gì lên server, không cần khoá. Mỗi lượt hỏi trần 15 s.

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--")) ?? "").replace(/\/+$/, "");
const flag = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const wantBuild = flag("--build");
const strict = args.includes("--strict");

if (!/^https?:\/\//.test(base)) {
  console.error("Dùng: node scripts/smoke.mjs <https://gốc-web> [--build <sha>] [--strict]");
  process.exit(2);
}

const results = [];
const out = (level, name, detail) => {
  results.push(level);
  console.log(`${level.padEnd(9)} ${name}${detail ? ` — ${detail}` : ""}`);
};
const get = (path, init) => fetch(base + path, { ...init, signal: AbortSignal.timeout(15_000) });

async function step(name, fn) {
  try {
    await fn();
  } catch (e) {
    out("LỖI", name, e instanceof Error ? e.message : String(e));
  }
}

await step("trang chủ", async () => {
  const r = await get("/");
  out(r.ok ? "ĐẠT" : "LỖI", "trang chủ", `HTTP ${r.status}`);
});

await step("mã bản", async () => {
  const r = await get("/api/version");
  const j = await r.json();
  const got = String(j.build ?? "");
  if (!got) return out("CẢNH BÁO", "mã bản", "rỗng (build ngoài CI?)");
  if (wantBuild && !(got.startsWith(wantBuild) || wantBuild.startsWith(got)))
    return out("LỖI", "mã bản", `muốn ${wantBuild}, đang chạy ${got}`);
  out("ĐẠT", "mã bản", got.slice(0, 12));
});

await step("mô hình + tuổi dự báo", async () => {
  const r = await get("/api/status");
  if (!r.ok) return out("CẢNH BÁO", "mô hình + tuổi dự báo", `HTTP ${r.status} (bản cũ chưa có /api/status?)`);
  const j = await r.json();
  const h = (x) => (x ? `${x.ageHours} giờ` : "chưa có");
  const desc = `fit ${j.model?.fishBlendFittedAt ?? "?"} / skill ${j.model?.forecastSkillFittedAt ?? "?"}, cá ${h(j.data?.fishSnapshot)}, thời tiết ${h(j.data?.weatherSnapshot)}`;
  if (j.duLieu === "khong-doc-duoc") return out("CẢNH BÁO", "mô hình + tuổi dự báo", `không đọc được DB — ${desc}`);
  out(j.duLieu === "tuoi" ? "ĐẠT" : "CẢNH BÁO", "mô hình + tuổi dự báo", j.duLieu === "tuoi" ? desc : `CŨ (cron đứng?) — ${desc}`);
});

for (const [file, magic] of [
  ["model-params.v1.json", "SDF2"],
  ["vn-coast.v1.json", "SDF2"],
  ["tide-stations.v1.json", "SDF1"],
]) {
  await step(`mã hoá ${file}`, async () => {
    const r = await get(`/data/${file}`, { headers: { Range: "bytes=0-3" } });
    const head = Buffer.from(await r.arrayBuffer()).subarray(0, 4).toString("latin1");
    out(head === magic ? "ĐẠT" : "LỖI", `mã hoá ${file}`, head === magic ? magic : `đầu file "${head}" — dữ liệu RÕ?`);
  });
}

await step("gác dữ liệu", async () => {
  const r = await get("/api/fish-forecast");
  out(r.status === 401 ? "ĐẠT" : "LỖI", "gác dữ liệu", `/api/fish-forecast không chuỗi ⇒ HTTP ${r.status} (muốn 401)`);
});

const bad = results.filter((l) => l === "LỖI" || (strict && l === "CẢNH BÁO")).length;
console.log(bad ? `\n${bad} mục hỏng.` : "\nTất cả đạt.");
process.exit(bad ? 1 : 0);
