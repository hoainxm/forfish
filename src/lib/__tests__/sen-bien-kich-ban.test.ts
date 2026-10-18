// @vitest-environment jsdom
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
  KỊCH BẢN TOÀN BỘ — mọi câu Sen Biển / chế độ Đang chạy có thể đọc (doc 15 §21e).

  KHÔNG phải cổng thường ngày (chậm ~1 phút, nạp toàn bộ hải đồ): chạy khi lập
  lại danh mục mảnh giọng.

    SEN_BIEN_KICH_BAN=/tmp/kich-ban.json npx vitest run src/lib/__tests__/sen-bien-kich-ban.test.ts
    node scripts/sen-bien-giong/lap_manh.mjs --kich-ban /tmp/kich-ban.json

  Gom câu từ ĐÚNG hàm của app trên DỮ LIỆU THẬT trong public/data: tàu chạy
  thẳng vào từng xác tàu / phao / đèn / rạn thật (nav-hazards → events →
  announcer), hỏi đáp bản đồ ở chỗ cách mọi cảng cá 15 km ra biển, đọc số lớp
  bản đồ, bão, bản tin mở đầu. Rồi cho qua bộ ghép và ghi:
   · `thieu`: cụm còn phải đọc giọng máy (+ số lần) ⇒ mảnh cần thu thêm
   · `cap`:  cặp mảnh hay đứng liền nhau (+ số lần) ⇒ thu GỘP thành một mảnh
             cho nghe liền hơi (kiểu BPE: gộp cặp hay gặp nhất trước)
*/

const OUT = process.env.SEN_BIEN_KICH_BAN;

import { buildNavContext, cableKmAt, denBienTin, phaoKeTiep, restrictedAt, type NavContext } from "@/lib/nav-context";
import { decodeVungQuanLy } from "@/lib/vung-quan-ly";
import { decodeXacTau } from "@/lib/xac-tau";
import { decodeSeamarks } from "@/lib/seamarks";
import { decodeVnAids } from "@/lib/vn-aids";
import { decodeDenBien } from "@/lib/den-bien";
import { decodeKhuTruBao } from "@/lib/khu-tru-bao";
import { decodeDepthGrid, depthClassAt, type DepthGrid } from "@/lib/depth-grid";
import { decodeTideStations } from "@/lib/tides";
import { requiredDepthM } from "@/lib/hazards";
import { evaluateNavHazards, initNavHazardState } from "@/lib/nav-hazards";
import { fmtDist } from "@/lib/map-prefs";
import { bearingDeg, haversineKm } from "@/lib/route-plan";
import { announce, finished, initAnnouncer, pump, type AnnounceResult, type AnnouncerState } from "@/lib/nav-voice/announcer";
import { collectVoiceEvents, initVoiceMemory, DEPTH_ZONE_SPEECH } from "@/lib/nav-voice/events";
import { ageSpeech, clockSpeech, dirSpeech, distSpeech, speedSpeech, waveSpeech, toSpeechVN, wordCount } from "@/lib/nav-voice/phrases";
import { stormBulletin, stormObservation } from "@/lib/nav-voice/nav-storm";
import { chartLine, diemTin, DEPTH_HERE_SHORT } from "@/lib/nav-voice/opening";
import { cauDocSo, noiThoiDiem, TEN_LOP, type LopBanDo } from "@/lib/sen-bien/lenh-ban-do";
import { hoiGi, traLoi, type ChoTen, type KhoBanDo } from "@/lib/sen-bien/hoi-ban-do";
import { senBienReply } from "@/lib/sen-bien/hieu-y";
import { SPECIES_META } from "@/lib/fish-predict";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { speechParts } from "@/lib/voice/tts";
import manhCatalog from "@/data/giong-sen-bien-manh.json";
import { khoaManh } from "@/lib/voice/ghep.mjs";

const DATA = join(process.cwd(), "public", "data");
const readJson = (f: string) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

