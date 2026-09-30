import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildAudioMap, buildKnowledgeIndex, knowledgeReply, parseAnswers, parseKnowledge, searchKnowledge, speakKey, voiceRegion,
} from "@/lib/assistant/brain";
import { voiceRank } from "@/lib/assistant/speech";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/app-config", () => ({ getConfigValue: async () => null }));
const { isOnlineEnabled } = await import("@/lib/assistant/server/key");

/*  GÓI NÃO (ADR 0010 P1): đọc kho theo luật contract, tìm câu hỏi mở bằng BM25
    CÓ CỔNG BẰNG CHỨNG (không đủ → null, không trả gần đúng), mp3 theo câu đọc,
    giọng theo vùng, ưu tiên giọng nữ, cờ tầng mạng.  */

const ROOT = process.cwd();
/** Dùng TOÀN BỘ kho nháp làm dữ liệu thử (coi như đã duyệt) — test máy tìm, không phải nội dung. */
const nhap = JSON.parse(readFileSync(join(ROOT, "scripts/tram-o-bo/kho/kho-nhap.json"), "utf8")) as {
  muc: Record<string, unknown>[];
};
const asApproved = { muc: nhap.muc.map((m) => ({ ...m, ngaySoat: "2026-09-30" })) };
const ITEMS = parseKnowledge(asApproved);
const INDEX = buildKnowledgeIndex(ITEMS);
const find = (q: string) => searchKnowledge(INDEX, q)?.item.id ?? null;

describe("parseKnowledge — luật contract", () => {
  it("kho nháp hợp lệ về shape (mọi mục ≤4 câu, có nguồn)", () => {
    expect(ITEMS.length).toBe(nhap.muc.length);
  });

  it("bỏ mục thiếu nguồn / thiếu ngày soát / >4 câu / id trùng / chip trỏ ra ngoài", () => {
    const base = { id: "a", cauHoiMau: ["x y"], tuKhoa: ["x"], traLoi: "Một câu.", nguon: "N", ngaySoat: "2026-09-01" };
    const out = parseKnowledge({
      muc: [
        base,
        { ...base, id: "b", nguon: "" },
        { ...base, id: "c", ngaySoat: "" },
        { ...base, id: "d", traLoi: "Một. Hai. Ba. Bốn. Năm." },
        { ...base }, // trùng id "a"
        { ...base, id: "e", chipMoMan: "//evil.example" },
      ],
    });
    expect(out.map((m) => m.id)).toEqual(["a", "e"]);
    expect(out[1].chipMoMan).toBeUndefined();
  });

  it("json hỏng → mảng rỗng, không ném", () => {
    expect(parseKnowledge(null)).toEqual([]);
    expect(parseKnowledge({ muc: "x" })).toEqual([]);
  });

  it("kho nháp: không mục nào được vào gói khi chưa duyệt (duyet=null)", () => {
    expect(nhap.muc.every((m) => m.duyet === null)).toBe(true);
  });
});

describe("searchKnowledge — tìm có cổng bằng chứng", () => {
  it.each([
    ["ướp cá ngừ sao cho tươi", "bao-quan-ca-ngu"],
    ["bác ơi cách bảo quản cá ngừ", "bao-quan-ca-ngu"],
    ["máy tàu bị nóng quá phải làm sao", "may-tau-nong"],
    ["có người rơi xuống biển thì làm gì", "nguoi-roi-xuong-bien"],
    ["làm sao chạy tàu cho đỡ tốn dầu", "tiet-kiem-dau-chay-ga-vua"],
    ["dầu có nước thì xả ở lọc dầu thế nào", "xa-nuoc-loc-dau"],
    ["tàu bị cháy phải làm sao", "chay-tren-tau"],
    ["mực ướp bị đỏ", "bao-quan-muc"],
  ])("'%s' → %s", (q, id) => {
    expect(find(q)).toBe(id);
  });

  it.each([
    "ai là tổng thống mỹ",
    "giá cá ngừ hôm nay bao nhiêu tiền một ký",
    "mai có mưa không",
    "",
    "bác ơi",
  ])("KHÔNG đủ bằng chứng → null: '%s'", (q) => {
    expect(find(q)).toBeNull();
  });

  it("mọi câu hỏi mẫu trong kho tìm ra ĐÚNG mục của nó (người duyệt sửa kho mà làm hỏng là đỏ ở đây)", () => {
    const sai = ITEMS.flatMap((m) => m.cauHoiMau.filter((q) => find(q) !== m.id).map((q) => `${m.id}: "${q}" → ${find(q)}`));
    expect(sai).toEqual([]);
  });

  it("kho rỗng → null", () => {
    expect(searchKnowledge(buildKnowledgeIndex([]), "ướp cá ngừ")).toBeNull();
  });
});

