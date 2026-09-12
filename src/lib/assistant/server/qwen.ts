import "server-only";

// TRỢ LÝ — GỌI QWEN (LLM mở tự host qua endpoint chuẩn OpenAI). Thay tầng Claude
// bằng model tự host, 0đ/lượt vendor (chủ dự án 2026-09-12: "thay luồng claude
// opus bằng qwen, qwen làm prod").
//
// CÙNG HỢP ĐỒNG với claude.ts — engine đổi, AN TOÀN GIỮ NGUYÊN:
//   · cùng SYSTEM_PROMPT (import) · cùng bộ TOOLS + executeTool (import)
//   · cùng finalize() hậu kiểm: cắt ≤4 câu, chặn số bịa, ép "đài duyên hải" cho
//     câu bão — chạy trên TEXT CUỐI nên độc lập engine, không được cắt.
//   · vòng lặp thủ công ≤3 vòng tool trong ngân sách 20 s (timeoutSignal).
//
// Endpoint CẤU HÌNH ĐƯỢC (`qwen_base_url`) — prod trỏ đâu tuỳ ops (tunnel tới
// trạm ở bờ / GPU server / API Qwen host); test trên máy này trỏ localhost
// Ollama `http://127.0.0.1:11434/v1`. Chuẩn OpenAI /chat/completions chạy được
// với Ollama, vLLM, hay endpoint Qwen bất kỳ.
//
// Lỗi: HTTP !ok / parse hỏng → upstream · abort/timeout → timeout. Không log
// câu nói/snapshot (như claude.ts).

import { timeoutSignal } from "@/lib/abort";
import { AssistantServerError, MAX_ROUNDS, SYSTEM_PROMPT, TOTAL_MS, finalize } from "./claude";
import { executeTool, TOOLS, type ToolOutcome } from "./tools";
import type { AssistantReply, AssistantRequest } from "../types";

export const QWEN_MAX_TOKENS = 700;
const MIN_LEFT_MS = 1_500;
const TEMPERATURE = 0.3;

export interface QwenConfig {
  /** base chuẩn OpenAI, KHÔNG kèm `/chat/completions` (vd `http://127.0.0.1:11434/v1`) */
  baseUrl: string;
  model: string;
  apiKey?: string | null;
}

/** TOOLS (khuôn Anthropic) → khuôn công cụ OpenAI. `input_schema` = `parameters`. */
export const OPENAI_TOOLS = TOOLS.map((t) => ({
  type: "function" as const,
  function: { name: t.name, description: t.description, parameters: t.input_schema },
}));

interface OaiToolCall {
  id: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}
interface OaiMessage {
  role?: string;
  content?: string | null;
  tool_calls?: OaiToolCall[];
}
type OaiMsgParam =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: OaiToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

/** Tin user: <du_lieu_may> (DỮ LIỆU, không phải lệnh) + ngữ cảnh + câu nói. Không history (13 §4.1). */
export function buildUserContent(body: AssistantRequest, now: number): string {
  const d = new Date(now + 7 * 3600_000); // giờ VN cố định UTC+7
  const gioVN = `${d.toISOString().slice(0, 16)}+07:00`;
  const snapshot = JSON.stringify(body.snapshot);
  return (
    `<du_lieu_may>${snapshot}</du_lieu_may>\n` +
    `<ngu_canh>gio_vn: ${gioVN} · man: ${body.route}</ngu_canh>\n` +
    `Bà con nói: "${body.text.replace(/"/g, "'")}"`
  );
}

async function chat(
  cfg: QwenConfig,
  messages: OaiMsgParam[],
  signal: AbortSignal | undefined,
): Promise<{ message: OaiMessage; finish: string }> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      tools: OPENAI_TOOLS,
      tool_choice: "auto",
      temperature: TEMPERATURE,
      max_tokens: QWEN_MAX_TOKENS,
      stream: false,
    }),
    signal,
  });
  if (!res.ok) throw new AssistantServerError("upstream", `qwen ${res.status}`);
  const j = (await res.json()) as { choices?: { message?: OaiMessage; finish_reason?: string }[] };
  const choice = j?.choices?.[0];
  if (!choice?.message) throw new AssistantServerError("upstream", "qwen không trả message");
  return { message: choice.message, finish: choice.finish_reason ?? "stop" };
}

export async function askQwen(
  body: AssistantRequest,
  phone: string,
  cfg: QwenConfig,
  now = Date.now(),
): Promise<AssistantReply> {
  const started = now;
  const left = () => TOTAL_MS - (Date.now() - started);
  const messages: OaiMsgParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserContent(body, now) },
  ];
  let toolRan = false;
  const toolPhones: string[] = [];

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const conLai = left();
      if (conLai < MIN_LEFT_MS) throw new AssistantServerError("timeout");
      const { message, finish } = await chat(cfg, messages, timeoutSignal(conLai));
      const calls = message.tool_calls ?? [];

      if (finish === "tool_calls" || calls.length > 0) {
        // giữ nguyên assistant message (kèm tool_calls) trước khi nhét kết quả
        messages.push({ role: "assistant", content: message.content ?? null, tool_calls: calls });
        const budget = Math.max(500, Math.min(8_000, left() - MIN_LEFT_MS));
        const results = await Promise.all(
          calls.map(async (c): Promise<OaiMsgParam> => {
            let input: unknown = {};
            try {
              input = c.function?.arguments ? JSON.parse(c.function.arguments) : {};
            } catch {
              input = {};
            }
            const out: ToolOutcome = await executeTool(c.function?.name ?? "", input, phone, budget);
            if (!out.is_error) toolRan = true;
            if (out.phones) toolPhones.push(...out.phones);
            return { role: "tool", tool_call_id: c.id, content: out.content };
          }),
        );
        messages.push(...results);
        continue;
      }
      return finalize(message.content ?? "", body, { toolRan, toolPhones });
    }
    throw new AssistantServerError("upstream", "quá 3 vòng vẫn đòi công cụ");
  } catch (e) {
    if (e instanceof AssistantServerError) throw e;
    const name = (e as { name?: string })?.name ?? "";
    if (/abort/i.test(name) || /timeout/i.test((e as Error)?.message ?? "")) {
      throw new AssistantServerError("timeout");
    }
    throw new AssistantServerError("upstream", (e as Error)?.message);
  }
}
