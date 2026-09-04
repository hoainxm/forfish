import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildIndex, type SpatialIndex } from "@/lib/spatial-index";
import { haversineKm } from "@/lib/route-plan";
import {
  evaluateNavHazards,
  fmtDistDefault,
  initNavHazardState,
  navQueryKm,
  navThresholdsKm,
  relDir,
  NAV_ANCHOR_MS,
  NAV_CHIME_COOLDOWN_MS,
  NAV_HAZARD_FLOOR_KM,
  NAV_HAZARD_STEPS_MIN,
  NAV_LOST_KEEP_MS,
  NAV_LOST_TICK_MS,
  NAV_QUERY_KM,
  NAV_QUERY_PAD_KM,
  NAV_SLOW_KMH,
  NAV_SLOW_REPEAT_MS,
  type HazardLike,
  type NavAlert,
  type NavHazardInput,
  type NavHazardState,
  type NoGoLike,
} from "@/lib/nav-hazards";

// ── dựng thế giới giả ──────────────────────────────────────────────────────
const LAT0 = 10;
const LON0 = 108;
const KM_PER_DEG = (Math.PI / 180) * 6371;
/** điểm cách gốc `northKm` về bắc, `eastKm` về đông */
const at = (northKm: number, eastKm: number) => ({
  lat: LAT0 + northKm / KM_PER_DEG,
  lon: LON0 + eastKm / (KM_PER_DEG * Math.cos((LAT0 * Math.PI) / 180)),
});

const wreck = (id: string, northKm: number, eastKm: number, extra: Partial<HazardLike> = {}): HazardLike => ({
  id,
  ...at(northKm, eastKm),
  rKm: 0.5,
  loai: "xac-tau",
  ten: null,
  doSauM: null,
  tinVua: false,
  ...extra,
});

const indexOf = (items: HazardLike[]): SpatialIndex<HazardLike> =>
  buildIndex(items, (h) => ({ lat: h.lat, lon: h.lon }));

const SPEED = 13; // km/h ≈ 7 hải lý
const DT_MS = 10_000; // một fix mỗi 10 s
const STEP_KM = (SPEED * DT_MS) / 3_600_000; // ≈ 36 m mỗi fix

function baseInput(over: Partial<NavHazardInput> = {}): NavHazardInput {
  return {
    pos: at(0, 0),
    headingDeg: 0,
    speedKmh: SPEED,
    accuracyM: 10,
    nowMs: 0,
    draftM: null,
    needM: null,
    status: "tracking",
    ix: null,
    noGo: null,
    depthAt: null,
    nearestCableKm: null,
    insideRestricted: null,
    borderNm: null,
    ...over,
  };
}

type Tick = { alerts: NavAlert[]; northKm: number; nowMs: number };

/** Chạy tàu về bắc từ `fromKm` tới `toKm`, gom mọi alert kèm vị trí lúc phát. */
function drive(
  ix: SpatialIndex<HazardLike> | null,
  fromKm: number,
  toKm: number,
  over: Partial<NavHazardInput> = {},
  state: NavHazardState = initNavHazardState(),
  t0 = 0,
): { ticks: Tick[]; state: NavHazardState; nowMs: number } {
  const ticks: Tick[] = [];
  let nowMs = t0;
  for (let north = fromKm; north <= toKm; north += STEP_KM) {
    const r = evaluateNavHazards(state, baseInput({ ix, pos: at(north, 0), nowMs, ...over }));
    state = r.state;
    if (r.alerts.length) ticks.push({ alerts: r.alerts, northKm: north, nowMs });
    nowMs += DT_MS;
  }
  return { ticks, state, nowMs };
}

/** Đứng yên `minutes` phút tại `pos`, gom alert. */
function idle(
  state: NavHazardState,
  minutes: number,
  over: Partial<NavHazardInput>,
  t0: number,
): { ticks: Tick[]; state: NavHazardState; nowMs: number } {
  const ticks: Tick[] = [];
  let nowMs = t0;
  const end = t0 + minutes * 60_000;
  for (; nowMs <= end; nowMs += DT_MS) {
    const r = evaluateNavHazards(state, baseInput({ nowMs, ...over }));
    state = r.state;
    if (r.alerts.length) ticks.push({ alerts: r.alerts, northKm: NaN, nowMs });
  }
  return { ticks, state, nowMs };
}

