// KHO Ô BẢN ĐỒ PHÍA MÁY CHỦ (2026-11-04) — cho /api/tiles/{chart,seamark,sst,chlorophyll}.
//
// Vì sao: trước đây route chỉ CHUYỂN TIẾP từng ô sống. Prod chạy IIS (sdfish.sdvico.vn), không CDN, nên
// `s-maxage` vô tác dụng: mỗi lượt kéo bản đồ của mỗi người đều gọi thẳng ra EMODnet/OpenSeaMap/NASA. Nguồn
// chậm hay sập là cả làng mất lớp đó.
//
// CHỖ LƯU = ĐĨA CỦA CHÍNH MÁY CHỦ (không Supabase Storage, không Blob) — luật CLAUDE.md "dữ liệu đi theo
// deployment": Storage tính băng thông ra (egress) theo từng lượt tải ⇒ mỗi ô bà con kéo thành một khoản đo đếm,
// lại phải tạo bucket + policy (cờ đỏ). Đĩa thì miễn phí, nhanh, nhưng:
//   · IIS (một tiến trình, đĩa bền): TỰ CHỌN `<DEPLOY_BASE>\shared\kho-o` — cạnh `current`, ngoài vùng robocopy /MIR
//     của mỗi lần deploy (xoá mọi thứ trong `current` không có trong bản build). Không cần env (anh Long 2026-11-04:
//     "đưa vào quản trị rồi tự chạy cần gì lên env").
//   · Vercel / máy dev: thư mục tạm hệ điều hành; Vercel mỗi instance một kho, mất khi tắt ⇒ chỉ là kho ấm.
// Trần ngăn `song` đặt ở /quan-tri › Cấu hình (`app_config.kho_o_tran_mb`); thẻ "Kho ô bản đồ" ở tab Hệ thống
// xem số ô / dung lượng / lần máy nhà đẩy gần nhất và xoá từng ngăn.
// Ghi hỏng (đĩa đầy, chỉ đọc) ⇒ bỏ qua: kho là bộ đệm, không phải dữ liệu của bà con.
//
// Hai NGĂN cho mỗi ô:
//   · `song`    — máy chủ tự tải từ nguồn khi trượt kho.
//   · `may-nha` — gpu-desktop tải trước vùng biển VN (ảnh GỐC của nguồn, không sửa byte) rồi đẩy lên (/api/o-ban-do/nhap).
// Thứ tự phát (chonTuKho + route): ô kho còn tươi (may-nha thắng nếu cả hai tươi — máy nhà đã dò đủ ngày cho cả vùng)
//   → nguồn trực tiếp (ghi vào ngăn `song`) → nguồn hỏng: ô kho cũ, mới nhất trước (may-nha/song) → 503.

