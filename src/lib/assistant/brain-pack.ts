"use client";

// TRỢ LÝ — GÓI NÃO TRONG MÁY (ADR 0010 P1; contract docs/contracts/tro-ly-brain-pack.contract.md).
//
// Gói phát theo BẢN DEPLOY ở `/tro-ly/*` (chủ dự án 2026-09-30: "local thôi" —
// không Supabase Storage). App tải vào kho RIÊNG `sdfish-tro-ly-v1` (SW giữ kho
// này khi bump vỏ và để `/tro-ly/*` đi thẳng mạng — public/sw.js).
//
// Luật đổi khối: tải ĐỦ mọi file trong manifest + sha256 KHỚP HẾT mới ghi con trỏ
// `__hien-tai` sang bản mới. Hỏng giữa chừng → con trỏ cũ giữ nguyên, gói cũ chạy
// tiếp. File lưu theo khoá `…?sha=<băm>` (bất biến) nên file không đổi giữa hai
// bản không phải tải lại.
//
// Offline (CLAUDE.md 🟡): (a) KHÔNG request lúc mở app — chỉ kiểm khi mở trợ lý
// (≥6 giờ/lần) và sau lượt tải-trước-chuyến có sóng, luôn có đồng hồ + `.catch`;
// (b) SW chỉ thêm 2 dòng giữ/bỏ qua, không đụng SHELL; (c) đổi nguyên khối, không
// xoá gì của bà con; (d) `loadBrain` đọc thẳng kho trong máy, không cần sóng.

import { timeoutSignal } from "@/lib/abort";
import {
  buildAudioMap, buildKnowledgeIndex, parseAnswers, parseKnowledge, PACK_PATH_RE, speakKey,
  type KnowledgeIndex, type VoiceRegion,
} from "./brain";

export const BRAIN_CACHE = "sdfish-tro-ly-v1";
const BASE = "/tro-ly/";
const POINTER = `${BASE}__hien-tai`;
/** Phiên bản BỘ ĐỌC gói — so với `manifest.minAppVersion` (contract §van một chiều). */
export const BRAIN_READER_VERSION = "1.0.0";
/** Nhịp kiểm gói mới (khớp nhịp tải-trước-chuyến). */
export const BRAIN_CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const MANIFEST_TIMEOUT_MS = 8_000;
const FILE_TIMEOUT_MS = 30_000;

export interface PackFile {
  path: string;
  sha256: string;
  bytes: number;
}
export interface PackManifest {
  version: string;
  createdAt: string;
  minAppVersion: string;
  files: PackFile[];
  notes?: string;
}
interface Pointer {
  manifest: PackManifest;
  checkedAt: number;
}

/** "1.10.0" so với "1.9.3" theo từng số (không so chuỗi). */
export function semverAtLeast(have: string, need: string): boolean {
  const a = have.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const b = need.split(".").map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}

/** Manifest đúng khuôn contract; sai một chỗ → `null` (không đổi gói). */
export function parseManifest(json: unknown): PackManifest | null {
  const m = json as Record<string, unknown> | null;
  if (!m || typeof m !== "object") return null;
  if (typeof m.version !== "string" || !m.version) return null;
  if (typeof m.minAppVersion !== "string") return null;
  if (!Array.isArray(m.files)) return null;
  const files: PackFile[] = [];
  const seen = new Set<string>();
  for (const f of m.files as Record<string, unknown>[]) {
    const path = f?.path;
    const sha = f?.sha256;
    const bytes = f?.bytes;
    if (typeof path !== "string" || !PACK_PATH_RE.test(path) || seen.has(path)) return null;
    if (typeof sha !== "string" || !/^[0-9a-f]{64}$/.test(sha)) return null;
    if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return null;
    seen.add(path);
    files.push({ path, sha256: sha, bytes });
  }
  return {
    version: m.version,
    createdAt: typeof m.createdAt === "string" ? m.createdAt : "",
    minAppVersion: m.minAppVersion,
    files,
    ...(typeof m.notes === "string" ? { notes: m.notes } : {}),
  };
}

const fileKey = (f: PackFile) => `${BASE}${f.path}?sha=${f.sha256}`;