const chimes = (ticks: Tick[]) => ticks.flatMap((t) => t.alerts).filter((a) => a.chuong);

// ── ngưỡng ───────────────────────────────────────────────────────────────
describe("navThresholdsKm — max(sàn, tốc độ × phút) + sai số GPS", () => {
  it("tốc độ null → đúng sàn 2 km / 500 m", () => {
    expect(navThresholdsKm(null, null)).toEqual([2, 0.5]);
    expect(NAV_HAZARD_FLOOR_KM).toEqual([2, 0.5]);
    expect(NAV_HAZARD_STEPS_MIN).toEqual([10, 3]);
  });
  it("13 km/h → vàng 2,17 km (10 phút), đỏ 0,65 km (3 phút)", () => {
    const [y, r] = navThresholdsKm(13, null);
    expect(y).toBeCloseTo(13 * 10 / 60, 5);
    expect(r).toBeCloseTo(13 * 3 / 60, 5);
  });
  it("tàu chậm 4 km/h → sàn thắng; sai số 300 m cộng thẳng", () => {
    expect(navThresholdsKm(4, 300)).toEqual([2.3, 0.8]);
  });
});

/*  BÁN KÍNH HỎI PHẢI CHẠY THEO NGƯỠNG (review đợt 4, N2). Hằng 3,7 km cũ chỉ
    che nổi SÀN 2 km; tàu trên ~12 hải lý/giờ có ngưỡng vàng vượt 3,7 km nên vật
    ở đúng mốc 10 phút không lọt vào kết quả hỏi — mốc tụt còn ~6,7 phút mà
    không có dấu hiệu nào. Ca dưới đo đúng tàu 20 hải lý/giờ (vỏ thép chạy về). */
describe("navQueryKm — hỏi chỉ mục đủ xa cho tàu chạy nhanh", () => {
  it("tàu chậm giữ nguyên sàn cũ, tàu nhanh nới theo ngưỡng", () => {
    expect(navQueryKm(2)).toBe(NAV_QUERY_KM);
    expect(navQueryKm(6.2)).toBeCloseTo(6.2 + NAV_QUERY_PAD_KM, 9);
    expect(navQueryKm(NaN)).toBe(NAV_QUERY_KM);
  });

  it("biên phủ được vòng chặn lớn nhất trong kho (giàn khoan 1 km, xác tàu tin vừa 1 km)", () => {
    expect(NAV_QUERY_PAD_KM).toBeGreaterThanOrEqual(1);
  });

  it("tàu 20 hải lý/giờ vẫn được nhắc ĐÚNG mốc 10 phút", () => {
    const KMH = 20 * 1.852; // 37,04 km/h
    const [vang] = navThresholdsKm(KMH, 10);
    expect(vang).toBeGreaterThan(NAV_QUERY_KM); // ngưỡng đã vượt hằng cũ
    // xác tàu (vòng 500 m) có MÉP nằm ngay trong mốc vàng
    const mepKm = vang - 0.1;
    const ix = indexOf([wreck("nhanh", mepKm + 0.5, 0)]);
    const r = evaluateNavHazards(
      initNavHazardState(),
      baseInput({ ix, speedKmh: KMH, accuracyM: 10 }),
    );
    expect(r.alerts).toHaveLength(1);
    expect(r.alerts[0].muc).toBe("vang");
    // và cùng vật đó ở NGOÀI mốc thì vẫn im — hỏi rộng không phải là nói sớm
    const ixXa = indexOf([wreck("xa", vang + 2, 0)]);
    const rXa = evaluateNavHazards(
      initNavHazardState(),
      baseInput({ ix: ixXa, speedKmh: KMH, accuracyM: 10 }),
    );
    expect(rXa.alerts).toEqual([]);
  });
});

