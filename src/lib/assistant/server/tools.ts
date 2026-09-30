import "server-only";

// TRỢ LÝ — CÔNG CỤ CHO MODEL (14 §6.4). Sáu tool `strict: true`,
// `additionalProperties: false`, `required` đủ mọi trường, sắp theo TÊN (cache
// ổn định — tools render ở vị trí 0 của prompt). Executor gọi THẲNG lib máy
// chủ / handler GET của route có sẵn (tiền lệ cron notify-storms) — KHÔNG fetch
// nội bộ. `phone` là của cổng danh tính, KHÔNG lấy từ input tool.
//
// Mỗi executor có trần riêng (≤8 s, không quá phần còn lại của ngân sách 20 s);
// hết giờ → `is_error` "Hỏi lâu quá." để model nói thật.

import type Anthropic from "@anthropic-ai/sdk";
import { GET as getFuelPrice } from "@/app/api/fuel-price/route";
import { GET as getPortPrices } from "@/app/api/port-prices/route";
import { GET as getStorms } from "@/app/api/storms/route";
import { timeoutSignal } from "@/lib/abort";
import { settleOverdueOrders } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import { loadWeatherSnapshot } from "@/lib/weather-snapshot";
import { seaSnapshotId } from "@/lib/weather-snapshot-id";
// kho kiến thức ĐÃ PHÁT HÀNH — đúng file máy bà con tải (public/tro-ly, dựng bằng
// scripts/tram-o-bo/phat-hanh-local.mjs). Nhúng lúc build: cùng bản deploy, cùng nội dung.
import knowledgeJson from "../../../../public/tro-ly/brain/knowledge.v1.json";
import { buildKnowledgeIndex, parseKnowledge, searchKnowledge } from "../brain";
import type { SeaDaySummary } from "../types";

const KHO = buildKnowledgeIndex(parseKnowledge(knowledgeJson));

export const TOOL_MAX_MS = 8_000;
export const TOOL_RESULT_MAX_CHARS = 2_000;

type Tool = Anthropic.Beta.BetaTool;

const tool = (name: string, description: string, properties: Record<string, unknown>): Tool => ({
  name,
  description,
  strict: true,
  input_schema: {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  },
});

/** Sắp theo tên — KHÔNG đổi theo user, KHÔNG đổi giữa chừng hội thoại. */
export const TOOLS: Tool[] = [
  tool("don_cua_toi", "Đơn chợ vật tư gần nhất của chính bác đang hỏi (tối đa 5). dang_giao=true chỉ lấy đơn đang giao.", {
    dang_giao: { type: "boolean", description: "true = chỉ đơn đang giao" },
  }),
  tool("gia_ca", "Giá cá tại bến tuần này (bản tin VASEP). loai rỗng = tất cả, có chữ thì lọc theo tên loài.", {
    loai: { type: "string", description: "tên loài cá, rỗng = tất cả" },
  }),
  tool("gia_dau", "Giá dầu DO 0,05S kỳ hiện hành (đồng/lít).", {}),
  tool("thoi_tiet_cang", "Dự báo biển 3 ngày gần nhất tại một cảng cá (điểm đi biển, sóng, gió, mưa). ngay: 0 hôm nay, 1 mai, 2 kia.", {
    port_id: { type: "string", description: "id cảng, vd quy-nhon, vung-tau, hon-ro" },
    ngay: { type: "integer", enum: [0, 1, 2], description: "0 hôm nay · 1 ngày mai · 2 ngày kia" },
  }),
  tool("tim_san_pham", "Tìm món trên chợ vật tư theo tên (nhớt, đá, lưới, lọc dầu...).", {
    q: { type: "string", description: "chữ tìm" },
    so_luong_toi_da: { type: "integer", minimum: 1, maximum: 5, description: "số món tối đa, 1..5" },
  }),
  tool("tin_bao", "Tin bão / áp thấp nhiệt đới trên Biển Đông hiện tại (NCHMF + GDACS).", {}),
  tool("tra_kho", "Tra kho kiến thức nghề cá ĐÃ DUYỆT (bảo quản cá, máy tàu, an toàn, tiết kiệm dầu...). Trả đúng đoạn tài liệu + nguồn, hoặc báo kho chưa có.", {
    cau_hoi: { type: "string", description: "câu hỏi của bác, viết lại ngắn gọn bằng tiếng Việt có dấu" },
  }),
].sort((a, b) => a.name.localeCompare(b.name));

export const TOOL_NAMES = TOOLS.map((t) => t.name);

export interface ToolOutcome {
  content: string;
  is_error?: boolean;
  /** SĐT xuất hiện trong kết quả (chỉ don_cua_toi) — `finalize` chỉ cho `goi=` số nằm trong đây */
  phones?: string[];
}

const err = (msg: string): ToolOutcome => ({ content: msg, is_error: true });
const okJson = (v: unknown): ToolOutcome => {
  const s = JSON.stringify(v);
  return { content: s.length > TOOL_RESULT_MAX_CHARS ? s.slice(0, TOOL_RESULT_MAX_CHARS) : s };
};

