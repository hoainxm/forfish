// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import manh from "@/data/giong-sen-bien-manh.json";
import { docSo, ghepManh, khoaManh, vietThanhNoi } from "@/lib/voice/ghep.mjs";
import { ageSpeech, clockSpeech, dirSpeech, distSpeech, speedSpeech, waveSpeech } from "@/lib/nav-voice/phrases";
import { cauDocSo, noiThoiDiem, type LopBanDo } from "@/lib/sen-bien/lenh-ban-do";
import { hoiGi, traLoi, type KhoBanDo, type ViTri } from "@/lib/sen-bien/hoi-ban-do";
import { napManhGiong, speechParts } from "@/lib/voice/tts";
import { baoKhucRe, type KhucRe } from "@/lib/nav-khuc-re";
import { cauVung } from "@/lib/nav-vung";
import { tenNoi, type VungQuanLy } from "@/lib/vung-quan-ly";
import { CAU_DU_HAI_DO, CAU_TAT_MAN, CAU_TU_DUNG, cauBatDau } from "@/lib/nav-voice/cau-dan-duong";
import { collectVoiceEvents, initVoiceMemory, type VoiceSources } from "@/lib/nav-voice/events";

const NGUON_RONG: VoiceSources = {
  nowMs: 0, unit: "nm", alerts: [], border: null, offRoute: null, gps: "tracking", info: null, storm: null, sea: null,
  depthHere: null, moving: true, legsPassed: 0, legsTotal: 0, arrived: false,
};

// danh mục mảnh nạp động (tts.ts) — nạp trước như lúc app đã sẵn
beforeAll(() => napManhGiong());

/*
  GHÉP GIỌNG SEN BIỂN (doc 15 §21) — câu có số/tên đọc bằng MẢNH mp3 Mỹ Duyên
  thay vì giọng máy. Cổng: mọi câu app dựng từ số + khung + tên trong danh mục
  phải phủ 100 % bằng mảnh; thiếu mảnh ⇒ ĐỎ, in ra cụm thiếu để thêm vào
  scripts/sen-bien-giong/lap_manh.mjs (rồi sinh mp3 ở gpu-desktop).
*/

describe("docSo — số đọc kiểu Việt", () => {
  it.each([
    ["0", "không"],
    ["5", "năm"],
    ["10", "mười"],
    ["15", "mười lăm"],
    ["21", "hai mươi mốt"],
    ["24", "hai mươi tư"],
    ["25", "hai mươi lăm"],
    ["30", "ba mươi"],
    ["105", "một trăm lẻ năm"],
    ["110", "một trăm mười"],
    ["200", "hai trăm"],
    ["1005", "một nghìn không trăm lẻ năm"],
    ["23488", "hai mươi ba nghìn bốn trăm tám mươi tám"],
    ["1000000", "một triệu"],
    ["09", "không chín"],
  ])("%s → %s", (s, w) => expect(docSo(s).join(" ")).toBe(w));
});

describe("vietThanhNoi — chữ viết → câu nói", () => {
  it.each([
    ["Còn chừng 4,5 hải lý.", "Còn chừng bốn phẩy năm hải lý"],
    ["sâu 2–4 m", "sâu hai đến bốn mét"],
    ["gió 35 km/giờ", "gió ba mươi lăm cây số một giờ"],
    ["mây che 80%", "mây che tám mươi phần trăm"],
    ["rộng 23.488 ha", "rộng hai mươi ba nghìn bốn trăm tám mươi tám héc ta"],
    ["nước 1,05 mét", "nước một phẩy không năm mét"],
    ["Đảo Lý Sơn", "Đảo Lý Sơn"],
  ])("%s", (a, b) => expect(vietThanhNoi(a)).toBe(b));
});

