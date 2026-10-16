"use client";

// SEN BIỂN — gom các lớp bản đồ cho hỏi đáp (hoi-ban-do.ts). Chỉ GỌI LẠI các hàm
// tải đã có (mỗi hàm tự giữ promise trong bộ nhớ, đi qua một cửa data-fetch, SW
// cache-first) — không tải gì mới. Lớp nào hỏng/chưa có thì để trống: câu đáp
// sẽ nói thật "máy chưa có lớp …", không ngã cả kho.

import { fetchDenBien } from "@/lib/den-bien";
import { fetchDepthGrid } from "@/lib/depth-grid";
import { fetchKhuTruBao } from "@/lib/khu-tru-bao";
import { fetchSeaLanes, fetchCoralReefs, fetchIslands } from "@/lib/sea-lanes";
import { fetchSeamarks } from "@/lib/seamarks";
import { fetchTideStations } from "@/lib/tides";
import { fetchVnAids } from "@/lib/vn-aids";
import { fetchVungQuanLy } from "@/lib/vung-quan-ly";
import { fetchXacTau } from "@/lib/xac-tau";

import type { ChoTen, KhoBanDo } from "./hoi-ban-do";

const mem = <T,>(p: Promise<T>): Promise<T | undefined> => p.catch(() => undefined);

/** Point có `name` → {lat, lon, ten}. */
function diemCoTen(fs: readonly GeoJSON.Feature[] | undefined): ChoTen[] | undefined {
  if (!fs) return undefined;
  const out: ChoTen[] = [];
  for (const f of fs) {
    const name = (f.properties as { name?: string } | null)?.name;
    if (f.geometry?.type === "Point" && name) {
      const [lon, lat] = f.geometry.coordinates;
      out.push({ lat, lon, ten: name });
    }
  }
  return out;
}

let kho: Promise<KhoBanDo> | null = null;

/** Một kho / phiên; kho thiếu lớp thì lần hỏi sau thử lại phần thiếu. Không ném. */
export function napKhoBanDo(): Promise<KhoBanDo> {
  if (kho) return kho;
  const p = (async (): Promise<KhoBanDo> => {
    const [dao, ran, sm, vn, den, xacTau, truBao, vung, lanes, conNuoc, doSau] = await Promise.all([
      mem(fetchIslands()),
      mem(fetchCoralReefs()),
      mem(fetchSeamarks()),
      mem(fetchVnAids()),
      mem(fetchDenBien()),
      mem(fetchXacTau()),
      mem(fetchKhuTruBao()),
      mem(fetchVungQuanLy()),
      mem(fetchSeaLanes()),
      mem(fetchTideStations()),
      mem(fetchDepthGrid()),
    ]);
    const vungCam = lanes
      ?.filter((f) => f.properties?.kind === "vungcam" && f.geometry?.type === "Polygon")
      .map((f) => ({
        ten: String(f.properties?.ten ?? "").replace(/ — .*$/, ""),
        loai: String(f.properties?.loai ?? ""),
        ring: (f.geometry as GeoJSON.Polygon).coordinates[0] as [number, number][],
      }));
    const gian = lanes
      ?.filter((f) => f.properties?.kind === "giankhoan" && f.geometry?.type === "Point")
      .map((f) => {
        const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
        return { lat, lon, ten: "giàn khoan" };
      });
    return {
      dao: diemCoTen(dao),
      ran: diemCoTen(ran),
      phao: sm || vn ? [...(sm ?? []), ...(vn ?? [])] : undefined,
      den,
      xacTau,
      truBao,
      vung,
      vungCam,
      gian,
      conNuoc,
      doSau,
    };
  })();
  kho = p;
  void p.then((k) => {
    // thiếu lớp (mất sóng lần đầu) ⇒ lần hỏi sau tải lại
    if (!k.dao || !k.doSau || !k.xacTau || !k.vung) kho = null;
  });
  return p;
}
