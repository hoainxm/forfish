// Cảm xúc kiểu Facebook (anh Long 2026-10-24): luật thuần + hợp đồng kho file (giống DB 0069: một người một cảm xúc,
// đổi loại không đổi tổng) + agent bấm cảm xúc như người thật.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CAM_XUC, chonCamXuc, chotCamXuc, laCamXuc, xepDem, type CamXucState } from "@/lib/kairos/cam-xuc";
import { camXucAgent } from "@/lib/kairos/agent-dieu-phoi.mjs";
import { createKairosFileStore } from "@/lib/kairos/file-store";
import type { KairosStore } from "@/lib/kairos/store";

describe("bộ cảm xúc", () => {
  it("6 loại như FB (bỏ 'Thương thương'), nhãn ≤2 chữ, id hợp lệ", () => {
    expect(CAM_XUC.map((c) => c.id)).toEqual(["hay", "thuong", "haha", "wow", "buon", "gian"]);
    for (const c of CAM_XUC) expect(c.nhan.split(" ").length).toBeLessThanOrEqual(2);
    expect(laCamXuc("haha")).toBe(true);
    expect(laCamXuc("like")).toBe(false);
    expect(laCamXuc(null)).toBe(false);
  });
  it("xepDem: nhiều nhất trước, hoà theo thứ tự bộ, bỏ số 0/âm/lạ", () => {
    expect(xepDem({ haha: 2, hay: 5, thuong: 2, buon: 0, wow: -1, la: 9 } as Record<string, number>)).toEqual([
      { kind: "hay", n: 5 },
      { kind: "thuong", n: 2 },
      { kind: "haha", n: 2 },
    ]);
    expect(xepDem(undefined)).toEqual([]);
  });
});

describe("chọn cảm xúc (lạc quan)", () => {
  const s0: CamXucState = { myCamXuc: null, hayCount: 3, camXuc: [{ kind: "hay", n: 3 }] };
  it("chưa bấm ⇒ chọn: tổng +1, đếm đúng loại", () => {
    const s = chonCamXuc(s0, "thuong");
    expect(s).toEqual({ myCamXuc: "thuong", hayCount: 4, camXuc: [{ kind: "hay", n: 3 }, { kind: "thuong", n: 1 }] });
  });
  it("đang có ⇒ đổi loại: tổng giữ nguyên", () => {
    const s = chonCamXuc(chonCamXuc(s0, "hay"), "haha");
    expect(s.hayCount).toBe(4);
    expect(s.myCamXuc).toBe("haha");
    expect(s.camXuc).toEqual([{ kind: "hay", n: 3 }, { kind: "haha", n: 1 }]);
  });
  it("chạm lại đúng loại ⇒ gỡ; không xuống dưới 0", () => {
    const co = chonCamXuc(s0, "hay");
    expect(chonCamXuc(co, "hay")).toEqual(s0);
    expect(chonCamXuc({ myCamXuc: "hay", hayCount: 0, camXuc: [] }, null).hayCount).toBe(0);
  });
  it("chốt: máy chủ hỏng ⇒ hoàn tác về trước khi bấm; ok ⇒ lấy số máy chủ", () => {
    expect(chotCamXuc(s0, { ok: false })).toEqual(s0);
    expect(chotCamXuc(s0, { ok: true, data: { kind: "wow", hayCount: 7, camXuc: { hay: 6, wow: 1 } } })).toEqual({
      myCamXuc: "wow",
      hayCount: 7,
      camXuc: [{ kind: "hay", n: 6 }, { kind: "wow", n: 1 }],
    });
    expect(chotCamXuc(s0, { ok: true, data: { kind: null, hayCount: 2 } }).myCamXuc).toBeNull();
  });
});

describe("agent bấm cảm xúc như người thật", () => {
  it("phần lớn 👍, có ❤️ 😆, không bao giờ 😡", () => {
    const dem: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const k = camXucAgent(() => i / 1000);
      dem[k] = (dem[k] ?? 0) + 1;
    }
    expect(dem.hay).toBeGreaterThan(500);
    expect(dem.thuong).toBeGreaterThan(100);
    expect(dem.gian ?? 0).toBe(0);
  });
});

describe("kho file — giống DB 0069", () => {
  vi.stubEnv("MARKET_STORE", "file");
  let dir: string;
  let store: KairosStore;
  beforeAll(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "kairos-cx-"));
    store = createKairosFileStore({ dir });
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  it("một người một cảm xúc; đổi loại không đổi tổng; đếm theo loại; gỡ thì trừ", async () => {
    await store.createProfile({ phone: "0901000011", handle: "Cx A", handle_norm: "cx a" });
    const p = await store.insertPost({ kind: "ba-con", author_phone: "0901000011", body: "Mẻ cá hôm nay", images: [], topic: "nghe-ca", regions: [], provinces: [], ports: [], reshare_of: null });
    await store.setHay("post", p.id, "0901000012", true, "thuong");
    await store.setHay("post", p.id, "0901000013", true);
    await store.setHay("post", p.id, "0901000012", true, "haha"); // đổi loại
    expect((await store.getPost(p.id))?.hay_count).toBe(2);
    expect((await store.demCamXuc("post", [p.id])).get(p.id)).toEqual({ haha: 1, hay: 1 });
    expect((await store.camXucOf("post", "0901000012", [p.id])).get(p.id)).toBe("haha");
    await store.setHay("post", p.id, "0901000012", false);
    expect((await store.getPost(p.id))?.hay_count).toBe(1);
    expect((await store.demCamXuc("post", [p.id])).get(p.id)).toEqual({ hay: 1 });
  });
});