describe("ghepManh — khớp cụm dài nhất, tên riêng không bị xé", () => {
  const ds = ["còn chừng", "hải lý", "tới ranh giới", "bốn", "phẩy năm", "hướng", "Đông", "Nam", "Sa Huỳnh", "rạn có tên gần nhất là"];
  const m = new Map(ds.map((t) => [khoaManh(t), t]));
  const tra = (k: string) => m.get(k);
  const g = (s: string) => ghepManh(s, tra, 8);

  it("câu phủ đủ ⇒ một khúc mp3 nhiều mảnh", () =>
    expect(g("Còn chừng 4,5 hải lý tới ranh giới")).toEqual([
      { text: "Còn chừng bốn phẩy năm hải lý tới ranh giới", ids: ["còn chừng", "bốn", "phẩy năm", "hải lý", "tới ranh giới"] },
    ]));
  it("tên ngoài danh mục ⇒ CHỈ khúc tên đọc giọng máy", () =>
    expect(g("Rạn có tên gần nhất là Đá Xyz")).toEqual([
      { text: "Rạn có tên gần nhất là", ids: ["rạn có tên gần nhất là"] },
      { text: "Đá Xyz", ids: null },
    ]));
  it("tên lạ dính chữ hoa có mảnh ('Nam') ⇒ cả tên đọc giọng máy, không nửa nọ nửa kia", () =>
    expect(g("hướng Quảng Nam")).toEqual([
      { text: "hướng", ids: ["hướng"] },
      { text: "Quảng Nam", ids: null },
    ]));
  it("hướng viết hoa đứng riêng vẫn là mảnh", () =>
    expect(g("hướng Đông Nam")).toEqual([{ text: "hướng Đông Nam", ids: ["hướng", "Đông", "Nam"] }]));
});

