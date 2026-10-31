// GHI BẢNG GIÁ SDVICO VÀO CHỢ VẬT TƯ (gian hàng `sdvico`, bảng shop_products) — 2026-10-31.
// Anh Long gửi ảnh "bảng giá bán lẻ đã bao gồm VAT" rồi chốt: "ghi giá vào đi phải có giá". Món "Liên hệ báo giá" thành món
// có giá + loại (biến thể) ⇒ bà con bỏ giỏ, đặt như món thường; đơn của gian hàng SDVICO tự thành phiếu ⇒ nhóm Zalo
// "Triển Khai Kinh Doanh" (api/cho/don). Starlink (V4 15tr, Mini 13tr) bảng ghi "dự kiến" — anh Long "đưa luôn đi" ⇒ tạo món
// mới (THEM), mô tả nói rõ hàng dự kiến, KD báo ngày có hàng khi gọi.
//
// Chạy lại khi bảng giá đổi (sửa GIA dưới đây):
//   node --env-file=.env.local scripts/sdvico-gia-cho.mjs          # in ra sẽ đổi gì (không ghi)
//   node --env-file=.env.local scripts/sdvico-gia-cho.mjs --ghi    # ghi thật (service role)
// Khớp món theo id prod; tồn kho đặt 99 (SDVICO lắp theo đơn, không giữ kho tại app — KD xác nhận khi gọi).

const GIA = [
  {
    id: "f35dfce6-2341-4517-9afb-760d61baaf24", // Máy lọc dầu diesel SF50 / SF300B
    price_vnd: 7_900_000,
    variants: [
      { label: "Bản cơ SF50 (không điện)" },
      { label: "Bản điện SF300B (bơm 12V)", priceVnd: 9_900_000 },
      { label: "Túi lọc dầu thay thế", priceVnd: 190_000 },
    ],
    them_mo_ta:
      "Hai bản khác nhau: bản CƠ SF50 không cần điện, dầu tự chảy qua lọc — hợp tàu có két dầu đặt cao hơn máy. Bản ĐIỆN SF300B có bơm 12V đẩy dầu, lọc nhanh cỡ 300 lít một giờ, đuổi bọt gió — hợp tàu có két dưới hầm, đường ống dài. Kỹ thuật SDVICO xuống tàu chốt bản. Giá đã gồm VAT.",
  },
  {
    id: "cf708cd8-d7fc-44b8-8bd9-13149a96f2a2", // Máy lọc nước biển SEA-40 / SEA250
    price_vnd: 38_000_000,
    variants: [
      { label: "Bản cơ (giá từ)" },
      { label: "Bản điện (giá từ)", priceVnd: 49_500_000 },
    ],
    them_mo_ta:
      "Bản CƠ không dùng điện, giá từ 38.000.000đ. Bản ĐIỆN chạy 220V, 380V hay biến tần theo điện trên tàu, giá từ 49.500.000đ. Giá theo cấu hình — nhân viên SDVICO gọi lại báo đúng giá cho tàu mình. Giá đã gồm VAT.",
  },
  {
    id: "411149d5-212f-4d3c-984e-b07dccb5b24f", // Giám sát hành trình Viettel S-Tracking
    price_vnd: 23_601_000,
    variants: [],
    them_mo_ta: "Giá đã gồm VAT.",
  },
  {
    id: "938c880e-9ec1-438e-881b-6a2cc83b939f", // Giám sát hành trình Vifish.24
    price_vnd: 24_000_000,
    variants: [],
    them_mo_ta: "Giá đã gồm VAT.",
  },
  {
    id: "e57511a6-9d30-46f8-a7a7-b05ff4724759", // Điện thoại vệ tinh Thuraya MarineStar
    price_vnd: 37_800_000,
    variants: [
      { label: "Trọn bộ (máy + ăng-ten + dây + PAT)" },
      { label: "Điện thoại (máy, dây, PAT)", priceVnd: 28_080_000 },
      { label: "Ăng-ten Thuraya", priceVnd: 9_900_000 },
      { label: "Bộ dây tín hiệu", priceVnd: 1_400_000 },
      { label: "SIM VNPT", priceVnd: 500_000 },
      { label: "PAT", priceVnd: 250_000 },
      { label: "Dây nguồn điện thoại", priceVnd: 200_000 },
    ],
    them_mo_ta:
      "Trọn bộ gồm điện thoại, ăng-ten, dây nguồn, dây tín hiệu, PAT. Bản Điện thoại gồm máy, dây nguồn, dây tín hiệu, PAT (chưa có ăng-ten). Phụ kiện bán lẻ. Giá đã gồm VAT.",
  },
];

