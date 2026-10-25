import { describe, expect, it } from "vitest";
import { baiCuaTin, nhanDem, tinChuongKairos } from "@/lib/kairos/chuong";
import { dongDoc, hieuTimTinKairos, timTinKairos, traLoiTinKairos } from "@/lib/kairos/tim-tin";
import type { KairosPost } from "@/lib/kairos/types";
import type { InboxMessage } from "@/lib/inbox";

function post(over: Partial<KairosPost> = {}): KairosPost {
  return {
    id: "p1",
    kind: "ba-con",
    author: { profileId: "a1", handle: "Tư Sa Huỳnh", subline: "", avatarUrl: null, official: false },
    outlet: null,
    url: null,
    title: null,
    body: "Biển êm.",
    summary: null,
    summaryBy: null,
    coverUrl: null,
    images: [],
    topic: "nghe-ca",
    regions: ["mien-trung"],
    provinces: [],
    ports: [],
    reshareOf: null,
    pinnedUntil: null,
    hayCount: 0,
    commentCount: 0,
    hayByMe: false,
    topComments: [],
    publishedAt: "2026-10-23T05:00:00.000Z",
    editedAt: null,
    mine: false,
    ...over,
  };
}

const NOW = Date.parse("2026-10-24T03:00:00Z");
const POSTS = [
  post({ id: "a", body: "Đêm qua câu mực ở Hoàng Sa được 3 tạ. Biển êm.", publishedAt: "2026-10-24T01:00:00Z" }),
  post({ id: "b", kind: "bao", author: null, outlet: "Báo Quảng Ngãi", title: "Ngư dân Lý Sơn trúng đậm mùa mực", body: "", summary: "Tàu cá Lý Sơn...", provinces: ["quang-ngai"], publishedAt: "2026-10-23T08:00:00Z" }),
  post({ id: "c", kind: "bao", author: null, outlet: "VnExpress", title: "Bão số 12 đi vào Biển Đông", body: "", topic: "thoi-su", publishedAt: "2026-10-23T09:00:00Z" }),
  post({ id: "d", body: "Cầu cảng Sa Huỳnh đang sửa.", ports: ["sa-huynh"], publishedAt: "2026-10-22T09:00:00Z" }),
  post({ id: "e", kind: "bao", author: null, title: "Áp thấp nhiệt đới mạnh lên", body: "", topic: "thoi-su", publishedAt: "2026-10-22T10:00:00Z" }),
];

describe("hieuTimTinKairos — nhận ý", () => {
  it("dấu hiệu mạnh: bài / Kairos / đọc báo", () => {
    expect(hieuTimTinKairos("Sen ơi, bài về câu mực")?.cum).toBe("câu mực");
    expect(hieuTimTinKairos("tin Kairos về Lý Sơn")?.cum).toBe("lý sơn");
    expect(hieuTimTinKairos("đọc tin trên kai rốt đi")).not.toBeNull();
    expect(hieuTimTinKairos("đọc báo cho tôi nghe")?.cum).toBe("");
    expect(hieuTimTinKairos("có tin bão gì trên Kairos không")?.bao).toBe(true);
  });
  it("dấu hiệu yếu cần chủ đề/nơi", () => {
    expect(hieuTimTinKairos("có tin về Lý Sơn không")?.cum).toBe("lý sơn");
    expect(hieuTimTinKairos("có tin gì không")).toBeNull();
  });
  it("câu bão chỉ có 'tin' ⇒ KHÔNG nhận (để tin bão chính thức trả lời)", () => {
    expect(hieuTimTinKairos("Sen ơi, có tin bão gì không")).toBeNull();
    expect(hieuTimTinKairos("tin bão mới nhất")).toBeNull();
  });
  it("không cướp ý khác", () => {
    for (const c of ["thời tiết mai thế nào", "giá dầu hôm nay", "có thông tin gì về giấy tờ không", "mở hộp thư", "có tin nhắn mới không", "dẫn đường về Sa Huỳnh", "giá mực hôm nay", "câu mực ở đâu"]) {
      expect(hieuTimTinKairos(c), c).toBeNull();
    }
  });
  it("chủ đề theo tên chip", () => {
    const y = hieuTimTinKairos("bài nghề cá mới nhất");
    expect(y?.chuDe).toBe("nghe-ca");
    expect(y?.cum).toBe("");
  });
  it("tỉnh", () => {
    expect(hieuTimTinKairos("bài về Quảng Ngãi")?.tinh).toBe("quang-ngai");
  });
});

