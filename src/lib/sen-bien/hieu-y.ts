// SEN BIỂN trên bản đồ — từ câu nói ra MỘT việc làm (thuần, có test).
//
// Phạm vi tạm (chủ dự án 2026-10-16: "Sen Biển tạm thời chỉ phục vụ đúng cái
// bản đồ"): CHỌN ĐIỂM ĐẾN bằng giọng ("dẫn về cảng Sa Huỳnh", "chạy ra Hòn
// Mù") + hỏi sóng gió chỗ đang xem. Ý định khác → nói thật là chưa làm.
//
// Tên chỗ dò trong hai danh sách bà con đã có sẵn TRONG MÁY: cảng cá + điểm
// đã ghim. Không đoán toạ độ từ chữ tự do — không thấy tên thì hỏi lại.

import { foldVn, guessIntent, type NgramModel, type SenIntent } from "./ngram";

export type SenDest = { name: string; lat: number; lon: number; kind: "cang" | "diem" | "nha" };

export type SenReply =
  | { kind: "go"; dest: SenDest; say: string }
  | { kind: "pick"; options: SenDest[]; say: string }
  | { kind: "say"; say: string };

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

export function senBienReply(
  text: string,
  model: NgramModel | null,
  dests: readonly SenDest[],
  seaLine: string | null,
): SenReply {
  const f = foldVn(text);
  if (!f) return { kind: "say", say: "Sen Biển chưa nghe rõ. Bà con nói lại tên chỗ muốn tới nhé." };
  const hits = findDests(text, dests);
  const home = dests.find((d) => d.kind === "nha");
  // mô hình chưa tải được (lần đầu mất sóng) ⇒ vẫn dẫn được khi câu có tên chỗ
  const y: SenIntent = model
    ? guessIntent(model, text, { diem: dests.map((d) => core(d.name)) }).y
    : hits.length
      ? "dan_duong"
      : "khong_hieu";

  const wantsGo = y === "dan_duong" || y === "dat_cang_nha" || ((y === "khong_hieu" || y === "mo_man") && hits.length > 0);
  if (wantsGo) {
    if (hits.length === 1) return { kind: "go", dest: hits[0], say: `Sen Biển chọn ${hits[0].name} làm điểm đến. Bà con xem đường rồi bấm Bắt đầu.` };
    if (hits.length > 1)
      return { kind: "pick", options: hits.slice(0, 4), say: `Có ${hits.length} chỗ tên giống nhau. Bà con chạm chọn đúng chỗ.` };
    if (HOME_RE.test(` ${f} `)) {
      if (home) return { kind: "go", dest: home, say: `Sen Biển dẫn về ${home.name}. Bà con xem đường rồi bấm Bắt đầu.` };
      return { kind: "say", say: "Máy chưa biết cảng nhà. Bà con ghim chỗ cảng nhà trên bản đồ trước nhé." };
    }
    return { kind: "say", say: "Sen Biển chưa thấy chỗ đó trong danh sách cảng và điểm đã ghim. Bà con nói lại tên cảng, hoặc ghim điểm trước." };
  }
  if (y === "thoi_tiet" || y === "bao" || y === "con_nuoc")
    return { kind: "say", say: seaLine ? `Chỗ đang xem: ${seaLine}.` : "Bà con chạm vào biển chỗ muốn xem, Sen Biển đọc sóng gió chỗ đó." };
  if (y === "ngoai_pham_vi") return { kind: "say", say: "Việc này Sen Biển không trả lời được." };
  if (y === "chao_hoi") return { kind: "say", say: "Chào bà con. Muốn đi đâu, cứ nói tên cảng hoặc điểm đã ghim." };
  if (NGOAI_BAN_DO.includes(y))
    return { kind: "say", say: "Sen Biển hiện chỉ giúp trên bản đồ: chọn chỗ đến và xem sóng gió." };
  return { kind: "say", say: "Sen Biển chưa hiểu. Bà con thử nói: dẫn về cảng Sa Huỳnh." };
}
