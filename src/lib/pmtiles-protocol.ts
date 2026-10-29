// Đăng ký protocol `pmtiles://` cho MapLibre — để nền bản đồ VECTOR đọc thẳng
// file tĩnh cùng-origin `public/data/vn-basemap.pmtiles` (không key, không host
// ngoài như CARTO). Chạy MỘT LẦN phía client (guard). Import ở vỏ lazy
// `fishing-map.tsx` TRƯỚC khi FishingMapView dựng map.
//
// VÌ SAO PMTiles: CARTO raster nay đòi API key (watermark ~2026-08); PMTiles là
// file tĩnh same-origin → không key, thương mại OK, và SW giữ được (offline).
// VÌ SAO "sạch, không chữ Trung": nền CHỈ lấy hình học (đất/nước/bờ/đường), BỎ
// HẾT nhãn OSM (nơi lọt tên Hải Nam/đảo tranh chấp) — xem buildMapStyle.
//
// BẢN MÃ (2026-09-16; từ 2026-10-02 MỌI .pmtiles kể cả nền/rạn là SDF2 — xem
// OPEN_SDF1 ở scripts/encode-data.mjs): SDF2 = AES-CTR, 29 byte header, khoá
// theo tài khoản; nhánh SDF1 (hoán vị, 4 byte) giữ để đọc kho SW cũ. Thư viện pmtiles
// đọc bằng Range request nên không tải trọn file để giải; `DecodingSource` bọc
// `FetchSource`: dời offset qua header và giải từng lát (hoán vị ngược, hoặc
// CTR nhảy đúng khối). Lát đầu (offset 0) nhìn header để biết file là bản gì —
// không thêm request dò nào.

import maplibregl from "maplibre-gl";
import { FetchSource, PMTiles, Protocol, type Source, type RangeResponse } from "pmtiles";
import {
  DATA_HEADER_LEN,
  DATA_HEADER2_LEN,
  hasDataHeader,
  parseHeader2,
  unsubstitute,
} from "@/lib/data-codec.mjs";
import { aesCtrDecryptAt, type KeyLookup } from "@/lib/data-crypt";
import { getDataKey } from "@/lib/data-key";
import { DATA_PROTOCOL } from "@/lib/data-fetch";

type Mode =
  | { kind: "unknown" }
  | { kind: "plain" }
  | { kind: "sdf1" }
  | { kind: "sdf2"; keyId: string; nonce: Uint8Array };

const asBuf = (u8: Uint8Array): ArrayBuffer => u8.slice().buffer as ArrayBuffer;

/** Nguồn byte cho PMTiles: giải lát cắt theo định dạng file, trả nguyên nếu rõ. */
export class DecodingSource implements Source {
  private mode: Mode = { kind: "unknown" };
  constructor(
    private readonly inner: Source,
    private readonly lookupKey: KeyLookup = getDataKey,
  ) {}

  getKey(): string {
    return this.inner.getKey();
  }

  /** Đọc header ở đầu file rồi chốt chế độ. Trả về số byte header để dời offset. */
  private detect(u8: Uint8Array): number {
    const h2 = parseHeader2(u8);
    if (h2) {
      this.mode = { kind: "sdf2", keyId: h2.keyId, nonce: h2.nonce };
      return DATA_HEADER2_LEN;
    }
    if (hasDataHeader(u8)) {
      this.mode = { kind: "sdf1" };
      return DATA_HEADER_LEN;
    }
    this.mode = { kind: "plain" };
    return 0;
  }

  private headerLen(): number {
    switch (this.mode.kind) {
      case "sdf2":
        return DATA_HEADER2_LEN;
      case "sdf1":
        return DATA_HEADER_LEN;
      default:
        return 0;
    }
  }

  /** Giải một lát THÂN (đã bỏ header) nằm ở `payloadOffset`. */
  private async decodeSlice(u8: Uint8Array, payloadOffset: number): Promise<Uint8Array> {
    const m = this.mode;
    if (m.kind === "sdf1") return unsubstitute(u8);
    if (m.kind === "sdf2") {
      const key = await this.lookupKey(m.keyId);
      if (!key) throw new Error("no_key");
      return aesCtrDecryptAt(key, m.nonce, u8, payloadOffset);
    }
    return u8;
  }

  async getBytes(
    offset: number,
    length: number,
    signal?: AbortSignal,
    etag?: string,
  ): Promise<RangeResponse> {
    if (this.mode.kind === "unknown") {
      if (offset !== 0) {
        // Chưa từng thấy đầu file (không xảy ra với thư viện pmtiles — nó luôn
        // xin header trước — nhưng đừng đoán): dò header một lần.
        const probe = await this.inner.getBytes(0, DATA_HEADER2_LEN, signal, etag);
        this.detect(new Uint8Array(probe.data));
      } else {
        // Xin dư đúng cỡ header lớn nhất để lát đầu không phải xin hai lần.
        const r = await this.inner.getBytes(0, length + DATA_HEADER2_LEN, signal, etag);
        const u8 = new Uint8Array(r.data);
        const h = this.detect(u8);
        const body = u8.subarray(h, h + length);
        return { ...r, data: asBuf(await this.decodeSlice(body, 0)) };
      }
    }
    const h = this.headerLen();
    if (h === 0) return this.inner.getBytes(offset, length, signal, etag);
    const r = await this.inner.getBytes(offset + h, length, signal, etag);
    return { ...r, data: asBuf(await this.decodeSlice(new Uint8Array(r.data), offset)) };
  }
}

