// Trục 1 — WORKER dẫn đường: chạy planRoute (Dijkstra ~120k lượt legCost ×
// lấy mẫu thời tiết dọc chặng) NGOÀI main thread — máy Android yếu không đơ
// UI vài giây mỗi lần "Tính đường". File này CHỈ là vỏ nhận/trả message
// (structured clone dữ liệu thuần); mọi logic vẫn ở route-plan.ts. Component
// KHÔNG dùng trực tiếp — đi qua planRouteAsync (route-plan-async.ts).

import { planRoute, type PlanArgs, type RoutePlan } from "./route-plan";

export type PlanRequest = { id: number; args: PlanArgs };
export type PlanResponse =
  | { id: number; ok: true; plan: RoutePlan | null }
  | { id: number; ok: false };

// self trong worker là DedicatedWorkerGlobalScope; tsconfig app dùng lib DOM
// nên ép kiểu qua Worker (cùng chữ ký onmessage/postMessage một đối số)
const ctx = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent<PlanRequest>) => {
  const { id, args } = e.data;
  let res: PlanResponse;
  try {
    res = { id, ok: true, plan: planRoute(args) };
  } catch {
    // lỗi bất ngờ trong thuật toán — báo về để phía gọi tính lại đồng bộ
    res = { id, ok: false };
  }
  ctx.postMessage(res);
};
