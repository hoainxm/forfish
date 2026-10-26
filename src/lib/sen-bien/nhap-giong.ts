// SEN BIỂN HỎI TỪNG CÂU ĐỂ NHẬP — bộ hiểu câu trả lời (THUẦN, có test) — 2026-10-26.
//
// Anh Long: "cho bà con nhập bằng giọng nói cũng được, ví dụ trao đổi Sen Biển để thiết lập, Sen Biển hỏi từng câu
// rồi lưu lại, tàu, giấy tờ, chứng nhận". Màn hỏi–nghe ở components/hoi-tung-cau.tsx; file này chỉ HIỂU một câu trả
// lời cho một ô và chứa KỊCH BẢN (câu hỏi + cách hiểu) cho giấy tờ và tàu.
//
// Vì sao không dùng `parse-coord.soBangChu`: nó coi "năm" là số 5 cả khi là chữ "năm" đứng trước năm ("tháng ba năm
// hai không hai bảy" ⇒ "3 5 2 0 2 7"), không hiểu "nghìn", tách "hai tư" thành "2 4" — đúng cho toạ độ, sai cho ngày.
// Ở đây đọc theo đúng ngữ pháp ngày tháng của bà con.

import { DOCUMENT_KINDS, type DocumentKind } from "@/lib/documents";

const chuan = (s: string) => String(s ?? "").normalize("NFC").toLowerCase().replace(/[.,!?;:]+$/g, "").replace(/\s+/g, " ").trim();
/** bỏ dấu để so từ khoá (đ ⇒ d) */
export const boDau = (s: string) =>
  chuan(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9/ ]+/g, " ").replace(/\s+/g, " ").trim();

// ── lệnh trong hội thoại ────────────────────────────────────────────────────────────────────────
export const laDung = (t: string) => /^(thoi|dung|huy|thoat|ket thuc|khong nhap nua)( lai| di| nhe| nha)?$/.test(boDau(t));
export const laBoQua = (t: string) =>
  /^(bo qua|qua|khong co|khong biet|chua co|khong nho|de sau|bo|cho qua|khong)( di| nhe| nha| a)?$/.test(boDau(t));
/** đồng ý ⇒ true, từ chối ⇒ false, không rõ ⇒ null */
export function laCo(t: string): boolean | null {
  const s = boDau(t);
  if (/^(khong|sai|chua|sua|khoan|de toi sua|thoi)\b/.test(s)) return false;
  if (/^(co|luu|dung|u|uh|um|ok|oke|duoc|phai|vang|da|luu di|dung roi|chuan)\b/.test(s)) return true;
  return null;
}

// ── số đọc bằng chữ ─────────────────────────────────────────────────────────────────────────────
const SO: Record<string, number> = {
  khong: 0, linh: 0, le: 0, mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, lam: 5, sau: 6, bay: 7, tam: 8, chin: 9,
};

/**
 * Dãy từ số ⇒ số nguyên. "mười một"=11, "hai mươi tư"=24, "hai tư"=24 (nói gọn ⇒ ghép chữ số), "ba mốt"=31,
 * "hai nghìn không trăm hai mươi bảy"=2027, "một trăm linh năm"=105, "2027"=2027. Không phải số ⇒ null.
 */
export function soTuChu(words: string): number | null {
  const ws = boDau(words).split(" ").filter(Boolean);
  if (!ws.length) return null;
  if (ws.every((w) => /^\d+$/.test(w))) return Number(ws.join(""));
  const coNhan = ws.some((w) => w === "muoi" || w === "tram" || w === "nghin" || w === "ngan");
  if (!coNhan) {
    // nói gọn: mỗi từ một chữ số ("hai tư" = 24, "hai không hai bảy" = 2027)
    let s = "";
    for (const w of ws) {
      if (/^\d$/.test(w)) s += w;
      else if (w in SO) s += String(SO[w]);
      else return null;
    }
    return s ? Number(s) : null;
  }
  let tong = 0;
  let cur = 0;
  let coSo = false;
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (/^\d+$/.test(w)) {
      cur += Number(w);
      coSo = true;
    } else if (w === "muoi") {
      // "mười" đứng đầu cụm = 10; "mươi" sau chữ số = ×10 (sau khi bỏ dấu hai chữ trùng nhau ⇒ xét chỗ đứng)
      cur = cur ? cur * 10 : 10;
      coSo = true;
    } else if (w === "tram") {
      tong += (cur || (coSo ? 0 : 1)) * 100;
      cur = 0;
      coSo = true;
    } else if (w === "nghin" || w === "ngan") {
      tong += (cur || 1) * 1000;
      cur = 0;
      coSo = true;
    } else if (w in SO) {
      cur += SO[w];
      coSo = true;
    } else return null;
  }
  return coSo ? tong + cur : null;
}