describe("relDir / fmtDistDefault", () => {
  it("hướng tương đối theo mũi tàu", () => {
    expect(relDir(0, 10)).toBe("phía trước");
    expect(relDir(0, 90)).toBe("bên phải");
    expect(relDir(0, 270)).toBe("bên trái");
    expect(relDir(0, 180)).toBe("phía sau");
    expect(relDir(350, 20)).toBe("phía trước");
    expect(relDir(null, 20)).toBeNull();
  });
  it("chữ khoảng cách mặc định: m dưới 1 km, hải lý từ 1 km, dấu phẩy Việt", () => {
    expect(fmtDistDefault(0.62)).toBe("600 m");
    expect(fmtDistDefault(0.01)).toBe("50 m");
    expect(fmtDistDefault(1.852)).toBe("1 hải lý");
    expect(fmtDistDefault(2.8)).toBe("1,5 hải lý");
  });
});

// ── kịch bản 1: đi thẳng vào xác tàu ─────────────────────────────────────
describe("đi 13 km/h vào xác tàu — vàng rồi đỏ, đúng 2 lần, im sau khi qua", () => {
  const ix = indexOf([wreck("w1", 6, 0)]);
  const { ticks } = drive(ix, 0, 10);
  const mine = ticks.filter((t) => t.alerts.some((a) => a.id === "w1"));

  it("đúng 2 lần nói cho một vật", () => {
    expect(mine).toHaveLength(2);
  });
  it("vàng bắn khi mép vật còn ≥2,0 km, đỏ khi còn ≥600 m", () => {
    const [y, r] = mine;
    const edgeY = 6 - y.northKm - 0.5;
    const edgeR = 6 - r.northKm - 0.5;
    expect(y.alerts[0].muc).toBe("vang");
    expect(edgeY).toBeGreaterThanOrEqual(2.0);
    expect(edgeY).toBeLessThanOrEqual(2.2);
    expect(r.alerts[0].muc).toBe("do");
    expect(edgeR).toBeGreaterThanOrEqual(0.6);
    expect(edgeR).toBeLessThanOrEqual(0.7);
  });
  it("câu chữ: tên vật + phía trước + 'chừng', không mệnh lệnh; đỏ có chuông, vàng cũng có chuông (bậc 1)", () => {
    const [y, r] = mine;
    expect(y.alerts[0].cau).toMatch(/^Xác tàu phía trước chừng .+\.$/);
    expect(y.alerts[0].cau).not.toMatch(/bẻ lái|an toàn|ngay/i);
    expect(y.alerts[0].bac).toBe(1);
    expect(y.alerts[0].chuong).toBe(true);
    expect(r.alerts[0].chuong).toBe(true);
    expect(r.alerts[0].rung).toBe(true);
  });
  it("ETA phút đúng = mép / tốc độ", () => {
    const y = mine[0].alerts[0];
    expect(y.etaMin).toBe(Math.round((y.distKm / SPEED) * 60));
    expect(y.etaMin).toBe(10);
  });
  it("sau khi qua (vật ở phía sau, đang ra xa) không nói thêm", () => {
    const after = ticks.filter((t) => t.northKm > 6.5);
    expect(after).toHaveLength(0);
  });
  it("nước trên vật + tin vừa → thêm vào câu; xác tàu sâu hơn mức cần → bậc 3, rung không chuông", () => {
    const ix2 = indexOf([wreck("w2", 6, 0, { doSauM: 1.1, tinVua: true, ten: "MINH KHÁNH 01" })]);
    const r2 = drive(ix2, 0, 5);
    const a = r2.ticks[0].alerts[0];
    expect(a.cau).toBe(`Xác tàu MINH KHÁNH 01 phía trước chừng ${fmtDistDefault(a.distKm)} — nước trên vật 1,1 m (vị trí gần đúng).`);
    const ix3 = indexOf([wreck("w3", 6, 0, { doSauM: 8 })]);
    const r3 = drive(ix3, 0, 6, { draftM: 2, needM: 2.9 });
    for (const t of r3.ticks) {
      expect(t.alerts[0].bac).toBe(3);
      expect(t.alerts[0].muc).toBe("vang");
      expect(t.alerts[0].chuong).toBe(false);
    }
    expect(r3.ticks).toHaveLength(2);
    expect(r3.ticks[0].alerts[0].rung).toBe(true);
  });
  it("giàn khoan: câu vàng kèm 'không vào trong 500 m'", () => {
    const ix4 = indexOf([wreck("g1", 6, 0, { loai: "gian-khoan", rKm: 1 })]);
    const r4 = drive(ix4, 0, 4);
    expect(r4.ticks[0].alerts[0].cau).toMatch(/^Giàn khoan phía trước chừng .+ — không vào trong 500 m\.$/);
  });
});