/** Chạy `p` với trần `ms`; hết giờ → reject. Dùng `timeoutSignal` (không `AbortSignal.timeout` trần). */
function withBudget<T>(p: Promise<T>, ms: number): Promise<T> {
  const sig = timeoutSignal(ms);
  if (!sig) return p;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error("timeout"));
    if (sig.aborted) return onAbort();
    sig.addEventListener("abort", onAbort, { once: true });
    p.then(resolve, reject).finally(() => sig.removeEventListener("abort", onAbort));
  });
}

async function routeJson(res: Response): Promise<unknown | null> {
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function strOf(v: unknown, k: string): string {
  const x = (v as Record<string, unknown>)?.[k];
  return typeof x === "string" ? x : "";
}

async function run(name: string, input: Record<string, unknown>, phone: string): Promise<ToolOutcome> {
  switch (name) {
    case "don_cua_toi": {
      const store = await getMarketStore();
      const page = await store.listBuyerOrders(phone, { pageSize: 5 });
      const items = await settleOverdueOrders(store, page.items, new Date().toISOString());
      const only = input.dang_giao === true;
      const orders = items
        .filter((o) => !only || o.status === "dang_giao")
        .map((o) => ({ code: o.code, status: o.status, shopName: o.shopName ?? "", totalVnd: o.totalVnd, createdAt: o.createdAt, shopPhone: o.shopPhone ?? "" }));
      const phones = orders.map((o) => o.shopPhone).filter(Boolean);
      return { ...okJson({ orders }), phones };
    }
    case "gia_ca": {
      const j = await routeJson(await getPortPrices());
      if (!j) return err("Chưa lấy được giá tuần này.");
      const loai = strOf(input, "loai").trim().toLowerCase();
      const all = ((j as { prices?: { species: string; minVnd: number; maxVnd: number }[] }).prices ?? []).map((p) => ({ species: p.species, minVnd: p.minVnd, maxVnd: p.maxVnd }));
      const prices = (loai ? all.filter((p) => p.species.toLowerCase().includes(loai)) : all).slice(0, 12);
      return okJson({ week: (j as { week?: string }).week ?? null, prices });
    }
    case "gia_dau": {
      const j = await routeJson(await getFuelPrice());
      const fuel = (j as { fuel?: { date: string; do005Zone1: number } } | null)?.fuel;
      if (!fuel) return err("Chưa lấy được giá dầu kỳ này.");
      return okJson({ date: fuel.date, priceVnd: fuel.do005Zone1 });
    }
    case "thoi_tiet_cang": {
      const portId = strOf(input, "port_id").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (!portId) return err("Chưa có bản cảng này.");
      const r = await loadWeatherSnapshot(seaSnapshotId(portId));
      if (r.unreachable) return err("Máy chủ chưa hỏi được thời tiết.");
      const payload = r.payload as { savedAt?: number; days?: SeaDaySummary[] } | SeaDaySummary[] | null;
      const days = Array.isArray(payload) ? payload : payload?.days;
      if (!Array.isArray(days) || days.length === 0) return err("Chưa có bản cảng này.");
      // ≤3 ngày cho MỌI hạng (brief §4 #6; v1 không tra hạng trong ngân sách 20 s — fail-closed)
      return okJson({ port: portId, savedAt: Array.isArray(payload) ? null : (payload?.savedAt ?? null), days: days.slice(0, 3) });
    }
    case "tim_san_pham": {
      const q = strOf(input, "q").trim().slice(0, 80);
      const n = Math.max(1, Math.min(5, Number(input.so_luong_toi_da) || 3));
      const store = await getMarketStore();
      const page = await store.listProducts({ q, page: 1, pageSize: n, includeHidden: false });
      return okJson({ items: page.items.map((p) => ({ id: p.id, title: p.title, priceVnd: p.priceVnd, unit: p.unit, stock: p.stock, shopName: p.shopName })) });
    }
    case "tin_bao": {
      const j = await routeJson(await getStorms());
      if (!j) return err("Cả hai nguồn bão chưa trả lời.");
      const storms = ((j as { storms?: { name: string; kindLabel: string; windKmh: number | null; alert: string; lat: number; lon: number }[] }).storms ?? []).map((s) => ({
        name: s.name, kindLabel: s.kindLabel, windKmh: s.windKmh, alert: s.alert,
      }));
      return okJson({ checkedAt: (j as { checkedAt?: string }).checkedAt ?? null, storms });
    }
    case "tra_kho": {
      const hit = searchKnowledge(KHO, strOf(input, "cau_hoi").slice(0, 300));
      if (!hit) return err("Kho chưa có tài liệu cho chuyện này.");
      return okJson({ traLoi: hit.item.traLoi, nguon: hit.item.nguon, ngaySoat: hit.item.ngaySoat });
    }
    default:
      return err("Không có công cụ này.");
  }
}

/** Chạy một tool với trần `budgetMs` (≤ TOOL_MAX_MS). Không ném — mọi lỗi thành `is_error`. */
export async function executeTool(name: string, input: unknown, phone: string, budgetMs: number): Promise<ToolOutcome> {
  const ms = Math.max(500, Math.min(TOOL_MAX_MS, budgetMs));
  const inp = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  try {
    return await withBudget(run(name, inp, phone), ms);
  } catch (e) {
    const msg = (e as Error)?.message;
    if (msg === "timeout") return err("Hỏi lâu quá.");
    console.error("[tro-ly] tool", name, "hỏng:", msg);
    return err(name === "don_cua_toi" ? "Không đọc được đơn." : "Chưa hỏi được.");
  }
}
