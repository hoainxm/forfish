// Nhắc tên "@Tên" kiểu Facebook — bà con + 2000 agent (14 §3.12, migration 0071).
import { describe, expect, it } from "vitest";
import { doiAgent } from "@/lib/kairos/agent-doi.mjs";
import { chuanSoAgent, ghepViec, ghiSoAgent, keHoach, promptAgent } from "@/lib/kairos/agent-dieu-phoi.mjs";
import { chenTen, chiaDoan, dangGo, docIdNhac, docNhacTen, goiY, locNhacTen } from "@/lib/kairos/nhac-ten";
import { nhacTenMessage } from "@/lib/kairos/notify-gop";
import { validateComment, validatePost } from "@/lib/kairos/validate";

const A = "6f1c2a8e-1111-4222-8333-944455556666";
const B = "7a2d3b9f-2222-4333-8444-a55566667777";
const SANG = Date.parse("2026-10-24T00:00:00Z");
const h = (gio: number) => new Date(SANG - gio * 3_600_000).toISOString();

describe("nhac-ten — thuần", () => {
  it("docNhacTen / docIdNhac: bỏ hỏng, không trùng, ≤10", () => {
    expect(docNhacTen([{ id: A, ten: "Hải Âu" }, { id: A, ten: "X" }, { id: "x", ten: "Y" }, null])).toEqual([{ id: A, ten: "Hải Âu" }]);
    expect(docIdNhac([A, { id: B }, A, "x"])).toEqual([A, B]);
    expect(docIdNhac(Array.from({ length: 12 }, (_, i) => `${String(i).padStart(8, "0")}-1111-4222-8333-944455556666`))).toHaveLength(10);
  });
  it("locNhacTen: chỉ giữ người có '@tên' đứng riêng trong chữ", () => {
    const ds = [{ id: A, ten: "Hải Âu" }, { id: B, ten: "Ba Sa" }];
    expect(locNhacTen("@Hải Âu coi nè", ds)).toEqual([{ id: A, ten: "Hải Âu" }]);
    expect(locNhacTen("mail@Hải Âu", ds)).toEqual([]);
    expect(locNhacTen("@Ba Sang ơi", ds)).toEqual([]);
  });
  it("chiaDoan: tên dài thắng tên ngắn trùng đầu", () => {
    const d = chiaDoan("hỏi @Hải Âu Nhỏ với @Hải Âu", [{ id: A, ten: "Hải Âu" }, { id: B, ten: "Hải Âu Nhỏ" }]);
    expect(d.map((x) => ("nhac" in x ? `[${x.nhac.id === B ? "B" : "A"}]` : x.chu)).join("")).toBe("hỏi [B] với [A]");
  });
  it("dangGo + chenTen + goiY", () => {
    expect(dangGo("chào @hải", 9)).toEqual({ start: 5, q: "hải" });
    expect(dangGo("a@b", 3)).toBeNull();
    expect(dangGo("@x\ny", 4)).toBeNull();
    const r = chenTen("chào @hải nha", 5, 9, "Hải Âu");
    expect(r).toEqual({ text: "chào @Hải Âu nha", caret: 13 });
    expect(goiY("hai a", [{ ten: "Hải Âu" }, { ten: "Ba Sa" }, { ten: "Thợ Hải" }])).toEqual([{ ten: "Hải Âu" }]);
  });
  it("validate bài + bình luận nhận mentions (chỉ id)", () => {
    const p = validatePost({ body: "@Hải Âu ra coi", mentions: [A, "x"] }, { profileId: A, portIds: new Set() });
    expect(p.ok && p.value.mentions).toEqual([A]);
    const c = validateComment({ body: "@Hải Âu chuẩn", mentions: [{ id: B }] }, A);
    expect(c.ok && c.value.mentions).toEqual([B]);
  });
  it("thông báo nhắc tên trỏ đúng chỗ", () => {
    expect(nhacTenMessage("Ba", "p1", "c1")).toMatchObject({ title: "Có người nhắc đến bạn", url: "/kairos/p/p1#bl-c1" });
    expect(nhacTenMessage("Ba", "p1").body).toContain("một bài viết");
  });
});

