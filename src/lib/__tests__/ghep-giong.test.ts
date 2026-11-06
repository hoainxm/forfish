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
import { cauTomTat, KICH_BAN_GIAY, kichBanTau } from "@/lib/sen-bien/nhap-giong";
import { CAU_GIO, CAU_LANG } from "@/lib/sen-bien/cau-vui";
import { CAU_CAN_KIEM } from "@/lib/sen-bien/hoi-dap";
import { CAU_CHUA_CHAC } from "@/lib/sen-bien/hoi-kho";
import { loiDocGiamSat } from "@/lib/stracking/doc-canh-bao.mjs";
import { baoKhucRe, type KhucRe } from "@/lib/nav-khuc-re";
import { cauVung } from "@/lib/nav-vung";
import { tenNoi, type VungQuanLy } from "@/lib/vung-quan-ly";
import { CAU_DU_HAI_DO, CAU_TAT_MAN, CAU_TU_DUNG, cauBatDau } from "@/lib/nav-voice/cau-dan-duong";
import { collectVoiceEvents, initVoiceMemory, type VoiceSources } from "@/lib/nav-voice/events";
import {
  CAU_CHAY_KHONG_DICH, CAU_CHUA_BO_NGHE, CAU_CHUA_DAN, CAU_CHUA_TOC_DO, CAU_MICRO_CHAN, CAU_TINH_LAI,
  cauConLai, cauCuuNan, cauHuong, cauTocDo,
} from "@/lib/sen-bien/lenh-chay";

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
    // 4 lỗ giọng (15 §33): báo trước tới đích, định vị yếu, khu trú bão khi bão gần
    for (let km = 1; km < 30; km *= 1.7) {
      const r = collectVoiceEvents(initVoiceMemory(), { ...NGUON_RONG, conLaiKm: km, tocDoKmh: 200 }).events;
      cau.push(...r.map((e) => e.text));
    }
    for (const m of [160, 230, 480]) cau.push(...collectVoiceEvents(initVoiceMemory(), { ...NGUON_RONG, saiSoM: m }).events.map((e) => e.text));
    const vungKhu = JSON.parse(readFileSync(join(process.cwd(), "public/data/khu-tru-bao.v1.json"), "utf8")) as { khu?: { ten: string }[] } | { ten: string }[];
    const dsKhu = (Array.isArray(vungKhu) ? vungKhu : (vungKhu.khu ?? [])).map((k) => k.ten);
    expect(dsKhu.length).toBeGreaterThan(20);
    for (const ten of dsKhu) cau.push(`Khu tránh trú bão gần nhất là ${ten}, còn chừng ${distSpeech(37, "nm")}.`);
    phuHet(cau);
  });
  it("hai câu dẫn đường từng nợ mảnh (sinh 2026-11-02): tắt màn, về lại đường", () => {
    phuHet([CAU_TAT_MAN, "Tàu đã về lại đường đã vẽ."]);
  });
  it("câu Sen Biển vượt Mimi (15 §34): còn bao xa + giờ tới, tốc độ, hướng lái, kêu cứu, rảnh tay", () => {
    const cau: string[] = [CAU_CHUA_DAN, CAU_CHAY_KHONG_DICH, CAU_TINH_LAI, CAU_CHUA_TOC_DO, CAU_CHUA_BO_NGHE, CAU_MICRO_CHAN];
    const now = Date.UTC(2026, 10, 2, 1, 0);
    for (let km = 3; km < 300; km *= 2.1) for (const h of [0.4, 2.5, 9.8]) cau.push(cauConLai({ remainingKm: km, etaHours: h }, true, "nm", now + km * 7e5));
    for (const v of [0, 7.3, 14.4, 22, 31]) cau.push(cauTocDo(v, "nm"), cauTocDo(v, "km"));
    const dirs = ["Bắc", "Đông Bắc", "Đông", "Đông Nam", "Nam", "Tây Nam", "Tây", "Tây Bắc"];
    for (const dirVN of dirs) {
      cau.push(cauHuong({ offRoute: false, offRouteKm: 0, vachBen: null, huongVeVachDeg: null, steer: null, dirVN }, "nm"));
      for (const g of [-70, -25, 15, 45])
        cau.push(cauHuong({ offRoute: false, offRouteKm: 0, vachBen: null, huongVeVachDeg: null, steer: { side: g < 0 ? "left" : "right", label: "", turnDeg: g }, dirVN }, "nm"));
    }
    for (const ben of ["trái", "phải"] as const) for (const h of [10, 135, 270])
      cau.push(cauHuong({ offRoute: true, offRouteKm: 4.2, vachBen: ben, huongVeVachDeg: h, steer: null, dirVN: "Nam" }, "nm"));
    for (const [la, lo] of [[14.5754, 109.1], [8.62, 106.61], [20.95, 107.72], [10.3, 104.0]])
      cau.push(cauCuuNan({ lat: la, lon: lo }, 30_000), cauCuuNan({ lat: la, lon: lo }, 12 * 60_000));
    cau.push(cauCuuNan(null, null));
    phuHet(cau);
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

/*  RÀ SOÁT GIỌNG 2026-11-06 (doc 15 §36, anh Long: "xây giọng đọc Mỹ Duyên cho nó hết đi"): câu hỏi nhập bằng giọng,
    cảnh báo giám sát hành trình, câu lảng / câu giờ, câu an toàn kho — trọn giọng thu sẵn (câu nguyên hoặc mảnh).
    Câu mới viết trong các file này mà chưa sinh giọng ⇒ đỏ: chạy ra-soat-giong.test.ts rồi lap_manh + gen_clips. */
describe("rà soát giọng: câu hỏi, cảnh báo, câu đã dùng trọn Mỹ Duyên", () => {
  it("câu hỏi nhập giấy tờ / tàu bằng giọng + câu tóm tắt", () => {
    const hoi = [...KICH_BAN_GIAY, ...kichBanTau(["Bình Định", "Quảng Ngãi"])].map((b) => b.hoi);
    phuHet([...hoi, cauTomTat(["dài 15 mét", "đóng năm 2015"]) /* tên riêng tự do (tên tàu, chủ tàu) không thu được — câu đó giọng máy */, cauTomTat([])]);
  });
  it("câu lảng + câu giờ + câu an toàn kho", () => {
    phuHet([...Object.values(CAU_LANG).flat(), ...CAU_GIO.flat(), CAU_CAN_KIEM, CAU_CHUA_CHAC]);
  });
  it("cảnh báo giám sát hành trình: mất tín hiệu, mọi loại cảnh báo, cước, yên tâm", () => {
    const now = Date.parse("2026-11-06T07:00:00Z");
    const vn = (s: string) => new Date(Date.parse(`${s}+07:00`)).toISOString();
    const t = (o: Record<string, unknown> = {}) => ({ tenTau: "BV-92345-TS", imei: "1", hetHan: "2027-06-01", trongBo: false, matKetNoiTu: null, ...o });
    const loai = ["SOS", "Vượt biên", "Sắp vượt biên", "Tắt thiết bị", "Mất GPS", "Pin dự phòng sắp hết", "Thiết bị Reset", "Quá tốc độ", "Vùng chú ý đánh bắt"];
    const cau = [
      loiDocGiamSat({ tau: [], now }),
      loiDocGiamSat({ tau: [t()], now }),
      loiDocGiamSat({ tau: [t(), t({ imei: "2", tenTau: "QNg-90123-TS" })], now }),
      loiDocGiamSat({ tau: [t({ matKetNoiTu: vn("2026-11-06T09:53:00") })], now }),
      loiDocGiamSat({ tau: [t({ trongBo: true, matKetNoiTu: vn("2026-11-06T09:53:00") })], now }),
      loiDocGiamSat({ tau: [t({ matKetNoiTu: vn("2026-11-06T06:00:00") })], now }),
      ...["2026-11-19", "2026-11-06", "2026-11-01"].map((h) => loiDocGiamSat({ tau: [t({ hetHan: h })], now })),
      ...loai.map((l) => loiDocGiamSat({ tau: [t()], canhBao: [{ imei: "1", loai: l, luc: vn("2026-11-06T11:20:00"), muc: "Báo động" }], now })),
    ];
    phuHet(cau);
  });
});
