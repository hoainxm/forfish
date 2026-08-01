# Ops — Self-host sdvico/forfish trên VPS → sdfish.sdvico.vn (KHÔNG Vercel)

> Deploy production trên **VPS doanh nghiệp** `116.103.228.188`, phục vụ `sdfish.sdvico.vn`. App là **Next.js server** (12+ API route động) → phải chạy tiến trình Node, KHÔNG phải web tĩnh.
>
> **Load khi**: deploy/cập nhật production self-host, đụng nginx/pm2/env/TLS trên VPS.

---

## 0. Tiền đề

- SSH được vào VPS (Ubuntu/Debian giả định — CentOS đổi `apt` → `dnf`).
- **DNS đã đúng**: `sdfish` A → `116.103.228.188` (chính VPS này). KHÔNG cần đổi DNS.
- Repo private `sdvico/forfish` → cần **deploy key SSH** (khuyến nghị) hoặc **PAT** để clone.

## 1. Cài runtime (một lần)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx
sudo npm i -g pm2
node -v   # ≥ 20
```

## 2. Clone repo

```bash
sudo mkdir -p /var/www && sudo chown $USER /var/www && cd /var/www
git clone git@github.com:sdvico/forfish.git sdfish   # SSH deploy key
# hoặc: git clone https://<PAT>@github.com/sdvico/forfish.git sdfish
cd /var/www/sdfish
```

## 3. Env production — TẠO TRƯỚC KHI BUILD

`NEXT_PUBLIC_*` được nhúng lúc `npm run build` → phải có env **trước** build.

```bash
nano /var/www/sdfish/.env.production
chmod 600 /var/www/sdfish/.env.production
```

Nội dung (điền giá trị thật):

```bash
# Supabase (dùng chung mọi deploy)
NEXT_PUBLIC_SUPABASE_URL=https://znzgugvfhgmiszqgjulk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
# SDWork (CRM gateway)
SDWORK_SUPABASE_URL=<...>
SDWORK_SUPABASE_ANON_KEY=<...>
SDWORK_WEBHOOK_SECRET=<...>
SDWORK_SYNC_URL=<...>
NEXT_PUBLIC_SDWORK_ANON_KEY=<...>
NEXT_PUBLIC_SDWORK_FUNCTIONS_URL=<...>
# Web app cùng origin → để trống
NEXT_PUBLIC_API_BASE=
# Web Push (dùng lại cặp đã sinh, hoặc chạy: npx web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BKmPhkrMh6bf3iS4K5zPnm7DjJ3dbGtszRzBptzCWz0_pbsdLYVma4IdFRv30gQonCuHk1n1xJs17bJJukrdUEA
VAPID_PUBLIC_KEY=BKmPhkrMh6bf3iS4K5zPnm7DjJ3dbGtszRzBptzCWz0_pbsdLYVma4IdFRv30gQonCuHk1n1xJs17bJJukrdUEA
VAPID_PRIVATE_KEY=kjvRv-_quRCdhLUxua1mc-PzaSswKtX3flQwhL5lHYU
VAPID_SUBJECT=https://sdvico.vn
# Admin (full-admin qua env)
ADMIN_PHONES=0938635689
# Pepper băm CCCD — sinh 1 lần, GIỮ CỐ ĐỊNH: openssl rand -hex 32
CREW_CCCD_PEPPER=<openssl rand -hex 32>
# Cron (đã có sẵn giá trị trên hệ thống → dùng lại đúng giá trị đó)
CRON_SECRET=<...>
```

> ⚠️ `VAPID_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SDWORK_WEBHOOK_SECRET`, `CREW_CCCD_PEPPER` là **bí mật** — file `.env.production` chmod 600, KHÔNG commit.

## 4. Build + chạy nền (pm2)

```bash
cd /var/www/sdfish
npm ci
export $(grep -v '^#' .env.production | xargs)   # nạp env cho build
npm run build
pm2 start npm --name sdfish -- run start          # next start, cổng 3000
pm2 save
pm2 startup    # chạy lệnh nó in ra → tự bật lại sau reboot
```

> `next start` đọc `.env.production` tự động khi `NODE_ENV=production`. Nếu env không nạp, thêm `--update-env` hoặc dùng `pm2 start ... --env production`.

## 5. Nginx reverse proxy

```bash
sudo tee /etc/nginx/sites-available/sdfish >/dev/null <<'NGINX'
server {
  listen 80;
  server_name sdfish.sdvico.vn;
  client_max_body_size 10m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
NGINX
sudo ln -sf /etc/nginx/sites-available/sdfish /etc/nginx/sites-enabled/sdfish
sudo nginx -t && sudo systemctl reload nginx
```

## 6. TLS (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d sdfish.sdvico.vn --redirect
```

## 7. Cron (THAY Vercel Cron)

VPS = KHÔNG có Vercel Cron. Phải TỰ trigger `/api/cron/*` từ máy → **hết Hobby limit** (5 cron + hàng-giờ chạy thoải mái, miễn phí). `vercel.json crons` chỉ Vercel đọc; Next.js server bỏ qua.

### 7a. Script gọi chung (đọc CRON_SECRET từ .env.production)

```bash
sudo tee /usr/local/bin/sdfish-cron.sh >/dev/null <<'SH'
#!/usr/bin/env bash
set -euo pipefail
SECRET=$(grep -E '^CRON_SECRET=' /var/www/sdfish/.env.production | cut -d= -f2-)
curl -fsS -m 90 -X "${2:-GET}" -H "Authorization: Bearer $SECRET" \
  "http://127.0.0.1:3000$1"      # localhost → bỏ qua nginx/TLS, nhanh + kín
SH
sudo chmod 755 /usr/local/bin/sdfish-cron.sh
```

### 7b. Cách A — crontab (đơn giản, đủ dùng)

```bash
sudo crontab -e     # dán các dòng dưới (UTC — khớp lịch vercel.json cũ)
```

```cron
0 2 * * *    /usr/local/bin/sdfish-cron.sh /api/cron/refresh-fish     >> /var/log/sdfish-cron.log 2>&1
30 2 * * *   /usr/local/bin/sdfish-cron.sh /api/cron/refresh-weather  >> /var/log/sdfish-cron.log 2>&1
30 23 * * *  /usr/local/bin/sdfish-cron.sh /api/collect/sea-daily     >> /var/log/sdfish-cron.log 2>&1
0 3 * * 6    /usr/local/bin/sdfish-cron.sh /api/cron/snapshot-prices  >> /var/log/sdfish-cron.log 2>&1
0 * * * *    /usr/local/bin/sdfish-cron.sh /api/cron/trace-payments POST >> /var/log/sdfish-cron.log 2>&1
```

> `trace-payments` là **POST** (khác refresh-* GET). Trên VPS đặt lại **hàng-giờ** (`0 * * * *`) vì không còn Hobby limit. Timezone crontab theo giờ hệ thống — set `TZ=UTC` ở đầu crontab nếu VPS chạy giờ VN mà muốn khớp UTC.

### 7c. Cách B — systemd timer (bền hơn: log journald, OnFailure)

Ví dụ 1 cron (nhân bản cho các cron khác):

```bash
sudo tee /etc/systemd/system/sdfish-trace.service >/dev/null <<'UNIT'
[Unit]
Description=SDFish trace-payments cron
[Service]
Type=oneshot
ExecStart=/usr/local/bin/sdfish-cron.sh /api/cron/trace-payments POST
UNIT

sudo tee /etc/systemd/system/sdfish-trace.timer >/dev/null <<'UNIT'
[Unit]
Description=SDFish trace-payments hourly
[Timer]
OnCalendar=hourly
Persistent=true
[Install]
WantedBy=timers.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now sdfish-trace.timer
systemctl list-timers | grep sdfish     # kiểm lịch
```

### 7d. Dọn nguồn trùng

- **Bỏ `crons` khỏi `vercel.json`** nếu KHÔNG còn deploy Vercel (Vercel không chạy nữa thì vô hại nếu để, nhưng gỡ cho sạch).
- **GitHub Actions `refresh-*.yml`**: chọn 1 nguồn — hoặc VPS cron, hoặc GH Actions. Chạy CẢ 2 = double-hit endpoint. Khi VPS cron lo hết → tắt/ xoá workflow GH (Actions → Disable).
- Verify chạy tay: `sudo /usr/local/bin/sdfish-cron.sh /api/cron/refresh-weather` → kỳ vọng JSON 200.

## 8. Verify

```bash
curl -I https://sdfish.sdvico.vn/quyen-rieng-tu   # HTTP/2 200
curl -s https://sdfish.sdvico.vn/tien | grep -o "Giao dịch"
```

## 9. Cập nhật khi có code mới

```bash
cd /var/www/sdfish && git pull && npm ci && \
  export $(grep -v '^#' .env.production | xargs) && \
  npm run build && pm2 reload sdfish --update-env
```

(Có thể tự động hóa bằng GitHub Actions self-hosted runner hoặc webhook + script deploy — làm sau nếu cần.)

## 10. Sau khi domain LIVE

- `capacitor.config.ts` `server.url` → `https://sdfish.sdvico.vn/` → rebuild AAB → nộp store.
- Gỡ `sdfish.sdvico.vn` khỏi project Vercel hoainxm (Dashboard → Domains → Remove) để Vercel không giữ tên miền (vô hại nếu để, DNS đã trỏ VPS).

---

**Last updated**: 2026-08-01 (thêm §7 Cron — systemd/crontab thay Vercel Cron) · Host: VPS `116.103.228.188` (PA Vietnam) · Runtime: Node 20 + pm2 + nginx + certbot
