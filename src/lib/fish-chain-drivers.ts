// ĐẦU VÀO của lớp chuỗi thức ăn (fish-chain.ts) — CHỈ server (cron refresh-fish và route /api/fish-forecast khi tính
// live). Mọi lời gọi mạng có đồng hồ chặn và đường lùi: hỏng ⇒ giá trị dự phòng trong thông số hoặc null, KHÔNG BAO
// GIỜ làm hỏng bản đồ cá (lớp này chỉ cộng thêm; thiếu đầu vào ⇒ góp 0).
//   ONI  — CPC oni.ascii.txt (công thuộc Mỹ)            · PDO — NCEI ERSSTv5 pdo.dat (công thuộc Mỹ)
//   Luzon — CMEMS SEALEVEL NRT ADT 0,125° (Zarr ẩn danh, Copernicus: dùng tự do, ghi nguồn) — 1 khối ~1 MB/ngày
//   Hộp phù du/nhiệt — từ CHÍNH lưới SST/phù du cron cá vừa tải (không gọi thêm mạng)
// Nguồn + giấy phép: docs/research/du-bao-ca-dong-dan-2026-10/11-so-nguon.md; dịch vụ ngoài: ops/external-services.md.
import "server-only";
import { timeoutSignal } from "@/lib/abort";
import { decodeTypedChunk, readZarrArrayMeta, readZarrAttr, parseCfTimeUnits, cfTimeToMs, nearestIndex } from "@/lib/copernicus";
import { CHAIN_BOXES, moonFracAt, parseOni, parsePdo, type ChainBox, type ChainDrivers, type ChainParams } from "@/lib/fish-chain";

export const ONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt";
export const PDO_URL = "https://www.ncei.noaa.gov/pub/data/cmb/ersst/v5/index/ersst.v5.pdo.dat";
export const LUZON_ZARR =
  "https://s3.waw3-1.cloudferro.com/mdl-arco-geo-045/arco/SEALEVEL_GLO_PHY_L4_NRT_008_046/cmems_obs-sl_glo_phy-ssh_nrt_allsat-l4-duacs-0.125deg_P1D_202506/geoChunked.zarr";
/** hai điểm hai bờ eo Luzon (cùng vĩ độ): bờ Thái Bình Dương − bờ Biển Đông */
export const LUZON_POINTS = { tbd: [20.5, 122.5], bd: [20.5, 119.5] } as const;
const TIMEOUT_MS = 8000;

async function getText(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: timeoutSignal(TIMEOUT_MS), cache: "no-store" });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}
async function getBytes(url: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url, { signal: timeoutSignal(TIMEOUT_MS), cache: "no-store" });
    return r.ok ? new Uint8Array(await r.arrayBuffer()) : null; // 403 = khối trống ở kho ARCO
  } catch {
    return null;
  }
}

/** ΔADT (m) giữa hai bờ eo Luzon ở ngày gần nhất có số; null khi kho không trả. */
export async function fetchLuzonAdt(): Promise<{ dAdt: number | null; ngay: string | null }> {
  const none = { dAdt: null, ngay: null };
  try {
    const zb = await getBytes(`${LUZON_ZARR}/.zmetadata`);
    if (!zb) return none;
    const zmeta = JSON.parse(new TextDecoder().decode(zb));
    const adt = readZarrArrayMeta(zmeta, "adt"), tm = readZarrArrayMeta(zmeta, "time");
    const la = readZarrArrayMeta(zmeta, "latitude"), lo = readZarrArrayMeta(zmeta, "longitude");
    const units = parseCfTimeUnits(String(readZarrAttr(zmeta, "time", "units") ?? ""));
    const scale = Number(readZarrAttr(zmeta, "adt", "scale_factor") ?? 1);
    if (!adt || !tm || !la || !lo || !units) return none;
    const axis = async (name: string, m: { shape: number[]; chunks: number[]; dtype: string }) => {
      const out: number[] = [];
      for (let k = 0; k * m.chunks[0] < m.shape[0]; k++) {
        const b = await getBytes(`${LUZON_ZARR}/${name}/${k}`);
        if (!b) return null;
        out.push(...decodeTypedChunk(b, m.dtype).slice(0, Math.min(m.chunks[0], m.shape[0] - k * m.chunks[0])));
      }
      return out;
    };
    const [lats, lons, times] = await Promise.all([axis("latitude", la), axis("longitude", lo), axis("time", tm)]);
    if (!lats || !lons || !times) return none;
    const [ct, cy, cx] = adt.chunks;
    const pts = Object.values(LUZON_POINTS).map(([y, x]) => ({ iy: nearestIndex(lats, y), ix: nearestIndex(lons, x) }));
    // khối thời gian cuối có thể đệm NaN ở đuôi ⇒ lùi tới ngày cuối có số ở CẢ HAI điểm
    let tLast = times.length - 1;
    while (tLast >= 0 && !Number.isFinite(times[tLast])) tLast--;
    for (let tc = Math.floor(tLast / ct); tc >= Math.max(0, Math.floor(tLast / ct) - 1); tc--) {
      const chunks = await Promise.all(pts.map((p) => getBytes(`${LUZON_ZARR}/adt/${tc}.${Math.floor(p.iy / cy)}.${Math.floor(p.ix / cx)}`)));
      if (chunks.some((c) => !c)) continue;
      const vals = chunks.map((c) => decodeTypedChunk(c as Uint8Array, adt.dtype));
      for (let t = Math.min(ct - 1, tLast - tc * ct); t >= 0; t--) {
        const v = pts.map((p, k) => vals[k][t * cy * cx + (p.iy % cy) * cx + (p.ix % cx)]);
        if (v.every((x) => Number.isFinite(x) && x !== adt.fillValue)) {
          const ngay = new Date(cfTimeToMs(times[tc * ct + t], units)).toISOString().slice(0, 10);
          return { dAdt: Math.round((v[0] - v[1]) * scale * 10000) / 10000, ngay };
        }
      }
    }
    return none;
  } catch {
    return none;
  }
}

