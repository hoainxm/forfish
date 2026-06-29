# Hand-off prompt — gửi cho Claude (hoặc AI) phía SDWork

> Paste TOÀN BỘ block dưới đây vào Claude đang làm việc trên repo CRM SDWork.
> Tự đứng riêng — không cần file đính kèm.
>
> **Bảo mật**: secret HMAC nằm trong prompt → gửi qua kênh AN TOÀN
> (1Password share / Bitwarden / Signal / Wire). KHÔNG email plain / Slack
> channel chung. Sau khi SDWork team confirm nhận được, rotate secret lần
> nữa nếu muốn (xem §10).

---

# Task — Dựng outbox SDWork → SDFish (webhook đồng bộ KH/thiết bị/vật tư + provision auth)

Bạn là engineer làm việc trên repo CRM **SDWork** (Supabase project ref `exueouggmbjtjvsvpfya`).
Đối tác **SDFish** (app khách hàng độc lập, project ref `znzgugvfhgmiszqgjulk`,
URL prod `https://forfish-alpha.vercel.app`) cần SDWork đẩy event mỗi khi KH/đơn/
thiết bị/vật tư thay đổi, qua webhook đã sẵn sàng phía họ.

Phía SDFish **đã làm xong** (verify end-to-end 2026-06-25):
- Webhook nhận `POST /api/sdwork/webhook` — HMAC + upsert customers/devices/supplies
  + provision auth user (SĐT + mật khẩu).
- Edge Function `sdfish-password-in` để nhận chiều SDFish→SDWork (KH đổi mk → đẩy
  về CRM). Bạn KHÔNG cần đụng cái này; chỉ cần đảm bảo CRM auth user có thể nhận
  reset mk (admin API `updateUserById`).

Việc của bạn (phía SDWork): **dựng outbox + trigger + worker đẩy event sang SDFish**.

---

## 1. Endpoint + Secret (cấu hình)

| Item | Giá trị |
|---|---|
| URL inbound SDFish | `POST https://forfish-alpha.vercel.app/api/sdwork/webhook` |
| Header signature | `x-sdwork-signature: <HMAC-SHA256 hex của raw body, key = SHARED_SECRET>` |
| Content-Type | `application/json` |
| Method | `POST` |
| SHARED_SECRET (HMAC) | `<PASTE_SECRET_HERE>` |
| Tên env CRM nên dùng | `SDWORK_WEBHOOK_SECRET` |

Set secret vào CRM:
```bash
supabase secrets set "SDWORK_WEBHOOK_SECRET=<PASTE_SECRET_HERE>" --project-ref exueouggmbjtjvsvpfya
```

---

## 2. Shape payload (canonical — KHÔNG đổi key)

```jsonc
POST /api/sdwork/webhook
{
  "events": [
    { "entity": "customer", "action": "upsert", "ref": "<accounts.id UUID>",
      "data": {
        "phone": "0901234567",            // accounts.login_phone (đã normalize)
        "name": "Nguyễn Văn A",            // accounts.name
        "password": "<mk khởi tạo>",       // temp_credentials.temp_password — CHỈ EMIT LẦN INSERT ĐẦU
        "resetPassword": false             // true = SDWork chủ động đặt lại mk khách
      }
    },
    { "entity": "device", "action": "upsert", "ref": "<order_item_serials.id UUID>",
      "data": {
        "customerPhone": "0901234567",     // accounts.login_phone qua orders.customer_id
        "name": "Anten vệ tinh SF-50",     // products.name qua order_item_serials.product_id
        "serial": "SF50-001",              // order_item_serials.serial_number
        "model": "SF-50",                  // products.sku (CRM không có cột model riêng → dùng sku)
        "purchasedOn": "2026-06-01",       // orders.delivery_confirmed_at → fallback orders.confirmed_at (date)
        "warrantyUntil": "2028-06-01",     // warranty_cards.expires_at → fallback purchasedOn + products.warranty_months
        "orderCode": "DH-123"              // orders.code
      }
    },
    { "entity": "supply", "action": "upsert", "ref": "<order_items.id UUID>",
      "data": {
        "customerPhone": "0901234567",
        "name": "Cáp đồng trục RG-58",     // products.name qua order_items.product_id
        "qty": 1.5,                        // order_items.qty — CHẤP NHẬN THẬP PHÂN
        "unit": "m",                       // products.unit (cái/cuộn/kg/m)
        "orderCode": "DH-123"
      }
    },
    { "entity": "device", "action": "delete", "ref": "<id cũ>" }
  ]
}
```