describe("knowledgeReply", () => {
  it("chữ = đúng đoạn đã duyệt, có dòng nguồn + tháng soát, chip mở màn", () => {
    const hit = searchKnowledge(INDEX, "ướp cá ngừ sao cho tươi")!;
    const r = knowledgeReply(hit);
    expect(r.text).toBe(hit.item.traLoi);
    expect(r.source).toBe("offline");
    expect(r.intent).toBe("hoi_mo");
    expect(r.sourceNote).toMatch(/^Theo .+ · SDVICO soát 9\/2026$/);
    expect(r.action).toEqual({ type: "navigate", href: "/tien" });
  });
});

describe("giọng Sen Biển sinh sẵn", () => {
  it("khoá câu đọc bỏ hoa/thường + dấu câu cuối, GIỮ dấu tiếng Việt", () => {
    expect(speakKey("Dạ, bác cần gì?")).toBe(speakKey("dạ, bác cần gì"));
    expect(speakKey("Mở Ra khơi.")).not.toBe(speakKey("Mở Ra khoi."));
  });

  it("answers → map mp3, bỏ đường mp3 sai khuôn", () => {
    const answers = parseAnswers({
      answers: [
        { id: "da", intentId: "chao_hoi", text: "Dạ.", mp3: { bac: "audio/bac/da.mp3", nam: "../x.mp3" } },
        { intentId: "xac_nhan", text: "Rồi." },
      ],
    });
    const m = buildAudioMap(answers);
    expect(m.get(speakKey("Dạ."))).toEqual({ bac: "audio/bac/da.mp3" });
    expect(m.has(speakKey("Rồi."))).toBe(false);
  });

  it.each([
    ["Cà Mau", "nam"], ["Bà Rịa - Vũng Tàu", "nam"], ["TP. Hồ Chí Minh", "nam"], ["Kiên Giang", "nam"],
    ["Gia Lai", "bac"], ["Khánh Hoà", "bac"], ["Quảng Ninh", "bac"], ["", "bac"], [null, "bac"],
  ])("vùng giọng theo tỉnh %s → %s", (p, want) => {
    expect(voiceRegion(p as string | null)).toBe(want);
  });

  it("giọng máy: ưu tiên nữ, giọng mạng xếp sau khi mất sóng", () => {
    const an = { name: "Microsoft An - Vietnamese (Vietnam)", localService: true };
    const hoaiMy = { name: "Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)", localService: false };
    const la = { name: "vi-vn-x-abc-local", localService: true };
    expect(voiceRank(hoaiMy, true)).toBeLessThan(voiceRank(an, true));
    expect(voiceRank(la, true)).toBeLessThan(voiceRank(an, true));
    expect(voiceRank(an, false)).toBeLessThan(voiceRank(hoaiMy, false)); // mất sóng: giọng trong máy mới đọc được
  });
});

describe("tên tàu không ghép đôi chữ 'tàu'", () => {
  it.each([["BĐ 91234", "tàu BĐ 91234"], ["Tàu của tôi", "Tàu của tôi"], ["ghe Hai Lúa", "ghe Hai Lúa"], ["Thuyền Nam", "Thuyền Nam"], ["Tàu", "Tàu"]])(
    "%s → %s",
    async (n, want) => {
      const { tauTen } = await import("@/lib/assistant/answer");
      expect(tauTen(n)).toBe(want);
    },
  );
});

describe("cờ tầng mạng assistant_online_enabled", () => {
  it.each([[null, true], ["", true], ["1", true], ["bat", true], ["tat", false], ["tắt", false], ["0", false], ["false", false], [" OFF ", false]])(
    "%s → %s",
    (v, want) => {
      expect(isOnlineEnabled(v as string | null)).toBe(want);
    },
  );
});
