// SEN BIỂN trên bản đồ — từ câu nói ra MỘT việc làm (thuần, có test).
//
// Phạm vi tạm (chủ dự án 2026-10-16: "Sen Biển tạm thời chỉ phục vụ đúng cái
// bản đồ"): CHỌN ĐIỂM ĐẾN bằng giọng ("dẫn về cảng Sa Huỳnh", "chạy ra Hòn
// Mù") + hỏi sóng gió chỗ đang xem. Ý định khác → nói thật là chưa làm.
//
// Tên chỗ dò trong hai danh sách bà con đã có sẵn TRONG MÁY: cảng cá + điểm
// đã ghim. Không đoán toạ độ từ chữ tự do — không thấy tên thì hỏi lại.

import { parseSpokenCoordPair } from "@/lib/parse-coord";

import { foldVn, guessIntent, type NgramModel, type SenIntent } from "./ngram";

export type SenDest = { name: string; lat: number; lon: number; kind: "cang" | "diem" | "nha" };

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
  | { kind: "say"; say: string };

/** Đang ở nấc nào của cuộc nói — quyết định "đi"/"thôi" nghĩa là gì. */
export type SenCtx = {
  /** vừa đọc tóm tắt đường, đang chờ "đi" */
  awaitingGo: boolean;
  /** đang chạy hoặc đang dẫn đường */
  running: boolean;
};

/** Bỏ chữ "cảng"/"cảng cá" đầu tên để "về Sa Huỳnh" cũng khớp "Cảng Sa Huỳnh". */
function core(name: string): string {
  return foldVn(name).replace(/^(cang ca|cang|ben ca|ben)\s+/, "");
}

/** Mọi chỗ có tên xuất hiện NGUYÊN CỤM trong câu; khớp dài nhất thắng. */
export function findDests(text: string, dests: readonly SenDest[]): SenDest[] {
  const t = ` ${foldVn(text)} `;
  let best = 0;
  let hits: SenDest[] = [];
  for (const d of dests) {
    const k = core(d.name);
    if (!k || !t.includes(` ${k} `)) continue;
    if (k.length > best) {
      best = k.length;
      hits = [d];
    } else if (k.length === best && !hits.some((h) => h.lat === d.lat && h.lon === d.lon)) {
      hits.push(d);
    }
  }
  return hits;
}

const HOME_RE = / (cang nha|ve nha|ve ben) /;

const NGOAI_BAN_DO: SenIntent[] = [
  "giay_to", "bao_duong", "thuyen_vien", "tau_cua_toi", "tim_mon", "them_gio", "xem_gio",
  "don_cua_toi", "gia_ca", "gia_dau", "tin_mua_ban", "goi_shop", "goi_sdvico", "hop_thu", "mo_man", "hoi_mo",
];

/*  LỆNH NGẮN = LUẬT TỪ KHOÁ, KHÔNG HỎI MÔ HÌNH. Đo 2026-10-16: n-gram đoán
    "đi" → huỷ (0,75), "bắt đầu" → giá dầu, "còn bao xa" → bão — lệnh một hai
    chữ quá ngắn cho đặc trưng n-gram. Bộ lệnh đóng, sai là nguy hiểm ("đi"
    thành "dừng") ⇒ luật tường minh. Mô hình chỉ dùng cho câu chọn chỗ. */
// "thôi" chỉ là KHÔNG khi đứng đầu câu ("thôi khỏi"); "đi thôi" / "chạy thôi" là ĐỒNG Ý
const NEG = /(^thoi( |$))|((^| )(khong|dung|huy|ngung|khoi)( |$))/;
const STOP = /^(dung|dung lai|dung chay|ngung|huy|thoi|tat dan duong|dung dan duong|ngung dan duong|thoi khoi)( |$)/;
const CONFIRM = /^(di|di thoi|di di|bat dau|chay|chay di|chay thoi|xuat phat|ok|oke|duoc|u|uh|vang|da|co|dong y)( |$)/;
const MUTE = /^(im|im di|im lang|tat tieng|tat loa|nho tieng)( |$)/;
const UNMUTE = /(^| )(bat tieng|bat loa|mo loa|doc tiep|noi tiep)( |$)/;
const REPEAT = /(^| )(noi lai|nhac lai|doc lai|lap lai|noi gi|gi vay)( |$)/;
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
  if (!f) return { kind: "say", say: "Sen Biển chưa nghe rõ. Bà con nói lại tên chỗ muốn tới nhé." };

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

  // (3) toạ độ đọc bằng giọng
  const c = parseSpokenCoordPair(text);
  if (c) {
    const name = `${coordSpeech(c.lat, "lat")}, ${coordSpeech(c.lon, "lon")}`;
    return { kind: "go", dest: { name, lat: c.lat, lon: c.lon, kind: "diem" }, say: `Điểm ${name}.` };
  }

  // (4) chọn chỗ theo tên
  const hits = findDests(text, dests);
  const home = dests.find((d) => d.kind === "nha");
  // mô hình chưa tải được (lần đầu mất sóng) ⇒ vẫn dẫn được khi câu có tên chỗ
  const y: SenIntent = model
    ? guessIntent(model, text, { diem: dests.map((d) => core(d.name)), xn: ctx.awaitingGo }).y
    : hits.length
      ? "dan_duong"
      : "khong_hieu";

  const wantsGo =
    y === "dan_duong" || y === "dat_cang_nha" || (hits.length > 0 && y !== "ngoai_pham_vi");
  if (wantsGo) {
    if (hits.length === 1) return { kind: "go", dest: hits[0], say: `Đi ${hits[0].name}.` };
    if (hits.length > 1)
      return { kind: "pick", options: hits.slice(0, 4), say: `Có ${hits.length} chỗ tên giống nhau. Bà con chạm chọn đúng chỗ.` };
    if (HOME_RE.test(` ${f} `)) {
      if (home) return { kind: "go", dest: home, say: `Về ${home.name}.` };
      return { kind: "say", say: "Máy chưa biết cảng nhà. Bà con ghim chỗ cảng nhà trên bản đồ trước nhé." };
    }
    return { kind: "say", say: "Sen Biển chưa thấy chỗ đó. Bà con nói tên cảng, điểm đã ghim, hoặc đọc toạ độ." };
  }
  if (y === "thoi_tiet" || y === "bao" || y === "con_nuoc")
    return { kind: "say", say: seaLine ? `Chỗ đang xem: ${seaLine}.` : "Bà con chạm vào biển chỗ muốn xem, Sen Biển đọc sóng gió chỗ đó." };
  if (y === "ngoai_pham_vi") return { kind: "say", say: "Việc này Sen Biển không trả lời được." };
  if (y === "chao_hoi") return { kind: "say", say: "Chào bà con. Muốn đi đâu, cứ nói tên cảng, điểm đã ghim hoặc toạ độ." };
  if (NGOAI_BAN_DO.includes(y))
    return { kind: "say", say: "Sen Biển hiện chỉ giúp trên bản đồ: chọn chỗ đến, dẫn đường và đọc cảnh báo." };
  return { kind: "say", say: "Sen Biển chưa hiểu. Bà con thử nói: dẫn về cảng Sa Huỳnh." };
}