/** Năm (đóng tàu, năm trên giấy): "hai không mười tám"=2018, "hai nghìn mười tám"=2018, "mười tám"=2018. */
export function namTuChu(words: string, nay = new Date().getFullYear()): number | null {
  const ws = boDau(words).split(" ").filter(Boolean);
  if (!ws.length) return null;
  let n = soTuChu(words);
  // "hai không mười tám": hai chữ số đầu + phần sau đọc kiểu số
  if ((n == null || n > 9999 || (n < 1000 && ws.length >= 3)) && ws.length >= 3 && ws[0] in SO && ws[1] in SO) {
    const dau = soTuChu(ws.slice(0, 2).join(" "));
    const sau = soTuChu(ws.slice(2).join(" "));
    if (dau != null && sau != null && sau < 100) n = dau * 100 + sau;
  }
  if (n == null) return null;
  if (n < 100) n += n + 2000 <= nay + 20 ? 2000 : 1900;
  return n >= 1950 && n <= nay + 40 ? n : null;
}

const iso = (y: number, m: number, d: number): string | null => {
  if (y < 2000 || y > 2060 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
};

/**
 * Ngày nói ⇒ "YYYY-MM-DD". Nhận: "mười một tháng ba năm hai không hai bảy", "ngày 11 tháng 3 năm 2027",
 * "mồng năm tháng tư năm hai lăm", "hai tư tháng chín năm hai sáu", "11/3/2027", "11 3 2027". Thiếu năm ⇒ null
 * (Sen Biển hỏi lại — đoán năm là nguy hiểm với ngày hết hạn).
 */
export function ngayTuChu(text: string, nay = new Date()): string | null {
  // "hết hạn ngày mười một tháng ba…" ⇒ bỏ mọi thứ trước "ngày/mùng/mồng" cuối cùng đứng trước "tháng"
  const s = chuan(text).replace(/^.*\b(ngày|mùng|mồng)\s+(?=.*tháng)/u, "").replace(/^(hết hạn|cấp|là|vào)\s+/u, "");
  const so = /(\d{1,2})\s*[/.\- ]\s*(\d{1,2})\s*[/.\- ]\s*(\d{2,4})/.exec(s);
  if (so) {
    let y = Number(so[3]);
    if (y < 100) y += 2000;
    return iso(y, Number(so[2]), Number(so[1]));
  }
  const m = /^(.+?)\s+tháng\s+(.+?)\s+năm\s+(.+)$/u.exec(s);
  if (!m) return null;
  const d = soTuChu(m[1]);
  const th = soTuChu(m[2]);
  const y = namTuChu(m[3], nay.getFullYear() + 30);
  if (d == null || th == null || y == null) return null;
  return iso(y, th, d);
}

/** Số thập phân nói ⇒ chuỗi kiểu form ("18,5"): "mười tám phẩy năm", "18,5", "mười tám mét rưỡi". */
export function soThapPhan(text: string): string | null {
  // chữ số kiểm trên chữ GỐC — bỏ dấu là mất luôn "," "." ("18,5" ⇒ "18 5")
  const so = /^(\d+)(?:[.,](\d+))?$/.exec(chuan(text).replace(/\s*(mét|m|khoảng|chừng)\s*/g, "").replace(/\s+/g, ""));
  if (so) return so[2] ? `${so[1]},${so[2]}` : so[1];
  const s = boDau(text).replace(/\bmet\b|\bm\b|\bkhoang\b|\bchung\b/g, " ").replace(/\s+/g, " ").trim();
  const ruoi = /^(.+?) ruoi$/.exec(s);
  if (ruoi) {
    const n = soTuChu(ruoi[1]);
    return n == null ? null : `${n},5`;
  }
  const [a, b] = s.split(/ (?:phay|cham) /);
  const nguyen = soTuChu(a);
  if (nguyen == null) return null;
  if (b == null) return String(nguyen);
  const le = b.split(" ").map((w) => (/^\d+$/.test(w) ? w : w in SO ? String(SO[w]) : "")).join("");
  return le ? `${nguyen},${le}` : null;
}

/** Số giấy nói ⇒ chuỗi gọn: chữ số đọc rời ghép lại, "trên/xẹt/gạch chéo" ⇒ "/", "gạch" ⇒ "-". ≤40 ký tự. */
export function soGiayTuChu(text: string): string | null {
  const ws = chuan(text).split(" ").filter(Boolean);
  const out: string[] = [];
  let soDang = "";
  const day = () => {
    if (soDang) out.push(soDang);
    soDang = "";
  };
  for (const w of ws) {
    const f = boDau(w);
    if (/^\d+$/.test(w)) soDang += w;
    else if (f in SO && f !== "linh" && f !== "le") soDang += String(SO[f]);
    else if (["tren", "xet", "xuyet", "cheo"].includes(f)) {
      day();
      out.push("/");
    } else if (f === "gach" || f === "ngang") {
      day();
      out.push("-");
    } else if (f === "so" || f === "la") continue;
    else {
      day();
      out.push(w.toUpperCase());
    }
  }
  day();
  const r = out.join(" ").replace(/\s*([/-])\s*/g, "$1").trim();
  // ≥2 chữ số: "không nhớ" (không = 0) không được thành số giấy "0 NHỚ"
  return r && r.length <= 40 && (r.match(/\d/g)?.length ?? 0) >= 2 ? r : null;
}

// ── mã tàu đánh vần ─────────────────────────────────────────────────────────────────────────────
/** Tên chữ cái tiếng Việt (đã bỏ dấu, trừ "đê/đờ" xét trên chữ gốc) ⇒ chữ in hoa. */
const CHU_CAI: [RegExp, string][] = [
  [/^(e lo|lo|eo lo)$/, "L"], [/^(e mo|em mo|mo|em)$/, "M"], [/^(e no|en no|no|en)$/, "N"], [/^(e ro|ro)$/, "R"],
  [/^(et xi|et|ech|ech xi|so|xi)$/, "S"], [/^(ich xi|ich)$/, "X"], [/^(i dai|i gret)$/, "Y"],
  [/^(be|bo|bi)$/, "B"], [/^(xe|co|ce|si)$/, "C"], [/^(de|do|di)$/, "D"], [/^(go|gie|gi)$/, "G"], [/^(hat|ho|hach)$/, "H"],
  [/^(ca|ka|ko)$/, "K"], [/^(pe|po|pi)$/, "P"], [/^(quy|cu|qui)$/, "Q"], [/^(te|to|ti)$/, "T"], [/^(ve|vo|vi)$/, "V"],
  [/^a$/, "A"], [/^e$/, "E"], [/^i$/, "I"], [/^o$/, "O"], [/^u$/, "U"],
];
const LA_D_GACH = /^(đê|đờ|đe|đi)$/;

/**
 * Mã tàu nói ⇒ "XX-NNNNN-TS". Nhận đánh vần ("gờ lờ chín chín hai tám không tê ét"), dạng gõ quen ("GL 99280 TS",
 * "BĐ-97345-TS"). Không đủ (thiếu chữ đầu / số 4–6 chữ số) ⇒ null ⇒ bà con gõ tay.
 */
export function maTauTuChu(text: string): string | null {
  const s = chuan(text);
  // ĐÁNH VẦN TRƯỚC: "gờ lờ 99280 tê ét" mà thử dạng gõ trước sẽ thành "LỜ-99280-TS"
  const danhVan = maTauDanhVan(s);
  if (danhVan) return danhVan;
  const go = /(?:^|[^\p{L}\d])([a-zđ]{1,4})[\s.\-]*(\d{4,6})[\s.\-]*(ts)?(?![\p{L}\d])/iu.exec(s);
  if (go && !/^(so|ma|tau|la)$/i.test(boDau(go[1]))) return `${go[1].toUpperCase()}-${go[2]}-TS`;
  return null;
}

function maTauDanhVan(s: string): string | null {
  const ws = s.split(" ").filter(Boolean);
  let chu = "";
  let so = "";
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    const f = boDau(w);
    if (["ma", "tau", "so", "la", "dang", "ky"].includes(f) && !so && !chu) continue;
    if (/^\d+$/.test(w)) {
      so += w;
      continue;
    }
    if (so && f in SO) {
      so += String(SO[f]);
      continue;
    }
    // "tê ét" ở cuối = TS
    if (so && (f === "te" || f === "to") && /^(et|xi|so)$/.test(boDau(ws[i + 1] ?? ""))) break;
    if (!so) {
      if (LA_D_GACH.test(w)) {
        chu += "Đ";
        continue;
      }
      const hai = boDau(`${w} ${ws[i + 1] ?? ""}`);
      const kep = CHU_CAI.find(([re]) => re.test(hai));
      if (kep && hai.includes(" ")) {
        chu += kep[1];
        i++;
        continue;
      }
      const don = CHU_CAI.find(([re]) => re.test(f));
      if (don) {
        chu += don[1];
        continue;
      }
      if (f in SO) {
        so += String(SO[f]);
        continue;
      }
    }
  }
  return chu.length >= 1 && chu.length <= 4 && /^\d{4,6}$/.test(so) ? `${chu}-${so}-TS` : null;
}

