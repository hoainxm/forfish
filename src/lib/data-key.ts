// KHOÁ GIẢI FILE DỮ LIỆU SDF2 PHÍA MÁY KHÁCH (2026-09-16).
//
// Khoá KHÔNG nằm trong bundle. Tài khoản đã đăng nhập xin ở `/api/data-key`
// (gửi chuỗi thiết bị qua `tokenHeader()`), cất vào `forfish.datakey.v1` để
// ngoài biển mất sóng vẫn giải được file trong kho SW. Giữ tối đa 3 khoá theo
// id — đổi khoá lúc phát hành thì máy còn giữ khoá cũ cho file cũ.
//
// OFFLINE: không có khoá trong máy + mất sóng ⇒ CẢ BẢN ĐỒ vắng — từ 2026-10-02
// nền .pmtiles/bờ/đảo/rạn cũng là SDF2 (chỉ trạm triều còn SDF1). Nên khoá phải
// vào máy SỚM: `refreshDataKeyOnce()` chạy lúc nạp app / vừa đăng nhập / có sóng
// lại (sw-register), vỏ bản đồ gọi thêm `prefetchDataKey()`. Mọi lỗi mạng đều
// nuốt thành null, KHÔNG BAO GIỜ ném.

import { readToken, tokenHeader } from "@/lib/device-token-store";
import { timeoutSignal } from "@/lib/abort";
import { bytesOfHex } from "@/lib/data-codec.mjs";
import { importAesKey, keyIdOf } from "@/lib/data-crypt";

/** Quy ước khoá forfish.* (xem docs/app-map/ops/state-registry.md) */
export const DATA_KEY_STORE = "forfish.datakey.v1";
export const DATA_KEY_ROUTE = "/api/data-key";
const KEEP = 3;

type Store = Record<string, string>; // keyId → hex 64

function readStore(): Store {
  try {
    const raw = window.localStorage.getItem(DATA_KEY_STORE);
    const j = raw ? (JSON.parse(raw) as unknown) : null;
    if (!j || typeof j !== "object") return {};
    const out: Store = {};
    for (const [id, hex] of Object.entries(j as Record<string, unknown>)) {
      if (/^[0-9a-f]{16}$/.test(id) && typeof hex === "string" && /^[0-9a-f]{64}$/.test(hex)) out[id] = hex;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStore(s: Store): void {
  try {
    const ids = Object.keys(s).slice(-KEEP);
    const trimmed: Store = {};
    for (const id of ids) trimmed[id] = s[id];
    window.localStorage.setItem(DATA_KEY_STORE, JSON.stringify(trimmed));
  } catch {
    /* kho đầy / chặn — khoá vẫn còn trong RAM phiên này */
  }
}

let inflight: Promise<{ id: string; hex: string } | null> | null = null;

/** Xin khoá hiện hành từ server. Một lượt mạng cho mọi chỗ gọi cùng lúc. Không ném. */
export function fetchDataKey(): Promise<{ id: string; hex: string } | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const r = await fetch(DATA_KEY_ROUTE, {
        headers: { ...tokenHeader() },
        cache: "no-store",
        signal: timeoutSignal(15000),
      });
      if (!r.ok) return null;
      const j = (await r.json()) as {
        ok?: boolean;
        id?: unknown;
        key?: unknown;
        keys?: unknown;
      };
      if (!j?.ok) return null;
      // Server trả [hiện hành, trước đó] (2026-09-17) — cất cả để file mã bằng
      // khoá cũ vẫn đọc được sau khi admin đổi khoá. Bản cũ chỉ có id/key.
      const list = Array.isArray(j.keys) ? j.keys : [{ id: j.id, key: j.key }];
      const s = readStore();
      let first: { id: string; hex: string } | null = null;
      for (const e of list as Array<{ id?: unknown; key?: unknown }>) {
        if (typeof e?.id !== "string" || typeof e?.key !== "string") continue;
        const raw = bytesOfHex(e.key);
        if (!raw || raw.length !== 32 || !/^[0-9a-f]{16}$/.test(e.id)) continue;
        // Không tin id server nói suông: id phải là băm của chính khoá.
        if ((await keyIdOf(raw)) !== e.id) continue;
        s[e.id] = e.key;
        if (!first) first = { id: e.id, hex: e.key };
      }
      if (!first) return null;
      writeStore(s);
      return first;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

const mem = new Map<string, Promise<CryptoKey | null>>();

/** Khoá cho `keyId`: RAM → kho máy → server. Không có ⇒ null (không ném). */
export function getDataKey(keyId: string): Promise<CryptoKey | null> {
  let p = mem.get(keyId);
  if (p) return p;
  p = (async () => {
    let hex = readStore()[keyId];
    if (!hex) {
      const got = await fetchDataKey();
      // Đọc lại kho: server trả [hiện hành, trước đó] — file mã bằng khoá TRƯỚC
      // (máy chưa kịp tải bản mới sau khi admin đổi khoá) cũng phải mở được.
      hex = readStore()[keyId] ?? (got?.id === keyId ? got.hex : undefined);
    }
    const raw = hex ? bytesOfHex(hex) : null;
    if (!raw) {
      mem.delete(keyId); // lần sau thử lại — mất sóng không khoá vĩnh viễn
      return null;
    }
    try {
      return await importAesKey(raw);
    } catch {
      mem.delete(keyId);
      return null;
    }
  })();
  mem.set(keyId, p);
  return p;
}

/** Gọi khi mở bản đồ có sóng: kho trống thì xin sẵn, để offline sau vẫn giải được. */
export function prefetchDataKey(): void {
  if (typeof window === "undefined") return;
  if (Object.keys(readStore()).length > 0) return;
  void fetchDataKey();
}

let refreshed = false;

/**
 * Xin lại khoá MỘT lần mỗi lần nạp app (kể cả khi kho đã có): admin đổi khoá rồi
 * deploy thì SW tải file mã bằng khoá MỚI ngầm, máy chưa mở bản đồ lúc có sóng
 * mà ra khơi là mất cả nền. Chỉ chạy khi có tài khoản và có sóng; hỏng thì lần
 * gọi sau (đăng nhập / có sóng lại) thử tiếp. Không ném.
 */
export function refreshDataKeyOnce(): void {
  if (refreshed || typeof window === "undefined") return;
  if (!readToken()) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  refreshed = true;
  void fetchDataKey().then((r) => {
    if (!r) refreshed = false;
  });
}

/** Cho test: xoá đệm RAM. */
export function __resetDataKeyCacheForTest(): void {
  mem.clear();
  inflight = null;
  refreshed = false;
}
