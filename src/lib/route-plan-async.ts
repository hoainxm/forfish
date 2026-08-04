// Trục 1 — CẦU GỌI planRoute qua Web Worker (route-plan.worker.ts):
// compute() của route-planner.tsx await hàm này thay vì chạy Dijkstra đồng
// bộ trên main thread (team review 2026-07-26: máy Android yếu đơ vài giây).
// Không có Worker (SSR/test) hoặc worker hỏng → chạy đồng bộ tại chỗ — đúng
// kết quả, chỉ mất cái mượt; KHÔNG bao giờ vì worker mà mất tính năng.

import { planRoute, type PlanArgs, type RoutePlan } from "./route-plan";
import type { PlanRequest, PlanResponse } from "./route-plan.worker";

// một worker sống cả phiên (dựng lại nếu chết), ghép trả lời theo id
let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  { args: PlanArgs; resolve: (p: RoutePlan | null) => void }
>();

function ensureWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    // URL literal tương đối để bundler (Turbopack/webpack) tách chunk worker
    worker = new Worker(new URL("./route-plan.worker.ts", import.meta.url));
  } catch {
    return null; // môi trường không dựng được worker — rơi về đồng bộ
  }
  worker.onmessage = (e: MessageEvent<PlanResponse>) => {
    const req = pending.get(e.data.id);
    if (!req) return;
    pending.delete(e.data.id);
    // worker báo lỗi tính toán → tính lại đồng bộ cho chắc có kết quả
    req.resolve(e.data.ok ? e.data.plan : planRoute(req.args));
  };
  worker.onerror = () => {
    // worker chết (script không tải được…) — trả lời mọi request đang chờ
    // bằng bản đồng bộ, bỏ worker; lượt gọi sau tự dựng lại
    const waiting = [...pending.values()];
    pending.clear();
    worker?.terminate();
    worker = null;
    for (const req of waiting) req.resolve(planRoute(req.args));
  };
  return worker;
}

/** Worker im quá lâu thì thôi, tính bằng bản đồng bộ. Dijkstra nặng nhất đo
    được ~3–4 giây trên máy yếu; 20 giây là đã hỏng thật chứ không phải chậm. */
const PLAN_WORKER_GIVEUP_MS = 20_000;

/** planRoute chạy nền — cùng tham số/kết quả, không block main thread */
export function planRouteAsync(args: PlanArgs): Promise<RoutePlan | null> {
  const w = ensureWorker();
  if (!w) return Promise.resolve(planRoute(args));
  return new Promise((resolve) => {
    const id = nextId++;
    /*  ⚠️ PHẢI CÓ CỬA SETTLE THỨ BA (sửa 2026-08-02h).

        LỖI ĐÃ SỬA: promise này chỉ settle qua `worker.onmessage` hoặc
        `worker.onerror`. Worker bị hệ điều hành GIẾT vì sức ép bộ nhớ —
        Dijkstra ~120k lượt `legCost` + lưới thời tiết 0,7–1,5 MB clone sang
        worker, trên máy 2–3 GB RAM — **không bắn `onerror`**. Promise treo ⇒
        `finally { setBusy(false) }` ở `route-planner.tsx` không chạy ⇒ nút kẹt
        "Đang tính…" và `if (busy) return` chặn luôn mọi lần bấm sau. Bà con mất
        hẳn tính năng dẫn đường tiết kiệm dầu cho tới khi tắt mở lại app.

        Hết giờ thì tính BẰNG BẢN ĐỒNG BỘ ngay tại luồng chính — chậm hơn nhưng
        có kết quả, đúng như nhánh `onerror` vẫn làm. */
    const timer = setTimeout(() => {
      if (!pending.delete(id)) return; // worker đã trả lời kịp
      resolve(planRoute(args));
    }, PLAN_WORKER_GIVEUP_MS);
    pending.set(id, {
      args,
      resolve: (r) => {
        clearTimeout(timer);
        resolve(r);
      },
    });
    try {
      w.postMessage({ id, args } satisfies PlanRequest);
    } catch {
      /*  `postMessage` ném (structured-clone hỏng) SAU khi đã `pending.set` ⇒
          mục nằm lại vĩnh viễn kèm `args` (~1 MB `field` + `depth`). Dọn tay rồi
          trả bản đồng bộ. */
      clearTimeout(timer);
      pending.delete(id);
      resolve(planRoute(args));
    }
  });
}