Yêu cầu:
- `ref` = UUID PK bảng nguồn → BẤT BIẾN, dùng idempotent (SDFish upsert theo
  `(entity, ref)`). Delete chỉ cần `ref`.
- `phone` & `customerPhone`: phải lấy `accounts.login_phone` (đã normalize
  `0xxxxxxxxx`). KHÔNG dùng `accounts.phone` raw (bẩn: +84, space, dot). Legacy
  NULL → SKIP event cho đến khi backfill xong.
- `password` chỉ emit **LẦN INSERT customer ĐẦU TIÊN**. Reset mk sau → có flow
  riêng từ SDFish; SDWork KHÔNG gửi `password` lại trừ khi sale chủ động cấp lại
  (gửi kèm `resetPassword: true`).

---

## 3. Response — đối soát outbox

```jsonc
200 {
  "ok": true,
  "applied": 3,
  "results": [
    { "ref": "<id>", "entity": "customer", "action": "upsert", "ok": true, "provisioned": true },
    { "ref": "<id>", "entity": "device",   "action": "upsert", "ok": true },
    { "ref": "<id>", "entity": "supply",   "action": "upsert", "ok": false, "code": "upsert_failed" }
  ]
}
```

Quy tắc đánh dấu:
- **`results[i].ok = true` → mark `sent_at = now()` cho event đó.**
- **`results[i].ok = false` → giữ chưa gửi, `attempts++`, retry theo backoff.**
- **KHÔNG dùng `applied` count làm đối soát** (event lỗi sẽ câm).
- `provisioned: false` (chỉ với customer có `password`) → upsert dữ liệu OK
  nhưng tạo auth user lỗi → **ALERT** nhân viên (KH chưa đăng nhập được).

Mã lỗi toàn cục:
- `401 bad_signature` → secret CRM ≠ SDFish → DỪNG, alert (đừng retry mù)
- `503 not_configured` → SDFish thiếu env → retry backoff dài
- `400 bad_json` → lỗi build body phía SDWork → sửa code, không retry

---

## 4. Bảng outbox (SQL paste vào SQL Editor CRM)

```sql
create table if not exists public.sdfish_outbox (
  id          bigserial primary key,
  entity      text not null,                  -- 'customer' | 'device' | 'supply'
  action      text not null,                  -- 'upsert' | 'delete'
  ref         text not null,                  -- UUID PK bảng nguồn
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,                    -- null = chưa gửi
  attempts    int not null default 0,
  last_error  text
);
create index if not exists sdfish_outbox_unsent_idx
  on public.sdfish_outbox (id) where sent_at is null;
```

---

## 5. Trigger Postgres (nguồn → outbox CÙNG transaction)

Pattern (tuỳ chỉnh tên bảng/cột theo schema CRM thực):

```sql
-- 5a. customer (bảng accounts, filter type='customer')
create or replace function public.sdfish_outbox_customer() returns trigger language plpgsql as $$
declare
  v_data jsonb;
  v_password text;
begin
  if (tg_op = 'DELETE' or (new.status = 'inactive' and old.status <> 'inactive')) then
    insert into public.sdfish_outbox (entity, action, ref, data)
      values ('customer', 'delete', coalesce(old.id::text, new.id::text), '{}'::jsonb);
    return coalesce(new, old);
  end if;

  if (new.type <> 'customer' or new.login_phone is null) then
    return new;  -- bỏ qua đại lý / chưa normalize
  end if;

  -- Lấy mk khởi tạo CHỈ khi INSERT mới
  if (tg_op = 'INSERT') then
    select temp_password into v_password
      from public.temp_credentials
      where account_id = new.id and context = 'create_customer'
      order by created_at desc limit 1;
  end if;

  v_data := jsonb_build_object(
    'phone', new.login_phone,
    'name',  new.name
  );
  if v_password is not null then
    v_data := v_data || jsonb_build_object('password', v_password);
  end if;

  insert into public.sdfish_outbox (entity, action, ref, data)
    values ('customer', 'upsert', new.id::text, v_data);
  return new;
end $$;

create trigger sdfish_outbox_accounts_aiu
  after insert or update on public.accounts
  for each row execute function public.sdfish_outbox_customer();

create trigger sdfish_outbox_accounts_ad
  after delete on public.accounts
  for each row execute function public.sdfish_outbox_customer();
```

Tương tự cho `device` (`order_item_serials`) và `supply` (`order_items` với filter
`products.track_by_serial = false`). Field map đầy đủ ở §2 (KHÔNG đổi key).