// ── kịch bản 2–3: cáp ngầm ────────────────────────────────────────────────
describe("cáp ngầm — chỉ khi chạy chậm và ≤500 m", () => {
  it("chạy song song cáp 200 m ở 13 km/h → 0 alert", () => {
    const { ticks } = drive(null, 0, 5, { nearestCableKm: 0.2 });
    expect(ticks).toHaveLength(0);
    expect(SPEED).toBeGreaterThan(NAV_SLOW_KMH);
  });
  it("dừng 3 km/h trên cáp → 1 alert trong 30 s, rồi ≤1 lần/10 phút", () => {
    const { ticks } = idle(initNavHazardState(), 25, { speedKmh: 3, nearestCableKm: 0.2 }, 0);
    expect(ticks[0].nowMs).toBeLessThanOrEqual(30_000);
    expect(ticks[0].alerts[0]).toMatchObject({ id: "cap-ngam", bac: 3, muc: "vang", chuong: false, rung: true });
    expect(ticks[0].alerts[0].cau).toBe("Đang trên cáp ngầm — đừng neo, đừng thả giã.");
    // 0, 10, 20 phút → 3 lần trong 25 phút
    expect(ticks).toHaveLength(3);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].nowMs - ticks[i - 1].nowMs).toBeGreaterThanOrEqual(NAV_SLOW_REPEAT_MS);
    }
  });
  it("vùng cấm neo đang ở trong, chạy chậm → một câu bậc 3 có tên vùng", () => {
    const r = evaluateNavHazards(initNavHazardState(), baseInput({ speedKmh: 2, insideRestricted: "vùng cấm neo Vũng Rô" }));
    expect(r.alerts[0].cau).toBe("Đang trong vùng cấm neo Vũng Rô — đừng neo, đừng thả lưới ở đây.");
    expect(r.alerts[0].bac).toBe(3);
  });
});

// ── kịch bản 4: neo cạnh vật ─────────────────────────────────────────────
describe("neo 10 phút cạnh 3 vật — 0 chuông sau khi dừng", () => {
  // ba xác tàu phía trước, cách nhau <1 km → cụm; tàu chạy tới rồi dừng
  const ix = indexOf([wreck("a", 6, 0), wreck("b", 6.4, 0.3), wreck("c", 6.8, -0.3)]);
  const run = drive(ix, 0, 4.5);
  const stop = idle(run.state, 10, { ix, pos: at(4.5, 0), speedKmh: null }, run.nowMs);

  it("lúc chạy tới: một câu gom cụm '3 chướng ngại phía trước, gần nhất chừng …'", () => {
    const first = run.ticks[0].alerts[0];
    expect(first.cau).toMatch(/^3 chướng ngại phía trước, gần nhất chừng .+\.$/);
    expect(first.id).toBe("a+b+c");
  });
  it("đứng yên 10 phút: không một tiếng chuông, không câu bậc 1 mới sau 5 phút", () => {
    expect(chimes(stop.ticks)).toHaveLength(0);
    const late = stop.ticks.filter((t) => t.nowMs - run.nowMs > NAV_ANCHOR_MS);
    expect(late.flatMap((t) => t.alerts).filter((a) => a.bac === 1 || a.bac === 3)).toHaveLength(0);
    expect(stop.state.slowSinceMs).toBe(run.nowMs);
  });
});