// ── loại giấy, tỉnh, chữ tự do ──────────────────────────────────────────────────────────────────
const LOAI: [RegExp, DocumentKind][] = [
  [/dang kiem|an toan ky thuat|ky thuat/, "dang_kiem"],
  [/dang ky/, "dang_ky_tau"],
  [/giay phep|khai thac|phep/, "giay_phep_khai_thac"],
  [/thuc pham|ve sinh|attp/, "an_toan_thuc_pham"],
  [/bao hiem/, "bao_hiem"],
  [/thuyen truong|may truong|chung chi|bang lai|bang/, "chung_chi_thuyen_truong"],
  [/khac/, "khac"],
];
export function loaiGiayTuChu(text: string): DocumentKind | null {
  const s = boDau(text);
  return LOAI.find(([re]) => re.test(s))?.[1] ?? null;
}

/** Tỉnh trong danh sách (khớp dài nhất, so không dấu). */
export function tinhTuChu(text: string, ds: readonly string[]): string | null {
  const s = ` ${boDau(text)} `;
  let tot: string | null = null;
  for (const t of ds) {
    const k = boDau(t);
    if (k.length >= 3 && s.includes(` ${k} `) && (!tot || k.length > boDau(tot).length)) tot = t;
  }
  return tot;
}

/** Chữ tự do (tên tàu, chủ tàu, nghề): gọn, viết hoa chữ đầu, 1–60 ký tự; bỏ "là", "tên là" ở đầu. */
export function chuTuDo(text: string): string | null {
  const s = String(text ?? "").normalize("NFC").replace(/\s+/g, " ").trim().replace(/^(tên là|tên|là|dạ|thì)\s+/i, "").replace(/[.!?]+$/, "");
  if (!s || s.length > 60) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── kịch bản ───────────────────────────────────────────────────────────────────────────────────
export type KetQuaO = { ok: true; gt: string; noi: string } | { ok: false };
export interface BuocHoi<K extends string = string> {
  o: K;
  hoi: string;
  /** hiểu câu trả lời ⇒ giá trị cho form + câu Sen Biển nhắc lại ("Dạ, …") */
  hieu: (t: string) => KetQuaO;
  boQuaDuoc: boolean;
}

const fmtNgay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} tháng ${m} năm ${y}`;
};
const ok = (gt: string, noi: string): KetQuaO => ({ ok: true, gt, noi });
const KHONG: KetQuaO = { ok: false };

export type OGiayGiong = "kind" | "expiresOn" | "number" | "issuedOn";
export const KICH_BAN_GIAY: BuocHoi<OGiayGiong>[] = [
  {
    o: "kind",
    hoi: "Giấy gì bác? Ví dụ đăng kiểm, giấy phép khai thác, bảo hiểm.",
    hieu: (t) => {
      const k = loaiGiayTuChu(t);
      return k ? ok(k, DOCUMENT_KINDS.find((x) => x.value === k)?.label ?? "") : KHONG;
    },
    boQuaDuoc: false,
  },
  {
    o: "expiresOn",
    hoi: "Giấy hết hạn ngày nào bác? Không có hạn thì nói bỏ qua.",
    hieu: (t) => {
      const d = ngayTuChu(t);
      return d ? ok(d, `hết hạn ${fmtNgay(d)}`) : KHONG;
    },
    boQuaDuoc: true,
  },
  {
    o: "number",
    hoi: "Số giấy là gì bác? Không nhớ thì nói bỏ qua.",
    hieu: (t) => {
      const s = soGiayTuChu(t);
      return s ? ok(s, `số ${s}`) : KHONG;
    },
    boQuaDuoc: true,
  },
  {
    o: "issuedOn",
    hoi: "Ngày cấp là ngày nào? Không nhớ thì nói bỏ qua.",
    hieu: (t) => {
      const d = ngayTuChu(t);
      return d ? ok(d, `cấp ${fmtNgay(d)}`) : KHONG;
    },
    boQuaDuoc: true,
  },
];

export type OTauGiong = "name" | "maTau" | "province" | "lengthM" | "ownerName" | "gear" | "builtYear";
export function kichBanTau(tinh: readonly string[]): BuocHoi<OTauGiong>[] {
  return [
    {
      o: "name",
      hoi: "Tàu tên gì bác?",
      hieu: (t) => {
        const s = chuTuDo(t);
        return s ? ok(s, `tàu ${s}`) : KHONG;
      },
      boQuaDuoc: false,
    },
    {
      o: "maTau",
      hoi: "Số đăng ký tàu là gì? Bác đánh vần, ví dụ bê đê chín bảy ba bốn năm tê ét. Không nhớ thì nói bỏ qua.",
      hieu: (t) => {
        const m = maTauTuChu(t);
        return m ? ok(m, `số ${m.replace(/-/g, " ")}`) : KHONG;
      },
      boQuaDuoc: true,
    },
    {
      o: "province",
      hoi: "Tàu cập cảng tỉnh nào?",
      hieu: (t) => {
        const p = tinhTuChu(t, tinh);
        return p ? ok(p, p) : KHONG;
      },
      boQuaDuoc: true,
    },
    {
      o: "lengthM",
      hoi: "Tàu dài bao nhiêu mét? Không biết thì nói bỏ qua.",
      hieu: (t) => {
        const s = soThapPhan(t);
        const n = s ? Number(s.replace(",", ".")) : NaN;
        return s && n > 0 && n <= 100 ? ok(s, `dài ${s.replace(",", " phẩy ")} mét`) : KHONG;
      },
      boQuaDuoc: true,
    },
    {
      o: "ownerName",
      hoi: "Chủ tàu tên gì?",
      hieu: (t) => {
        const s = chuTuDo(t);
        return s ? ok(s, `chủ tàu ${s}`) : KHONG;
      },
      boQuaDuoc: true,
    },
    {
      o: "gear",
      hoi: "Tàu làm nghề gì? Ví dụ câu cá ngừ, lưới vây.",
      hieu: (t) => {
        const s = chuTuDo(t);
        return s ? ok(s, `nghề ${s}`) : KHONG;
      },
      boQuaDuoc: true,
    },
    {
      o: "builtYear",
      hoi: "Tàu đóng năm nào?",
      hieu: (t) => {
        const n = namTuChu(t);
        return n ? ok(String(n), `đóng năm ${n}`) : KHONG;
      },
      boQuaDuoc: true,
    },
  ];
}

/** Câu tóm tắt cuối + hỏi lưu. */
export function cauTomTat(noi: readonly string[]): string {
  return noi.length ? `Bác xem lại: ${noi.join(", ")}. Lưu nhé?` : "Chưa ghi được gì. Bác bấm Lưu hoặc sửa tay nhé.";
}
