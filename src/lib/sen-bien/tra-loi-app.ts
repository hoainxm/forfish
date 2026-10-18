// SEN BIỂN — TRỢ LÝ CHO TOÀN APP (thuần, có test, không mạng).
//
// Chủ dự án 2026-10-18: "mở rộng làm trợ lý cho toàn app, giao tiếp bằng giọng nói".
// Sen Biển vẫn là MỘT bộ: tai (nghe-may / Web Speech) → hiểu ý (n-gram v3 + luật,
// Android thêm Gemma) → trả lời. File này lo nửa "việc ngoài bản đồ":
//   · câu thuộc BẢN ĐỒ (dẫn đường, hỏi bản đồ, thao tác lớp) ⇒ `veBanDo` — màn khác
//     chuyển sang /ngu-truong rồi màn bản đồ xử lý tiếp (fishing-map-view đọc ?sen=)
//   · câu việc trong app (thời tiết, bão, con nước, giấy tờ, bảo dưỡng, bạn thuyền,
//     tàu, giá cá, giá dầu, cảng nhà, mở màn, hộp thư, trợ giúp…) ⇒ trả lời từ dữ liệu
//     ĐÃ có trong máy bằng bộ trả lời của Trợ lý cũ (lib/assistant/answer.ts, chép từ
//     feat/san-thuong-mai; chủ dự án 17/10 đã bỏ đường gọi máy chủ ⇒ chỉ phần trong máy).
// Ý định do n-gram chọn (đúng hơn regex — train/reports/troly-*); tham số lấy từ bộ
// tách của parse.ts khi parse cùng ý (như ứng viên "ngram" lúc chấm).

import { answerOffline } from "@/lib/assistant/answer";
import { parseUtterance } from "@/lib/assistant/parse";
import { INTENTS as APP_INTENTS, type AssistantReply, type DeviceSnapshot, type Intent, type ParseContext } from "@/lib/assistant/types";

import type { SenReply } from "./hieu-y";
import type { SenIntent } from "./ngram";

/** Câu trả lời này phải do màn BẢN ĐỒ làm (cần bản đồ, vị trí, lớp, dẫn đường). */
export function veBanDo(r: SenReply): boolean {
  switch (r.kind) {
    case "go":
    case "pick":
    case "hoi":
    case "map":
    case "howfar":
    case "start":
    case "stop":
    case "cancel":
      return true;
    case "say":
      return r.y === "dan_duong";
    default:
      return false;
  }
}


/**
 * Câu "say" của hieu-y (việc ngoài bản đồ) → câu trả lời từ dữ liệu trong máy; null =
 * giữ câu của hieu-y (câu đã là trả lời thật, hoặc ý không thuộc trợ lý app).
 */
export function traLoiApp(
  text: string,
  r: SenReply,
  snap: DeviceSnapshot,
  ctx: Omit<ParseContext, "route"> & { route?: string },
  now: number,
): AssistantReply | null {
  if (r.kind !== "say" || r.daTraLoi || r.ask || !r.y) return null;
  const y = r.y as SenIntent;
  if (!(APP_INTENTS as readonly string[]).includes(y)) return null;
  const intent = y as Intent;
  // Chợ vật tư đã gộp (2026-10-18): câu chợ có tham số rõ đi lenh-cho.ts trước; câu chợ chung n-gram
  // nhận (tìm món, giỏ, đơn, gọi shop) trả bằng bộ trả lời cũ của Trợ lý (answer.ts) như mọi ý khác.
  const p = parseUtterance(text, { route: ctx.route ?? "/", ...ctx });
  // tham số chỉ tin khi bộ tách cùng ý với n-gram; khác ý thì để trống (answer tự hỏi lại / trả lời chung)
  const parsed = p.intent === intent ? p : { ...p, intent, slots: {}, followUp: undefined };
  try {
    return answerOffline(parsed, snap, now);
  } catch {
    return null;
  }
}