// ── kịch bản 5: GPS lệch ────────────────────────────────────────────────
describe("GPS lệch", () => {
  const ix = indexOf([wreck("w1", 6, 0)]);
  it("accuracy 300 m → không câu đỏ; câu mốc đỏ hạ vàng và ghi '(định vị lệch ±300 m)'", () => {
    const { ticks } = drive(ix, 0, 10, { accuracyM: 300 });
    const all = ticks.flatMap((t) => t.alerts);
    expect(all.some((a) => a.muc === "do")).toBe(false);
    expect(all).toHaveLength(2);
    expect(all[1].cau).toMatch(/\(định vị lệch ±300 m\)\.$/);
    expect(all[1].muc).toBe("vang");
  });
  it("accuracy 600 m → luôn []", () => {
    const { ticks } = drive(ix, 0, 10, { accuracyM: 600 });
    expect(ticks).toHaveLength(0);
  });
});

// ── kịch bản 6: mất GPS / denied ────────────────────────────────────────
describe("trạng thái GPS", () => {
  it("lost → trả lại câu cuối, không chuông không rung; state giữ nguyên", () => {
    const ix = indexOf([wreck("w1", 6, 0)]);
    const run = drive(ix, 0, 4);
    expect(run.ticks).toHaveLength(1);
    const lost = evaluateNavHazards(run.state, baseInput({ ix, status: "lost", nowMs: run.nowMs }));
    expect(lost.alerts).toHaveLength(1);
    expect(lost.alerts[0].cau).toBe(run.ticks[0].alerts[0].cau);
    expect(lost.alerts[0].chuong).toBe(false);
    expect(lost.alerts[0].rung).toBe(false);
    expect(lost.state).toBe(run.state);
  });
  /*  HẠN 10 PHÚT PHẢI TỚI ĐƯỢC (review đợt 4, N3). Bộ não luôn làm đúng phần
      của nó; cái từng hỏng là chỗ gọi — mất GPS thì không còn fix nào nên effect
      không chạy lại, hạn không bao giờ được đánh giá. Hai vế cùng canh: luật ở
      đây, và nhịp đánh thức (`NAV_LOST_TICK_MS`) mà `fishing-map-view` phải có. */
  it("lost quá NAV_LOST_KEEP_MS → alerts RỖNG (câu cũ không đứng mãi)", () => {
    const ix = indexOf([wreck("w1", 6, 0)]);
    const run = drive(ix, 0, 4);
    expect(run.ticks).toHaveLength(1);
    // mốc tính từ lúc CÓ CÂU, không phải từ fix cuối
    const noiLuc = run.state.lastAlertMs;
    const conHan = evaluateNavHazards(
      run.state,
      baseInput({ ix, status: "lost", nowMs: noiLuc + NAV_LOST_KEEP_MS - 1 }),
    );
    expect(conHan.alerts).toHaveLength(1);
    const hetHan = evaluateNavHazards(
      run.state,
      baseInput({ ix, status: "lost", nowMs: noiLuc + NAV_LOST_KEEP_MS + 1 }),
    );
    expect(hetHan.alerts).toEqual([]);
  });

  it("nhịp đánh thức lúc mất GPS ngắn hơn hẳn hạn giữ câu", () => {
    expect(NAV_LOST_TICK_MS).toBeGreaterThan(0);
    expect(NAV_LOST_TICK_MS).toBeLessThanOrEqual(NAV_LOST_KEEP_MS / 4);
  });

  it("bản đồ có đặt đồng hồ đó, và CHỈ khi không còn tracking", () => {
    const src = readFileSync(
      join(process.cwd(), "src", "components", "fishing-map-view.tsx"),
      "utf8",
    );
    expect(src).toContain("NAV_LOST_TICK_MS");
    // đồng hồ không được chạy trong lúc bám GPS bình thường
    expect(src).toMatch(/navStatus === "tracking"\) return;\s*\r?\n\s*const id = setInterval/);
    // và lượt đánh giá phải phụ thuộc nhịp đó, không thì bơm tick vô ích
    const i = src.indexOf("evaluateNavHazards(navStateRef.current");
    expect(i).toBeGreaterThan(0);
    const deps = src.slice(i, src.indexOf("]);", i));
    expect(deps).toContain("navLostTick");
  });

  it("denied / idle → []", () => {
    for (const status of ["denied", "idle"] as const) {
      expect(evaluateNavHazards(initNavHazardState(), baseInput({ status })).alerts).toEqual([]);
    }
  });
  it("kho chưa nạp (ix null, depthAt null, noGo null) → [] không ném", () => {
    expect(evaluateNavHazards(initNavHazardState(), baseInput()).alerts).toEqual([]);
  });
});

