// Proxy Overpass — lấy điểm nautical (đèn biển / xác tàu / phao / cảng) trong
// bbox. Cache 1 ngày — dữ liệu OSM seamark đổi chậm. Trả JSON gọn.

import { NextResponse } from "next/server";
import { fnv1a64Hex } from "@/lib/market/order-ref";
import {
  fetchNautical,
  type BBox,
  type NauticalKind,
} from "@/lib/nautical-layers";

// Cache qua header Cache-Control + CDN edge (Vercel).

const ALLOWED: NauticalKind[] = ["wreck", "lighthouse", "buoy", "harbour"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") as NauticalKind | null;
  if (!kind || !ALLOWED.includes(kind)) {
    return NextResponse.json(
      { ok: false, code: "bad_kind" },
      { status: 400 },
    );
  }
  // bbox = "minLat,minLng,maxLat,maxLng"; mặc định = vùng biển VN
  const raw = url.searchParams.get("bbox") ?? "6,102,24,118";
  const parts = raw.split(",").map((s) => parseFloat(s));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return NextResponse.json(
      { ok: false, code: "bad_bbox" },
      { status: 400 },
    );
  }
  const bbox: BBox = {
    minLat: parts[0],
    minLng: parts[1],
    maxLat: parts[2],
    maxLng: parts[3],
  };
  // sanity: chỉ chấp nhận bbox quanh VN, không cho tài nguyên public bị quét toàn cầu
  if (
    bbox.minLat < -5 || bbox.maxLat > 30 ||
    bbox.minLng < 95 || bbox.maxLng > 125 ||
    bbox.minLat >= bbox.maxLat || bbox.minLng >= bbox.maxLng
  ) {
    return NextResponse.json(
      { ok: false, code: "bbox_out_of_range" },
      { status: 400 },
    );
  }
  try {
    // id nội bộ của nguồn (`node/123`) ⇒ băm ổn định — không lộ nguồn qua mã điểm (khong-lo-nguon nợ #8)
    const points = (await fetchNautical(kind, bbox)).map((p) => ({ ...p, id: `n${fnv1a64Hex(p.id)}` }));
    return NextResponse.json(
      { ok: true, kind, count: points.length, points },
      {
        headers: {
          "Cache-Control":
            "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
        },
      },
    );
  } catch (e) {
    // KHÔNG chuyển tiếp câu lỗi của nguồn (vd "… 429") — log ở máy chủ, máy nhận mã chung
    console.error("[nautical] nguồn hỏng:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { ok: false, code: "unavailable" },
      { status: 502 },
    );
  }
}
