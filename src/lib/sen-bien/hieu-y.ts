// SEN BIỂN trên bản đồ — từ câu nói ra MỘT việc làm (thuần, có test).
//
// Phạm vi tạm (chủ dự án 2026-10-16: "Sen Biển tạm thời chỉ phục vụ đúng cái
// bản đồ"): CHỌN ĐIỂM ĐẾN bằng giọng ("dẫn về cảng Sa Huỳnh", "chạy ra Hòn
// Mù") + hỏi sóng gió chỗ đang xem. Ý định khác → nói thật là chưa làm.
//
// Tên chỗ dò trong hai danh sách bà con đã có sẵn TRONG MÁY: cảng cá + điểm
// đã ghim. Không đoán toạ độ từ chữ tự do — không thấy tên thì hỏi lại.

import { parseSpokenCoordPair } from "@/lib/parse-coord";

import { cauHoiTuY, hoiGi, tachThamSo, timLoaiCa, type CauHoi } from "./hoi-ban-do";
import { lenhLuat, lenhTuY, type LenhBanDo } from "./lenh-ban-do";
import { foldVn, guessIntent, type NgramModel, type SenIntent } from "./ngram";

export type SenDest = {
  name: string;
  lat: number;
  lon: number;
  kind: "cang" | "diem" | "nha";
  /** toạ độ trong máy đã biết là SAI (PORT_COORD_SAI) — nhận ra tên nhưng không dẫn tới */
  toaDoSai?: boolean;
};

export type SenReply =
  | { kind: "go"; dest: SenDest; say: string }
  | { kind: "pick"; options: SenDest[]; say: string }
  /** bà con nói "đi" sau khi nghe tóm tắt đường ⇒ bắt đầu dẫn đường */
  | { kind: "start"; say: string }
  /** "dừng" khi đang chạy/dẫn ⇒ dừng hẳn */
  | { kind: "stop"; say: string }
  /** "thôi/không" khi đang chờ "đi" ⇒ bỏ chuyến vừa vẽ */
  | { kind: "cancel"; say: string }
  | { kind: "mute"; say: string }
  | { kind: "unmute"; say: string }
  /** đọc lại câu vừa rồi — chỗ gọi biết câu nào */
  | { kind: "repeat" }
  /** còn bao xa — chỗ gọi có số */
  | { kind: "howfar" }
  /** câu hỏi bản đồ (gần đảo nào, rạn, độ sâu, phía trước, cá…) — chỗ gọi tra kho lớp (hoi-ban-do.ts) */
  | { kind: "hoi"; q: CauHoi }
  /** thao tác màn bản đồ (mở/tắt lớp, đổi giờ, đọc số, phóng/thu, về tàu) — chỗ gọi bấm nút hộ (lenh-ban-do.ts) */
  | { kind: "map"; lenh: LenhBanDo }
  /** `ask` = câu này CHỜ bà con nói lại ⇒ đọc xong Sen Biển tự nghe một lượt ngắn ·
      `y` = ý định n-gram khi có — "dan_duong" mà không thấy tên ⇒ Gemma (Android) còn cứu được tên lệch giọng */
  /** `daTraLoi` = câu này đã là câu trả lời thật (sóng gió chỗ đang xem, chặn ngoài phạm vi) — lớp trợ lý toàn app (tra-loi-app.ts) đừng thay */
  | { kind: "say"; say: string; ask?: boolean; y?: SenIntent; daTraLoi?: boolean };

/** Đang ở nấc nào của cuộc nói — quyết định "đi"/"thôi" nghĩa là gì. */
export type SenCtx = {
  /** vừa đọc tóm tắt đường, đang chờ "đi" */
  awaitingGo: boolean;
  /** đang chạy hoặc đang dẫn đường */
  running: boolean;
  /** chỗ Sen Biển vừa trả lời ("rạn gần nhất là…") — "dẫn tới đó" đi tới đây */
  choVuaNoi?: SenDest | null;
  /** tên ngắn các loài cá app biết — để nhận "chỗ nào nhiều cá ngừ vằn" */
  loaiCa?: readonly string[];
};

/** Bỏ chữ "cảng"/"cảng cá" đầu tên để "về Sa Huỳnh" cũng khớp "Cảng Sa Huỳnh". */
function core(name: string): string {
  return foldVn(name).replace(/^(cang ca|cang|ben ca|ben)\s+/, "");
}