/** Lưới đơn giản (cùng dạng ScalarGrid của fish-predict) — chỉ phần cần để lấy trung bình hộp. */
export interface MeanGrid {
  lats: number[];
  lons: number[];
  values: number[][];
}
/** Trung bình theo hộp (bỏ NaN); `f` đổi giá trị trước khi lấy trung bình (vd log10 cho phù du). */
export function boxMeans(g: MeanGrid | null | undefined, p: Pick<ChainParams, "hop">, f: (v: number) => number = (v) => v): Partial<Record<ChainBox, number | null>> {
  const out: Partial<Record<ChainBox, number | null>> = {};
  for (const b of CHAIN_BOXES) {
    if (!g) { out[b] = null; continue; }
    const [la0, la1, lo0, lo1] = p.hop[b];
    let s = 0, n = 0;
    g.lats.forEach((la, i) => {
      if (la < la0 || la > la1) return;
      g.lons.forEach((lo, j) => {
        if (lo < lo0 || lo > lo1) return;
        const v = g.values[i]?.[j];
        if (v != null && Number.isFinite(v)) { const x = f(v); if (Number.isFinite(x)) { s += x; n++; } }
      });
    });
    out[b] = n >= 4 ? Math.round((s / n) * 10000) / 10000 : null;
  }
  return out;
}

/** Phần đầu vào cần mạng (chạy SONG SONG với các nguồn khác của cron cá). */
export async function fetchChainExternal(): Promise<{ oniText: string | null; pdoText: string | null; luzon: { dAdt: number | null; ngay: string | null } }> {
  const [oniText, pdoText, luzon] = await Promise.all([getText(ONI_URL), getText(PDO_URL), fetchLuzonAdt()]);
  return { oniText, pdoText, luzon };
}

/** Ráp đầu vào một ngày. Thiếu mạng ⇒ dùng `duPhong` trong thông số (ghi rõ nguồn), không bao giờ ném. */
export function assembleDrivers(
  date: string,
  ext: Awaited<ReturnType<typeof fetchChainExternal>> | null,
  grids: { sst?: MeanGrid | null; chl?: MeanGrid | null },
  p: ChainParams,
): ChainDrivers {
  const year = Number(date.slice(0, 4));
  const oniP = ext?.oniText ? parseOni(ext.oniText, year) : null;
  const pdoP = ext?.pdoText ? parsePdo(ext.pdoText) : null;
  const sst = boxMeans(grids.sst, p), chl = boxMeans(grids.chl, p, (v) => (v > 0 ? Math.log10(v) : NaN));
  const hop: ChainDrivers["hop"] = {};
  for (const b of CHAIN_BOXES) hop[b] = { chlLog: chl[b] ?? null, sst: sst[b] ?? null };
  return {
    date,
    moonFrac: moonFracAt(date),
    oni: oniP?.gannhat != null
      ? { gannhat: oniP.gannhat, muaGanNhat: oniP.muaGanNhat, djf: oniP.djf, nguon: "cpc" }
      : { gannhat: p.duPhong.oni.giaTri, muaGanNhat: `${p.duPhong.oni.mua} ${p.duPhong.oni.nam}`, djf: null, nguon: "du-phong" },
    pdo: pdoP?.giaTri != null
      ? { giaTri: pdoP.giaTri, thang: pdoP.thang, nguon: "ncei" }
      : { giaTri: p.duPhong.pdo.giaTri, thang: p.duPhong.pdo.thang, nguon: "du-phong" },
    luzon: ext?.luzon ?? { dAdt: null, ngay: null },
    hop,
  };
}
