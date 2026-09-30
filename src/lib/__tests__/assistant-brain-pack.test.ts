import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

/*  GÓI NÃO TRONG MÁY (brain-pack.ts): đổi NGUYÊN KHỐI — tải đủ + sha256 khớp hết
    mới chuyển con trỏ; hỏng giữa chừng giữ gói cũ; cùng bản thì không tải lại;
    app cũ hơn minAppVersion thì không đổi; nạp gói không cần mạng.
    Chạy môi trường Node (WebCrypto thật), dựng Cache API giả tối thiểu.  */

class FakeCache {
  store = new Map<string, Response>();
  private k(r: RequestInfo | URL) {
    return new URL(typeof r === "string" ? r : r instanceof URL ? r.href : r.url, "http://app.test").href;
  }
  async match(r: RequestInfo | URL) {
    const hit = this.store.get(this.k(r));
    return hit ? hit.clone() : undefined;
  }
  async put(r: RequestInfo | URL, res: Response) {
    this.store.set(this.k(r), res.clone());
  }
  async delete(r: RequestInfo | URL) {
    return this.store.delete(this.k(r));
  }
  async keys() {
    return [...this.store.keys()].map((url) => ({ url }) as Request);
  }
}

const cache = new FakeCache();
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const KNOW = JSON.stringify({
  version: "1",
  muc: [{ id: "uop-ca", cauHoiMau: ["ướp cá ngừ sao cho tươi"], tuKhoa: ["cá ngừ", "ướp"], traLoi: "Ướp đá ngay.", nguon: "N", ngaySoat: "2026-09-30" }],
});
const ANS = JSON.stringify({ version: "1", answers: [{ id: "da", intentId: "chao_hoi", text: "Dạ.", mp3: { bac: "audio/bac/da.mp3" } }] });
const MP3 = "ID3-fake-mp3";

function manifest(version: string, files: Record<string, string>, minAppVersion = "1.0.0") {
  return {
    version, createdAt: "2026-09-30T00:00:00Z", minAppVersion,
    files: Object.entries(files).map(([path, body]) => ({ path, sha256: sha(body), bytes: body.length })),
  };
}

let served: { manifest: unknown; files: Record<string, string> };
let fetched: string[];

beforeEach(async () => {
  cache.store.clear();
  fetched = [];
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = globalThis;
  g.location = new URL("http://app.test/");
  g.caches = { open: async () => cache };
  URL.createObjectURL = () => "blob:fake";
  vi.stubGlobal("fetch", async (input: string) => {
    fetched.push(input);
    const path = new URL(input, "http://app.test").pathname.replace(/^\/tro-ly\//, "");
    if (path === "manifest.json") return new Response(JSON.stringify(served.manifest), { status: 200 });
    const body = served.files[path];
    return body == null ? new Response("", { status: 404 }) : new Response(body, { status: 200 });
  });
  served = { files: { "brain/knowledge.v1.json": KNOW, "brain/answers.v1.json": ANS, "audio/bac/da.mp3": MP3 }, manifest: null };
  served.manifest = manifest("1", served.files);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const mod = () => import("@/lib/assistant/brain-pack");

describe("parseManifest / semverAtLeast", () => {
  it("manifest sai khuôn → null (đường có .., sha sai dạng, thiếu version)", async () => {
    const { parseManifest } = await mod();
    expect(parseManifest(manifest("1", { "brain/a.json": "x" }))).not.toBeNull();
    expect(parseManifest({ ...manifest("1", {}), version: "" })).toBeNull();
    expect(parseManifest({ ...manifest("1", {}), files: [{ path: "../x", sha256: sha("x"), bytes: 1 }] })).toBeNull();
    expect(parseManifest({ ...manifest("1", {}), files: [{ path: "a", sha256: "abc", bytes: 1 }] })).toBeNull();
    expect(parseManifest(null)).toBeNull();
  });

  it("so phiên bản theo số, không theo chữ", async () => {
    const { semverAtLeast } = await mod();
    expect(semverAtLeast("1.10.0", "1.9.3")).toBe(true);
    expect(semverAtLeast("1.0.0", "1.0.0")).toBe(true);
    expect(semverAtLeast("1.0.0", "1.0.1")).toBe(false);
  });
});

describe("refreshBrainPack — đổi nguyên khối", () => {
  it("lần đầu: tải đủ, kiểm sha, nạp được kho + mp3 (không cần mạng khi nạp)", async () => {
    const m = await mod();
    expect(await m.refreshBrainPack({ now: 1 })).toBe("moi");
    vi.stubGlobal("fetch", async () => {
      throw new Error("mất sóng");
    });
    const b = await m.loadBrain();
    expect(b?.version).toBe("1");
    expect(b?.knowledgeCount).toBe(1);
    expect(m.audioUrlFor(b, "Dạ.", "nam")).toBe("blob:fake"); // thiếu giọng nam → lấy giọng bắc
    expect(m.audioUrlFor(b, "Câu khác.", "bac")).toBeNull();
  });

  it("sha256 lệch một file → 'loi', KHÔNG đổi con trỏ, gói cũ vẫn dùng", async () => {
    const m = await mod();
    await m.refreshBrainPack({ now: 1 });
    served.files = { ...served.files, "brain/knowledge.v1.json": KNOW.replace("Ướp đá ngay.", "Ướp đá liền.") };
    served.manifest = { ...manifest("2", served.files) };
    // phá: phục vụ file khác băm đã ghi
    served.files["brain/knowledge.v1.json"] = "hỏng";
    expect(await m.refreshBrainPack({ now: 2, force: true })).toBe("loi");
    const b = await m.loadBrain();
    expect(b?.version).toBe("1");
  });

  it("cùng phiên bản → 'giu', không tải lại file; chưa tới 6 giờ → không hỏi mạng", async () => {
    const m = await mod();
    await m.refreshBrainPack({ now: 1 });
    fetched = [];
    expect(await m.refreshBrainPack({ now: 2 })).toBe("chua-toi-gio");
    expect(fetched).toEqual([]);
    expect(await m.refreshBrainPack({ now: 2, force: true })).toBe("giu");
    expect(fetched).toEqual(["/tro-ly/manifest.json"]);
  });

  it("gói mới: file KHÔNG đổi (cùng sha) không tải lại; file cũ thôi dùng bị dọn", async () => {
    const m = await mod();
    await m.refreshBrainPack({ now: 1 });
    const { "audio/bac/da.mp3": _drop, ...rest } = served.files;
    void _drop;
    served.files = { ...rest, "brain/knowledge.v1.json": KNOW.replace("Ướp đá ngay.", "Ướp đá liền.") };
    served.manifest = manifest("2", served.files);
    fetched = [];
    expect(await m.refreshBrainPack({ now: 2, force: true })).toBe("moi");
    expect(fetched.some((u) => u.includes("answers"))).toBe(false);
    expect([...cache.store.keys()].some((k) => k.includes("da.mp3"))).toBe(false);
  });

  it("app cũ hơn minAppVersion → 'app-cu', không tải", async () => {
    served.manifest = manifest("9", served.files, "9.0.0");
    const m = await mod();
    expect(await m.refreshBrainPack({ now: 1 })).toBe("app-cu");
    expect(await m.loadBrain()).toBeNull();
  });

  it("mất sóng lúc kiểm → 'loi', không ném", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    const m = await mod();
    expect(await m.refreshBrainPack({ now: 1 })).toBe("loi");
    expect(await m.loadBrain()).toBeNull();
  });
});
