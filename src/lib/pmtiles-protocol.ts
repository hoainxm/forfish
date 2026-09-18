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
// BẢN MÃ (2026-09-16): file .pmtiles phát ra ngoài đã qua data-codec — SDF1
// (hoán vị byte, 4 byte header) cho nền/rạn miễn phí, SDF2 (AES-CTR, 29 byte
// header, khoá theo tài khoản) cho kho biên tập như chất đáy. Thư viện pmtiles
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

/** Đăng ký một lần. Gọi lại nhiều lần vô hại. */
export function registerPmtilesProtocol(): void {
  if (registered || typeof window === "undefined") return;
  try {
    const protocol = new Protocol();
    // Kho nào chưa có thì tạo với nguồn giải mã TRƯỚC khi thư viện tự tạo
    // `new PMTiles(url)` (FetchSource trần — đọc bản mã ra rác).
    maplibregl.addProtocol("pmtiles", (params, abortController) => {
      const key = archiveKey(params.url);
      if (key && !protocol.get(key)) {
        protocol.add(new PMTiles(new DecodingSource(new FetchSource(key))));
      }
      return protocol.tile(params, abortController);
    });
    registered = true;
  } catch {
    /* trùng đăng ký / môi trường thiếu — bỏ qua, nền rơi về fallback vn-coast */
  }
}