// ── kịch bản 7: nón độ sâu ───────────────────────────────────────────────
describe("nón phía trước — lớp độ sâu", () => {
  const ranTuKm = 1.5;
  const depthRan = (lat: number) => (lat >= at(ranTuKm, 0).lat ? 1 : 5);

  it("bắt lớp 1 (rạn đá) ở ~1,5 km phía trước, vàng (ngoài mốc đỏ 650 m)", () => {
    const r = evaluateNavHazards(initNavHazardState(), baseInput({ depthAt: depthRan }));
    expect(r.alerts).toHaveLength(1);
    const a = r.alerts[0];
    expect(a.id).toBe("day:ran");
    expect(a.distKm).toBeGreaterThanOrEqual(1.4);
    expect(a.distKm).toBeLessThanOrEqual(1.8);
    expect(a.muc).toBe("vang");
    expect(a.bac).toBe(1);
    expect(a.cau).toMatch(/^Phía trước chừng .+ có rạn đá\.$/);
    expect(a.etaMin).toBe(Math.round((a.distKm / SPEED) * 60));
  });
  it("lớp 0 → bờ/đảo; lớp 2 → rất cạn; lớp 3 không khai mớn → 'chưa tới 4 m' bậc 1; khai mớn cần ≤2 m → tin bậc 4", () => {
    const mk = (c: number) => (lat: number) => (lat >= at(1, 0).lat ? c : 5);
    expect(evaluateNavHazards(initNavHazardState(), baseInput({ depthAt: mk(0) })).alerts[0].cau).toMatch(/là bờ hoặc đảo\.$/);
    expect(evaluateNavHazards(initNavHazardState(), baseInput({ depthAt: mk(2) })).alerts[0].cau).toMatch(/nước rất cạn — chưa tới 2 m\.$/);
    const c3 = evaluateNavHazards(initNavHazardState(), baseInput({ depthAt: mk(3) })).alerts[0];
    expect(c3.cau).toMatch(/nước cạn — chưa tới 4 m\.$/);
    expect(c3.bac).toBe(1);
    const c3ok = evaluateNavHazards(initNavHazardState(), baseInput({ depthAt: mk(3), draftM: 1.2, needM: 1.9 })).alerts[0];
    expect(c3ok.bac).toBe(4);
    expect(c3ok.muc).toBe("tin");
    expect(c3ok.chuong).toBe(false);
    expect(c3ok.rung).toBe(false);
  });
  it("lớp 4 (4–12 m) và lớp 5 → im; không có hướng tàu → không nón", () => {
    const mk = (c: number) => () => c;
    expect(evaluateNavHazards(initNavHazardState(), baseInput({ depthAt: mk(4) })).alerts).toEqual([]);
    expect(evaluateNavHazards(initNavHazardState(), baseInput({ depthAt: mk(5) })).alerts).toEqual([]);
    expect(evaluateNavHazards(initNavHazardState(), baseInput({ depthAt: mk(0), headingDeg: null })).alerts).toEqual([]);
  });
  it("nón dài theo tốc độ: 24 km/h → 4 km; rạn ở 3,5 km vẫn thấy; 13 km/h thì chưa", () => {
    const far = (lat: number) => (lat >= at(3.5, 0).lat ? 1 : 5);
    expect(evaluateNavHazards(initNavHazardState(), baseInput({ depthAt: far, speedKmh: 24 })).alerts).toHaveLength(1);
    expect(evaluateNavHazards(initNavHazardState(), baseInput({ depthAt: far, speedKmh: 13 })).alerts).toHaveLength(0);
  });
});

