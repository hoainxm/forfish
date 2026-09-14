import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BOAT, bboxFor, type PlanArgs } from "../route-plan";
import { DEPTH_GRID_BYTES, decodeDepthGrid } from "../depth-grid";

const start = { lat: 12, lon: 110 }, dest = { lat: 12, lon: 112 };
const bbox = bboxFor(start, dest, 120);
const args: PlanArgs = {
  start, dest, bbox, boat: DEFAULT_BOAT, departHourIdx: 0,
  depth: decodeDepthGrid(new Uint8Array(DEPTH_GRID_BYTES).fill(0x55).buffer),
  field: {
    lat0: bbox.latMin, lon0: bbox.lonMin,
    dLat: (bbox.latMax - bbox.latMin) / 4,
    dLon: (bbox.lonMax - bbox.lonMin) / 4,
    nLat: 5, nLon: 5,
    cells: Array.from({ length: 25 }, () => ({ onSea: false, hours: [] })),
  },
};
const missing = { plan: null, failure: "weather-coverage" };

type Message = { data: unknown };
let instances: FakeWorker[];
let onPost: (request: unknown, worker: FakeWorker) => void;
class FakeWorker {
  onmessage: ((event: Message) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  constructor() { instances.push(this); }
  postMessage(request: unknown) { onPost(structuredClone(request), this); }
}

beforeEach(() => {
  vi.resetModules();
  instances = [];
  onPost = () => {};
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("route diagnostics qua Worker và các cửa fallback", () => {
  it("không có Worker: giữ lý do thiếu phủ và hợp đồng API cũ", async () => {
    vi.stubGlobal("Worker", undefined);
    const api = await import("../route-plan-async");
    expect(await api.planRouteWithDiagnosticsAsync(args)).toEqual(missing);
    expect(await api.planRouteAsync(args)).toBeNull();
  });

  it("request/response thật qua structured clone không đánh mất lý do", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const context: { onmessage: ((event: Message) => void) | null; postMessage: (message: unknown) => void } = {
      onmessage: null,
      postMessage(message) { instances.at(-1)!.onmessage?.({ data: structuredClone(message) }); },
    };
    vi.stubGlobal("self", context);
    await import("../route-plan.worker");
    onPost = (request) => context.onmessage?.({ data: request });
    const api = await import("../route-plan-async");
    expect(await api.planRouteWithDiagnosticsAsync(args)).toEqual(missing);
  });

  it("worker báo lỗi tải: fallback trả cùng chẩn đoán và dọn worker", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const api = await import("../route-plan-async");
    const pending = api.planRouteWithDiagnosticsAsync(args);
    instances[0].onerror?.();
    expect(await pending).toEqual(missing);
    expect(instances[0].terminate).toHaveBeenCalledOnce();
  });

  it("không dựng được Worker: vẫn trả chẩn đoán tại chỗ", async () => {
    vi.stubGlobal("Worker", class { constructor() { throw new Error("worker unavailable"); } });
    const api = await import("../route-plan-async");
    expect(await api.planRouteWithDiagnosticsAsync(args)).toEqual(missing);
  });

  it("worker trả ok:false: tính lại cùng input và giữ lý do", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    onPost = (request, worker) => worker.onmessage?.({
      data: { id: (request as { id: number }).id, ok: false },
    });
    const api = await import("../route-plan-async");
    expect(await api.planRouteWithDiagnosticsAsync(args)).toEqual(missing);
  });

  it("worker im lặng 20 giây: promise vẫn kết thúc với đúng lý do", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    const api = await import("../route-plan-async");
    const pending = api.planRouteWithDiagnosticsAsync(args);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await pending).toEqual(missing);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("postMessage ném lỗi: không để timer treo và vẫn trả chẩn đoán", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    onPost = () => { throw new Error("clone failed"); };
    const api = await import("../route-plan-async");
    expect(await api.planRouteWithDiagnosticsAsync(args)).toEqual(missing);
    expect(vi.getTimerCount()).toBe(0);
  });
});
