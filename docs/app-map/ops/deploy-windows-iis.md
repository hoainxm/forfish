# Deploy SDFish lên server Windows nội bộ (IIS + NSSM)

> Workflow: [`.github/workflows/deploy.windows-iis.yml`](../../../.github/workflows/deploy.windows-iis.yml).
> Đây là hướng dẫn **setup server 1 lần** + cách vận hành/rollback. Deploy về sau là
> tự động khi push `main`.
>
> Nguồn gốc: bê đúng "hướng đi" của **CRM SDVICO 40** (`crm-sdvico-40/.github/workflows/deploy.yml`)
> — self-hosted runner · release/current/prune · robocopy `/MIR`. Khác một điểm: CRM là
> **web tĩnh** (IIS serve thẳng thư mục), còn SDFish là **Next.js SSR** (60 API route +
> middleware auth) nên **phải chạy tiến trình Node**, IIS chỉ đứng trước làm reverse-proxy.

---

## 0. Vì sao KHÔNG serve tĩnh được (đọc 1 phút)

SDFish có `src/app/api/**` (60 route handler), `middleware.ts` (Supabase auth/SSO), admin,
secret runtime (`SUPABASE_SERVICE_ROLE_KEY`, `CREW_CCCD_PEPPER`…). Ép `output: 'export'`
để robocopy folder tĩnh như CRM sẽ **giết sạch** đám đó. Nên mô hình đúng là:

```
Trình duyệt/app  ──HTTP──►  IIS (site :80/:443, reverse-proxy)
                                   │  ARR + URL Rewrite
                                   ▼
                            Node (Next standalone) lắng nghe 127.0.0.1:3010
                                   │  chạy nền bằng NSSM Windows service
                                   ▼
                            Supabase / API ngoài
```

`next.config.ts` đã bật `output: 'standalone'` → `next build` ra `.next/standalone/server.js`
kèm `node_modules` tối thiểu, **khỏi `npm install` trên server lúc chạy**.

---

## 1. Bố cục thư mục trên server (tổ chức anh em với CRM)

```
C:\SDViCo Soft\
├── WORK\                       ← CRM (đã có)
└── FORFISH\                    ← DEPLOY_BASE của SDFish (tạo mới)
    ├── iis-site\
    │   └── web.config          ← physical path của IIS site (CHỈ chứa rule proxy)
    ├── shared\
    │   └── .env.production      ← secret runtime, ĐẶT TAY 1 LẦN (không vào git)
    ├── logs\
    │   ├── out.log
    │   └── err.log
    ├── release\<timestamp>\     ← các bản standalone, giữ 5 bản (prune tự động)
    └── current\                 ← bản đang chạy; NSSM service AppDirectory trỏ vào đây
```

Lưu ý: IIS site trỏ vào `iis-site\` **chứ không phải `current\`**, vì `current\` bị
`robocopy /MIR` xoá-ghi mỗi lần deploy — không để web.config ở đó.

Tạo khung thư mục:
```powershell
$base = "C:\SDViCo Soft\FORFISH"
New-Item -ItemType Directory -Force -Path "$base\iis-site","$base\shared","$base\logs","$base\release","$base\current" | Out-Null
```

---

## 2. Self-hosted runner (giải đáp "chỗ runner")

SDFish là **repo khác** với CRM, nên **không dùng lại được** runner `WORK` nếu runner đó
đăng ký ở cấp repo `crm-sdvico-40`. Chọn 1 trong 2:

| Cách | Làm | Kết quả |
|---|---|---|
| **A. Runner mới cho repo này** (đơn giản nhất) | `repo forfish → Settings → Actions → Runners → New self-hosted runner`, cài **trên chính server Windows này**, gán label `FORFISH` | 2 runner cùng máy, mỗi cái `_work` riêng → build CRM & SDFish **không đụng nhau**, chạy song song được. `runs-on` trong workflow đã để `[self-hosted, FORFISH]`. |
| **B. Runner org-level dùng chung** | Đăng ký runner ở `github.com/<org> → Settings → Actions → Runners`, cho cả 2 repo dùng | 1 runner phục vụ cả CRM lẫn SDFish, deploy 2 repo **xếp hàng** (1 job/lần). Sửa `runs-on` cho khớp label runner org. |

> Runner chạy dưới một tài khoản Windows — tài khoản đó phải có quyền ghi vào
> `C:\SDViCo Soft\FORFISH` và quyền **Stop/Start service** `forfish` (xem §5).

Cài Node LTS ≥ 20 trên server (Next 16 yêu cầu Node ≥ 18.18/20) — cả để runner build lẫn
để service chạy: <https://nodejs.org>. Kiểm tra: `node -v`.

---

## 3. `.env.production` (secret runtime — đặt tay, không vào git)

Tạo `C:\SDViCo Soft\FORFISH\shared\.env.production`. Điền giá trị thật cho các khoá app
đọc lúc chạy (tên khoá lấy từ code, `process.env.*`):

```dotenv
# --- Bắt buộc cho service Node ---
PORT=3010
HOSTNAME=127.0.0.1
NODE_ENV=production