⚠️ **Chống echo-loop password**: khi mk khách bị update qua Edge Function
`sdfish-password-in` (chiều SDFish→SDWork), trigger CRM phải **BỎ QUA**, KHÔNG
ghi outbox. Cách:
- Trong Edge Function `sdfish-password-in`, sau `auth.admin.updateUserById`, set
  một flag (vd `set local app.skip_outbox = 'true'`) trước update.
- Trigger kiểm `current_setting('app.skip_outbox', true) = 'true'` thì RETURN
  không ghi outbox.

---

## 6. Worker đẩy outbox (chọn 1 trong 2)

### Option A — Supabase Edge Function + cron (khuyến nghị)

```typescript
// supabase/functions/sdfish-outbox-worker/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SDFISH_URL = "https://forfish-alpha.vercel.app/api/sdwork/webhook";
const SECRET = Deno.env.get("SDWORK_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function hmacHex(raw: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function backoffSeconds(attempts: number): number {
  return Math.min(60 * Math.pow(5, attempts), 7200); // 1m, 5m, 25m, 2h cap
}

Deno.serve(async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: rows, error } = await admin
    .from("sdfish_outbox")
    .select("id, entity, action, ref, data, attempts")
    .is("sent_at", null)
    .order("id", { ascending: true })
    .limit(100);
  if (error || !rows?.length) return new Response("ok");

  // SẮP XẾP: customer TRƯỚC device/supply (RLS phía SDFish dựa SĐT customer)
  rows.sort((a, b) => (a.entity === "customer" ? -1 : 1));

  const body = JSON.stringify({
    events: rows.map(r => ({ entity: r.entity, action: r.action, ref: r.ref, data: r.data })),
  });

  let resp: Response;
  try {
    resp = await fetch(SDFISH_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-sdwork-signature": await hmacHex(body) },
      body,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    // mạng/timeout: tăng attempts cho TẤT CẢ rows trong batch
    await admin.from("sdfish_outbox").update({
      attempts: rows[0].attempts + 1, last_error: String(e),
    }).in("id", rows.map(r => r.id));
    return new Response("network_error", { status: 502 });
  }

  if (resp.status === 401) {
    // bad_signature: KHÔNG retry mù, alert
    console.error("ALERT: bad_signature — secret CRM ≠ SDFish");
    return new Response("bad_signature", { status: 401 });
  }

  const json = await resp.json();
  if (!Array.isArray(json.results)) {
    return new Response("bad_response", { status: 502 });
  }

  // Đánh dấu sent_at theo results[]
  for (let i = 0; i < json.results.length; i++) {
    const r = json.results[i], row = rows[i];
    if (r.ok) {
      await admin.from("sdfish_outbox").update({ sent_at: new Date().toISOString() }).eq("id", row.id);
      // ALERT khi customer có password mà provisioned:false
      if (row.entity === "customer" && row.data?.password && r.provisioned === false) {
        console.warn(`ALERT: customer ${row.ref} upsert OK nhưng provision auth lỗi`);
      }
    } else {
      await admin.from("sdfish_outbox").update({
        attempts: row.attempts + 1,
        last_error: r.code ?? "unknown",
      }).eq("id", row.id);
    }
  }

  return new Response(JSON.stringify({ pushed: json.applied }), {
    headers: { "content-type": "application/json" },
  });
});
```

Deploy:
```bash
supabase functions deploy sdfish-outbox-worker --project-ref exueouggmbjtjvsvpfya
```

Cron 30s (Supabase Dashboard → Database → Cron Jobs, cần extension `pg_cron` +
`pg_net`):
```sql
select cron.schedule(
  'sdfish-outbox-worker',
  '*/30 * * * * *',  -- mỗi 30s
  $$ select net.http_post(
       'https://exueouggmbjtjvsvpfya.functions.supabase.co/sdfish-outbox-worker',
       headers => '{"Authorization":"Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb
     ); $$
);
```

### Option B — Job ngoài (Vercel Cron / GitHub Action)

Đọc bảng outbox qua REST/pg-connect mỗi 30-60s, làm tương tự logic Option A.

---

## 7. Backfill (1 lần, TRƯỚC khi bật trigger incremental)