// ── kịch bản 8: vùng cấm vào ─────────────────────────────────────────────
describe("vùng cấm vào", () => {
  const sq = (n0: number, n1: number): NoGoLike => {
    const a = at(n0, -1);
    const b = at(n1, 1);
    return {
      id: "ng1",
      ten: "khu vực cấm Cam Ranh",
      ring: [[a.lon, a.lat], [b.lon, a.lat], [b.lon, b.lat], [a.lon, b.lat], [a.lon, a.lat]],
      bbox: { latMin: a.lat, latMax: b.lat, lonMin: a.lon, lonMax: b.lon },
    };
  };
  it("≤1 hải lý vàng, ≤500 m đỏ, đang trong đỏ 'Đang trong …'", () => {
    const z = sq(3, 5);
    const y = evaluateNavHazards(initNavHazardState(), baseInput({ noGo: [z], pos: at(1.5, 0) }));
    expect(y.alerts[0]).toMatchObject({ id: "ng1", muc: "vang", bac: 1 });
    expect(y.alerts[0].cau).toMatch(/^Khu vực cấm Cam Ranh cách chừng .+\.$/);
    const r = evaluateNavHazards(y.state, baseInput({ noGo: [z], pos: at(2.6, 0), nowMs: 60_000 }));
    expect(r.alerts[0].muc).toBe("do");
    const inside = evaluateNavHazards(initNavHazardState(), baseInput({ noGo: [z], pos: at(4, 0) }));
    expect(inside.alerts[0].cau).toBe("Đang trong khu vực cấm Cam Ranh.");
    expect(inside.alerts[0].distKm).toBe(0);
  });
  it("ngoài 1 hải lý → im", () => {
    expect(evaluateNavHazards(initNavHazardState(), baseInput({ noGo: [sq(3, 5)], pos: at(0, 0) })).alerts).toEqual([]);
  });
});

// ── trần + cooldown ─────────────────────────────────────────────────────
describe("trần 2 câu, chuông ≤1/20 s", () => {
  it("≤2 câu mỗi lần, câu đỏ đứng trước câu vàng", () => {
    // xác tàu sát (đỏ) + cụm xa (vàng, mép 1,7/1,9 km — trong sàn 2 km) + cáp (bậc 3)
    const ix = indexOf([wreck("near", 1, 0), wreck("far1", 2.2, 0), wreck("far2", 2.4, 0.2)]);
    const r = evaluateNavHazards(initNavHazardState(), baseInput({ ix, speedKmh: 3, nearestCableKm: 0.1 }));
    expect(r.alerts.length).toBeLessThanOrEqual(2);
    expect(r.alerts[0].muc).toBe("do");
    expect(r.alerts[0].id).toBe("near");
    expect(r.alerts[1].muc).toBe("vang");
    // vật chưa được chọn (cáp) chờ lượt sau, không mất
    const r2 = evaluateNavHazards(r.state, baseInput({ ix, speedKmh: 3, nearestCableKm: 0.1, nowMs: DT_MS }));
    expect(r2.alerts.map((a) => a.id)).toContain("cap-ngam");
  });
  it("hai vật vàng cách nhau >1 km (không gom): mỗi lần 1 câu vàng, chuông thứ hai trong 20 s bị nén, đỏ mới thì không", () => {
    // hai xác tàu cách tàu 2,16 km (mép 1,66 < 2,17), cách nhau 2,4 km → không gom
    const ix = indexOf([wreck("p", 1.8, -1.2), wreck("q", 1.8, 1.2)]);
    const r1 = evaluateNavHazards(initNavHazardState(), baseInput({ ix }));
    expect(r1.alerts).toHaveLength(1); // trần 1 vàng — cái kia chờ lượt sau
    expect(r1.alerts[0].chuong).toBe(true);
    const r2 = evaluateNavHazards(r1.state, baseInput({ ix, nowMs: 5_000 }));
    expect(r2.alerts).toHaveLength(1);
    expect(r2.alerts[0].id).not.toBe(r1.alerts[0].id);
    expect(r2.alerts[0].chuong).toBe(false); // trong 20 s, cooldown
    expect(r2.alerts[0].rung).toBe(false); // rung cũng nén 30 s
    const ix2 = indexOf([wreck("p", 1.8, -1.2), wreck("q", 1.8, 1.2), wreck("r", 0.9, 0)]);
    const r3 = evaluateNavHazards(r2.state, baseInput({ ix: ix2, nowMs: 10_000 }));
    expect(r3.alerts[0].muc).toBe("do");
    expect(r3.alerts[0].chuong).toBe(true); // đỏ mới miễn cooldown
    expect(r3.alerts[0].rung).toBe(true);
    expect(NAV_CHIME_COOLDOWN_MS).toBe(20_000);
  });
  it("ranh giới ≤6 hl đang kêu chuông riêng → câu vàng ở đây không chuông, đỏ vẫn chuông", () => {
    const ix = indexOf([wreck("p", 2.4, 0)]);
    const r = evaluateNavHazards(initNavHazardState(), baseInput({ ix, borderNm: 4 }));
    expect(r.alerts[0].muc).toBe("vang");
    expect(r.alerts[0].chuong).toBe(false);
    const ix2 = indexOf([wreck("q", 0.8, 0)]);
    const r2 = evaluateNavHazards(initNavHazardState(), baseInput({ ix: ix2, borderNm: 4 }));
    expect(r2.alerts[0].muc).toBe("do");
    expect(r2.alerts[0].chuong).toBe(true);
  });
  it("quên vật sau 30 phút → quay lại được nhắc lại", () => {
    const ix = indexOf([wreck("w", 1.5, 0)]);
    const r1 = evaluateNavHazards(initNavHazardState(), baseInput({ ix, speedKmh: null }));
    expect(r1.alerts).toHaveLength(1);
    const r2 = evaluateNavHazards(r1.state, baseInput({ ix, speedKmh: 13, nowMs: 60_000 }));
    expect(r2.alerts).toHaveLength(0);
    const r3 = evaluateNavHazards(r2.state, baseInput({ ix, speedKmh: 13, nowMs: 31 * 60_000 }));
    expect(r3.alerts).toHaveLength(1);
  });
});