/** Mọi chỗ có tên xuất hiện NGUYÊN CỤM trong câu; khớp dài nhất thắng.
 *  Không chỗ nào khớp trọn thì xét tên NÓI THIẾU CHỮ CUỐI (bắt được khi chạy
 *  thử 2026-10-16: "về bến Phan Rí" không khớp "Phan Rí Cửa" ⇒ rơi xuống nhánh
 *  "về bến" = cảng nhà, dẫn nhầm về nhà). Chỉ nhận ≥2 chữ ĐẦU của tên — một chữ
 *  ("Phan") quá dễ trùng; trùng nhiều chỗ thì trả cả, chỗ gọi cho chạm chọn. */
export function findDests(text: string, dests: readonly SenDest[]): SenDest[] {
  const t = ` ${foldVn(text)} `;
  const pick = (score: (k: string) => number): SenDest[] => {
    let best = 0;
    let hits: SenDest[] = [];
    for (const d of dests) {
      const s = score(core(d.name));
      if (s <= 0) continue;
      if (s > best) {
        best = s;
        hits = [d];
      } else if (s === best && !hits.some((h) => h.lat === d.lat && h.lon === d.lon)) {
        hits.push(d);
      }
    }
    return hits;
  };
  const full = pick((k) => (k && t.includes(` ${k} `) ? k.length : 0));
  if (full.length) return full;
  return pick((k) => {
    const w = k.split(" ");
    for (let n = w.length - 1; n >= 2; n--) if (t.includes(` ${w.slice(0, n).join(" ")} `)) return n;
    return 0;
  });
}

// "về bến" chỉ là cảng nhà khi KHÔNG có chữ nào theo sau ("về bến Phan Rí" là bến khác)
const HOME_RE = / (cang nha|ve nha) | ve ben $/;
// câu bắt đầu bằng động từ đi lại mà không thấy tên ⇒ bà con muốn tới một chỗ máy chưa biết
// KHÔNG có "toi" trần: bỏ dấu thì "tôi" và "tới" là một ("tôi đau bụng…" từng thành "chưa thấy chỗ")
const MOVE = /^(di|ve|ra|vao|vo|toi cang|chay|dan|chi duong)( |$)/;
const NOT_FOUND = "Sen Biển chưa thấy chỗ đó. Bà con nói tên cảng, điểm đã ghim, hoặc đọc toạ độ.";

/*  KHỚP GẦN THEO ÂM — chỉ khi không thấy tên nguyên cụm. Bộ nghe trong máy hay
    viết lệch tên riêng đúng kiểu giọng miền: "Hòn Rớ"→"Hòn Dớ", "Ninh Chữ"→
    "Niên Trữ", "La Gi"→"Lavi", "Sa Huỳnh"→"Xa Huyền" (đo 2026-10-16, 70 câu ×
    4 kiểu thu). Gộp phụ âm hay lẫn rồi so khoảng cách chữ. Khớp gần KHÔNG tự
    chạy: Sen Biển đọc lại tên + đường rồi chờ "đi", bà con nghe sai thì "thôi". */
function amKey(s: string): string[] {
  return foldVn(s)
    .split(" ")
    .filter(Boolean)
    .map((w) =>
      w
        .replace(/^ngh/, "ng")
        .replace(/^gh/, "g")
        .replace(/^gi(?=[aeiouy])/, "d")
        .replace(/^g(?=i)/, "d")
        .replace(/^tr/, "ch")
        .replace(/^[rv]/, "d")
        .replace(/^s/, "x")
        .replace(/^qu/, "kw")
        .replace(/^[ck]/, "k")
        .replace(/[ct]$/, "k"),
    );
}

function lev(a: string, b: string): number {
  let p = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const q = [i];
    for (let j = 1; j <= b.length; j++) q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    p = q;
  }
  return p[b.length];
}

