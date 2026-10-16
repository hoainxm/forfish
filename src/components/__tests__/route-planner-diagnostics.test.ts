// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeatherField } from "@/lib/route-plan";
import { fmtCoordPair } from "@/lib/map-prefs";
import { WeatherRateLimitError } from "@/lib/route-weather";

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
  // jsdom không có scrollTo; thẻ cuộn về đầu khi có kết quả (ca tính ra tuyến thật)
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
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

  /*  2026-10-16: dự báo lỗi KHÔNG còn chặn dẫn đường — tính tiếp trên LƯỚI RỖNG
      (source 'none'), bộ tính đường tự chạy lượt theo hải đồ. Trước đây ca này
      dừng ở câu "Tuyến này chưa có dự báo…" và không gọi bộ tính. */
  it("dự báo lỗi sớm trong lúc chờ kho: bắt lỗi, vẫn tính theo hải đồ và cho tính lại", async () => {
    let release!: (value: null) => void;
    mocks.xacTau.mockReturnValue(new Promise<null>((resolve) => { release = resolve; }));
    mocks.weather.mockRejectedValue(new Error("offline"));
    mount();
    clickCompute();
    await waitFor(() => expect(mocks.weather).toHaveBeenCalledOnce());
    // Cho một lượt event loop đi qua khi kho chưa xong: rejection không được bỏ mặc.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    await act(async () => { release(null); });
    await waitFor(() => expect(mocks.plan).toHaveBeenCalledWith(expect.objectContaining({
      field: expect.objectContaining({ source: "none", cells: [] }),
    })));
    expect(document.body.textContent).not.toContain("Tuyến này chưa có dự báo");
    await waitFor(() => expect(
      (screen.getByRole("button", { name: "Tính lộ trình" }) as HTMLButtonElement).disabled,
    ).toBe(false));
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

  it("Open-Meteo từ chối (429) + lưới lưu không đủ: nói máy chủ quá tải, KHÔNG nói vùng thiếu dữ liệu", async () => {
    mocks.weather.mockResolvedValue({ ...field, source: "grid", savedAt: Date.now(), rateLimited: true });
    mocks.plan.mockResolvedValue({ plan: null, failure: "weather-coverage" });
    mount();
    clickCompute();
    await screen.findByText(/Máy chủ dự báo thời tiết đang quá tải/);
    expect(document.body.textContent).toContain("Tính lại");
    expect(document.body.textContent).not.toContain("thiếu dữ liệu dự báo");
    expect(document.body.textContent).not.toContain("kiểm tra lại nơi xuất phát");
  });

  /*  Bộ tính đường THẬT (không mock) để đi trọn đường: lưới rỗng ⇒ lượt theo
      hải đồ ⇒ tuyến có `noWeatherKm` ⇒ thẻ hiện mục đỏ + câu lý do. */
  async function tinhThat() {
    const real = await vi.importActual<typeof import("@/lib/route-plan")>("@/lib/route-plan");
    mocks.plan.mockImplementation(async (a: Parameters<typeof real.planRouteWithDiagnostics>[0]) =>
      real.planRouteWithDiagnostics(a));
  }

  it("Open-Meteo từ chối (429) + máy chưa lưu gì: VẪN ra tuyến theo hải đồ, nói đúng lý do và cảnh báo đỏ", async () => {
    mocks.weather.mockRejectedValue(new WeatherRateLimitError());
    await tinhThat();
    mount();
    clickCompute();
    await screen.findByText(/chỉ tính theo hải đồ/);
    const t = document.body.textContent ?? "";
    expect(t).toContain("Máy chủ dự báo đang quá tải");
    expect(t).toContain("Thiếu dự báo sóng gió");
    expect(t).toContain("KHÔNG có số dự báo sóng gió");
    expect(t).toContain("đợi khoảng 1 tiếng");
    // không bịa "sóng 0 m" khi không có số
    expect(t).toContain("Chưa có số sóng gió cho tuyến này");
    expect(t).not.toMatch(/sóng ~?0 m/);
    expect(t).not.toContain("Tuyến này chưa có dự báo");
    expect(t).not.toContain("Chưa tìm được đường");
  });

  it("hết suất CẢ NGÀY (429 daily): bảo thử lại sau 7 giờ sáng mai, không bảo đợi 1 tiếng", async () => {
    mocks.weather.mockRejectedValue(new WeatherRateLimitError(true));
    await tinhThat();
    mount();
    clickCompute();
    await screen.findByText(/chỉ tính theo hải đồ/);
    const t = document.body.textContent ?? "";
    expect(t).toContain("7 giờ sáng mai");
    expect(t).not.toContain("đợi khoảng 1 tiếng");
  });

  it("mất sóng + máy chưa lưu gì: ra tuyến theo hải đồ, KHÔNG nói máy chủ quá tải", async () => {
    mocks.weather.mockRejectedValue(new Error("mất sóng"));
    await tinhThat();
    mount();
    clickCompute();
    await screen.findByText(/chỉ tính theo hải đồ/);
    const t = document.body.textContent ?? "";
    expect(t).toContain("Không lấy được dự báo sóng gió");
    expect(t).not.toContain("quá tải");
  });

  it("thiếu phủ dự báo có thông báo riêng thay cho khẳng định đất chặn", async () => {
    mocks.plan.mockResolvedValue({ plan: null, failure: "weather-coverage" });
    mount();
    clickCompute();
    await screen.findByText(/thiếu dữ liệu dự báo/);
    expect(document.body.textContent).not.toContain("không có đường vòng nào qua được");
  });
});