// Món CHƯA có trong gian hàng ⇒ tạo mới (khớp theo tên; có rồi thì chỉ cập nhật giá/loại/mô tả như GIA).
const THEM = [
  {
    title: "Internet vệ tinh Starlink (Mini / V4)",
    category: "dien-tu-hang-hai",
    unit: "bộ",
    price_vnd: 13_000_000,
    variants: [{ label: "Starlink Mini" }, { label: "Starlink V4 (Version 4)", priceVnd: 15_000_000 }],
    mo_ta:
      "Internet qua vệ tinh Starlink cho tàu: lướt mạng, gọi Zalo, xem tin thời tiết ngay giữa biển.\n· Bản Mini gọn nhẹ, tốn ít điện\n· Bản V4 (Version 4) ăng-ten lớn hơn",
    them_mo_ta:
      "Bản Mini 13.000.000đ, bản V4 15.000.000đ. HÀNG DỰ KIẾN: bà con đặt trước, nhân viên SDVICO gọi lại báo ngày có hàng và gói cước. Giá đã gồm VAT.",
  },
];

const GHI = process.argv.includes("--ghi");
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) throw new Error("thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (chạy với --env-file=.env.local)");
const H = { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json" };
const DAU_GIA = "\n\nGiá và loại: ";
const DAU_CU = ["\n\nGIÁ: "]; // dấu của lần ghi trước (31/10 sáng) — bỏ khi ghi lại

// cùng luật validateMarketProductDraft (lib/market/validate.ts) — kiểm trước khi ghi
for (const g of GIA) {
  if (!Number.isInteger(g.price_vnd) || g.price_vnd < 1000 || g.price_vnd > 1e9) throw new Error(`${g.id}: giá sai`);
  if (g.variants.length === 1 || g.variants.length > 10) throw new Error(`${g.id}: loại phải 0 hoặc 2–10`);
  for (const v of g.variants) if (!v.label || v.label.length > 40) throw new Error(`${g.id}: tên loại 1–40 chữ "${v.label}"`);
}

for (const g of GIA) {
  const r = await fetch(`${URL_}/rest/v1/shop_products?select=id,title,price_vnd,stock,variants,description&id=eq.${g.id}`, { headers: H });
  const [cu] = await r.json();
  if (!cu) {
    console.log(`KHÔNG THẤY ${g.id}`);
    continue;
  }
  // mô tả: bỏ đoạn GIÁ cũ (nếu chạy lại) rồi gắn đoạn mới
  let goc = String(cu.description ?? "").split(DAU_GIA)[0];
  for (const d of DAU_CU) goc = goc.split(d)[0];
  const moi = { price_vnd: g.price_vnd, variants: g.variants, stock: Math.max(cu.stock ?? 0, 99), description: `${goc}${DAU_GIA}${g.them_mo_ta}`.slice(0, 2000) };
  console.log(`${cu.title}: ${cu.price_vnd ?? "báo giá"} ⇒ ${g.price_vnd}${g.variants.length ? ` · ${g.variants.length} loại` : ""}`);
  if (!GHI) continue;
  const w = await fetch(`${URL_}/rest/v1/shop_products?id=eq.${g.id}`, {
    method: "PATCH",
    headers: { ...H, prefer: "return=minimal" },
    body: JSON.stringify({ ...moi, updated_at: new Date().toISOString() }),
  });
  console.log(w.ok ? "  đã ghi" : `  LỖI ${w.status} ${await w.text()}`);
}
// cùng phép bỏ dấu với foldVn (lib/market/text.ts) — cột search_text cho ô tìm của chợ
const fold = (x) => String(x).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").trim();
const SHOP = "453f9f7a-d737-4cc7-a825-454a00632744"; // gian hàng sdvico
for (const t of THEM) {
  const r = await fetch(`${URL_}/rest/v1/shop_products?select=id&shop_id=eq.${SHOP}&title=eq.${encodeURIComponent(t.title)}&deleted_at=is.null`, { headers: H });
  const co = await r.json();
  const description = `${t.mo_ta}${DAU_GIA}${t.them_mo_ta}`;
  const row = { price_vnd: t.price_vnd, variants: t.variants, description, search_text: fold(`${t.title} ${description}`) };
  console.log(`${t.title}: ${co.length ? "có rồi ⇒ cập nhật" : "CHƯA có ⇒ tạo mới"} · ${t.price_vnd} · ${t.variants.length} loại`);
  if (!GHI) continue;
  const w = co.length
    ? await fetch(`${URL_}/rest/v1/shop_products?id=eq.${co[0].id}`, { method: "PATCH", headers: { ...H, prefer: "return=minimal" }, body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }) })
    : await fetch(`${URL_}/rest/v1/shop_products`, {
        method: "POST",
        headers: { ...H, prefer: "return=minimal" },
        body: JSON.stringify({ ...row, shop_id: SHOP, title: t.title, category: t.category, unit: t.unit, stock: 99, images: [], status: "dang_ban" }),
      });
  console.log(w.ok ? "  đã ghi" : `  LỖI ${w.status} ${await w.text()}`);
}
if (!GHI) console.log("(chưa ghi — thêm --ghi để ghi thật)");