import { existsSync } from "node:fs";
import { access, mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { laPng } from "@/lib/o-ban-do-nguon.mjs";
import { TILE_PROXY, upstreamTileUrl, type TileProxySource } from "@/lib/tile-proxy";

export type NganKho = "song" | "may-nha";
export const NGAN_KHO: readonly NganKho[] = ["may-nha", "song"];

export type OKho = { ngan: NganKho; buf: Uint8Array; ctype: string; luc: number };

/**
 * CHỌN THƯ MỤC KHO (thuần, có test). Deploy IIS chạy `node server.js` trong `<base>\current` và có `<base>\shared`
 * (chứa .env.production) ⇒ kho ở `<base>\shared\kho-o`. Còn lại ⇒ thư mục tạm.
 */
export function chonThuMucKho(cwd: string, coThuMuc: (p: string) => boolean, tam: string): string {
  const base = path.dirname(cwd);
  if (path.basename(cwd).toLowerCase() === "current" && coThuMuc(path.join(base, "shared"))) {
    return path.join(base, "shared", "kho-o");
  }
  return path.join(tam, "sdfish-kho-o");
}

/*  `turbopackIgnore` ở mọi lệnh đĩa/đường dẫn của kho (2026-11-05): đường dẫn kho DỰNG LÚC CHẠY từ `process.cwd()`
    (lên cả thư mục CHA để tìm `<base>\shared`). Thiếu chú thích, Turbopack không đoán được file nào ⇒ gom CẢ dự án
    lẫn thư mục cha (`.git`, node_modules) vào `.next/standalone` ⇒ runner IIS hết đĩa (ENOSPC), deploy aaf303dc +
    683edd74 hỏng. Kho là dữ liệu lúc chạy, không phải mã — không file nào ở đây cần đi theo gói deploy. */
export function thuMucKho(): string {
  return chonThuMucKho(/*turbopackIgnore: true*/ process.cwd(), existsSync, tmpdir());
}

/** Trần mặc định ngăn `song` khi /quan-tri chưa đặt `kho_o_tran_mb`. */
export const TRAN_KHO_MB_MAC_DINH = 2048;

/** Trần ngăn `song` (byte) từ ô cấu hình — rỗng/sai ⇒ mặc định. Ngăn `may-nha` tự giới hạn theo hộp biển VN. */
export function tranKhoBytes(oCauHinh: string | null | undefined): number {
  const mb = Number.parseInt(oCauHinh ?? "", 10);
  return (Number.isFinite(mb) && mb > 0 ? mb : TRAN_KHO_MB_MAC_DINH) * 1024 * 1024;
}

/** Chỉ cất ảnh PNG/JPEG — tên file theo đuôi, khỏi lưu kèm metadata. */
export function duoiAnh(ctype: string): "png" | "jpg" | null {
  const t = ctype.split(";")[0].trim().toLowerCase();
  return t === "image/png" ? "png" : t === "image/jpeg" ? "jpg" : null;
}

function duongO(ngan: NganKho, src: TileProxySource, z: number, x: number, y: number, duoi: string): string {
  return path.join(/*turbopackIgnore: true*/ thuMucKho(), ngan, src, String(z), String(x), `${y}.${duoi}`);
}

/**
 * LUẬT CHỌN (thuần, có test). `tuoi` = ô phát ngay không hỏi nguồn; `duPhong` = ô kho cũ dùng khi nguồn hỏng,
 * mới nhất trước. Ngăn `may-nha` có hạn riêng (mayNhaMs; 0 = nguồn này máy nhà không đẩy ⇒ không bao giờ tươi).
 */
export function chonTuKho(
  src: TileProxySource,
  o: OKho[],
  now: number,
): { tuoi: OKho | null; duPhong: OKho[] } {
  const def = TILE_PROXY[src];
  const han = (k: OKho) => (k.ngan === "may-nha" ? def.mayNhaMs : def.khoMs);
  const conTuoi = (k: OKho) => han(k) > 0 && now - k.luc >= -60_000 && now - k.luc < han(k);
  const tuoi = o.find((k) => k.ngan === "may-nha" && conTuoi(k)) ?? o.find((k) => k.ngan === "song" && conTuoi(k)) ?? null;
  const duPhong = o.filter((k) => k !== tuoi).sort((a, b) => b.luc - a.luc);
  return { tuoi, duPhong };
}

/** Đọc mọi ngăn của một ô. Không có / đọc hỏng ⇒ bỏ qua ngăn đó. */
export async function docKhoO(src: TileProxySource, z: number, x: number, y: number): Promise<OKho[]> {
  const out: OKho[] = [];
  for (const ngan of NGAN_KHO) {
    for (const duoi of ["png", "jpg"] as const) {
      const f = duongO(ngan, src, z, x, y, duoi);
      try {
        const [buf, st] = await Promise.all([readFile(/*turbopackIgnore: true*/ f), stat(/*turbopackIgnore: true*/ f)]);
        if (buf.length === 0) continue;
        out.push({ ngan, buf: new Uint8Array(buf), ctype: duoi === "png" ? "image/png" : "image/jpeg", luc: st.mtimeMs });
        break;
      } catch {
        /* chưa có ô này ở ngăn này */
      }
    }
  }
  return out;
}

let soLanGhi = 0;
let dangDon = false;

/** Ghi một ô (ghi file tạm rồi đổi tên ⇒ không bao giờ đọc phải ô ghi dở). Trả false khi không ghi được. */
export async function ghiKhoO(
  ngan: NganKho,
  src: TileProxySource,
  z: number,
  x: number,
  y: number,
  buf: Uint8Array,
  ctype: string,
): Promise<boolean> {
  const duoi = duoiAnh(ctype);
  if (!duoi || buf.length === 0 || !upstreamTileUrl(src, z, x, y)) return false;
  const f = duongO(ngan, src, z, x, y, duoi);
  const tam = `${f}.${process.pid}.${Date.now()}.tmp`;
  try {
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(tam, buf);
    await rename(tam, f);
  } catch (e) {
    console.warn("[kho ô] ghi hỏng", f, (e as Error)?.message);
    await unlink(tam).catch(() => {});
    return false;
  }
  if (ngan === "song" && ++soLanGhi % 500 === 0 && !dangDon) {
    dangDon = true;
    donKhoSong().catch(() => {}).finally(() => (dangDon = false));
  }
  return true;
}

/** Chọn ô cần xoá cho kho dưới trần: cũ nhất trước (thuần, có test). */
export function chonXoa(files: { f: string; size: number; luc: number }[], tran: number): string[] {
  let tong = files.reduce((s, x) => s + x.size, 0);
  if (tong <= tran) return [];
  const xoa: string[] = [];
  for (const x of [...files].sort((a, b) => a.luc - b.luc)) {
    if (tong <= tran * 0.9) break; // xoá dư 10% để khỏi dọn liên tục
    xoa.push(x.f);
    tong -= x.size;
  }
  return xoa;
}

async function donKhoSong(): Promise<void> {
  const goc = path.join(/*turbopackIgnore: true*/ thuMucKho(), "song");
  const files: { f: string; size: number; luc: number }[] = [];
  const di = async (d: string) => {
    for (const e of await readdir(d, { withFileTypes: true }).catch(() => [])) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) await di(f);
      else {
        const st = await stat(f).catch(() => null);
        if (st) files.push({ f, size: st.size, luc: st.mtimeMs });
      }
    }
  };
  await di(goc);
  // nạp muộn: app-config là "server-only" (đọc DB) — chỉ cần mỗi 500 lượt ghi, test không chạm tới
  const { getConfigValue } = await import("@/lib/app-config");
  const tran = tranKhoBytes(await getConfigValue("kho_o_tran_mb").catch(() => null));
  for (const f of chonXoa(files, tran)) await unlink(f).catch(() => {});
}