/** `pmtiles:///data/x.pmtiles/3/6/3` hay `pmtiles:///data/x.pmtiles` → `/data/x.pmtiles`. */
export function archiveKey(url: string): string | null {
  if (!url.startsWith("pmtiles://")) return null;
  const rest = url.slice("pmtiles://".length);
  const m = /^(.+)\/\d+\/\d+\/\d+$/.exec(rest);
  return m ? m[1] : rest;
}

let registered = false;
let protocol: Protocol | null = null;

const kho = (key: string) => new PMTiles(new DecodingSource(new FetchSource(key)));

/** Đăng ký một lần. Gọi lại nhiều lần vô hại. */
export function registerPmtilesProtocol(): void {
  if (registered || typeof window === "undefined") return;
  try {
    const p = new Protocol();
    protocol = p;
    // Kho nào chưa có thì tạo với nguồn giải mã TRƯỚC khi thư viện tự tạo
    // `new PMTiles(url)` (FetchSource trần — đọc bản mã ra rác).
    maplibregl.addProtocol("pmtiles", (params, abortController) => {
      const key = archiveKey(params.url);
      if (key && !p.get(key)) p.add(kho(key));
      return p.tile(params, abortController);
    });
    registered = true;
  } catch {
    /* trùng đăng ký / môi trường thiếu — bỏ qua, nền rơi về fallback vn-coast */
  }
}

/*  NẠP LẠI LỚP SAU KHI KHOÁ VỀ (nợ 07 §10.3 C, trả 2026-10-29).
    Lớp SDF2 giải hỏng vì máy chưa có khoá thì hỏng LUÔN tới hết phiên: pmtiles cache LỜI HỨA header đã bị từ chối
    (SharedPromiseCache không xoá lời hứa hỏng), MapLibre giữ lát `errored`, nguồn GeoJSON giữ lần nạp lỗi. Khoá về
    (`subscribeDataKeyAdded`) thì vỏ bản đồ: (1) thay kho pmtiles bằng bản MỚI (`lamMoiKhoPmtiles`), (2) gọi lại
    `setUrl`/`setData` cùng đường dẫn cho đúng những nguồn đã báo lỗi — API công khai của MapLibre, `setUrl` nạp lại
    mọi lát kể cả lát lỗi. Không thêm request nào ngoài việc xin lại đúng thứ đã hỏng (SW trả từ kho nếu đã có). */

/** Một nguồn MapLibre cần nạp lại: vector `pmtiles://` (kèm khoá kho) hoặc GeoJSON `sdfdata://`. */
export type NguonNapLai =
  | { id: string; kind: "vector"; url: string; archive: string }
  | { id: string; kind: "geojson"; url: string };

/** Mô tả nguồn đủ để quyết định (lấy từ `map.getSource(id)?.serialize()`). */
type MoTaNguon = { type?: string; url?: unknown; data?: unknown } | undefined;

/**
 * Những nguồn ĐÃ BÁO LỖI mà đọc qua bộ giải mã (pmtiles:// · sdfdata://) — chỉ chúng mới hỏng vì thiếu khoá. Nguồn lỗi
 * khác (ô ảnh vệ tinh, GeoJSON dựng trong máy) bỏ qua: nạp lại chúng không chữa được gì. Thuần, không đụng map.
 */
export function nguonCanNapLai(hong: Iterable<string>, moTa: (id: string) => MoTaNguon): NguonNapLai[] {
  const out: NguonNapLai[] = [];
  const sdf = `${DATA_PROTOCOL}://`;
  for (const id of new Set(hong)) {
    const m = moTa(id);
    if (!m) continue;
    if (m.type === "vector" && typeof m.url === "string") {
      const archive = archiveKey(m.url);
      if (archive) out.push({ id, kind: "vector", url: m.url, archive });
    } else if (m.type === "geojson" && typeof m.data === "string" && m.data.startsWith(sdf)) {
      out.push({ id, kind: "geojson", url: m.data });
    }
  }
  return out;
}

/** Bỏ kho pmtiles cũ (header/thư mục hỏng đang nằm trong cache) — lần xin sau dựng kho mới với bộ giải mã. */
export function lamMoiKhoPmtiles(archives: Iterable<string>): void {
  if (!protocol) return;
  for (const a of new Set(archives)) protocol.add(kho(a));
}
