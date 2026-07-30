// Trục 1 — API độ mặn mặt biển (Copernicus, theo ngày). Fetch S3 + giải nén
// blosc chạy SERVER (client không làm được). ISR 6h — độ mặn đổi chậm.
//
// Attribution bắt buộc khi hiển thị (giấy phép Copernicus Marine):
// "Generated using E.U. Copernicus Marine Service Information".

import { NextResponse } from "next/server";
import { fetchSalinityDaily, SALINITY_MAX_DAYS } from "@/lib/copernicus-salinity";

export const revalidate = 21600; // 6h

export async function GET(req: Request) {
  const days = Number(new URL(req.url).searchParams.get("days"));
  const data = await fetchSalinityDaily(
    Number.isFinite(days) && days > 0 ? days : SALINITY_MAX_DAYS,
  );
  if (!data) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true, ...data });
}
