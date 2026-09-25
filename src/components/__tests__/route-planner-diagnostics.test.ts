// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeatherField } from "@/lib/route-plan";
import { fmtCoordPair } from "@/lib/map-prefs";

const mocks = vi.hoisted(() => ({ weather: vi.fn(), depth: vi.fn(), xacTau: vi.fn(), plan: vi.fn() }));
vi.mock("react-map-gl/maplibre", () => ({ Layer: () => null, Marker: () => null, Source: () => null }));
vi.mock("@/lib/route-weather", async (original) => ({ ...await original<object>(), fetchWeatherField: mocks.weather }));
vi.mock("@/lib/depth-grid", async (original) => ({ ...await original<object>(), fetchDepthGrid: mocks.depth }));
vi.mock("@/lib/xac-tau", async (original) => ({ ...await original<object>(), fetchXacTau: mocks.xacTau }));
vi.mock("@/lib/route-plan-async", () => ({ planRouteWithDiagnosticsAsync: mocks.plan, planRouteAsync: vi.fn() }));
vi.mock("@/lib/seamarks", async (original) => ({ ...await original<object>(), fetchSeamarks: () => Promise.resolve(null) }));
vi.mock("@/lib/vn-aids", async (original) => ({ ...await original<object>(), fetchVnAids: () => Promise.resolve(null) }));
vi.mock("@/lib/soundings", async (original) => ({ ...await original<object>(), fetchSoundings: () => Promise.resolve(null) }));
vi.mock("@/lib/soundings-verified", async (original) => ({ ...await original<object>(), fetchSoundingVerdicts: () => Promise.resolve(null) }));
vi.mock("@/lib/fairway-depth", async (original) => ({ ...await original<object>(), fetchFairwayDepths: () => Promise.resolve(null) }));
vi.mock("@/lib/tides", async (original) => ({ ...await original<object>(), fetchTideStations: () => Promise.resolve(null) }));
vi.mock("@/lib/sea-lanes", async (original) => ({ ...await original<object>(), fetchSeaLanes: () => Promise.resolve(null), fetchCoralReefs: () => Promise.resolve(null) }));

import { RouteMode } from "../route-planner";

const home = { id: "home", kind: "home" as const, name: "Cảng thử", lat: 12, lon: 110 };
const stop = { id: "stop-one", name: "Chỗ chưa đặt tên", lat: 12, lon: 112 };
const cursor = { lat: 13, lon: 114 };
const field: WeatherField = {
  lat0: 10, lon0: 108, dLat: 1, dLon: 1, nLat: 1, nLon: 1, cells: [],
};

function mount() {
  return render(React.createElement(RouteMode, {
    dest: cursor, destDepth: 0, places: [home], stops: [stop],
    stormInfo: { kind: "khong-co", checkedAt: Date.now() }, onRoute: vi.fn(), onClose: vi.fn(),
  }));
}
function clickCompute() {
  fireEvent.click(screen.getByRole("button", { name: "Tính lộ trình" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("React", React);
  localStorage.clear();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  mocks.weather.mockResolvedValue(field);
  mocks.depth.mockResolvedValue(null);
  mocks.xacTau.mockResolvedValue(null);
  mocks.plan.mockResolvedValue({ plan: null, failure: "no-route" });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Tính đường — chờ dữ liệu và giải thích đúng điểm đang dùng", () => {
  it("tải dự báo ngay khi kho hải đồ còn chờ", async () => {
    let release!: (value: null) => void;
    mocks.xacTau.mockReturnValue(new Promise<null>((resolve) => { release = resolve; }));
    mount();
    clickCompute();
    await waitFor(() => expect(mocks.weather).toHaveBeenCalledOnce());
    expect(mocks.plan).not.toHaveBeenCalled();
    await act(async () => { release(null); });
    await waitFor(() => expect(mocks.plan).toHaveBeenCalled());
  });

  it("dự báo lỗi sớm trong lúc chờ kho: bắt lỗi và cho tính lại", async () => {
    let release!: (value: null) => void;
    mocks.xacTau.mockReturnValue(new Promise<null>((resolve) => { release = resolve; }));
    mocks.weather.mockRejectedValue(new Error("offline"));
    mount();
    clickCompute();
    await waitFor(() => expect(mocks.weather).toHaveBeenCalledOnce());
    // Cho một lượt event loop đi qua khi kho chưa xong: rejection không được bỏ mặc.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    await act(async () => { release(null); });
    await screen.findByText(/Tuyến này chưa có dự báo/);
    expect((screen.getByRole("button", { name: "Tính lộ trình" }) as HTMLButtonElement).disabled).toBe(false);
    expect(mocks.plan).not.toHaveBeenCalled();
  });

  it("tính theo stop đã thêm, hiển thị tọa độ dù có tên; không lấy con trỏ làm đích", async () => {
    mount();
    expect(screen.getAllByText(fmtCoordPair(stop.lat, stop.lon, "dms")).length).toBeGreaterThan(0);
    clickCompute();
    await waitFor(() => expect(mocks.plan).toHaveBeenCalledWith(expect.objectContaining({
      start: { lat: home.lat, lon: home.lon }, dest: { lat: stop.lat, lon: stop.lon },
    })));
    await waitFor(() => expect(screen.getByText(/kiểm tra lại/)).toBeDefined());
    expect(document.body.textContent).not.toContain("không có đường vòng nào qua được");
    expect(document.body.textContent).toMatch(/nơi đi|nơi xuất phát/);
  });

  it("thiếu phủ dự báo có thông báo riêng thay cho khẳng định đất chặn", async () => {
    mocks.plan.mockResolvedValue({ plan: null, failure: "weather-coverage" });
    mount();
    clickCompute();
    await screen.findByText(/thiếu dữ liệu dự báo/);
    expect(document.body.textContent).not.toContain("không có đường vòng nào qua được");
  });
});
