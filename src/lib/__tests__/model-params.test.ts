import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildModelParams, OUT } from "../../../scripts/build-model-params.mjs";
import { CURATED } from "../../../scripts/encode-data.mjs";
import {
  MODEL_PARAMS_URL,
  getModelParams,
  setModelParams,
  loadModelParams,
  subscribeModelParams,
  __resetModelParamsForTest,
} from "@/lib/model-params";
import { loadForecastSkill } from "@/lib/forecast-skill";
import { blendUsable, maxMeasuredLead, blendWeight } from "@/lib/fish-blend";

/*  THAM SỐ MÔ HÌNH RA KHỎI BUNDLE (2026-09-16): app tải /data/model-params.v1.json
    (SDF2). Cổng: (1) file phát hành ĐÚNG BẰNG nguồn sự thật src/data — fit lại mà
    quên chạy build-model-params là đỏ; (2) file nằm trong nhóm SDF2 và trong vỏ
    SW; (3) không có import trực tiếp hai JSON đó trong src/ ngoài test;
    (4) chưa nạp ⇒ blend tắt/skill null, không ném; nạp xong ⇒ có số; (5) loader
    hỏng ⇒ null và cho thử lại. */

const ROOT = process.cwd();
const enc = (o: unknown) => new TextEncoder().encode(JSON.stringify(o)).buffer;

describe("file phát hành ↔ nguồn sự thật", () => {
  it("public/data/model-params.v1.json = gộp src/data (chạy lại scripts/build-model-params.mjs nếu đỏ)", () => {
    const disk = JSON.parse(readFileSync(join(ROOT, OUT), "utf8"));
    expect(disk).toEqual(buildModelParams(ROOT));
  });

  it("thuộc nhóm SDF2 và có trong vỏ SW", () => {
    expect(CURATED.has("model-params.v1.json")).toBe(true);
    const sw = readFileSync(join(ROOT, "public", "sw.js"), "utf8");
    expect(sw).toContain('"/data/model-params.v1.json"');
    expect(MODEL_PARAMS_URL).toBe("/data/model-params.v1.json");
  });

  it("KHÔNG còn import trực tiếp fish-blend-weights / forecast-skill JSON trong src (ngoài test)", () => {
    const walk = (dir: string, out: string[] = []) => {
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, f.name);
        if (f.isDirectory()) walk(p, out);
        else if (/\.(ts|tsx)$/.test(f.name) && !p.includes("__tests__")) out.push(p);
      }
      return out;
    };
    const hits = walk(join(ROOT, "src")).filter((p) =>
      /@\/data\/(fish-blend-weights|forecast-skill)\.json/.test(readFileSync(p, "utf8")),
    );
    expect(hits).toEqual([]);
  });
});

describe("loader + consumer", () => {
  beforeEach(() => __resetModelParamsForTest());
  afterEach(() => vi.unstubAllGlobals());

  it("chưa nạp: blend tắt, skill null, không ném", () => {
    expect(getModelParams()).toBeNull();
    expect(blendUsable()).toBe(false);
    expect(maxMeasuredLead()).toBe(0);
    expect(blendWeight(5)).toBe(1);
    expect(loadForecastSkill()).toBeNull();
  });

  it("nạp từ file (bản rõ) ⇒ có số, listener được gọi, lần hai không gọi mạng", async () => {
    const body = buildModelParams(ROOT);
    const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, arrayBuffer: async () => enc(body) });
    vi.stubGlobal("fetch", spy);
    let called = 0;
    subscribeModelParams(() => called++);
    const p = await loadModelParams();
    expect(p?.v).toBe(1);
    expect(called).toBe(1);
    expect(blendUsable()).toBe(true);
    expect(maxMeasuredLead()).toBeGreaterThanOrEqual(10);
    expect(blendWeight(5)).toBeLessThan(1);
    expect(loadForecastSkill()?.perLeadDay?.length).toBeGreaterThan(0);
    await loadModelParams();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("mạng hỏng ⇒ null, KHÔNG ném, lần sau thử lại", async () => {
    const spy = vi
      .fn()
      .mockRejectedValueOnce(new Error("mat song"))
      .mockResolvedValueOnce({ ok: true, status: 200, arrayBuffer: async () => enc({ v: 1 }) });
    vi.stubGlobal("fetch", spy);
    expect(await loadModelParams()).toBeNull();
    expect(await loadModelParams()).toEqual({ v: 1 });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("setModelParams(rác) ⇒ null", () => {
    setModelParams("x" as unknown as null);
    expect(getModelParams()).toBeNull();
  });
});
