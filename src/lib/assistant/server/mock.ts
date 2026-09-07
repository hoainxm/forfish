import "server-only";

// TRỢ LÝ — KỊCH BẢN GIẢ LẬP (14 §6.6). Chạy khi `ASSISTANT_MOCK=1` hoặc thiếu
// khoá ngoài production. `source: "mock"` là DẤU HIỆU DUY NHẤT (13 §7.2).
//
// Trả lời bằng chính tầng máy (`parseUtterance` + `answerOffline` trên snapshot
// gửi lên) để UI/QA thấy đúng hình hợp đồng; câu hỏi mở / không hiểu → 5 câu
// xoay vòng theo hash; tìm món → hỏi kho thật (file-store có seed) để thấy
// action `search`. Trễ giả 600 ms để UI hiện "Đang nghĩ…".

import { FISHING_PORTS } from "@/data/fishing-ports";
import { PORTS } from "@/data/ports";
import { getMarketStore } from "@/lib/market/store";
import { answerOffline } from "../answer";
import { parseUtterance } from "../parse";
import type { AssistantReply, AssistantRequest } from "../types";

export const MOCK_DELAY_MS = 600;

const OPEN_ANSWERS = [
  "Kinh nghiệm bà con: sóng trên 2 mét thì ghe nhỏ đừng ra. Bác nghe thêm đài duyên hải.",
  "Nhớt máy tàu thì chọn đúng cấp nhà máy ghi trên máy, thay đúng kỳ quan trọng hơn hiệu. Giá thật hỏi đại lý.",
  "Cá ướp đá xay phủ kín, đá cây thì chèn quanh hầm. Chuyện này tôi trả lời thử, bác hỏi thêm người có kinh nghiệm.",
  "Mùa này cá được giá hay không tuỳ bến, bác coi bảng giá tuần ở Giao dịch. Giá thật hỏi đại lý.",
  "Chuyện này tôi không rành lắm. Bác hỏi tôi thời tiết, bão, giấy tờ, giỏ hàng thì tôi nói được ngay.",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockReply(body: AssistantRequest): Promise<AssistantReply> {
  await sleep(MOCK_DELAY_MS);
  const s = body.snapshot;
  const parsed = parseUtterance(body.text, {
    route: body.route,
    awaitingConfirm: false,
    boatNames: [],
    portNames: [...PORTS, ...FISHING_PORTS].map((p) => p.name),
    placeNames: s.placeNames,
  });
  const base = answerOffline(parsed, s, Date.now());

  if (parsed.intent === "hoi_mo" || (parsed.intent === "khong_hieu" && !parsed.followUp && !parsed.reason)) {
    const text = OPEN_ANSWERS[hash(body.text) % OPEN_ANSWERS.length];
    return { text, speak: text, source: "mock", intent: parsed.intent === "hoi_mo" ? "hoi_mo" : "khong_hieu" };
  }
  if (parsed.intent === "tim_mon" && parsed.slots.q) {
    try {
      const store = await getMarketStore();
      const page = await store.listProducts({ q: parsed.slots.q, page: 1, pageSize: 3, includeHidden: false });
      const n = page.total;
      const text = n > 0 ? `Tìm được ${n} món '${parsed.slots.q}'. Bác coi rồi chọn nhé.` : "Chợ chưa có món tên đó. Bác nói tên khác, hoặc mở chợ coi theo nhóm.";
      return { ...base, text, speak: text, source: "mock", ...(n > 0 ? {} : { action: undefined }) };
    } catch (e) {
      console.error("[tro-ly] mock listProducts hỏng:", (e as Error)?.message);
    }
  }
  return { ...base, source: "mock" };
}
