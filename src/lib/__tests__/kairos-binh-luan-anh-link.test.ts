// Bình luận có ảnh + thẻ xem trước link + thông báo trỏ `#bl-<id>` (14 §3.4b, migration 0070).
import { describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (host: string) =>
    host === "noi-bo.example.com" ? [{ address: "10.0.0.5", family: 4 }] : [{ address: "93.184.216.34", family: 4 }],
  ),
}));

import { toCachedPost } from "@/lib/kairos/cache";
import { notifyMessage } from "@/lib/kairos/notify-gop";
import type { KairosComment, KairosPost } from "@/lib/kairos/types";
import { validateComment } from "@/lib/kairos/validate";
import { docTrang, docXemTruoc, hostDuocDoc, ipCongKhai, layXemTruoc, timLink } from "@/lib/kairos/xem-truoc-link";

const PID = "6f1c2a8e-1111-4222-8333-944455556666";
const OTHER = "7a2d3b9f-2222-4333-8444-a55566667777";
const img = (owner = PID) => `${owner}/00000001-aaaa-4bbb-8ccc-dddddddddddd.jpg`;

describe("validateComment — ảnh kèm", () => {
  it("chỉ ảnh, không chữ ⇒ nhận", () => {
    const r = validateComment({ body: "", image: img() }, PID);
    expect(r.ok && r.value).toEqual({ body: "", parentId: null, image: img() });
  });
  it("ảnh thư mục người khác / không biết người viết ⇒ bad_image", () => {
    expect(validateComment({ body: "hay", image: img(OTHER) }, PID)).toMatchObject({ ok: false, code: "bad_image" });
    expect(validateComment({ body: "hay", image: img() })).toMatchObject({ ok: false, code: "bad_image" });
  });
  it("không chữ không ảnh ⇒ empty; chữ thường vẫn như cũ", () => {
    expect(validateComment({ body: "  " }, PID)).toMatchObject({ ok: false, code: "empty" });
    expect(validateComment({ body: "Cá về nhiều" }, PID)).toMatchObject({ ok: true, value: { image: null } });
  });
});

describe("timLink", () => {
  it("lấy link đầu, bỏ dấu câu dính đuôi", () => {
    expect(timLink("Xem cái này https://vnexpress.net/bai-1.html, hay lắm")).toBe("https://vnexpress.net/bai-1.html");
    expect(timLink("không có link")).toBeNull();
    expect(timLink("ftp://x.com/a")).toBeNull();
  });
});

describe("chống SSRF", () => {
  it("host: chỉ tên miền công khai, cổng mặc định", () => {
    expect(hostDuocDoc(new URL("https://tuoitre.vn/a"))).toBe(true);
    for (const u of ["http://localhost/a", "http://127.0.0.1/", "http://[::1]/", "http://may.local/", "https://a.com:8080/", "http://intranet/", "https://u:p@a.com/"]) {
      expect(hostDuocDoc(new URL(u))).toBe(false);
    }
  });
  it("IP: chặn mạng riêng, loopback, link-local, CGNAT, IPv6 nội bộ", () => {
    for (const ip of ["10.1.2.3", "127.0.0.1", "169.254.169.254", "172.20.0.1", "192.168.1.1", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(ipCongKhai(ip)).toBe(false);
    }
    for (const ip of ["93.184.216.34", "8.8.8.8", "2606:4700::1111"]) expect(ipCongKhai(ip)).toBe(true);
  });
});

describe("docTrang / docXemTruoc", () => {
  const html = `<html><head><title>Dự phòng</title><meta property="og:title" content="Giá cá ngừ tăng &amp; ổn định">
    <meta property="og:site_name" content="VnExpress"><meta property="og:image" content="/anh/bia.jpg"></head></html>`;
  it("og:title + site + ảnh tuyệt đối https", () => {
    expect(docTrang(html, "https://vnexpress.net/bai")).toEqual({
      url: "https://vnexpress.net/bai",
      site: "VnExpress",
      title: "Giá cá ngừ tăng & ổn định",
      image: "https://vnexpress.net/anh/bia.jpg",
    });
  });
  it("không tiêu đề ⇒ null; thiếu site ⇒ tên miền", () => {
    expect(docTrang("<html></html>", "https://a.vn/")).toBeNull();
    expect(docTrang("<title>Trang A</title>", "https://www.a.vn/x")?.site).toBe("a.vn");
  });
  it("bản lưu hỏng ⇒ null; ảnh http bị bỏ", () => {
    expect(docXemTruoc(null)).toBeNull();
    expect(docXemTruoc({ url: "javascript:alert(1)", title: "x" })).toBeNull();
    expect(docXemTruoc({ url: "https://a.vn", title: "A", site: "a.vn", image: "http://a.vn/1.jpg" })?.image).toBeNull();
  });
});

describe("layXemTruoc", () => {
  const trang = (body: string, init: ResponseInit = {}) => new Response(body, { headers: { "content-type": "text/html; charset=utf-8" }, ...init });
  it("đọc được ⇒ thẻ", async () => {
    const f = vi.fn(async () => trang('<meta property="og:title" content="Tin biển">'));
    expect(await layXemTruoc("https://a.vn/x", f as unknown as typeof fetch)).toMatchObject({ title: "Tin biển", site: "a.vn" });
  });
  it("chuyển hướng vào mạng nội bộ ⇒ null, không đọc tiếp", async () => {
    const f = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://noi-bo.example.com/admin" } }));
    expect(await layXemTruoc("https://a.vn/x", f as unknown as typeof fetch)).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("link localhost ⇒ null, không gọi mạng; lỗi mạng ⇒ null", async () => {
    const f = vi.fn(async () => trang("<title>x</title>"));
    expect(await layXemTruoc("http://localhost:3000/", f as unknown as typeof fetch)).toBeNull();
    expect(f).not.toHaveBeenCalled();
    const loi = vi.fn(async () => {
      throw new Error("mất sóng");
    });
    expect(await layXemTruoc("https://a.vn/", loi as unknown as typeof fetch)).toBeNull();
  });
  it("không phải HTML ⇒ null", async () => {
    const f = vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } }));
    expect(await layXemTruoc("https://a.vn/", f as unknown as typeof fetch)).toBeNull();
  });
});

describe("thông báo trỏ tới bình luận", () => {
  it("có id bình luận ⇒ #bl-<id>", () => {
    expect(notifyMessage({ phone: "0900000001", why: "post" }, "Ba", "p1", "c9").url).toBe("/kairos/p/p1#bl-c9");
    expect(notifyMessage({ phone: "0900000001", why: "post" }, "Ba", "p1").url).toBe("/kairos/p/p1");
  });
});

describe("bản lưu offline chỉ chữ", () => {
  it("bỏ ảnh bình luận + ảnh thẻ link, giữ tiêu đề link", () => {
    const c = {
      id: "c1", postId: "p1", parentId: null, body: "", hayCount: 0, hayByMe: false, createdAt: "2026-10-24T00:00:00Z", mine: false,
      author: { profileId: "a", handle: "Ba", avatarUrl: "https://x/a.jpg" },
      image: "https://x/c.jpg",
      link: { url: "https://a.vn", site: "a.vn", title: "A", image: "https://a.vn/i.jpg" },
    } as unknown as KairosComment;
    const p = { images: [], reshareOf: null, author: null, coverUrl: null, topComments: [c] } as unknown as KairosPost;
    const out = toCachedPost(p).topComments[0];
    expect(out.image).toBeNull();
    expect(out.link).toEqual({ url: "https://a.vn", site: "a.vn", title: "A", image: null });
  });
});
