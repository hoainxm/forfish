// THEO DÕI "CẬP NHẬT HẢI ĐỒ GIẤY" CỦA NHÀ NƯỚC — vmsa.vn, mỗi tuần một bản tin.
//
//   node scripts/theo-doi-cap-nhat-hai-do.mjs             # quét trang 1 (đủ cho cron tuần)
//   node scripts/theo-doi-cap-nhat-hai-do.mjs --trang 4   # quét 4 trang danh sách
//   node scripts/theo-doi-cap-nhat-hai-do.mjs --tat-ca    # quét hết mọi trang (lần đầu)
//   node scripts/theo-doi-cap-nhat-hai-do.mjs --thu       # không ghi file, chỉ in
//
// ── VIỆC NÀY LÀ VIỆC GÌ ───────────────────────────────────────────────────
// Tổng công ty Bảo đảm an toàn hàng hải Việt Nam mỗi tuần đăng một bản tin
// "CẬP NHẬT HẢI ĐỒ GIẤY NGÀY dd/mm/yyyy (TUẦN NN)", liệt kê những Thông báo
// hàng hải trong tuần và những tờ hải đồ bị ảnh hưởng. Đây chính là ĐẦU NGUỒN
// của các lớp hải đồ trong app: số đo sâu (`fetch-soundings.mjs`), báo hiệu
// (`generate-vn-aids.mjs`), đèn biển, xác tàu.
//
// Script này KHÔNG dựng lại lớp bản đồ. Nó giữ một CUỐN SỔ: tuần nào, thông
// báo số mấy, đụng tờ hải đồ nào, bản PDF ở đâu.
//
// ── VÌ SAO CHỈ GHI SỔ, KHÔNG TỰ DỰNG LẠI LỚP BẢN ĐỒ ───────────────────────
// Hai lý do, lý do thứ hai mới là lý do thật:
//
//  1. Các `generate-*.mjs` đọc KHO PDF nằm NGOÀI repo (hàng nghìn file, nhiều
//     GB). Dựng lại từ mỗi tuần mới sẽ ra file chỉ có mỗi tuần đó — tức là
//     XOÁ dữ liệu cũ, không phải cập nhật.
//
//  2. Dữ liệu dẫn đường mà SAI thì bà con đâm vào chỗ cạn. Repo này đã chốt
//     "parse trượt ⇒ KHÔNG ghi hàng rỗng" cho bản tin bão vì *một hàng sai là
//     một khúc đường vẽ sai, nằm lại vĩnh viễn*. Để một con robot tự ghi độ
//     sâu mới vào hải đồ mà không ai đọc lại là đúng cái sai đó, phóng to.
//
// Nên máy làm phần máy làm tốt — CANH nguồn, không bỏ sót tuần nào — còn phần
// quyết định "số này vào hải đồ" vẫn là người.
//
// ── ẢNH HƯỞNG OFFLINE: KHÔNG ──────────────────────────────────────────────
// Chạy trong GitHub Actions, KHÔNG chạy trong app. Sổ ghi vào
// `docs/app-map/_generated/` chứ KHÔNG vào `public/data/` — app không đọc nên
// đừng bắt bà con tải. Không thêm request mạng nào lúc mở app, không đụng
// `public/sw.js`, không đụng khoá `forfish.*`, không đè dữ liệu đã tải.
//
// ## Assumptions
// - Bản tin của một tuần KHÔNG được sửa lại sau khi đăng. Sổ chỉ THÊM, không
//   sửa hàng cũ (`gop()` giữ bản đã có) — nếu nguồn thật sự sửa nội dung một
//   thông báo cũ thì phải xoá tay hàng đó rồi chạy lại. Chọn vậy vì mất một
//   bản sửa hiếm hoi còn hơn để cron âm thầm ghi đè lịch sử.
// - Khoá của một hàng là `năm + số thông báo` (số đánh lại từ 1 mỗi năm).
// - Mục "Thông báo tạm thời và thông báo sơ bộ hết hiệu lực" nằm NGOÀI bảng,
//   script chưa bóc. Việc huỷ hiệu lực gần như luôn kèm một thông báo mới ở
//   tuần sau, nên sổ vẫn bắt được — nhưng đây là khoảng trống có chủ ý.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { taiLai } from "./lib/tai-lai.mjs";
import { decodeEntities } from "./lib/tbhh-doc.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SO_FILE = join(ROOT, "docs", "app-map", "_generated", "cap-nhat-hai-do.json");

