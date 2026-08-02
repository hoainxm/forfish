import { describe, it, expect, vi, beforeEach } from "vitest";

/*  BẢN ĐỒ CÁ: KHÔNG CÓ GÌ ĐỂ TRẢ THÌ PHẢI NÓI 503 (2026-08-02, audit C-4).

    Vì sao phải test HÀNH VI chứ không quét chữ: cổng `api-error-status.test.ts`
    chỉ bắt được dạng `Response.json({ ok: false })` viết thẳng. Route này trả
    `Response.json(live)` — một BIẾN — nên quét chữ không thấy, mà hậu quả lại
    nặng nhất trong cả đợt soát: payload bản đồ cá CHỈ tồn tại trong kho service
    worker (fish-predict chỉ lưu DẤU vào localStorage). Một phản hồi 200 kèm
    {ok:false} là service worker cất đè lên bản DUY NHẤT ⇒ ra khơi lớp cá trắng
    vĩnh viễn, trong khi bảng "trong máy có gì" vẫn báo là có.  */

const snapshot = vi.hoisted(() => ({ value: null as unknown }));
const live = vi.hoisted(() => ({ value: { ok: false } as unknown }));

vi.mock("@/lib/fish-snapshot", () => ({
  loadFishSnapshot: async () => snapshot.value,
}));
vi.mock("@/lib/fish-forecast-run", () => ({
  computeFishForecast: async () => live.value,
}));
vi.mock("@/lib/fish-snapshot-policy", () => ({
  isSnapshotFresh: (generatedAt: string | null) => generatedAt === "tuoi",
}));

import { GET } from "@/app/api/fish-forecast/route";

beforeEach(() => {
  snapshot.value = null;
  live.value = { ok: false };
});

describe("/api/fish-forecast — mã trạng thái", () => {
  it("snapshot còn tươi → 200", async () => {
    snapshot.value = { ok: true, generatedAt: "tuoi" };
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("snapshot cũ nhưng tính live được → 200", async () => {
    snapshot.value = { ok: true, generatedAt: "cu" };
    live.value = { ok: true };
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("live hỏng mà còn snapshot cũ → 200 (thà bản cũ còn hơn trắng bản đồ)", async () => {
    snapshot.value = { ok: true, generatedAt: "cu" };
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("KHÔNG CÒN GÌ (snapshot hỏng + live hỏng) → 503, KHÔNG PHẢI 200", async () => {
    const res = await GET();
    expect(res.status).toBe(503);
    // vẫn giữ thân {ok:false} để client hiện "chạm thử lại" như cũ
    expect(await res.json()).toMatchObject({ ok: false });
  });
});