describe("2000 agent nhắc tên nhau", () => {
  const [x, y] = doiAgent();
  const baCon = {
    id: "p1", kind: "ba-con", author: { handle: "Bà con 1" }, body: "Biển êm ghê", topic: "nghe-ca", regions: ["mien-trung"],
    commentCount: 2, publishedAt: h(1),
    topComments: [
      { id: "c1", body: "Đêm qua mực lên nhiều không ae", createdAt: h(0.5), author: { handle: "Anh Tư", profileId: A } },
      { id: "c2", body: `@${y.ten} vụ này ông rành nè`, createdAt: h(0.4), author: { handle: x.ten, profileId: B, isAgent: true }, mentions: [{ id: "9a2d3b9f-2222-4333-8444-a55566667777", ten: y.ten }] },
    ],
  };
  it("agent bị @ thì vào đáp người gọi; bình luận bà con có agent trả lời trong luồng", () => {
    const { viecChu } = keHoach([baCon], chuanSoAgent(null, SANG), SANG, () => 0.3);
    const dap = viecChu.find((v) => v.muc === "duoc-nhac");
    expect(dap?.agent.id).toBe(y.id);
    expect(dap?.parent).toMatchObject({ id: "c2", ten: x.ten, profileId: B });
    // suất trả lời mỗi lượt ít (≈35 % ngân sách bình luận) — người bị gọi tên được ưu tiên; không ai gọi ⇒ trả lời bà con
    const chiBaCon = { ...baCon, topComments: [baCon.topComments[0]] };
    const v2 = keHoach([chiBaCon], chuanSoAgent(null, SANG), SANG, () => 0.3).viecChu;
    expect(v2.some((v) => v.muc === "tra-loi-binh-luan" && v.parent?.id === "c1")).toBe(true);
  });
  it("ghepViec: thiếu '@tên' ⇒ tự thêm đầu câu, kèm parentId + nhac; ghi sổ không trả lời lại", () => {
    const v = { loai: "binh-luan", agent: y, muc: "duoc-nhac", post: baCon, parent: { id: "c2", body: "x", ten: x.ten, profileId: B } };
    const gui = ghepViec([v], [{ i: 0, body: "chuẩn r ông" }], () => 0.99); // 0,99 ⇒ không lỗi gõ
    expect(gui[0]).toMatchObject({ parentId: "c2", nhac: [B], body: `@${x.ten} chuẩn r ông` });
    const so = ghiSoAgent(chuanSoAgent(null, SANG), gui, [{ ok: true }], SANG);
    expect(so.daTraLoi).toEqual(["c2"]);
    const lai = keHoach([baCon], so, SANG, () => 0.3).viecChu;
    expect(lai.some((w) => w.parent?.id === "c2")).toBe(false);
  });
  it("rủ bạn: nhacAgent chỉ khi chữ thật có '@tên bạn'; prompt dặn đúng", () => {
    const co = ghepViec([{ loai: "bai", agent: x, muc: "bai-ke", ban: y }], [{ i: 0, body: `Mùa này cá cơm lên nhiều, @${y.ten} ra coi nè` }]);
    expect(co[0].nhacAgent).toEqual([y.id]);
    const khong = ghepViec([{ loai: "bai", agent: x, muc: "bai-ke", ban: y }], [{ i: 0, body: "Mùa này cá cơm lên nhiều lắm bà con" }]);
    expect(khong[0].nhacAgent).toBeUndefined();
    const pr = promptAgent([{ loai: "bai", agent: x, muc: "bai-ke", ban: y }], SANG);
    expect(pr).toContain(`"nhacBan":"${y.ten}"`);
    expect(pr).toContain("KHÔNG tự gọi tên ai bằng @");
  });
});
