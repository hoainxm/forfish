import { computeFishForecast } from "@/lib/fish-forecast-run";
import { loadFishSnapshot } from "@/lib/fish-snapshot";
import { isBuildPhase, isSnapshotFresh } from "@/lib/fish-snapshot-policy";

/**
 * Dự báo cá (PFZ) đọc snapshot do cron tính sẵn. Middleware chặn premium trước
 * cache; route không đọc cookie để giữ ISR.
 */
export const maxDuration = 60;
export const revalidate = 1800;

export async function GET() {
  const snap = await loadFishSnapshot();
  if (snap && snap.ok && isSnapshotFresh(snap.generatedAt, Date.now())) {
    return Response.json(snap);
  }
  /*  2b) ĐANG BUILD → KHÔNG kéo bảy nguồn (2026-08-03). Next dựng sẵn route này
          lúc `next build` (có `revalidate`, không đụng API động); đọc snapshot
          hỏng ở đó là rơi vào `computeFishForecast()` — 14–30 giây × bảy nguồn
          ngoài, trong ngân sách 60 giây của Next ⇒ **bản build ĐỎ**, đúng lỗi
          "/api/fish-forecast took more than 60 seconds" đang có.
          Có snapshot (dù CŨ) thì gieo bằng snapshot; không có thì để 503 ở
          nhánh cuối — request THẬT đầu tiên tự tính rồi lấp đầy kho ISR.
          Xem `isBuildPhase` để biết vì sao một nguồn thời tiết chậm KHÔNG được
          phép chặn việc ship bản vá. */
  if (isBuildPhase()) {
    if (snap && snap.ok) return Response.json(snap); // ok:200 — snapshot thật, có `ok:true`
    return Response.json(
      { ok: false, reason: "build-phase" },
      { status: 503, headers: { "Cache-Control": "public, s-maxage=60" } },
    );
  }
  // 2) Snapshot CŨ (cron đứng) / chưa có / bảng chưa tạo → tự tính LIVE cho tươi,
  //    KHÔNG âm thầm dọn số cũ như số mới.
  const live = await computeFishForecast();
  if (live.ok) return Response.json(live);
  if (snap && snap.ok) return Response.json(snap);
  /* 4) KHÔNG CÒN GÌ ĐỂ TRẢ → 503, KHÔNG PHẢI 200 (sửa 2026-08-02, audit C-4).
        Service worker chỉ cất phản hồi `res.ok`, mà `Response.json({ok:false})`
        mặc định là 200 ⇒ Supabase snapshot hỏng + nguồn live sập cùng lúc là
        ĐÈ MẤT bản đồ cá trong kho `sdfish-api-v1` — bản DUY NHẤT, vì
        fish-predict chỉ lưu DẤU vào localStorage chứ không lưu số liệu. Ra khơi
        là lớp cá trắng vĩnh viễn mà bảng "trong máy có gì" vẫn báo có.
        503 nằm trong `isRescuableStatus` ⇒ SW trả lại bản cũ trong kho; client
        `fetchFishForecast` nay lùi về BẢN ĐÃ LƯU khi `!r.ok` (2026-08-02k), trước đó là `{ok:false}` — cả hai đường đều KHÔNG để màn hình
        đổi. Cùng khuôn với storms/fuel-price/currents-depth. */
  /*  `s-maxage` cho NHÁNH LỖI (2026-08-02b): route này có `revalidate` cấp
      route, và Next có thể KHÔNG cất phản hồi khác 200 vào kho ISR ⇒ lúc nguồn
      sập toàn phần thì MỌI request lại chạy `computeFishForecast()` (7 nguồn,
      14–30 s) thay vì một lần mỗi 30 phút như hồi trả 200. Tự làm nghẽn đúng
      lúc hạ tầng đang yếu. 60 giây đủ chặn dồn mà vẫn hồi phục nhanh. */
  return Response.json(live, {
    status: 503,
    headers: { "Cache-Control": "public, s-maxage=60" },
  });
}
