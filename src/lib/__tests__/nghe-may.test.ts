import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { chuThuong, hotwordsText, SHERPA_BAN, vadBuoc, vadMoi, VAD_CHO_MS, VAD_IM_MS, VAD_TRAN_MS } from "@/lib/sen-bien/nghe-may";

/** chạy VAD qua dãy (rms, ms) — khung 85 ms */
function chay(rmsAt: (t: number) => number, toiDa = 12000) {
  let s = vadMoi();
  for (let t = 85; t <= toiDa; t += 85) {
    const r = vadBuoc(s, rmsAt(t), t);
    s = r.s;
    if (r.xong) return { xong: r.xong, t };
  }
  return { xong: undefined, t: toiDa };
}

describe("VAD — biết lúc bà con nói xong", () => {
  it("nói 1,5 s rồi im ⇒ xong sau ~1,1 s im", () => {
    const r = chay((t) => (t > 600 && t < 2100 ? 0.2 : 0.005));
    expect(r.xong).toBe("noi-xong");
    expect(r.t).toBeGreaterThanOrEqual(2100 + VAD_IM_MS - 85);
    expect(r.t).toBeLessThan(2100 + VAD_IM_MS + 200);
  });
  it("không nói gì ⇒ báo không nói sau ngưỡng chờ", () => {
    const r = chay(() => 0.004);
    expect(r).toEqual({ xong: "khong-noi", t: expect.any(Number) });
    expect(r.t).toBeGreaterThanOrEqual(VAD_CHO_MS);
  });
  it("máy tàu ồn đều (nền cao) không bị coi là tiếng nói", () => {
    const r = chay((t) => 0.08 + 0.01 * Math.sin(t));
    expect(r.xong).toBe("khong-noi");
  });
  it("nói át tiếng máy vẫn bắt được", () => {
    const r = chay((t) => (t > 800 && t < 2500 ? 0.4 : 0.08));
    expect(r.xong).toBe("noi-xong");
  });
  it("nói liên tục ⇒ cắt ở trần", () => {
    const r = chay((t) => (t > 400 ? 0.3 : 0.005), 20000);
    expect(r.xong).toBe("tran");
    expect(r.t).toBeGreaterThanOrEqual(VAD_TRAN_MS);
  });
});

describe("chữ của bộ nghe", () => {
  it("chữ hoa → thường, dấu dựng sẵn", () => expect(chuThuong("DẪN VỀ  CẢNG SA HUỲNH ")).toBe("dẫn về cảng sa huỳnh"));
  it("tên ưu tiên: hoa, bỏ ngoặc/dấu câu, không trùng", () =>
    expect(hotwordsText(["Sa Huỳnh", "sa huỳnh", "Bình Châu (Bến Lội)", "Cty TNHH Thành Vui", "X"])).toBe(
      "SA HUỲNH\nBÌNH CHÂU\nCTY TNHH THÀNH VUI\n",
    ));
  it("không tên ⇒ rỗng", () => expect(hotwordsText([])).toBe(""));
});

describe("gói bộ nghe + bộ chạy WASM có đủ trong repo", () => {
  it("sen-bien-nghe.v2.bin: đầu SBN1, đủ 5 file, độ dài khớp", () => {
    const b = readFileSync("public/data/sen-bien-nghe.v2.bin");
    expect(b.subarray(0, 4).toString("ascii")).toBe("SBN1");
    const nh = b.readUInt32LE(4);
    const head = JSON.parse(b.subarray(8, 8 + nh).toString("utf8")) as { files: { name: string; len: number }[] };
    expect(head.files.map((f) => f.name)).toEqual(["encoder.onnx", "decoder.onnx", "joiner.onnx", "tokens.txt", "bpe.vocab"]);
    expect(8 + nh + head.files.reduce((a, f) => a + f.len, 0)).toBe(b.length);
    // v2 (2026-10-22): bản 70.000 giờ tinh chỉnh — ghi công zzasdf + Apache-2.0 phải đi cùng file (ADR 0015)
    const meta = head as unknown as { model: string; nguon?: string };
    expect(meta.model).toMatch(/70000h/);
    expect(meta.nguon).toMatch(/zzasdf/);
    expect(meta.nguon).toMatch(/Apache-2\.0/);
  });
  it(`public/sherpa-asr/${SHERPA_BAN}/ có bộ chạy chỉ-nghe (không phải bản Node)`, () => {
    const dir = `public/sherpa-asr/${SHERPA_BAN}/`;
    for (const f of ["sherpa-onnx-wasm-main-asr.js", "sherpa-onnx-wasm-main-asr.wasm", "sherpa-onnx-asr.js", "LICENSE"])
      expect(existsSync(dir + f), f).toBe(true);
    const js = readFileSync(dir + "sherpa-onnx-wasm-main-asr.js", "utf8");
    expect(js).not.toMatch(/NODERAWFS is currently only supported/);
    expect(js).toMatch(/_SherpaOnnxCreateOfflineRecognizer/);
  });
  // Vendor do Emscripten sinh, eslint bỏ qua (eslint.config.mjs) ⇒ gác bằng
  // checksum: ai đổi bộ chạy mà không bump SHERPA_BAN (thư mục mới) là đỏ —
  // SW/trình duyệt giữ bản cũ theo đường dẫn, đổi nội dung tại chỗ là lệch.
  it(`bộ chạy ${SHERPA_BAN} không bị sửa tại chỗ (checksum)`, () => {
    const SHA: Record<string, string> = {
      "sherpa-onnx-asr.js": "d51ae8e8b756ee5e53423ffada0c9702973f154f561aca7984fe0b12f4060178",
      "sherpa-onnx-wasm-main-asr.js": "63eebaa6b1ea572849bab623ae19ca65f4894253816ef5dbc214204a7ad32242",
      "sherpa-onnx-wasm-main-asr.wasm": "8e06e8f0a1a0f3f5460238e36542fed9f933c10f4393826d1c0f429fc9d9b85d",
    };
    expect(SHERPA_BAN).toBe("1.13.8");
    for (const [f, h] of Object.entries(SHA))
      expect(createHash("sha256").update(readFileSync(`public/sherpa-asr/${SHERPA_BAN}/${f}`)).digest("hex"), f).toBe(h);
  });
  it("worker trỏ đúng thư mục bộ chạy", () =>
    expect(readFileSync("public/sen-bien-nghe.worker.js", "utf8")).toMatch(/\/sherpa-asr\/\$\{ban\}\//));
});