// ---------- Cho thẻ quản trị (/api/admin/kho-o) ----------

export type ThongKeNgan = { ngan: NganKho; src: TileProxySource; so: number; byte: number; moiNhat: number | null };

/** Đếm ô theo ngăn × lớp. Thư mục chưa có ⇒ 0 ô. */
export async function thongKeKho(): Promise<{ thuMuc: string; ghiDuoc: boolean; nhom: ThongKeNgan[] }> {
  const goc = thuMucKho();
  const nhom: ThongKeNgan[] = [];
  for (const ngan of NGAN_KHO) {
    for (const src of Object.keys(TILE_PROXY) as TileProxySource[]) {
      const tk: ThongKeNgan = { ngan, src, so: 0, byte: 0, moiNhat: null };
      const di = async (d: string) => {
        for (const e of await readdir(d, { withFileTypes: true }).catch(() => [])) {
          const f = path.join(d, e.name);
          if (e.isDirectory()) await di(f);
          else if (!e.name.endsWith(".tmp")) {
            const st = await stat(f).catch(() => null);
            if (!st) continue;
            tk.so++;
            tk.byte += st.size;
            tk.moiNhat = Math.max(tk.moiNhat ?? 0, st.mtimeMs);
          }
        }
      };
      await di(path.join(/*turbopackIgnore: true*/ goc, ngan, src));
      nhom.push(tk);
    }
  }
  let ghiDuoc = true;
  try {
    await mkdir(goc, { recursive: true });
    await access(goc, 2 /* W_OK */);
  } catch {
    ghiDuoc = false;
  }
  return { thuMuc: goc, ghiDuoc, nhom };
}

/** Xoá cả một ngăn (quản trị bấm). Kho là bộ đệm — xoá xong tự đầy lại theo lượt xem / lượt máy nhà đẩy. */
export async function xoaNganKho(ngan: NganKho): Promise<void> {
  await rm(path.join(/*turbopackIgnore: true*/ thuMucKho(), ngan), { recursive: true, force: true });
}

// ---------- Gói máy nhà đẩy lên (/api/o-ban-do/nhap) ----------

export type ONhap = { src: TileProxySource; z: number; x: number; y: number; buf: Uint8Array };

/** Trần một gói: số ô + cỡ một ô — chặn gói rác làm đầy đĩa. */
export const TRAN_O_MOT_GOI = 2000;
export const TRAN_BYTE_MOT_O = 1024 * 1024;

/**
 * Đọc gói `{ o: [{ src, z, x, y, png: base64 }] }` (thuần, có test). Chỉ nhận nguồn máy nhà được đẩy
 * (mayNhaMs > 0), ô hợp lệ, thân đúng PNG, ≤ 1 MB. Ô sai bị đếm vào `loai`, không làm hỏng cả gói.
 * null = thân không đúng khuôn.
 */
export function docGoiO(body: unknown): { o: ONhap[]; loai: number } | null {
  const ds = (body as { o?: unknown } | null)?.o;
  if (!Array.isArray(ds) || ds.length === 0 || ds.length > TRAN_O_MOT_GOI) return null;
  const o: ONhap[] = [];
  let loai = 0;
  for (const it of ds) {
    const { src, z, x, y, png } = (it ?? {}) as Record<string, unknown>;
    if (
      typeof src !== "string" ||
      !(src in TILE_PROXY) ||
      TILE_PROXY[src as TileProxySource].mayNhaMs <= 0 ||
      typeof z !== "number" ||
      typeof x !== "number" ||
      typeof y !== "number" ||
      !upstreamTileUrl(src, z, x, y) ||
      typeof png !== "string" ||
      png.length > Math.ceil((TRAN_BYTE_MOT_O * 4) / 3) + 4
    ) {
      loai++;
      continue;
    }
    const buf = new Uint8Array(Buffer.from(png, "base64"));
    if (!laPng(buf) || buf.length > TRAN_BYTE_MOT_O) {
      loai++;
      continue;
    }
    o.push({ src: src as TileProxySource, z, x, y, buf });
  }
  return { o, loai };
}