# --- Supabase / API ---
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_API_BASE=
NEXT_PUBLIC_SDWORK_FUNCTIONS_URL=
NEXT_PUBLIC_SDWORK_ANON_KEY=
SDWORK_SUPABASE_URL=
SDWORK_SUPABASE_ANON_KEY=
SDWORK_TRACE_URL=
SDWORK_WEBHOOK_SECRET=

# --- Bí mật nghiệp vụ ---
CREW_CCCD_PEPPER=
SDFISH_RENEWAL_SECRET=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
ADMIN_PHONES=
MASTER_AGENT_PHONES=
```

> ⚠️ Khoá `NEXT_PUBLIC_*` được **nhúng lúc build**, không chỉ lúc chạy. Nếu build diễn ra
> trên runner (đúng như workflow này), các `NEXT_PUBLIC_*` cần đúng **lúc build** → hoặc
> đặt chúng thành biến môi trường của tài khoản runner, hoặc thêm bước ghi `.env.production`
> vào workspace trước `npm run build`. Khoá **không** `NEXT_PUBLIC_` (service role, pepper…)
> chỉ cần lúc chạy → nằm ở `shared\.env.production` là đủ.

---

## 4. NSSM service chạy Node

[NSSM](https://nssm.cc) biến `node server.js` thành Windows service (tự khởi động, tự
restart khi crash). Tải `nssm.exe`, đặt vào PATH (vd `C:\Tools\nssm\`).

```powershell
$node = "C:\Program Files\nodejs\node.exe"
$base = "C:\SDViCo Soft\FORFISH"

# server.js đọc PORT/HOSTNAME/secret từ file env qua cờ --env-file của Node (>= 20.6).
nssm install forfish $node "--env-file=""$base\shared\.env.production"" server.js"
nssm set forfish AppDirectory "$base\current"
nssm set forfish AppStdout    "$base\logs\out.log"
nssm set forfish AppStderr    "$base\logs\err.log"
nssm set forfish Start        SERVICE_AUTO_START
nssm set forfish AppExit Default Restart
```

Chưa `nssm start forfish` vội — cần có bản build trong `current` trước (deploy lần đầu ở §7).

> Node cũ hơn 20.6 không có `--env-file`. Khi đó bỏ cờ này và nạp env qua
> `nssm set forfish AppEnvironmentExtra` (liệt kê từng KEY=VALUE), hoặc nâng Node.

---

## 5. IIS reverse-proxy (ARR + URL Rewrite)

1. Cài **URL Rewrite** và **Application Request Routing (ARR)** cho IIS (Web Platform
   Installer hoặc bản cài rời của Microsoft).
2. Bật proxy toàn cục: IIS Manager → chọn node server → **Application Request Routing Cache**
   → *Server Proxy Settings* → tick **Enable proxy** → Apply.
3. Tạo site (hoặc dùng site sẵn có): **physical path = `C:\SDViCo Soft\FORFISH\iis-site`**,
   gán binding (host header / cổng riêng, vd `forfish.local:80` hoặc một port). Cho HTTPS thì
   thêm binding 443 + chứng chỉ.
4. Đặt `web.config` vào `C:\SDViCo Soft\FORFISH\iis-site\`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ForFish-ReverseProxy" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:3010/{R:1}" />
          <serverVariables>
            <set name="HTTP_X_FORWARDED_PROTO" value="https" />
            <set name="HTTP_X_FORWARDED_HOST"  value="{HTTP_HOST}" />
          </serverVariables>
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

> Để set được `serverVariables` phải khai chúng ở *URL Rewrite → View Server Variables →
> Add* (`HTTP_X_FORWARDED_PROTO`, `HTTP_X_FORWARDED_HOST`). Nếu site chạy HTTP thuần thì đổi
> giá trị `HTTP_X_FORWARDED_PROTO` thành `http`.

---

## 6. Bật workflow

Trong `deploy.windows-iis.yml`, xác nhận/đổi:

```yaml
runs-on: [self-hosted, FORFISH]     # khớp label runner (§2)
env:
  DEPLOY_BASE: 'C:\SDViCo Soft\FORFISH'
  APP_PORT: '3010'                   # khớp PORT trong .env.production
  SERVICE_NAME: 'forfish'            # khớp tên NSSM service (§4)
  KEEP_RELEASES: 5