const HOST = "https://vmsa.vn";
const DANH_MUC = `${HOST}/thuy-dac-428/cap-nhat-hai-do-giay-433`;
/** Danh mục phân trang theo BƯỚC 20 trên đường dẫn: `.../433/20` là trang 2. */
const MOI_TRANG = 20;
/** Trần cứng để một lỗi phân trang không biến `--tat-ca` thành vòng lặp vô tận. */
const TRAN_TRANG = 40;
/** Nghỉ giữa hai lượt tải — nguồn là web đời cũ, đừng gõ dồn. */
const NGHI_MS = 800;

const arg = (ten, mac = null) => {
  const i = process.argv.indexOf(`--${ten}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : mac;
};
const CO = (ten) => process.argv.includes(`--${ten}`);
const THU = CO("thu");
const TAT_CA = CO("tat-ca");
const SO_TRANG = TAT_CA ? TRAN_TRANG : Math.max(1, Number(arg("trang", "1")) || 1);

const log = (s) => console.log(s);
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── BÓC HTML ──────────────────────────────────────────────────────────────
 * Nguồn là CMS đời cũ, bảng dán từ trình soạn thảo: mỗi ô bọc 6 lớp <span>
 * mang style rác. Nên KHÔNG dò theo class hay thứ tự thẻ — chỉ bóc trần chữ
 * trong từng ô rồi đọc theo CỘT. Khuôn kiểu đó sống lâu hơn khuôn theo class.
 *
 * `decodeEntities` lấy từ `scripts/lib/tbhh-doc.mjs` chứ KHÔNG chép lại: trang
 * này mã hoá tiếng Việt nửa vời y hệt các trang TBHH khác (`&acirc;` = â cho
 * chữ Latin-1, còn ơ ư đ ra thực thể số) — thiếu bảng tên là "Độ sâu" đọc ra
 * "Độ s&acirc;u" và mọi so khớp sau đó trượt.                               */

/** Một ô `<td>` → chữ thuần, đã gộp khoảng trắng và giải mã thực thể. */
function oChu(td) {
  return decodeEntities(td.replace(/<[^>]+>/g, " "))
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Khuôn một dòng trong danh mục — GIỐNG `ROW_RE` của fetch-soundings.mjs. */
const HANG_DANH_MUC =
  /<h4><a href="([^"]+)"\s+title="([^"]*)"[^>]*>[\s\S]*?newslist-content"><p>([^<]*)</g;

/** `31/08/2026` → `2026-08-31`; không đọc được thì `null` (KHÔNG đoán). */
function ngayISO(s) {
  const m = /(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/.exec(String(s));
  if (!m) return null;
  const [, d, t, n] = m;
  return `${n}-${String(t).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Danh sách bản tin trên MỘT trang danh mục. */
function docDanhMuc(html) {
  const ra = [];
  for (const m of html.matchAll(HANG_DANH_MUC)) {
    const url = decodeEntities(m[1]).trim();
    const tieuDe = decodeEntities(m[2]).replace(/\s+/g, " ").trim();
    if (!/cap-nhat-hai-do-giay-ngay/i.test(url)) continue;
    const tuan = Number(/TUẦN\s*(\d+)/i.exec(tieuDe)?.[1] ?? NaN);
    ra.push({
      url: url.startsWith("http") ? url : `${HOST}/${url.replace(/^\//, "")}`,
      tieuDe,
      tuan: Number.isFinite(tuan) ? tuan : null,
      ngay: ngayISO(tieuDe) ?? ngayISO(decodeEntities(m[3])),
    });
  }
  return ra;
}

/** Số tờ hải đồ VN: `VN30019`, đôi khi kèm chữ cuối. */
const MA_HAI_DO = /\bVN\s?\d{4,6}[A-Z]?\b/gi;
/** Ô "Tuần" — số tuần trong năm. */
const LA_TUAN = (s) => /^\d{1,2}$/.test(s) && +s >= 1 && +s <= 53;
/** Ô "Ngày, tháng" — nguồn viết cả `27/07/2026` lẫn `27, 07, 2026`. */
const LA_NGAY = (s) => /^\d{1,2}\s*[/,.\-]\s*\d{1,2}\s*[/,.\-]\s*\d{4}$/.test(s.trim());

/**
 * Một bản tin → các hàng thông báo.
 *
 * ĐỌC THEO HÌNH DẠNG NỘI DUNG, KHÔNG THEO SỐ CỘT. Nguồn có ít nhất ba khuôn
 * hàng, đo thật trên chính vmsa.vn:
 *
 *   5 ô  ["36","31/08/2026","140","VN40011","VIET NAM - …"]   đủ
 *   4 ô  ["31","27/07/2026","113","VN30019"]                  KHÔNG có mô tả
 *   3 ô  ["141","VN50008","VIET NAM - …"]                     rowspan nuốt tuần+ngày
 *
 * Đếm cột thì hai khuôn dưới đội lốt nhau: cả hai đều "thiếu một ô", nhưng
 * thiếu ở HAI ĐẦU KHÁC NHAU. Bản đếm cột đầu tiên đã đọc tuần `31` thành SỐ
 * THÔNG BÁO và ngày `27/07/2026` thành số hải đồ — sai im lặng, sổ vẫn đầy.
 *
 * Nên hỏi từng ô "mày trông giống cái gì": tuần là số ≤ 53, ngày có hai dấu
 * ngăn, số thông báo là số trần, hải đồ mang mã `VN…`. Hình dạng sống lâu hơn
 * vị trí.
 */
function docBanTin(html, banTin) {
  const hang = [];
  let tuan = banTin.tuan;
  let ngay = banTin.ngay;

  for (const tb of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const trs = [...tb[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
    if (!trs.length) continue;
    const dau = [...trs[0].matchAll(/<t[dh][\s\S]*?<\/t[dh]>/gi)].map((m) => oChu(m[0]));
    /*  Trang còn hai bảng nữa CHỈ CHỨA LINK NĂM (2015…2026) để nhảy kho cũ.
        Nhận đúng bảng thông báo bằng chữ ở hàng tiêu đề, không bằng thứ tự
        bảng — thứ tự đổi là im lặng lấy nhầm bảng năm.                       */
    if (!dau.some((c) => /thông báo số/i.test(c)) || !dau.some((c) => /hải đồ/i.test(c))) {
      continue;
    }

    for (const tr of trs.slice(1)) {
      const o = [...tr.matchAll(/<t[dh][\s\S]*?<\/t[dh]>/gi)].map((m) => oChu(m[0]));
      if (!o.length) continue;

      /*  Hai ô đầu CHỈ được coi là tuần+ngày khi CẢ HAI cùng đúng hình dạng.
          Nếu chỉ một ô khớp thì đây là hàng bị rowspan nuốt — giữ tuần/ngày
          của hàng trước, đừng cắn vào ô "số thông báo".                      */
      let i = 0;
      if (o.length >= 2 && LA_TUAN(o[0]) && LA_NGAY(o[1])) {
        tuan = Number(o[0]);
        ngay = ngayISO(o[1]) ?? ngay;
        i = 2;
      }

      /*  Ô "số thông báo" có hai bẫy, cả hai đo thật trên nguồn:
           · `11 1` — CMS chẻ số 111 thành hai mẩu vẽ rời, bóc chữ ra thành hai
             mẩu cách nhau khoảng trắng (tuần 30/2026). Một ô = một số, nên bỏ
             hết khoảng trắng BÊN TRONG là về đúng "111".
           · `54(T)` — thông báo TẠM THỜI; còn `(P)` là sơ bộ (tuần 18/2026).
             Khuôn `^\d+$` vứt sạch loại này, mà tạm thời mới là loại hay đổi
             nhất: luồng vừa bồi lấp, phao vừa trôi.                          */
      const soTho = String(o[i] ?? "").replace(/\s+/g, "");
      const mSo = /^(\d{1,4})(\((T|P)\))?$/i.exec(soTho);
      // Hàng rỗng / hàng ghi chú ("Không có") — bỏ, KHÔNG ghi hàng nửa vời
      if (!mSo) continue;
      const so = mSo[1];
      const loai = mSo[3] ? (mSo[3].toUpperCase() === "T" ? "tam-thoi" : "so-bo") : null;

      /*  Ô hải đồ mang một HOẶC NHIỀU mã ("VN40014 VN30006"). Bốc thẳng bằng
          mã thay vì cắt theo dấu phân cách — nguồn dùng đủ kiểu ngăn (dấu
          phẩy, gạch chéo, xuống dòng, hai khoảng trắng).                     */
      const oHaiDo = String(o[i + 1] ?? "");
      const haiDo = (oHaiDo.match(MA_HAI_DO) ?? [])
        .map((s) => s.replace(/\s+/g, "").toUpperCase());
      /*  Không có mã nào ⇒ hoặc bảng đổi khuôn, hoặc ô để trống. BỎ hàng chứ
          KHÔNG ghi hàng không biết đụng tờ hải đồ nào — sổ mà có hàng vô
          nghĩa thì lần sau không ai tin sổ nữa.                              */
      if (!haiDo.length) {
        log(`  ⚠ TB ${so}: ô hải đồ không có mã VN nào (${oHaiDo.slice(0, 40)}) — bỏ hàng`);
        continue;
      }

      hang.push({
        tuan: tuan ?? null,
        ngay: ngay ?? null,
        so,
        ...(loai ? { loai } : {}),
        haiDo,
        moTa: o.slice(i + 2).join(" ").replace(/\s+/g, " ").trim(),
        banTin: banTin.url,
        /*  Khai sẵn `pdf` ở đây dù vòng ghép link chạy sau: mọi hàng cùng một
            hình dạng thì bên đọc không phải phân biệt "chưa có link" với
            "khoá không tồn tại". Không có link thì để `null`, không bỏ khoá. */
        pdf: null,
      });
    }
  }

  /*  PDF của từng thông báo nằm rải trong thân bài, chữ của link CHÍNH LÀ số
      thông báo ("140"). Ghép theo số chứ không theo thứ tự xuất hiện — thứ tự
      là thứ dễ đổi nhất trên một trang soạn bằng tay.                        */
  for (const a of html.matchAll(/<a\b[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const chu = oChu(a[2]);
    const so = /^(\d+)$/.exec(chu)?.[1] ?? /\b(\d{1,4})\b/.exec(chu)?.[1];
    if (!so) continue;
    const h = hang.find((x) => x.so === so && !x.pdf);
    if (h) {
      const u = decodeEntities(a[1]).trim();
      h.pdf = u.startsWith("http") ? u : `${HOST}/${u.replace(/^\//, "")}`;
    }
  }
  return hang;
}

/*  Khoá một hàng: số thông báo đánh lại từ 1 mỗi năm nên phải kèm NĂM; và kèm
    cả `loai` vì `54` (chính thức) với `54(T)` (tạm thời) là hai tin khác nhau,
    có năm ra cùng năm.                                                       */
const khoa = (h) => `${(h.ngay ?? "????").slice(0, 4)}/${h.so}${h.loai ? `(${h.loai})` : ""}`;

function gop(cu, moi) {
  const map = new Map(cu.map((h) => [khoa(h), h]));
  const them = [];
  for (const h of moi) {
    const k = khoa(h);
    if (map.has(k)) continue; // đã có → GIỮ bản cũ (xem ## Assumptions)
    map.set(k, h);
    them.push(h);
  }
  const tatCa = [...map.values()].sort(
    (a, b) => String(b.ngay).localeCompare(String(a.ngay)) || Number(b.so) - Number(a.so),
  );
  return { tatCa, them };
}

/* ══ CHẠY ══════════════════════════════════════════════════════════════════ */
/*  CHỈ CHẠY KHI ĐƯỢC GỌI THẲNG. Bộ test nhập file này để soi ĐÚNG bộ đọc đã
    sinh ra cuốn sổ (`docDanhMuc`, `docBanTin`) thay vì chép lại một bản thứ
    hai rồi để hai bản trôi khỏi nhau. Phần chạy mà nằm ở mức ngoài cùng thì
    mỗi lần `npm test` sẽ kéo cả chục trang vmsa.vn về và ghi đè sổ — không
    thể chấp nhận.  */
async function chay() {

  const cu = existsSync(SO_FILE) ? JSON.parse(readFileSync(SO_FILE, "utf8")) : null;
  const hangCu = Array.isArray(cu?.thongBao) ? cu.thongBao : [];
  const daCo = new Set(hangCu.map((h) => h.banTin));

  log(`Sổ hiện có ${hangCu.length} thông báo. Quét tối đa ${SO_TRANG} trang danh mục.`);

  /** Danh mục → danh sách bản tin, dừng sớm khi trang không thêm gì mới. */
  const banTin = [];
  for (let t = 0; t < SO_TRANG; t++) {
    const url = t === 0 ? DANH_MUC : `${DANH_MUC}/${t * MOI_TRANG}`;
    log(`· danh mục trang ${t + 1}: ${url}`);
    const html = await taiLai(url, { log });
    const ds = docDanhMuc(html);
    if (!ds.length) {
      log("  (trang không có bản tin nào — dừng)");
      break;
    }
    banTin.push(...ds);
    /*  Cron tuần chỉ cần trang 1. Khi quét nhiều trang mà CẢ trang đã nằm trong
        sổ thì phần sau càng cũ hơn — dừng, đừng tải cho vui.                   */
    if (!TAT_CA && t > 0 && ds.every((b) => daCo.has(b.url))) {
      log("  (cả trang đã có trong sổ — dừng)");
      break;
    }
    await nghi(NGHI_MS);
  }

  /*  Bản tin đã có đủ hàng trong sổ thì KHÔNG tải lại thân bài — mỗi lượt cron
      tuần chỉ còn 1 request danh mục + 1 request bản tin mới.                  */
  const canTai = banTin.filter((b) => TAT_CA || !daCo.has(b.url));
  log(`Có ${banTin.length} bản tin trên danh mục, cần đọc ${canTai.length} bản.`);

  const moi = [];
  /*  Bản tin tải được nhưng KHÔNG bóc ra hàng nào. Có thật: tuần 20/2026 dán
      bảng lồng trong bảng, mỗi ô mô tả thành một <table> riêng và bảng thông báo
      không còn hàng dữ liệu nào. Cố đoán bảng soup ấy là đường ngắn nhất tới một
      dòng độ sâu SAI nằm im trong sổ. Nên: ghi tên nó ra, để người mở tay.     */
  const chuaBoc = [];
  let hong = 0;
  for (const b of canTai) {
    log(`· bản tin tuần ${b.tuan ?? "?"} ngày ${b.ngay ?? "?"}: ${b.url}`);
    try {
      const html = await taiLai(b.url, { log });
      const hang = docBanTin(html, b);
      if (!hang.length) {
        log("  ⚠ không bóc được hàng nào — ghi vào mục 'chưa bóc được'");
        chuaBoc.push({ tuan: b.tuan, ngay: b.ngay, url: b.url });
      }
      moi.push(...hang);
    } catch (e) {
      /*  Một bản tin hỏng KHÔNG được kéo cả đợt xuống: các tuần khác vẫn vào sổ,
          tuần hỏng để lượt cron sau nhặt (nó vẫn nằm ngoài `daCo`).            */
      hong++;
      log(`  ✗ bỏ qua: ${e?.message ?? e}`);
    }
    await nghi(NGHI_MS);
  }

  const { tatCa, them } = gop(hangCu, moi);

  /*  Giữ danh sách "chưa bóc được" của các lượt trước rồi bỏ những bản tin lần
      này đã bóc ra hàng — không thì mỗi lượt lại quên mất tuần hỏng của lượt cũ. */
  const daBocDuoc = new Set(moi.map((h) => h.banTin));
  const chuaBocGop = [...(cu?.chuaBoc ?? []), ...chuaBoc]
    .filter((b) => !daBocDuoc.has(b.url))
    .filter((b, i, a) => a.findIndex((x) => x.url === b.url) === i)
    .sort((a, b) => String(b.ngay).localeCompare(String(a.ngay)));

  log("");
  log(`Thêm mới: ${them.length} thông báo. Tổng sổ: ${tatCa.length}.`);
  for (const h of them.slice(0, 40)) {
    const l = h.loai === "tam-thoi" ? " (tạm thời)" : h.loai === "so-bo" ? " (sơ bộ)" : "";
    log(
      `  + tuần ${h.tuan} · ${h.ngay} · TB ${h.so}${l} · ${h.haiDo.join(", ")} · ${h.moTa.slice(0, 90)}`,
    );
  }
  if (chuaBocGop.length) {
    log("");
    log(`⚠ ${chuaBocGop.length} bản tin CHƯA BÓC ĐƯỢC (bảng lồng nhau) — cần mở tay:`);
    for (const b of chuaBocGop) log(`  ? tuần ${b.tuan} · ${b.ngay} · ${b.url}`);
  }

  /*  ĐỢT TRẮNG TAY MÀ CÓ BẢN TIN HỎNG = KHÔNG PHẢI "không có gì mới". Nói thẳng
      để workflow biết đường thử lại, đừng để im lặng trông giống thành công.   */
  if (!them.length && hong) {
    console.error(`Không thêm được gì và ${hong} bản tin tải hỏng — coi như đợt này TRƯỢT.`);
    process.exit(1);
  }

  if (THU) {
    log("(--thu: không ghi file)");
    process.exit(0);
  }

  const dau = tatCa[0];
  const so = {
    v: 1,
    nguon: DANH_MUC,
    coQuan: "Tổng công ty Bảo đảm an toàn hàng hải Việt Nam (vmsa.vn)",
    ghiChu:
      "Sổ theo dõi Thông báo hàng hải hằng tuần — đầu nguồn của các lớp hải đồ " +
      "trong app (số đo sâu, báo hiệu, đèn biển, xác tàu). App KHÔNG đọc file này; " +
      "nó để biết tuần nào cần dựng lại lớp nào.",
    banTinMoiNhat: dau ? { tuan: dau.tuan, ngay: dau.ngay, url: dau.banTin } : null,
    thongBao: tatCa,
    chuaBoc: chuaBocGop,
  };

  mkdirSync(dirname(SO_FILE), { recursive: true });
  writeFileSync(SO_FILE, JSON.stringify(so, null, 2) + "\n", "utf8");
  log(`Đã ghi ${SO_FILE}`);

}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await chay();
}

export { docDanhMuc, docBanTin, ngayISO, oChu, khoa, gop };
