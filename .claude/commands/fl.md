---
description: Phân tích task → output files context cần đọc trước khi code (gọi context-router agent) / Analyze task → output context files to read before coding (invokes context-router agent)
argument-hint: <mô tả task / task description>
---

Spawn `context-router` agent với task description sau / Spawn the `context-router` agent with the following task description:

**Task**: $ARGUMENTS

Agent sẽ / The agent will:
1. Classify domain (product / architecture / design / data / agents) + trục liên quan (1–4)
2. Output ordered list `.md` cần đọc + lý do mỗi file (root `CLAUDE.md`, `docs/app-map/01..05`)
3. Flag pre-flight risks (DB/RLS/migration · auth · cross-trục · data vendor adapter · LOGIC vs REQUEST)
4. Đưa câu confirm cụ thể trước khi code / Provide a specific confirm question before coding

KHÔNG code, KHÔNG explore source code. Chỉ ROUTE context.
DO NOT code, DO NOT explore source code. ROUTE context only.

Sau khi agent trả output → review list, đọc đúng các file đó (không load cả app-map), check Doc + Test sync invariant trong `CLAUDE.md`, rồi confirm với user trước khi tiếp tục.
After the agent returns → review the list, read exactly those files (do not load the whole app-map), check the Doc + Test sync invariant in `CLAUDE.md`, then confirm with the user before continuing.