describe("danh mục mảnh ↔ file mp3", () => {
  const items = Object.values(manh.nhom as Record<string, string[][]>).flat();
  it("không trùng id, không trùng khoá", () => {
    const ids = items.map(([id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = items.map(([, t]) => khoaManh(t));
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("không id nào trùng tên thiết bị cấm của Windows (con, nul, aux…)", () => {
    // con.mp3 từng làm hỏng checkout + commit trên Windows — xem lap_manh.mjs
    const cam = items.map(([id]) => id).filter((id) => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(id));
    expect(cam).toEqual([]);
  });
  /*  mp3 sinh ở gpu-desktop (Mac không chạy VieNeu). Thiếu file thì app vẫn đúng:
      mảnh tải hỏng ⇒ khúc đó đọc giọng máy — nên cổng này chỉ đếm, không chặn
      khi chưa có thư mục (lần sinh đầu). */
  it("có thư mục mảnh thì mỗi mảnh có mp3", () => {
    const dir = join(process.cwd(), "public", manh.dir.replace(/^\//, ""));
    if (!existsSync(dir)) return;
    const thieu = items.filter(([id]) => !existsSync(join(dir, `${id}.mp3`))).map(([id]) => id);
    expect(thieu).toEqual([]);
  });
});

/* ── CỔNG PHỦ: câu thật của app ───────────────────────────────────────────── */

function thieu(text: string): string[] {
  return speechParts(text).filter((p) => !p.clips).map((p) => p.text);
}
function phuHet(cau: string[]) {
  const miss = new Map<string, string>();
  for (const c of cau) for (const t of thieu(c)) if (!miss.has(t)) miss.set(t, c);
  expect([...miss].map(([t, c]) => `${t}   ← ${c}`)).toEqual([]);
}

describe("câu có số của app phủ đủ mảnh", () => {
  it("quãng đường, sóng, tốc độ, hướng", () => {
    const cau: string[] = [];
    for (let km = 0.05; km < 600; km *= 1.07) {
      cau.push(`Còn chừng ${distSpeech(km, "nm")}.`, `Đi ${distSpeech(km, "km")}.`);
      cau.push(`Đang đi khác đường đã vẽ chừng ${distSpeech(km, "nm")}.`);
    }
    for (let m = 0; m < 9; m += 0.1) cau.push(`Sóng chừng ${waveSpeech(m)}.`);
    for (let v = 0; v < 60; v += 3) cau.push(`Tàu đang chạy hướng ${dirSpeech(v * 6)}, ${speedSpeech(v, "nm")}.`, `${speedSpeech(v, "km")}.`);
    phuHet(cau);
  });
  it("giờ, tuổi tin, thời điểm hỏi bản đồ", () => {
    const now = Date.UTC(2026, 9, 17, 5);
    const cau: string[] = [];
    for (let m = 0; m < 1440; m += 5) cau.push(`Số dự báo tải lúc ${clockSpeech(now + m * 60_000)}.`);
    for (const h of [0.5, 3, 10, 30, 70, 200]) cau.push(`Có bão trên Biển Đông, ${ageSpeech(now - h * 3600_000, now)}.`);
    for (let ngay = 0; ngay < 6; ngay++) {
      cau.push(`Bản đồ sóng ${noiThoiDiem({ ngay })}.`);
      for (let gio = 0; gio < 24; gio += 1) cau.push(`Bản đồ gió ${noiThoiDiem({ ngay, gio })}.`);
    }
    phuHet(cau);
  });
  it("đọc số lớp bản đồ", () => {
    const lop: LopBanDo[] = ["gio", "song", "dong_chay", "nhiet_nuoc", "may", "mua", "nhiet_kk", "ap_suat", "dong_set"];
    const cau: string[] = [];
    for (const l of lop)
      for (const x of [0, 0.3, 2.5, 7, 18, 33, 61, 95, 400, 1013, 2600]) {
        const s = cauDocSo(l, { windKmh: x, windDirDeg: x * 7, waveM: x / 10, curKmh: x / 5, curDirDeg: x, scalar: x, nhietNuoc: 20 + x / 50 });
        if (s) cau.push(`Chỗ đang xem: ${s}.`);
      }
    phuHet(cau);
  });
  it("khúc rẽ hai nhịp (VietMap 300_turn / turn): mọi hướng, hai bên, mọi khoảng cách", () => {
    const cau: string[] = [];
    for (const huongVN of ["Bắc", "Đông Bắc", "Đông", "Đông Nam", "Nam", "Tây Nam", "Tây", "Tây Bắc"])
      for (const gocDeg of [-90, 90])
        for (const unit of ["nm", "km"] as const) {
          const fmt = (k: number) => distSpeech(k, unit);
          const kr: KhucRe = { idx: 1, km: 0.1, huongSau: 0, huongVN, gocDeg };
          cau.push(baoKhucRe(null, kr, null, fmt).bao!.text); // nhịp "bây giờ"
          // nhịp báo trước: tốc độ đủ để km nằm trong mốc 5 phút
          for (let km = 0.3; km < 30; km *= 1.3) cau.push(baoKhucRe(null, { ...kr, km }, km * 14, fmt).bao!.text);
        }
    phuHet(cau);
  });
  it("câu dẫn đường mới (rà Vietmap 2026-11-02): lệch tuyến kèm hướng về vạch, bắt đầu, tự dừng", () => {
    const cau: string[] = [CAU_TU_DUNG, CAU_DU_HAI_DO];
    for (const ben of ["trái", "phải"] as const)
      for (let km = 2; km < 40; km *= 1.6)
        for (const h of [0, 90, 200, 300])
          cau.push(
            collectVoiceEvents(initVoiceMemory(), { ...NGUON_RONG, offRoute: { step: 2, km, ben, huongVeDeg: h } }).events[0].text,
          );
    for (let km = 3; km < 400; km *= 2.3)
      cau.push(cauBatDau(km, km / 13, km * 40, "nm").replace(` ${CAU_TAT_MAN}`, ""));
    phuHet(cau);
  });
  it("nợ mảnh giọng: hai câu dẫn đường chưa có mảnh — đọc giọng máy cả câu", () => {
    /*  nợ: "Tắt màn hình là máy ngừng đọc." và "Tàu đã về lại đường đã vẽ." chưa có mảnh
        Mỹ Duyên (máy GPU sinh qua lap_manh.mjs → gen_clips.py --manh — file đã nằm trong
        NGUON). Có mảnh rồi thì test này ĐỎ ⇒ gộp hai câu vào phuHet ở test trên. */
    expect(thieu(CAU_TAT_MAN).length).toBeGreaterThan(0);
    expect(thieu("Tàu đã về lại đường đã vẽ.").length).toBeGreaterThan(0);
  });
  it("vào / ra vùng quản lý thật (khu bảo tồn, vùng cấm theo mùa)", () => {
    /*  nợ: 8 địa danh trong tên vùng chưa có mảnh giọng (máy GPU sinh mp3 qua
        lap_manh.mjs → gen_clips.py --manh); trong lúc chờ, cả câu đọc giọng máy
        theo luật "một câu một giọng". Gỡ khỏi danh sách khi đã sinh. Tên MỚI thiếu
        mảnh vẫn đỏ. */
    const NO_THIEU = new Set([
      "gò", "đồi ngầm Quảng Bình", "Bắc Hải Vân", "vùng biển", "Hòn Dài", "Cao Mũi Còng Cọc",
      "Nhơn Lý", "Bờ Đập Mũi Yến", "Nhơn Hải", "Ghềnh Ráng", "Hòn Sâu Hòn Nhàn Hòn Đất",
    ]);
    const cau: string[] = [];
    // đọc bản RÕ trong git bằng fs — cấm import JSON từ public/data (cổng data-codec.test.ts)
    const vungData = JSON.parse(readFileSync(join(process.cwd(), "public/data/vung-quan-ly.v1.json"), "utf8")) as {
      vung: Pick<VungQuanLy, "loai" | "ten">[];
    };
    for (const v of vungData.vung) {
      if (v.loai !== "bao-ton" && v.loai !== "cam-thoi-han") continue;
      const ten = tenNoi(v);
      for (const loai of ["vao", "ra"] as const) {
        const c = cauVung({ loai, id: "x", ten, muc: "vang", lan: 1 });
        if (c) cau.push(c);
      }
    }
    expect(cau.length).toBeGreaterThan(10);
    const khoa = new Set(Object.values(manh.nhom as Record<string, string[][]>).flat().map(([, t]) => khoaManh(t)));
    const dai = Math.max(...[...khoa].map((k) => k.split(" ").length));
    const moi = new Set<string>();
    for (const c of cau)
      for (const doan of c.replace(/[.()]/g, "").split(/(?:[,;:]\s+|\s+[—–·-]\s+)/))
        for (const g of ghepManh(doan.trim(), (k) => (khoa.has(k) ? k : undefined), dai))
          if (!g.ids && !NO_THIEU.has(g.text)) moi.add(g.text);
    expect([...moi]).toEqual([]);
  });
  it("hỏi đáp bản đồ với tên trong danh mục", () => {
    const v: ViTri = { lat: 15.3, lon: 108.9, nguon: "tau", huongChay: 90 };
    const kho: KhoBanDo = {
      dao: [{ lat: 15.38, lon: 109.12, ten: "Lý Sơn" }],
      ran: [{ lat: 15.3, lon: 109.0, ten: "Bãi Cỏ Mây" }],
      truBao: [{ lat: 15.2, lon: 108.8, ten: "Sa Kỳ", tinh: "QUẢNG NGÃI", cap: "vung", sucChua: null, coTauM: null, ghiChu: null, tin: "cao", nguonToaDo: "" }],
      vung: [],
      vungCam: [],
      cang: [{ name: "Sa Huỳnh", lat: 15.2, lon: 108.83, kind: "cang" }],
    };
    const cau = ["gần đảo nào nhất", "rạn gần nhất ở đâu", "phía trước có gì", "chỗ tránh trú bão gần nhất", "cảng nào gần nhất", "tàu đang ở đâu"]
      .map((q) => traLoi(hoiGi(q)!, kho, v, "nm", Date.UTC(2026, 9, 16, 3)).say);
    phuHet(cau);
  });
});