describe.skipIf(!OUT)("kịch bản toàn bộ — gom câu, đo phủ mảnh", () => {
  it("gom + ghi báo cáo", { timeout: 600_000 }, () => {
    const raw = new Uint8Array(readFileSync(join(DATA, "depth-grid.v1.bin")));
    const GRID: DepthGrid = decodeDepthGrid(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer);
    const depthAt = (la: number, lo: number) => depthClassAt(GRID, la, lo);
    const NEED = requiredDepthM(2.2, null);
    const den = decodeDenBien(readJson("den-bien.v1.json"));
    const xacTau = decodeXacTau(readJson("xac-tau.v1.json"));
    const seamarks = decodeSeamarks(readJson("seamarks.v1.json"));
    const vnAids = decodeVnAids(readJson("vn-aids.v1.json"));
    const truBao = decodeKhuTruBao(readJson("khu-tru-bao.v1.json"));
    const vung = decodeVungQuanLy(readJson("vung-quan-ly.v1.json"));
    const lanes = readJson("vn-sea-lanes.v1.json").features as GeoJSON.Feature[];
    const CTX: NavContext = buildNavContext(
      { xacTau, laneFeatures: lanes, seamarks, vnAids, denBien: den, khuTruBao: truBao, vungQuanLy: vung },
      NEED,
      2026,
    );
    const fmt = (km: number) => fmtDist(km, "nm", km < 10 ? 1 : 0);
    const cau: string[] = [];
    const KM_PER_DEG = (Math.PI / 180) * 6371;
    const dich = (p: { lat: number; lon: number }, bacKm: number, dongKm = 0) => ({
      lat: p.lat + bacKm / KM_PER_DEG,
      lon: p.lon + dongKm / (KM_PER_DEG * Math.cos((p.lat * Math.PI) / 180)),
    });

    /* 1. tàu chạy thật vào vật cản thật (cùng bộ máy như nav-voice-real-chart) */
    function chay(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
      const speed = 13;
      const fixMs = 2000;
      const hdg = bearingDeg(from, to);
      let hz = initNavHazardState();
      let mem = initVoiceMemory();
      let st: AnnouncerState = initAnnouncer();
      let endAt: number | null = null;
      let waitUntil: number | null = null;
      const handle = (r: AnnounceResult, t: number) => {
        st = r.state;
        if (r.start) {
          cau.push(r.start.text);
          endAt = t + wordCount(r.start.text) * 350;
        } else if (r.waitMs != null) waitUntil = t + r.waitMs;
      };
      const advance = (t: number) => {
        for (let g = 0; g < 20; g++) {
          if (endAt != null && t >= endAt) {
            const e = endAt;
            endAt = null;
            handle(finished(st, e), e);
          } else if (endAt == null && waitUntil != null && t >= waitUntil) {
            const w = waitUntil;
            waitUntil = null;
            handle(pump(st, w), w);
          } else break;
        }
      };
      const steps = Math.ceil(haversineKm(from, to) / ((speed * fixMs) / 3_600_000));
      let t = 0;
      for (let i = 0; i <= steps; i++, t += fixMs) {
        const f = i / steps;
        const pos = { lat: from.lat + (to.lat - from.lat) * f, lon: from.lon + (to.lon - from.lon) * f };
        const r = evaluateNavHazards(hz, {
          pos, headingDeg: hdg, speedKmh: speed, accuracyM: i % 7 === 0 ? 60 : 10, nowMs: t, draftM: 2.2, needM: NEED,
          status: "tracking", ix: CTX.hazards, noGo: CTX.noGo, depthAt,
          nearestCableKm: cableKmAt(CTX, pos), insideRestricted: restrictedAt(CTX, pos), borderNm: null, fmtDist: fmt,
        });
        hz = r.state;
        const info = i % 5 === 0 ? (phaoKeTiep(CTX, pos, hdg, fmt) ?? denBienTin(CTX, pos, fmt)) : null;
        const c = collectVoiceEvents(mem, {
          nowMs: t, unit: "nm", alerts: r.alerts, border: null, offRoute: null, gps: "tracking", info,
          storm: null, sea: null, depthHere: depthAt(pos.lat, pos.lon), moving: true, legsPassed: 0, legsTotal: 0, arrived: false,
        });
        mem = c.mem;
        advance(t);
        handle(announce(st, c.events, t, "day-du"), t);
      }
      advance(t + 120_000);
    }
    const vat = CTX.hazards?.items ?? [];
    const buoc = Math.max(1, Math.floor(vat.length / 400));
    for (let i = 0; i < vat.length; i += buoc) {
      const h = vat[i];
      chay(dich(h, -6), dich(h, -(h.rKm + 0.2)));
    }
    for (let i = 0; i < den.length; i++) {
      const d = den[i];
      const l = denBienTin(CTX, dich(d, -3, 2), fmt);
      if (l) cau.push(toSpeechVN(l.cau));
    }
    for (let i = 0; i < vnAids.length; i += 3) {
      const a = vnAids[i];
      const l = phaoKeTiep(CTX, dich(a, -1.5), 0, fmt);
      if (l) cau.push(toSpeechVN(l.cau));
    }

    /* 2. hỏi đáp bản đồ ở chỗ cách mọi cảng 15 km ra biển + đọc số lớp */
    const diem = (fs: GeoJSON.Feature[]): ChoTen[] =>
      fs.flatMap((f) => {
        const n = (f.properties as { name?: string } | null)?.name;
        if (f.geometry?.type !== "Point" || !n) return [];
        const [lon, lat] = f.geometry.coordinates;
        return [{ lat, lon, ten: n }];
      });
    const cang = FISHING_PORTS.flatMap((p) => (p.lat != null && p.lng != null ? [{ name: p.name, lat: p.lat, lon: p.lng, kind: "cang" as const }] : []));
    const kho: KhoBanDo = {
      dao: diem(readJson("vn-islands.v1.json").features),
      ran: diem(readJson("coral-reefs.v1.json").features),
      phao: [...seamarks, ...vnAids],
      den,
      xacTau,
      truBao,
      vung,
      vungCam: lanes
        .filter((f) => f.properties?.kind === "vungcam" && f.geometry?.type === "Polygon")
        .map((f) => ({ ten: String(f.properties?.ten ?? "").replace(/ — .*$/, ""), loai: String(f.properties?.loai ?? ""), ring: (f.geometry as GeoJSON.Polygon).coordinates[0] as [number, number][] })),
      gian: lanes.filter((f) => f.properties?.kind === "giankhoan" && f.geometry?.type === "Point").map((f) => {
        const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
        return { lat, lon, ten: "giàn khoan" };
      }),
      conNuoc: decodeTideStations(readJson("tide-stations.v1.json")),
      doSau: GRID,
      cang,
    };
    const LOAI = Object.keys(SPECIES_META);
    const HOI = [
      "gần đảo nào nhất", "tàu đang ở đâu", "rạn gần nhất ở đâu", "chỗ này sâu bao nhiêu", "phía trước có gì",
      "đi hướng tây nam có gì", "đèn biển gần nhất", "có xác tàu nào gần đây không", "chỗ tránh trú bão gần nhất",
      "chỗ này có cấm đánh bắt không", "nước ròng lúc mấy giờ", "cảng nào gần nhất", "phao gần nhất ở đâu",
    ];
    const NOW = Date.UTC(2026, 9, 17, 2);
    for (const c of cang) {
      for (const [bac, dong] of [[0, 15], [0, -15], [15, 0], [-15, 0]]) {
        const p = dich(c, bac, dong);
        if (depthAt(p.lat, p.lon) == null) continue;
        for (const q of HOI) cau.push(traLoi(hoiGi(q, LOAI)!, kho, { ...p, nguon: "tau", huongChay: 45 }, "nm", NOW).say);
        cau.push(traLoi(hoiGi("gần đảo nào nhất", LOAI)!, kho, { ...p, nguon: "ban-do" }, "km", NOW).say);
        break;
      }
      cau.push(`Đi ${c.name}. Đang vẽ đường.`);
      for (const km of [7, 26, 90]) cau.push(`Tới ${c.name}: ${distSpeech(km, "nm")}, chừng ${Math.round(km / 13)} giờ. Nói đi để bắt đầu.`);
    }
    for (const l of Object.keys(TEN_LOP) as LopBanDo[])
      for (const x of [0, 0.4, 3, 9, 17, 28, 46, 70, 300, 1008, 1500, 3000]) {
        const s = cauDocSo(l, { windKmh: x, windDirDeg: x * 11, waveM: x / 8, curKmh: x / 6, curDirDeg: x * 3, scalar: x, nhietNuoc: 18 + x / 40 });
        if (s) for (const ngay of [0, 1, 3]) cau.push(`${TEN_LOP[l]} ${noiThoiDiem({ ngay, gio: (x * 7) % 24 })}: ${s}.`);
      }

    /* 3. lời Sen Biển, bão, bản tin, vùng nước, số đủ kiểu */
    for (const t of ["", "thôi", "đi", "dừng", "im", "bật tiếng", "về cảng nhà", "nhắc lại", "còn bao xa", "zzzz"])
      for (const ctx of [{ awaitingGo: true, running: false }, { awaitingGo: false, running: true }]) {
        const r = senBienReply(t, null, [], null, ctx);
        if ("say" in r && r.say) cau.push(r.say);
      }
    for (const c of ["du", "thieu", "chua-co"] as const) cau.push(chartLine(c));
    for (const s of Object.values(DEPTH_HERE_SHORT)) cau.push(s);
    for (const z of Object.values(DEPTH_ZONE_SPEECH)) if (z) cau.push(z.text, ...(z.first ? [z.first] : []));
    for (const kind of ["Áp thấp nhiệt đới", "Bão", "Bão mạnh", "Siêu bão"])
      for (const km of [60, 180, 400, 900]) {
        const st = { kind: "co-bao", checkedAt: NOW - 3 * 3600_000, storms: [{ id: "x", name: "", kindLabel: kind, windKmh: 100, lat: 15, lon: 112, alert: "danger", updated: "", track: [], areas: [] }] } as never;
        const pos = dich({ lat: 15, lon: 112 }, -km);
        cau.push(stormBulletin(st, stormObservation(st, pos, NOW, "nm"), NOW));
      }
    for (let km = 0.05; km < 900; km *= 1.05) cau.push(`Còn chừng ${distSpeech(km, "nm")} tới ranh giới. Giữ khoảng cách.`, `Đang đi khác đường đã vẽ chừng ${distSpeech(km, "km")}.`);
    for (let m = 0; m < 12; m += 0.1) cau.push(`Bây giờ gió cấp ${Math.round(m)}, sóng chừng ${waveSpeech(m)}.`);
    for (let d = 0; d < 360; d += 15) for (const v of [0, 9, 20, 35]) cau.push(`Tàu đang chạy hướng ${dirSpeech(d)}, ${speedSpeech(v, d % 2 ? "km" : "nm")}.`);
    for (let m = 0; m < 1440; m += 5) cau.push(`Số dự báo tải lúc ${clockSpeech(NOW + m * 60_000)}.`);
    for (const h of [0.5, 1.5, 3, 10, 30, 47, 70, 200]) cau.push(`Bản ${ageSpeech(NOW - h * 3600_000, NOW)} chưa thấy bão trên Biển Đông.`);
    for (let p = 5; p <= 30; p += 5) cau.push(`Pin còn ${p} phần trăm. Cắm sạc để máy còn báo.`);
    for (let n = 1; n <= 8; n++) cau.push(`Đã tới chỗ ghé số ${n}.`);
    cau.push(diemTin({ headingDeg: 135, speedKmh: 15, unit: "nm", sea: null, nowMs: NOW } as never) ?? "");

    /* ── đo phủ ─────────────────────────────────────────────────────────── */
    const thieu = new Map<string, number>();
    const cap = new Map<string, number>();
    let doan = 0;
    let doanThieu = 0;
    const duy = [...new Set(cau.filter(Boolean))];
    for (const c of duy) {
      for (const p of speechParts(c)) {
        doan++;
        if (!p.clips) {
          doanThieu++;
          thieu.set(p.text, (thieu.get(p.text) ?? 0) + 1);
          continue;
        }
        for (let i = 1; i < p.clips.length; i++) {
          const k = `${p.clips[i - 1]}|${p.clips[i]}`;
          cap.set(k, (cap.get(k) ?? 0) + 1);
        }
      }
    }
    const xep = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]);

    /*  CÂU MANG (doc 15 §21l): mảnh thu ĐỨNG RIÊNG mang ngữ điệu kết câu — ghép
        lại nghe như đọc từng cụm (UTMOS: câu ghép 1,9 so với câu thu nguyên 3,9).
        Chọn bộ câu thật ít nhất phủ mọi mảnh (tham lam: mảnh mới / độ dài) để
        VieNeu đọc NGUYÊN CÂU rồi cắt mảnh ra (scripts/sen-bien-giong/cat_trong_cau.mjs). */
    const amTiet = new Map<string, number>();
    for (const ds of Object.values(manhCatalog.nhom as Record<string, string[][]>))
      for (const [id, t] of ds) amTiet.set(`${manhCatalog.dir}/${id}.mp3`, khoaManh(t).split(" ").length);
    type Mang = { tts: string; words: string[]; spans: [string, number, number][] };
    const ung: Mang[] = [];
    for (const c of duy) {
      const parts = speechParts(c);
      const words: string[] = [];
      const spans: [string, number, number][] = [];
      let tts = "";
      let ok = true;
      for (const p of parts) {
        const w = p.clips ? khoaManh(p.text).split(" ") : khoaManh(p.text).split(" ").filter(Boolean);
        if (p.clips) {
          let i = words.length;
          for (const u of p.clips) {
            const n = amTiet.get(u);
            if (!n || u.startsWith("/giong/sen-bien/") === false) ok = false;
            if (!u.includes("/m/")) {
              i += w.length;
              continue;
            }
            spans.push([u.replace(/^.*\/m\/|\.mp3$/g, ""), i, i + (n ?? 0)]);
            i += n ?? 0;
          }
          if (i !== words.length + w.length) ok = false;
        }
        words.push(...w);
        tts += `${p.text}${p.pauseMs >= 250 ? ". " : p.pauseMs > 0 ? ", " : " "}`;
      }
      if (ok && spans.length && words.length <= 28) ung.push({ tts: tts.trim().replace(/\s+/g, " "), words, spans });
    }
    const conLai = new Set([...amTiet.keys()].map((u) => u.replace(/^.*\/m\/|\.mp3$/g, "")));
    const mang: Mang[] = [];
    const dung = new Set<number>();
    for (;;) {
      let best = -1;
      let diem = 0;
      ung.forEach((m, i) => {
        if (dung.has(i)) return;
        const moi = new Set(m.spans.map(([id]) => id).filter((id) => conLai.has(id))).size;
        const d = moi / (4 + m.words.length);
        if (d > diem) {
          diem = d;
          best = i;
        }
      });
      if (best < 0) break;
      dung.add(best);
      mang.push(ung[best]);
      for (const [id] of ung[best].spans) conLai.delete(id);
    }
    /*  mảnh không có trong câu thật nào (tên rạn ít hỏi, số hiếm) ⇒ câu mang DỰNG:
        3 mảnh một câu "Gần nhất là A, B, và C." — mảnh nằm giữa câu / giữa dãy
        kể, không mang ngữ điệu kết câu như khi thu đứng riêng. */
    const chu = new Map<string, string>();
    for (const ds of Object.values(manhCatalog.nhom as Record<string, string[][]>)) for (const [id, t] of ds) chu.set(id, t);
    const sot = [...conLai];
    for (let i = 0; i < sot.length; i += 3) {
      const ids = sot.slice(i, i + 3);
      const words = ["gần", "nhất", "là"];
      const spans: [string, number, number][] = [];
      const ten: string[] = [];
      ids.forEach((id, k) => {
        if (k === 2) words.push("và");
        const w = khoaManh(chu.get(id)!).split(" ");
        spans.push([id, words.length, words.length + w.length]);
        words.push(...w);
        ten.push(chu.get(id)!);
      });
      const tts = `Gần nhất là ${ten.length === 3 ? `${ten[0]}, ${ten[1]}, và ${ten[2]}` : ten.join(", ")}.`;
      mang.push({ tts, words, spans });
    }
    writeFileSync(
      OUT!,
      JSON.stringify({ cau: duy.length, doan, doanThieu, thieu: xep(thieu), cap: xep(cap), mang, khongMang: [...conLai] }, null, 1),
    );
    console.log(`câu mang: ${mang.length} câu (${mang.reduce((n, m) => n + m.words.length, 0)} âm tiết) phủ ${amTiet.size - conLai.size}/${amTiet.size} mảnh`);
    console.log(`kịch bản: ${duy.length} câu · ${doan} đoạn · thiếu mảnh ${doanThieu} (${((doanThieu / doan) * 100).toFixed(1)} %) · ${thieu.size} cụm thiếu · ${cap.size} cặp`);
    expect(duy.length).toBeGreaterThan(1000);
  });
});