```sql
-- 7a. customer
insert into public.sdfish_outbox (entity, action, ref, data)
select 'customer', 'upsert', a.id::text,
  jsonb_build_object('phone', a.login_phone, 'name', a.name)
from public.accounts a
where a.type = 'customer'
  and a.login_phone is not null
  and a.status = 'active';

-- 7b. device (chạy SAU 7a — đảm bảo customer được SDFish nhận trước)
insert into public.sdfish_outbox (entity, action, ref, data)
select 'device', 'upsert', s.id::text,
  jsonb_build_object(
    'customerPhone', a.login_phone,
    'name', p.name,
    'serial', s.serial_number,
    'model', p.sku,
    'purchasedOn', coalesce(o.delivery_confirmed_at, o.confirmed_at)::date,
    'warrantyUntil', coalesce(
      wc.expires_at::date,
      (coalesce(o.delivery_confirmed_at, o.confirmed_at)::date + (p.warranty_months || ' months')::interval)::date
    ),
    'orderCode', o.code
  )
from public.order_item_serials s
join public.products p on p.id = s.product_id
join public.orders o on o.id = s.order_id
join public.accounts a on a.id = o.customer_id
left join public.warranty_cards wc on wc.serial_number = s.serial_number and wc.status = 'active'
where s.order_id is not null
  and a.type = 'customer'
  and a.login_phone is not null;

-- 7c. supply
insert into public.sdfish_outbox (entity, action, ref, data)
select 'supply', 'upsert', oi.id::text,
  jsonb_build_object(
    'customerPhone', a.login_phone,
    'name', p.name,
    'qty', oi.qty,
    'unit', p.unit,
    'orderCode', o.code
  )
from public.order_items oi
join public.products p on p.id = oi.product_id
join public.orders o on o.id = oi.order_id
join public.accounts a on a.id = o.customer_id
where p.track_by_serial = false
  and a.type = 'customer'
  and a.login_phone is not null;
```

Worker tự push, theo dõi `sent_at` tăng dần. SDFish upsert idempotent → replay
an toàn.

---

## 8. Test kết nối (chạy NGAY sau khi set secret, TRƯỚC khi build outbox)

```bash
SECRET='<PASTE_SECRET_HERE>'
BODY='{"events":[{"entity":"customer","action":"upsert","ref":"test-sdwork-1","data":{"phone":"0903333333","name":"Test SDWork Side","password":"matkhau123"}}]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
curl -s -X POST 'https://forfish-alpha.vercel.app/api/sdwork/webhook' \
  -H "content-type: application/json" \
  -H "x-sdwork-signature: $SIG" \
  -d "$BODY"
```

Mong đợi:
```json
{"ok":true,"applied":1,"results":[{"ref":"test-sdwork-1","entity":"customer","action":"upsert","ok":true,"provisioned":true}]}
```

Nếu `bad_signature` → secret bạn copy thiếu/dư ký tự → check lại.
Nếu `503 not_configured` → SDFish prod chưa load secret → báo bên SDFish.

---

## 9. Checklist hoàn thành (tick từng item)

- [ ] Set `SDWORK_WEBHOOK_SECRET` vào CRM secrets manager (§1)
- [ ] Test curl §8 → `ok:true, provisioned:true`
- [ ] Tạo bảng `sdfish_outbox` (§4)
- [ ] Trigger trên `accounts` / `order_item_serials` / `order_items` /
      `warranty_cards` → INSERT outbox cùng transaction (§5)
- [ ] Worker đẩy outbox + xử lý `results[]` + backoff retry (§6)
- [ ] Chống echo-loop password trong Edge Function `sdfish-password-in` (§5)
- [ ] Backfill 1 lượt customer → device → supply (§7)
- [ ] Bật cron worker, monitor `sdfish_outbox` 24h → tỉ lệ `sent_at` ≈ 100%
- [ ] Alert khi `attempts > 5` hoặc `provisioned:false`

## 10. Bảo mật

- **KHÔNG log `data.password`** trong outbox, worker, response của SDFish.
- `data jsonb` chứa password plaintext tạm trong outbox = rủi ro:
  - Hạn chế quyền SELECT bảng `sdfish_outbox` (chỉ service_role + DBA).
  - HOẶC: với customer-có-password, đẩy NGAY không qua outbox; HOẶC xoá field
    `password` khỏi `data` sau khi `sent_at` set.
- Secret rotate: khi rotate, set đồng bộ 4 nơi:
  1. CRM secrets (`supabase secrets set`)
  2. SDFish `.env.local` (dev)
  3. SDFish Vercel env (prod, redeploy)
  4. Báo team SDFish trước khi đổi

Bắt đầu từ §1 (set secret) + §8 (test curl). Báo cáo kết quả từng bước trước khi
tiếp.
