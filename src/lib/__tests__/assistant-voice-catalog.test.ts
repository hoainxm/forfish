import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { answerOffline, onlineErrorReply } from "@/lib/assistant/answer";
import { speakKey } from "@/lib/assistant/brain";
import { parseUtterance } from "@/lib/assistant/parse";
import type { AssistantErrorCode, DeviceSnapshot } from "@/lib/assistant/types";
import { INTENTS } from "@/lib/assistant/types";

/*  CATALOG GIỌNG SEN BIỂN ↔ CÂU APP ĐỌC THẬT (2026-09-30).

    mp3 giọng Sen Biển chỉ phát khi câu app đọc TRÙNG NGUYÊN VĂN `text` trong
    scripts/tro-ly-giong/catalog.json (khoá `speakKey`). Sửa một chữ ở answer.ts
    mà quên catalog là mp3 lặng lẽ không bao giờ phát nữa (bà con nghe lại giọng
    máy, không ai biết). Test này dựng tập câu app THẬT SỰ đọc — chạy answerOffline
    trên máy rỗng/có sóng/mất sóng + các câu lỗi mạng + câu COPY của use-assistant
    — và đòi mọi câu trong catalog phải nằm trong tập đó. Đỏ ⇒ sửa catalog rồi
    sinh lại mp3 (scripts/tro-ly-giong/README.md). */

const ROOT = process.cwd();
const catalog = JSON.parse(readFileSync(join(ROOT, "scripts/tro-ly-giong/catalog.json"), "utf8")) as {
  items: { id: string; intent: string; text: string; doc?: string }[];
};

const NOW = Date.parse("2026-09-06T05:00:00Z");

function snap(over: Partial<DeviceSnapshot> = {}): DeviceSnapshot {
  return {
    takenAt: NOW, route: "/", online: true, premium: false, home: null,
    weather: null, storm: null, tide: null, boat: null, docs: [], maintenance: [], crew: { count: 0, issues: 0 },
    cart: { lines: 0, titles: [] }, orders: null, fishPrices: null, fuel: null, inboxUnread: 0, placeNames: [],
    ...over,
  };
}

const CTX = { route: "/", awaitingConfirm: false, boatNames: [], portNames: [], placeNames: [] };

/** Câu bà con hay nói — đủ để chạm mọi nhánh câu CỐ ĐỊNH của answer.ts. */
const UTTER = [
  "chào", "cảm ơn", "tắt tiếng", "bật tiếng", "bác nói được gì", "giá cá hôm nay", "giá dầu", "giỏ có gì",
  "có bão không", "con nước hôm nay", "giấy tờ sắp hết hạn", "bảo dưỡng gì tới hạn", "tàu có mấy người",
  "tàu của tôi", "có tin mới không", "mở", "mở ra khơi", "mở tàu cá", "mở giấy tờ", "mở bạn thuyền",
  "mở giao dịch", "mở chợ", "thời tiết hôm nay", "dẫn đường tới bãi mực", "ai là tổng thống mỹ",
  "đau bụng uống thuốc gì", "bị phạt bao nhiêu tiền", "xyz abc", "kinh nghiệm câu mực đêm như thế nào hả bác",
];

function spokenSet(): Set<string> {
  const out = new Set<string>();
  for (const online of [true, false]) {
    const s = snap({ online });
    for (const u of UTTER) {
      const p = parseUtterance(u, CTX);
      out.add(speakKey(answerOffline(p, s, NOW).speak));
      out.add(speakKey(answerOffline({ ...p, intent: "khong_hieu", reason: undefined, followUp: undefined, slots: {} }, s, NOW).speak));
    }
    // mọi ý định với slot rỗng — nhánh "chưa nói rõ" / câu mặc định của từng ý định
    for (const intent of INTENTS) out.add(speakKey(answerOffline({ intent, confidence: 1, slots: {}, normalized: "" }, s, NOW).speak));
    out.add(speakKey(answerOffline({ intent: "khong_hieu", confidence: 0, slots: {}, normalized: "", reason: "qua_dai" }, s, NOW).speak));
  }
  // nhánh bắt lỗi chung của answerOffline
  out.add(speakKey("Tôi chưa trả lời được câu này. Bác thử hỏi cách khác giúp."));
  const codes: (AssistantErrorCode | "offline")[] = ["quota", "no_key", "unavailable", "upstream", "timeout", "offline", "no_token", "refused", "invalid"];
  for (const c of codes) out.add(speakKey(onlineErrorReply(c, snap()).speak));
  // COPY của use-assistant (câu máy tự NÓI khi mic/xác nhận) — đọc từ mã nguồn, không nạp module client
  const src = readFileSync(join(ROOT, "src/lib/assistant/use-assistant.ts"), "utf8");
  const copy = /const COPY = \{([\s\S]*?)\n\};/.exec(src)?.[1] ?? "";
  for (const m of copy.matchAll(/:\s*"([^"]+)"/g)) out.add(speakKey(m[1]));
  return out;
}

describe("catalog giọng Sen Biển", () => {
  it("mọi câu trong catalog là câu app THẬT SỰ đọc (khớp nguyên văn)", () => {
    const spoken = spokenSet();
    const lech = catalog.items.filter((i) => !spoken.has(speakKey(i.text))).map((i) => `${i.id}: ${i.text}`);
    expect(lech).toEqual([]);
  });

  it("id duy nhất, dạng a-z_ (tên file mp3)", () => {
    const ids = catalog.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9_]+$/);
  });

  it("câu có số khẩn 115 phải có `doc` đọc từng số", () => {
    for (const i of catalog.items.filter((x) => /115/.test(x.text))) {
      expect(i.doc, i.id).toMatch(/một một năm/);
    }
  });
});