/** Chỗ có tên GẦN GIỐNG nhất (một chỗ duy nhất, cách chỗ nhì ít nhất 1 chữ); không chắc ⇒ []. */
export function findDestsGan(text: string, dests: readonly SenDest[]): SenDest[] {
  // bỏ chữ lệnh/đệm trước khi so: "cảng" từng khớp gần "Cà Ná"
  const h = amKey(foldVn(text).replace(LOI_DEM, " "));
  const gan: { d: SenDest; k: number }[] = [];
  for (const d of dests) {
    const k = amKey(core(d.name));
    const kj = k.join("");
    if (kj.length < 4) continue; // tên quá ngắn, gần giống gì cũng khớp
    let dmin = Infinity;
    for (let n = Math.max(1, k.length - 1); n <= k.length + 1; n++)
      for (let i = 0; i + n <= h.length; i++) dmin = Math.min(dmin, lev(h.slice(i, i + n).join(""), kj));
    if (dmin <= Math.floor(kj.length * 0.3)) gan.push({ d, k: dmin });
  }
  gan.sort((a, b) => a.k - b.k);
  const a = gan[0];
  // cùng một chỗ (trùng toạ độ, hai tên) không tính là "nhì"
  const nhi = gan.find((g) => g.d.lat !== a?.d.lat || g.d.lon !== a?.d.lon);
  return a && (!nhi || nhi.k > a.k) ? [a.d] : [];
}

const LOI_DEM =
  /(^| )(dan|ve|cang|ben|chay|ra|di|toi|cho|tui|toi|minh|em|anh|nha|giup|gium|coi|voi|duong|den|thoi|o|a|nhe)(?= |$)/g;

const LENH_Y = new Set<SenIntent>(["mo_lop", "tat_lop", "doi_thoi_diem", "doc_gia_tri", "phong_to", "thu_nho", "ve_tau", "chay_thoi_gian"]);

/** Độ tin n-gram từ đó tin mô hình hơn luật hỏi bản đồ (chọn trên bộ kín: 0,4–0,5 cùng đỉnh). */
const NGRAM_CHAC = 0.5;


const NGOAI_BAN_DO: SenIntent[] = [
  "giay_to", "bao_duong", "thuyen_vien", "tau_cua_toi", "tim_mon", "them_gio", "xem_gio",
  "don_cua_toi", "gia_ca", "gia_dau", "tin_mua_ban", "goi_shop", "goi_sdvico", "hop_thu", "mo_man", "hoi_mo",
];

/*  LỆNH NGẮN = LUẬT TỪ KHOÁ, KHÔNG HỎI MÔ HÌNH. Đo 2026-10-16: n-gram đoán
    "đi" → huỷ (0,75), "bắt đầu" → giá dầu, "còn bao xa" → bão — lệnh một hai
    chữ quá ngắn cho đặc trưng n-gram. Bộ lệnh đóng, sai là nguy hiểm ("đi"
    thành "dừng") ⇒ luật tường minh. Mô hình chỉ dùng cho câu chọn chỗ. */
// "thôi" chỉ là KHÔNG khi đứng đầu câu ("thôi khỏi"); "đi thôi" / "chạy thôi" là ĐỒNG Ý
// "chưa" / "để sau" / "khoan" lúc chờ "đi" cũng là chưa chạy (chạy thử 2026-10-16: từng ra "chưa hiểu")
const NEG = /(^thoi( |$))|((^| )(khong|dung|huy|ngung|khoi)( |$))|^(chua|de sau|khoan|doi chut|doi da)( |$)/;
const STOP = /^(dung|dung lai|dung chay|ngung|huy|thoi|tat dan duong|dung dan duong|ngung dan duong|thoi khoi)( |$)/;
const CONFIRM = /^(di|di thoi|di di|bat dau|chay|chay di|chay thoi|xuat phat|ok|oke|duoc|u|uh|vang|da|co|dong y)( |$)/;
const MUTE = /^(im|im di|im lang|tat tieng|tat loa|nho tieng)( |$)/;
const UNMUTE = /(^| )(bat tieng|bat loa|mo loa|doc tiep|noi tiep)( |$)/;
const REPEAT = /(^| )(noi lai|nhac lai|doc lai|lap lai|noi gi|gi vay)( |$)/;
const TOI_DO = /^(dan|di|chay|toi|ra|ve|dua)( toi| ra| ve| vo)? (do|cho do|cho nay|cho kia|ben do|dao do|ran do)( di| nha| luon)?$/;
const HOWFAR = /(^| )(bao xa|bao lau|bao gio toi|toi chua|con may|con bao nhieu)( |$)/;

/** 14,5754 → "14 độ 34 phút" — đọc lại toạ độ để bà con nghe máy hiểu đúng chưa. */
export function coordSpeech(v: number, axis: "lat" | "lon"): string {
  const a = Math.abs(v);
  let d = Math.floor(a);
  let m = Math.round((a - d) * 60);
  if (m === 60) {
    d += 1;
    m = 0;
  }
  const h = axis === "lat" ? (v >= 0 ? "Bắc" : "Nam") : v >= 0 ? "Đông" : "Tây";
  return `${d} độ ${m} phút ${h}`;
}

