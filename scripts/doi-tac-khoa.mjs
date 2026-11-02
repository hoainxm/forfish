// KHOÁ ĐỐI TÁC API AIS — cấp / liệt kê / thu hồi, MỘT LỆNH (2026-11-02).
//
// Ô app_config `doi_tac_ais` chỉ giữ BĂM ("ten:sha256hex:khu:goi,…" — lib/doi-tac.ts). Khu + gói = license đã ký theo báo giá
// BG-AIS-2026-01 (khu vực 1–5, gói 60 phút tiêu chuẩn / 30 phút). Token rõ in RA MỘT LẦN lúc cấp:
// chép ngay gửi đối tác, mất là cấp lại (không đọc ngược được từ băm). Máy chủ đọc lại ô sau tối đa 30 giây (cache app-config).
//
// Cần: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (env hoặc .env.local).
//
//   node scripts/doi-tac-khoa.mjs ds                                  # đối tác đang có khoá + khu + gói
//   node scripts/doi-tac-khoa.mjs cap doi-tac-1 --khu 12345 --goi 60   # cấp token mới (đè token cũ cùng tên)
//   node scripts/doi-tac-khoa.mjs sua doi-tac-1 --khu 13 --goi 30      # đổi khu/gói, GIỮ token cũ
//   node scripts/doi-tac-khoa.mjs thu doi-tac-1      # thu hồi
//
// Script chỉ ghi DB. Env DOI_TAC_AIS trên máy chủ (nếu ai đặt) ĐÈ ô DB ⇒ khi đó khoá cấp ở đây không có hiệu lực.

import { createHash, randomBytes } from "node:crypto";
import { loadEnv, makeRest } from "./test-account.mjs";

const KEY = "doi_tac_ais";
const TEN = /^[a-z0-9][a-z0-9-]{1,39}$/;

const MUC = /^([a-z0-9][a-z0-9-]{1,39}):([0-9a-f]{64}):([1-5]{1,5}):(30|60)$/; // = MUC_KHOA_DOI_TAC (lib/doi-tac)

export function docDs(v) {
  return (v ?? "")
    .split(",")
    .map((s) => MUC.exec(s.trim().toLowerCase()))
    .filter(Boolean)
    .map((m) => ({ ten: m[1], bam: m[2], khu: m[3], goi: m[4] }));
}
export const ghiDs = (ds) => ds.map((k) => `${k.ten}:${k.bam}:${k.khu}:${k.goi}`).join(",");

/** --khu 135 --goi 60 ⇒ { khu: "135", goi: "60" }; sai ⇒ ném. */
export function docCo(args) {
  const lay = (ten) => {
    const i = args.indexOf(ten);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const khuTho = lay("--khu");
  const goi = lay("--goi");
  if (!khuTho || !/^[1-5]{1,5}$/.test(khuTho)) throw new Error("--khu: các số khu vực 1–5 viết liền, vd 135 hoặc 12345");
  if (goi !== "60" && goi !== "30") throw new Error("--goi: 60 (tiêu chuẩn, 1 giờ/lần) hoặc 30 (30 phút/lần)");
  return { khu: [...new Set(khuTho)].sort().join(""), goi };
}

async function main() {
  const [lenh, ten, ...co] = process.argv.slice(2);
  const rest = makeRest(loadEnv());
  const [row] = await rest.get(`app_config?select=value&key=eq.${KEY}`);
  let ds = docDs(row?.value);
  const luu = async () => {
    const value = ghiDs(ds);
    const dong = { value, updated_by: "script:doi-tac-khoa", updated_at: new Date().toISOString() };
    if (row) await rest.patch(`app_config?key=eq.${KEY}`, dong);
    else await rest.post("app_config", { key: KEY, ...dong });
  };

  if (lenh === "ds") {
    console.log(ds.length ? ds.map((k) => `- ${k.ten} · khu ${k.khu.split("").join(", ")} · gói ${k.goi} phút`).join("\n") : "(chưa có đối tác nào)");
    return;
  }
  if (!ten || !TEN.test(ten)) throw new Error("Tên đối tác: chữ thường/số/gạch ngang, 2–40 ký tự (vd doi-tac-1)");
  if (lenh === "cap") {
    const { khu, goi } = docCo(co);
    const token = "ffp_" + randomBytes(32).toString("base64url");
    const bam = createHash("sha256").update(token, "utf8").digest("hex");
    ds = ds.filter((k) => k.ten !== ten).concat({ ten, bam, khu, goi });
    await luu();
    console.log(`Đã cấp khoá cho "${ten}" · khu ${khu.split("").join(", ")} · gói ${goi} phút (hiệu lực sau tối đa 30 giây).\nToken — CHỈ HIỆN MỘT LẦN:\n\n${token}\n`);
    return;
  }
  if (lenh === "sua") {
    const { khu, goi } = docCo(co);
    const k = ds.find((x) => x.ten === ten);
    if (!k) return console.log(`Không có đối tác "${ten}".`);
    Object.assign(k, { khu, goi });
    await luu();
    console.log(`Đã đổi "${ten}" · khu ${khu.split("").join(", ")} · gói ${goi} phút (token giữ nguyên).`);
    return;
  }
  if (lenh === "thu") {
    const truoc = ds.length;
    ds = ds.filter((k) => k.ten !== ten);
    if (ds.length === truoc) return console.log(`Không có đối tác "${ten}".`);
    await luu();
    console.log(`Đã thu hồi khoá "${ten}".`);
    return;
  }
  throw new Error("Lệnh: ds | cap <ten> --khu 135 --goi 60 | sua <ten> --khu … --goi … | thu <ten>");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
