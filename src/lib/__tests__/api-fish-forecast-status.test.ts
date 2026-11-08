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

const saved = vi.hoisted(() => ({ calls: 0, throws: false }));
vi.mock("@/lib/fish-snapshot", () => ({
  loadFishSnapshot: async () => snapshot.value,
  saveFishSnapshot: async () => {
    saved.calls += 1;
    if (saved.throws) throw new Error("db down");
    return { saved: true, reason: "ok" };
  },
}));
vi.mock("@/lib/fish-forecast-run", () => ({
  computeFishForecast: async () => live.value,
}));
/*  ⚠️ MOCK PHẢI KHAI ĐỦ MỌI THỨ ROUTE DÙNG. Thiếu `isBuildPhase` là route gọi
    `undefined()` ⇒ ném ⇒ ba ca dưới đỏ mà thông báo chẳng liên quan gì tới điều
    đang test. Mặc định `false` = ĐANG CHẠY THẬT (không phải lúc build). */
const buildPhase = vi.hoisted(() => ({ value: false }));
vi.mock("@/lib/fish-snapshot-policy", () => ({
  isSnapshotFresh: (generatedAt: string | null) => generatedAt === "tuoi",
  isBuildPhase: () => buildPhase.value,
}));

import { GET } from "@/app/api/fish-forecast/route";

beforeEach(() => {
  snapshot.value = null;
  live.value = { ok: false };
  buildPhase.value = false;
  saved.calls = 0;
  saved.throws = false;
});

/*  HÀNG SNAPSHOT THEO MÔ HÌNH (2026-10-05): hàng của mô hình đang chạy có thể
    chưa ai ghi (cron rơi về bản Vercel cũ) ⇒ route tính live thì phải LƯU lại,
    nếu không mỗi nhịp ISR lại kéo bảy nguồn ngoài. Lưu hỏng KHÔNG được làm hỏng
    phản hồi. */
describe("/api/fish-forecast — tính live xong thì lưu snapshot", () => {
  it("chưa có hàng của mô hình này, live OK ⇒ 200 VÀ đã lưu", async () => {
    live.value = { ok: true };
    const res = await GET();
    expect(res.status).toBe(200);
    expect(saved.calls).toBe(1);
  });

  it("snapshot còn tươi ⇒ KHÔNG tính, KHÔNG ghi lại", async () => {
    snapshot.value = { ok: true, generatedAt: "tuoi" };
    await GET();
    expect(saved.calls).toBe(0);
  });

  it("lưu hỏng (DB sập) ⇒ vẫn 200 với bản vừa tính", async () => {
    live.value = { ok: true };
    saved.throws = true;
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("live hỏng ⇒ KHÔNG ghi gì (đừng đè bản tốt bằng số hỏng)", async () => {
    snapshot.value = { ok: true, generatedAt: "cu" };
    await GET();
    expect(saved.calls).toBe(0);
  });
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

/*  ĐANG BUILD → KHÔNG KÉO BẢY NGUỒN (2026-08-03). Next dựng sẵn route này lúc
    `next build`; đọc snapshot hỏng ở đó là rơi vào `computeFishForecast()` —
    bảy nguồn ngoài, 14–30 giây/lượt, trong ngân sách 60 giây ⇒ BẢN BUILD ĐỎ
    ("/api/fish-forecast took more than 60 seconds"). Một nguồn thời tiết chậm
    KHÔNG được phép chặn việc ship bản vá. */
describe("/api/fish-forecast — lúc BUILD", () => {
  it("có snapshot (dù CŨ) → gieo kho bằng snapshot, KHÔNG tính live", async () => {
    buildPhase.value = true;
    snapshot.value = { ok: true, generatedAt: "cu" };
    live.value = { ok: true, generatedAt: "live-khong-duoc-goi" };
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).generatedAt).toBe("cu");
  });

  it("KHÔNG có snapshot → 503 NGAY, không đụng nguồn ngoài", async () => {
    buildPhase.value = true;
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, reason: "build-phase" });
  });

  it("lúc CHẠY THẬT vẫn tính live như cũ — cổng build không được khoá nhầm", async () => {
    snapshot.value = { ok: true, generatedAt: "cu" };
    live.value = { ok: true, generatedAt: "tuoi", cells: [] };
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ generatedAt: "tuoi" });
  });
});

/*  CHỈ TRƯỜNG CHO PHÉP đi xuống máy (2026-11-08, docs/app-map/ops/khong-lo-nguon.md nợ #2). */
describe("/api/fish-forecast — không lộ nguồn / chẩn đoán", () => {
  it("bỏ sources, dataQuality, chain, dateSkewDays, hint.why; baseMode thành cờ", async () => {
    snapshot.value = {
      ok: true,
      generatedAt: "tuoi",
      date: "2026-11-07",
      species: ["ngừ vằn"],
      baseMode: "catch-fleet-static",
      sources: { sst: { id: "noaa-x", date: "d", stale: true } },
      dataQuality: 0.8,
      dateSkewDays: 1,
      chain: { moon: 1 },
      cells: [{ lat: 10, lon: 110, s: 70, top: ["ngừ vằn"], sp: { "ngừ vằn": 70 }, t: 29, c: 0.2, hint: { sat: 40, why: ["ranh nóng lạnh"] } }],
    };
    const res = await GET();
    const j = await res.json();
    expect(JSON.stringify(j)).not.toMatch(/sources|dataQuality|chain|dateSkewDays|why|noaa|catch-fleet/);
    expect(j.baseMode).toBe(true);
    expect(j.anhCu).toBe(true);
    expect(j.cells[0]).toEqual({ lat: 10, lon: 110, s: 70, top: ["ngừ vằn"], sp: { "ngừ vằn": 70 }, t: 29, c: 0.2, hint: { sat: 40 } });
  });
  it("hết đường → 503 mã chung, không chuyển tiếp lý do bên trong", async () => {
    live.value = { ok: false, loi: "nguon chet" };
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, code: "unavailable" });
  });
});