function supported(): boolean {
  return typeof window !== "undefined" && "caches" in window && !!globalThis.crypto?.subtle;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function readPointer(cache: Cache): Promise<Pointer | null> {
  try {
    const r = await cache.match(POINTER);
    if (!r) return null;
    const p = (await r.json()) as Pointer;
    const manifest = parseManifest(p?.manifest);
    return manifest ? { manifest, checkedAt: Number(p.checkedAt) || 0 } : null;
  } catch {
    return null;
  }
}

async function writePointer(cache: Cache, p: Pointer): Promise<void> {
  await cache.put(POINTER, new Response(JSON.stringify(p), { headers: { "content-type": "application/json" } }));
}

export type RefreshResult = "moi" | "giu" | "chua-toi-gio" | "loi" | "app-cu" | "khong-ho-tro";

/**
 * Kiểm + tải gói mới. Không ném. `force` bỏ qua nhịp 6 giờ (lượt tải-trước-chuyến).
 * Chỉ gọi khi CÓ SÓNG — mọi request có đồng hồ riêng.
 */
export async function refreshBrainPack(opts: { force?: boolean; now?: number } = {}): Promise<RefreshResult> {
  if (!supported()) return "khong-ho-tro";
  const now = opts.now ?? Date.now();
  try {
    const cache = await caches.open(BRAIN_CACHE);
    const cur = await readPointer(cache);
    if (!opts.force && cur && now - cur.checkedAt < BRAIN_CHECK_EVERY_MS) return "chua-toi-gio";

    const res = await fetch(`${BASE}manifest.json`, { cache: "no-store", signal: timeoutSignal(MANIFEST_TIMEOUT_MS) });
    if (!res.ok) return "loi";
    const manifest = parseManifest(await res.json());
    if (!manifest) return "loi";
    if (!semverAtLeast(BRAIN_READER_VERSION, manifest.minAppVersion)) return "app-cu";
    if (cur && cur.manifest.version === manifest.version) {
      await writePointer(cache, { manifest: cur.manifest, checkedAt: now });
      return "giu";
    }

    // tải đủ + kiểm đủ TRƯỚC khi ghi bất cứ thứ gì
    const fresh: { f: PackFile; body: ArrayBuffer; type: string }[] = [];
    for (const f of manifest.files) {
      if (await cache.match(fileKey(f))) continue; // cùng sha = đã có, bất biến
      const r = await fetch(`${BASE}${f.path}?v=${encodeURIComponent(manifest.version)}`, {
        cache: "no-store",
        signal: timeoutSignal(FILE_TIMEOUT_MS),
      });
      if (!r.ok) return "loi";
      const body = await r.arrayBuffer();
      if ((await sha256Hex(body)) !== f.sha256) return "loi";
      fresh.push({ f, body, type: r.headers.get("content-type") ?? "application/octet-stream" });
    }
    for (const x of fresh) {
      await cache.put(fileKey(x.f), new Response(x.body, { headers: { "content-type": x.type } }));
    }
    await writePointer(cache, { manifest, checkedAt: now });
    loaded = null; // lần hỏi sau nạp bản mới

    // dọn file không còn trong bản hiện hành (bản cũ đã được thay trọn)
    const keep = new Set(manifest.files.map((f) => new URL(fileKey(f), location.origin).href));
    keep.add(new URL(POINTER, location.origin).href);
    for (const req of await cache.keys()) {
      if (!keep.has(req.url)) await cache.delete(req);
    }
    return "moi";
  } catch {
    return "loi";
  }
}

/* ───────────────── nạp gói đang dùng (không cần sóng) ───────────────── */

export interface LoadedBrain {
  version: string;
  knowledge: KnowledgeIndex;
  knowledgeCount: number;
  /** khoá câu đọc → blob URL mp3 theo vùng giọng */
  audio: Map<string, { bac?: string; nam?: string }>;
}

let loaded: Promise<LoadedBrain | null> | null = null;

async function readJson(cache: Cache, f: PackFile | undefined): Promise<unknown> {
  if (!f) return null;
  const r = await cache.match(fileKey(f));
  return r ? r.json() : null;
}

async function load(): Promise<LoadedBrain | null> {
  if (!supported()) return null;
  try {
    const cache = await caches.open(BRAIN_CACHE);
    const cur = await readPointer(cache);
    if (!cur) return null;
    const byPath = new Map(cur.manifest.files.map((f) => [f.path, f]));
    const items = parseKnowledge(await readJson(cache, byPath.get("brain/knowledge.v1.json")).catch(() => null));
    const answers = parseAnswers(await readJson(cache, byPath.get("brain/answers.v1.json")).catch(() => null));
    const audio = new Map<string, { bac?: string; nam?: string }>();
    for (const [key, paths] of buildAudioMap(answers)) {
      const urls: { bac?: string; nam?: string } = {};
      for (const r of ["bac", "nam"] as const) {
        const f = paths[r] ? byPath.get(paths[r]!) : undefined;
        const hit = f ? await cache.match(fileKey(f)) : undefined;
        if (hit) urls[r] = URL.createObjectURL(await hit.blob());
      }
      if (urls.bac || urls.nam) audio.set(key, urls);
    }
    return { version: cur.manifest.version, knowledge: buildKnowledgeIndex(items), knowledgeCount: items.length, audio };
  } catch {
    return null;
  }
}

/** Gói đang dùng, nạp MỘT lần mỗi phiên (đổi gói thì nạp lại). `null` = chưa có gói → hành vi cũ. */
export function loadBrain(): Promise<LoadedBrain | null> {
  if (!loaded) {
    loaded = load();
    // nạp hỏng thì lần sau thử lại, không kẹt `null` cả phiên
    void loaded.then((b) => {
      if (!b) loaded = null;
    });
  }
  return loaded;
}

/** mp3 giọng Sen Biển cho đúng câu này (vùng chọn trước, thiếu thì lấy giọng kia). */
export function audioUrlFor(b: LoadedBrain | null, text: string, region: VoiceRegion): string | null {
  const hit = b?.audio.get(speakKey(text));
  if (!hit) return null;
  return (region === "nam" ? hit.nam ?? hit.bac : hit.bac ?? hit.nam) ?? null;
}
