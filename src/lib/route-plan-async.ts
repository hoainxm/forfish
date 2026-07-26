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

/** planRoute chạy nền — cùng tham số/kết quả, không block main thread */
export function planRouteAsync(args: PlanArgs): Promise<RoutePlan | null> {
  const w = ensureWorker();
  if (!w) return Promise.resolve(planRoute(args));
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, { args, resolve });
    w.postMessage({ id, args } satisfies PlanRequest);
  });
}