```

Chạy tay lần đầu để kiểm tra: repo → **Actions → Deploy (Windows IIS) → Run workflow**.

---

## 7. Deploy lần đầu

1. Chạy workflow (Run workflow hoặc push `main`). Nó build → gom standalone → robocopy
   sang `current`. Lần đầu service chưa có nên workflow chỉ **cảnh báo** (không fail).
2. Khi `current\server.js` đã có → khởi động service: `nssm start forfish`
   (hoặc `Start-Service forfish`).
3. Mở `http://127.0.0.1:3010/` **trên server** để thử Node trực tiếp; rồi mở qua IIS
   (host header/binding đã đặt) để thử proxy.
4. Từ lần deploy sau, workflow tự **stop → robocopy → start → smoke check** service.

---

## 8. Rollback (khi bản mới lỗi)

Bản cũ vẫn nằm trong `release\` (giữ 5 bản). Trỏ `current` về bản cũ rồi restart:

```powershell
$base = "C:\SDViCo Soft\FORFISH"
$old  = "<timestamp_ban_tot>"        # xem: dir "$base\release"
Stop-Service forfish -Force
robocopy "$base\release\$old" "$base\current" /MIR /NFL /NDL /NJH /NJS
Start-Service forfish
```

(`robocopy /MIR` exit 1–7 là bình thường; chỉ >= 8 mới là lỗi thật.)

---

## 9. Bẫy thường gặp

- **robocopy "fail" mà thật ra thành công**: exit 1–7 = đã copy/xoá file (bình thường).
  Workflow chỉ coi `>= 8` là lỗi — đừng "sửa" chỗ này.
- **File bị khoá khi robocopy** ("current đang chạy"): vì service giữ khoá. Workflow đã
  **stop service trước, start sau**. Nếu chạy tay thì nhớ `Stop-Service` trước.
- **Trang trắng / 502 qua IIS**: (a) ARR proxy chưa Enable; (b) service chết — xem
  `logs\err.log`; (c) sai `APP_PORT` vs `PORT` trong `.env.production`.
- **Route/redirect sai host hoặc `http` khi ngoài là `https`**: thiếu header
  `X-Forwarded-Proto`/`X-Forwarded-Host` (§5).
- **`NEXT_PUBLIC_*` rỗng trên client**: chúng nhúng **lúc build**; phải có mặt ở bước build
  của runner, không chỉ trong `shared\.env.production` (xem cảnh báo §3).
- **`--env-file` không nhận**: Node < 20.6. Nâng Node hoặc dùng `AppEnvironmentExtra` (§4).
- **Runner không ghi được / không stop được service**: tài khoản chạy runner thiếu quyền
  thư mục hoặc quyền service (§2).

---

## 10. Ba tốc độ deploy (giữ nguyên triết lý CRM)

| Tầng | Cơ chế | Thời gian | Rollback |
|---|---|---|---|
| 1 · Vá tức thì | (web) reload khi có bản mới / (mobile) OTA Capgo | giây–phút | deploy lại bản trước |
| 2 · Release code | push `main` → workflow này (stop→swap→start) | phút | §8 trỏ lại release cũ |
| 3 · Đổi native | APK/AAB lên store (`android-release.yml`) | giờ–ngày | ra version mới |