// ── hiệu năng ───────────────────────────────────────────────────────────
describe("hiệu năng: ≤2 ms trung bình mỗi fix", () => {
  it("1.000 fix với 3.000 vật + nón độ sâu + 20 vùng cấm", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const items: HazardLike[] = [];
    for (let i = 0; i < 3000; i++) items.push(wreck(`h${i}`, rnd() * 60 - 10, rnd() * 60 - 30));
    const ix = indexOf(items);
    const noGo: NoGoLike[] = [];
    for (let i = 0; i < 20; i++) {
      const n0 = rnd() * 40;
      const e0 = rnd() * 40 - 20;
      const a = at(n0, e0);
      const b = at(n0 + 2, e0 + 2);
      noGo.push({
        id: `z${i}`,
        ten: null,
        ring: [[a.lon, a.lat], [b.lon, a.lat], [b.lon, b.lat], [a.lon, b.lat], [a.lon, a.lat]],
        bbox: { latMin: a.lat, latMax: b.lat, lonMin: a.lon, lonMax: b.lon },
      });
    }
    const depthAt = (lat: number, lon: number) => ((Math.floor(lat * 400) + Math.floor(lon * 400)) % 7 === 0 ? 1 : 5);
    let state = initNavHazardState();
    // làm nóng
    for (let i = 0; i < 100; i++) {
      state = evaluateNavHazards(state, baseInput({ ix, noGo, depthAt, pos: at(i * 0.03, 0), nowMs: i * DT_MS, headingDeg: 20 })).state;
    }
    const N = 1000;
    const t0 = performance.now();
    let total = 0;
    for (let i = 0; i < N; i++) {
      const r = evaluateNavHazards(state, baseInput({ ix, noGo, depthAt, pos: at(3 + i * 0.036, (i % 50) * 0.01), nowMs: (100 + i) * DT_MS, headingDeg: 20 + (i % 90) }));
      state = r.state;
      total += r.alerts.length;
    }
    const avg = (performance.now() - t0) / N;
    console.log(`nav-hazards bench: ${avg.toFixed(3)} ms/fix, ${total} alert/1000 fix, said=${state.said.size}`);
    expect(avg).toBeLessThanOrEqual(2);
    expect(haversineKm(at(0, 0), at(1, 0))).toBeCloseTo(1, 3);
  });
});
