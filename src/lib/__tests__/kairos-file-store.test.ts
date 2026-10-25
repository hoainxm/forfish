import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { postDto } from "@/lib/kairos/dto";
import { BAO_FEED_MS } from "@/lib/kairos/feed-query";
import { createKairosFileStore, devMediaName, KAIROS_DEV_UPLOADS } from "@/lib/kairos/file-store";
import { SDVICO_PHONE } from "@/lib/kairos/types";
import { isKairosError } from "@/lib/kairos/errors";
import type { KairosStore } from "@/lib/kairos/store";

/*  HỢP ĐỒNG KHO trên kho file dev (khuôn market-store-contract): những ràng buộc 0065 làm ở
    DB (PK Hay, unique báo xấu/tên, cascade, trả lời 1 cấp, đếm trigger) phải đúng ở đây để
    chạy local giống prod. supabase-store không chạy được ở máy này (không có DB). */

vi.stubEnv("MARKET_STORE", "file");
vi.stubEnv("VERCEL", "");

const A = "0901000001";
const B = "0901000002";
let dir: string;
let store: KairosStore;
let t = Date.parse("2026-10-23T08:00:00.000Z");
const now = () => new Date(t);
const feed = { baoSince: new Date(Date.parse("2026-10-23T08:00:00.000Z") - BAO_FEED_MS).toISOString() };

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "không ném";
  } catch (e) {
    return isKairosError(e) ? e.code : String(e);
  }
};

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "kairos-store-"));
  store = createKairosFileStore({ dir, now });
});
afterAll(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

describe("kho file Kairos", () => {
  it("seed: hồ sơ SDVICO Chính thức + bài ghim + một bài báo đã đạt", async () => {
    const sd = await store.profileByPhone(SDVICO_PHONE);
    expect(sd?.official).toBe(true);
    expect((await store.pinnedPosts(now().toISOString())).length).toBe(1);
    expect((await store.listPosts(feed, 20)).some((p) => p.kind === "bao")).toBe(true);
  });

  it("hồ sơ: trùng tên chuẩn hoá ⇒ handle_taken; hai lượt cùng SĐT ⇒ một hồ sơ", async () => {
    const a = await store.createProfile({ phone: A, handle: "Ba Sa Huỳnh", handle_norm: "ba sa huynh" });
    expect(await code(store.createProfile({ phone: B, handle: "ba sa HUYNH", handle_norm: "ba sa huynh" }))).toBe("handle_taken");
    expect((await store.createProfile({ phone: A, handle: "Khác", handle_norm: "khac" })).id).toBe(a.id);
    await store.createProfile({ phone: B, handle: "Tư Tam Quan", handle_norm: "tu tam quan" });
    expect(await store.takenNorms(["ba sa huynh", "chua ai"])).toEqual(new Set(["ba sa huynh"]));
  });

  it("bài + Hay idempotent (bấm 2 lần đếm 1) + bỏ Hay", async () => {
    t += 60_000;
    const p = await store.insertPost({ kind: "ba-con", author_phone: A, body: "Cá về nhiều", images: [], topic: "nghe-ca", regions: ["mien-trung"], provinces: [], ports: ["sa-huynh"], reshare_of: null });
    await store.setHay("post", p.id, B, true);
    await store.setHay("post", p.id, B, true);
    expect((await store.getPost(p.id))?.hay_count).toBe(1);
    expect(await store.hayOf("post", B, [p.id])).toEqual(new Set([p.id]));
    await store.setHay("post", p.id, B, false);
    expect((await store.getPost(p.id))?.hay_count).toBe(0);
    expect(await code(store.setHay("post", "00000000-0000-4000-8000-000000000000", B, true))).toBe("not_found");
  });

  it("bình luận: trả lời đúng 1 cấp, đếm, top theo Hay, xoá gốc xoá cả trả lời", async () => {
    t += 60_000;
    const p = await store.insertPost({ kind: "ba-con", author_phone: A, body: "Hỏi giá", images: [], topic: "kinh-te", regions: [], provinces: [], ports: [], reshare_of: null });
    const c1 = await store.insertComment({ post_id: p.id, parent_id: null, author_phone: B, body: "Giá tốt" });
    t += 1000;
    const c2 = await store.insertComment({ post_id: p.id, parent_id: null, author_phone: A, body: "Cảm ơn" });
    const r1 = await store.insertComment({ post_id: p.id, parent_id: c1.id, author_phone: A, body: "Đúng" });
    expect(await code(store.insertComment({ post_id: p.id, parent_id: r1.id, author_phone: B, body: "cấp 2" }))).toBe("not_found");
    await store.setHay("comment", c2.id, B, true);
    expect((await store.topComments(p.id, 2, [])).map((c) => c.id)).toEqual([c2.id, c1.id]);
    expect((await store.topComments(p.id, 2, [A])).map((c) => c.id)).toEqual([c1.id]); // bỏ người bị chặn
    expect((await store.getPost(p.id))?.comment_count).toBe(3);
    await store.deleteComment(c1.id);
    expect(await store.getComment(r1.id)).toBeNull();
    expect((await store.getPost(p.id))?.comment_count).toBe(1);
  });

  it("chặn: bài người bị chặn rời dòng tin; theo dõi lọc đúng người", async () => {
    await store.setEdge("block", B, A, true);
    const blocked = await store.edgesFrom("block", B);
    const rows = await store.listPosts({ ...feed, excludeAuthors: blocked }, 50);
    expect(rows.some((r) => r.author_phone === A)).toBe(false);
    await store.setEdge("block", B, A, false);
    await store.setEdge("follow", B, A, true);
    const mine = await store.listPosts({ ...feed, authors: await store.edgesFrom("follow", B) }, 50);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((r) => r.author_phone === A)).toBe(true);
  });

  it("báo xấu: một người một đích một lần; đếm người báo", async () => {
    const [p] = await store.listPosts({ ...feed, authors: [A] }, 1);
    expect(await store.insertReport({ target_type: "post", target_id: p.id, reporter_phone: B, reason: "lua-dao", note: null })).toBe("new");
    expect(await store.insertReport({ target_type: "post", target_id: p.id, reporter_phone: B, reason: "khac", note: "x" })).toBe("dup");
    expect(await store.distinctReporters("post", p.id)).toBe(1);
    expect((await store.modQueue(10)).posts.some((x) => x.id === p.id)).toBe(true);
    await store.resolveReports("post", p.id, "bo-qua", "staff:x", now().toISOString());
    expect((await store.listReports("moi", 10)).length).toBe(0);
  });

  it("hàng chờ agent: đích bị báo đã chấm thì thôi, có báo MỚI hơn lần chấm thì chấm lại", async () => {
    const p = await store.insertPost({ kind: "ba-con", author_phone: A, body: "Bán lưới", images: [], topic: "nghe-ca", regions: ["ca-nuoc"], provinces: [], ports: [], reshare_of: null });
    await store.updatePost(p.id, { mod_state: "dat" });
    t += 1000;
    await store.insertReport({ target_type: "post", target_id: p.id, reporter_phone: B, reason: "quang-cao", note: null });
    expect((await store.modQueue(10)).reportedPosts.some((x) => x.id === p.id)).toBe(true);
    t += 1000;
    // agent cho 'nghi': báo vẫn 'moi' chờ người trực, nhưng KHÔNG gửi lại agent lượt sau
    await store.updatePost(p.id, { mod_state: "nghi", mod_checked_at: now().toISOString() });
    expect((await store.modQueue(10)).reportedPosts.some((x) => x.id === p.id)).toBe(false);
    t += 1000;
    await store.insertReport({ target_type: "post", target_id: p.id, reporter_phone: A, reason: "lua-dao", note: null });
    expect((await store.modQueue(10)).reportedPosts.some((x) => x.id === p.id)).toBe(true);
  });

  it("dấu thông báo: 1 tin/bài/người/giờ", async () => {
    const [p] = await store.listPosts({ ...feed, authors: [A] }, 1);
    expect(await store.takeNotifyMark(p.id, A, now().toISOString(), 3600_000)).toBe(true);
    expect(await store.takeNotifyMark(p.id, A, new Date(t + 30 * 60_000).toISOString(), 3600_000)).toBe(false);
    expect(await store.takeNotifyMark(p.id, A, new Date(t + 61 * 60_000).toISOString(), 3600_000)).toBe(true);
  });

  it("nhập bài báo: trùng url_hash không thêm lần hai; bài cho-kiem chưa lên dòng tin", async () => {
    const row = { kind: "bao" as const, author_phone: null, body: "", images: [], topic: "thoi-su", regions: ["ca-nuoc"], provinces: [], ports: [], reshare_of: null, url: "https://a.vn/x", url_hash: "h-1", title: "Tin" };
    expect(await store.insertBao([row, row])).toBe(1);
    expect(await store.insertBao([row])).toBe(0);
    const all = await store.listPosts(feed, 100);
    expect(all.some((p) => p.url_hash === "h-1")).toBe(false);
    await store.insertSeen([{ url_hash: "h-1", title_norm: "tin", source_id: "s", outcome: "nhan", flag_term: null }]);
    expect(await store.seenHashes(["h-1", "h-2"])).toEqual(new Set(["h-1"]));
  });

  it("ảnh: tải lên, xoá bài có ảnh ⇒ xoá tệp; đường lạ bị từ chối", async () => {
    const prof = (await store.profileByPhone(A))!;
    const p = `${prof.id}/00000000-0000-4000-8000-0000000000f1.jpg`;
    await store.uploadImage(p, new Uint8Array([0xff, 0xd8, 0xff, 0x00]), "image/jpeg");
    const file = path.join(dir, KAIROS_DEV_UPLOADS, devMediaName(p));
    expect(existsSync(file)).toBe(true);
    expect(store.mediaUrl(p)).toBe(`/api/dev/kairos-media/${devMediaName(p)}`);
    await store.removeImages([p]);
    expect(existsSync(file)).toBe(false);
    await store.removeImages([p]); // đã không còn ⇒ không ném
    expect(await code(store.uploadImage("../../etc/passwd", new Uint8Array([1]), "image/jpeg"))).toBe("storage_failed");
  });

  it("xoá bài: cascade bình luận + Hay; bài đăng lại trỏ về ⇒ 'Bài gốc không còn'", async () => {
    const orig = await store.insertPost({ kind: "ba-con", author_phone: A, body: "Gốc", images: [], topic: "nghe-ca", regions: [], provinces: [], ports: [], reshare_of: null });
    const re = await store.insertPost({ kind: "ba-con", author_phone: B, body: "Đăng lại", images: [], topic: "nghe-ca", regions: [], provinces: [], ports: [], reshare_of: orig.id });
    await store.insertComment({ post_id: orig.id, parent_id: null, author_phone: B, body: "x" });
    await store.setHay("post", orig.id, B, true);
    await store.deletePost(orig.id);
    expect(await store.getPost(orig.id)).toBeNull();
    expect(await store.hayOf("post", B, [orig.id])).toEqual(new Set());
    const after = (await store.getPost(re.id))!;
    expect(after.reshare_of).toBeNull();
  });

  it("DTO từ hàng kho không lộ SĐT (AC21)", async () => {
    const rows = await store.listPosts(feed, 50);
    const profiles = await store.profilesByPhones(rows.map((r) => r.author_phone).filter((x): x is string => !!x));
    const ctx = { viewer: B, profiles: new Map(profiles.map((p) => [p.phone, p])), mediaUrl: (p: string) => store.mediaUrl(p) };
    const json = JSON.stringify(rows.map((r) => postDto(r, ctx)));
    expect(json).not.toContain(A);
    expect(json).not.toContain(B);
    expect(json).not.toContain(SDVICO_PHONE);
  });
});