describe("timTinKairos — lọc bản lưu", () => {
  it("cụm có dấu, mới nhất trước", () => {
    expect(timTinKairos(POSTS, hieuTimTinKairos("bài về câu mực")!).map((p) => p.id)).toEqual(["a"]);
  });
  it("có dấu thì 'câu' không trùng 'cầu'", () => {
    expect(timTinKairos(POSTS, hieuTimTinKairos("bài về câu")!).map((p) => p.id)).toEqual(["a"]);
  });
  it("bão: khớp cả áp thấp, KHÔNG khớp 'báo'", () => {
    expect(timTinKairos(POSTS, hieuTimTinKairos("bài về bão")!).map((p) => p.id)).toEqual(["c", "e"]);
  });
  it("tỉnh theo mã + theo chữ", () => {
    expect(timTinKairos(POSTS, hieuTimTinKairos("bài về Quảng Ngãi")!).map((p) => p.id)).toEqual(["b"]);
    expect(timTinKairos(POSTS, hieuTimTinKairos("tin Kairos về Lý Sơn")!).map((p) => p.id)).toEqual(["b"]);
  });
  it("cảng theo mã", () => {
    expect(timTinKairos(POSTS, hieuTimTinKairos("bài về sa huynh")!).map((p) => p.id)).toEqual(["d"]);
  });
  it("chủ đề", () => {
    expect(timTinKairos(POSTS, hieuTimTinKairos("bài thời sự")!).map((p) => p.id)).toEqual(["c", "e"]);
  });
  it("câu gõ không dấu so bỏ dấu", () => {
    expect(timTinKairos(POSTS, hieuTimTinKairos("bai ve cau muc")!).map((p) => p.id)).toEqual(["a"]);
  });
});

describe("traLoiTinKairos — câu đọc", () => {
  const cache = { savedAt: NOW - 60_000, posts: POSTS };
  it("có bài ⇒ đếm + đọc tối đa 3 + mở bài đầu", () => {
    const r = traLoiTinKairos(hieuTimTinKairos("bài về bão")!, cache, NOW);
    expect(r.den).toBe("/kairos/p/c");
    expect(r.noi).toMatch(/^Có 2 bài về bão\. Bài 1: Bão số 12 đi vào Biển Đông\. Bài 2: Áp thấp/);
    expect(r.noi).toMatch(/đài duyên hải/);
  });
  it("không câu hỏi cụ thể ⇒ 3 bài mới nhất", () => {
    const r = traLoiTinKairos(hieuTimTinKairos("đọc báo")!, cache, NOW);
    expect(r.noi.match(/Bài \d:/g)).toHaveLength(3);
    expect(r.den).toBe("/kairos/p/a");
  });
  it("không có bài khớp / chưa có bản lưu ⇒ nói rõ, mở /kairos", () => {
    expect(traLoiTinKairos(hieuTimTinKairos("bài về tôm hùm")!, cache, NOW)).toEqual({
      noi: "Bản lưu Kairos chưa có bài về tôm hùm. Có sóng thì mở Kairos xem thêm.",
      den: "/kairos",
    });
    expect(traLoiTinKairos(hieuTimTinKairos("bài về mực")!, null, NOW).noi).toMatch(/chưa lưu tin Kairos/);
  });
  it("bản lưu cũ > 6 giờ ⇒ khai giờ lưu", () => {
    const r = traLoiTinKairos(hieuTimTinKairos("bài về câu mực")!, { savedAt: NOW - 7 * 3600_000, posts: POSTS }, NOW);
    expect(r.noi).toMatch(/Bản lưu lúc \d\d:\d\d ngày \d\d\/\d\d\./);
  });
  it("dongDoc: bài bà con = tên + câu đầu, cắt ≤90", () => {
    expect(dongDoc(POSTS[0])).toBe("Tư Sa Huỳnh: Đêm qua câu mực ở Hoàng Sa được 3 tạ");
    expect(dongDoc(post({ title: "x ".repeat(80) })).length).toBeLessThanOrEqual(91);
  });
});

describe("chuông Kairos", () => {
  const m = (id: string, over: Partial<InboxMessage> = {}): InboxMessage => ({
    id,
    title: "Bài của bạn có bình luận mới",
    body: "Tư vừa bình luận bài của bạn trên Kairos.",
    url: `/kairos/p/bai-${id}`,
    sentAt: `2026-10-2${id}T00:00:00Z`,
    mine: true,
    ...over,
  });
  it("chỉ tin riêng có đường /kairos/p/<id>", () => {
    expect(baiCuaTin(m("1"))).toBe("bai-1");
    expect(baiCuaTin(m("1", { mine: false }))).toBeNull();
    expect(baiCuaTin(m("1", { url: "/ngu-truong" }))).toBeNull();
    expect(baiCuaTin(m("1", { url: null }))).toBeNull();
    expect(baiCuaTin(m("1", { url: "/kairos/u/toi" }))).toBeNull();
  });
  it("lọc + xếp mới nhất + cờ chưa đọc", () => {
    const list = [m("1"), m("3"), m("2", { mine: false }), m("4", { url: "/tau" })];
    const r = tinChuongKairos(list, new Set(["3"]));
    expect(r.map((t) => [t.id, t.chuaDoc])).toEqual([
      ["3", true],
      ["1", false],
    ]);
  });
  it("nhãn chấm đếm", () => {
    expect(nhanDem(0)).toBe("");
    expect(nhanDem(4)).toBe("4");
    expect(nhanDem(12)).toBe("9+");
  });
});