export function senBienReply(
  text: string,
  model: NgramModel | null,
  dests: readonly SenDest[],
  seaLine: string | null,
  ctx: SenCtx = { awaitingGo: false, running: false },
): SenReply {
  const f = foldVn(text);
  if (!f) return { kind: "say", say: "Sen Biển chưa nghe rõ. Bà con nói lại tên chỗ muốn tới nhé.", ask: true };

  // (1) chờ "đi": đồng ý / không — trước mọi thứ khác
  if (ctx.awaitingGo) {
    if (NEG.test(f)) return { kind: "cancel", say: "Dạ, chưa chạy. Đường vẫn để trên bản đồ." };
    if (CONFIRM.test(f)) return { kind: "start", say: "Bắt đầu dẫn đường. Sen Biển canh và đọc cảnh báo." };
  }
  // (2) lệnh khi đang chạy
  if (ctx.running && STOP.test(f)) return { kind: "stop", say: "Đã dừng dẫn đường." };
  if (MUTE.test(f)) return { kind: "mute", say: "Im ba mươi phút. Cảnh báo nguy hiểm vẫn đọc." };
  if (UNMUTE.test(f)) return { kind: "unmute", say: "Bật tiếng lại." };
  if (REPEAT.test(f)) return { kind: "repeat" };
  if (HOWFAR.test(f)) return { kind: "howfar" };

  // (2b) "dẫn tới đó" — chỗ vừa trả lời
  if (ctx.choVuaNoi && TOI_DO.test(f)) return { kind: "go", dest: ctx.choVuaNoi, say: `Đi ${ctx.choVuaNoi.name}.` };

  // (3) toạ độ đọc bằng giọng
  const c = parseSpokenCoordPair(text);
  if (c) {
    const name = `${coordSpeech(c.lat, "lat")}, ${coordSpeech(c.lon, "lon")}`;
    return { kind: "go", dest: { name, lat: c.lat, lon: c.lon, kind: "diem" }, say: `Điểm ${name}.` };
  }

  let hits = findDests(text, dests);
  const g = model ? guessIntent(model, text, { diem: dests.map((d) => core(d.name)), xn: ctx.awaitingGo }) : null;
  const yM = g?.y ?? null;

  // (3a) thao tác bản đồ — mô hình chắc thì theo mô hình, không thì luật chỉ bắt câu rất rõ
  const tim = (t: string) => timLoaiCa(t, ctx.loaiCa ?? []);
  if (g && g.conf >= NGRAM_CHAC && LENH_Y.has(g.y)) {
    const lenh = lenhTuY(g.y, text, tim);
    if (lenh) return { kind: "map", lenh };
    if (g.y === "mo_lop")
      return { kind: "say", say: "Bà con muốn xem lớp nào: sóng, gió, dòng chảy, mưa, mây, hay bản đồ cá?" };
    if (g.y === "doi_thoi_diem") return { kind: "say", say: "Bà con nói rõ ngày giờ, ví dụ: chiều mai, ba giờ chiều mốt." };
  } else if (!g || g.conf < NGRAM_CHAC) {
    const lenh = lenhLuat(text, tim);
    if (lenh) return { kind: "map", lenh };
  }

  // (3b) câu hỏi bản đồ — trước tên chỗ ("gần đảo nào" không phải "đi đảo Nào").
  // Bộ n-gram v2 (44 ý, 13 ý bản đồ) CHẮC (≥ 0,5) thì theo nó — kể cả khi nó nói "không phải câu bản đồ"; kém chắc
  // hoặc chưa tải được thì LUẬT làm lưới. Đo 2026-10-16 trên bộ câu bản đồ kín (Forlife Assistant
  // train/reports/troly-*): đúng tuyến luật 76,6 % · luật rồi n-gram 93,3 % · n-gram rồi luật 96,2 %.
  // Mô hình chỉ chọn LOẠI câu hỏi; hướng/loài/đi luôn vẫn do luật trích (tachThamSo).
  // Ngoại lệ: câu có TÊN chỗ + động từ đi ("chạy ra Hòn Mù có rạn") ⇒ để bước (4) dẫn đi.
  const tuMoHinh = (y: SenIntent) => (hits.length && tachThamSo(text).muonDi ? null : cauHoiTuY(y, text, ctx.loaiCa));
  const hoi = g && g.conf >= NGRAM_CHAC ? tuMoHinh(g.y) : (hoiGi(text, ctx.loaiCa) ?? (g ? tuMoHinh(g.y) : null));
  if (hoi) return { kind: "hoi", q: hoi };
  if (yM === "con_bao_xa") return { kind: "howfar" };

  // (4) chọn chỗ theo tên
  const home = dests.find((d) => d.kind === "nha");
  // mô hình chưa tải được (lần đầu mất sóng) ⇒ vẫn dẫn được khi câu có tên chỗ
  const y: SenIntent = yM ?? (hits.length || MOVE.test(f) ? "dan_duong" : "khong_hieu");
  // khớp gần chỉ khi câu RÕ là muốn đi — đừng để "sóng gió chỗ này" hoá tên cảng
  // Có mô hình thì chỉ khớp gần khi nó đoán DẪN ĐƯỜNG: nới sang "không hiểu"/"có động
  // từ đi" thì khớp nhầm tăng từ 1 lên 33 trên 1.421 câu thử ("về trang chủ" → Trân Châu).
  const muonDi = model ? y === "dan_duong" || y === "dat_cang_nha" : MOVE.test(f);
  if (!hits.length && muonDi)
    hits = findDestsGan(text, dests);

  const wantsGo =
    y === "dan_duong" || y === "dat_cang_nha" || (hits.length > 0 && y !== "ngoai_pham_vi");
  if (wantsGo) {
    /*  Cảng biết là sai toạ độ: dẫn tới đó là đưa tàu đi chỗ khác hàng trăm hải
        lý. Có chỗ trùng tên đúng toạ độ thì bỏ chỗ sai; chỉ còn chỗ sai thì nói
        thật (không im, không đoán). */
    const dung = hits.filter((h) => !h.toaDoSai);
    if (hits.length > 0 && dung.length === 0)
      return {
        kind: "say",
        say: `Toạ độ ${hits[0].name} trong máy chưa đúng, Sen Biển chưa dẫn tới đó được. Bà con đọc toạ độ, hoặc chạm chỗ đó trên bản đồ.`,
      };
    hits = dung;
    if (hits.length === 1) return { kind: "go", dest: hits[0], say: `Đi ${hits[0].name}.` };
    if (hits.length > 1)
      return { kind: "pick", options: hits.slice(0, 4), say: `Có ${hits.length} chỗ tên giống nhau. Bà con chạm chọn đúng chỗ.` };
    if (HOME_RE.test(` ${f} `)) {
      if (home) return { kind: "go", dest: home, say: `Về ${home.name}.` };
      return { kind: "say", say: "Máy chưa biết cảng nhà. Bà con ghim chỗ cảng nhà trên bản đồ trước nhé." };
    }
    return { kind: "say", say: NOT_FOUND, y };
  }
  if (y === "thoi_tiet" || y === "bao" || y === "con_nuoc")
    return { kind: "say", say: seaLine ? `Chỗ đang xem: ${seaLine}.` : "Bà con chạm vào biển chỗ muốn xem, Sen Biển đọc sóng gió chỗ đó.", y, ...(seaLine ? { daTraLoi: true } : {}) };
  if (y === "ngoai_pham_vi") return { kind: "say", say: "Việc này Sen Biển không trả lời được.", y, daTraLoi: true };
  if (y === "chao_hoi") return { kind: "say", say: "Chào bà con. Muốn đi đâu, cứ nói tên cảng, điểm đã ghim hoặc toạ độ.", y };
  /*  "đi Vũng Tàu" / "vào Rạch Giá" — tên không có trong danh sách, mô hình đoán
      lạc sang việc khác ("tàu" ⇒ tàu của tôi) ⇒ từng đáp "chỉ giúp trên bản
      đồ", sai hẳn ý. Câu mở bằng động từ đi lại thì nói thật là chưa thấy chỗ.
      Đặt SAU sóng gió / ngoài phạm vi / chào: chỉ giành lại các ý "việc khác". */
  if (MOVE.test(f)) return { kind: "say", say: NOT_FOUND, y: "dan_duong" };
  if (NGOAI_BAN_DO.includes(y))
    return { kind: "say", say: "Sen Biển hiện chỉ giúp trên bản đồ: chọn chỗ đến, dẫn đường và đọc cảnh báo.", y };
  return { kind: "say", say: "Sen Biển chưa hiểu. Bà con thử nói: dẫn về cảng Sa Huỳnh.", y };
}
