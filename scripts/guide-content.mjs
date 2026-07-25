/**
 * NỘI DUNG sách hướng dẫn SDFish — tách khỏi logic chụp/sinh HTML.
 * Sửa lời ở đây rồi chạy `npm run guide` để chụp lại + sinh lại HTML.
 *
 * Mỗi màn: chụp ảnh THẬT của app rồi đánh số lên đúng vị trí nút.
 * `marks` = các nút được đánh số, theo thứ tự đọc từ trên xuống.
 *   · sel   — CSS selector (ưu tiên `[data-tour="..."]` vì bền hơn class)
 *   · text  — tìm nút/link theo chữ hiển thị (khi không có selector ổn định)
 *   · scope — giới hạn vùng tìm cho `text` (tránh trùng chữ ở dock)
 * Nút không tìm thấy lúc chụp sẽ bị BỎ QUA kèm cảnh báo — không bao giờ vẽ
 * số vào chỗ trống.
 */

export const SEED_DATE = "2026-07-24";

/** Dữ liệu mẫu bơm vào localStorage để màn không trống khi chụp. */
export const seed = {
  boats: [
    {
      id: "b1",
      name: "Tàu Hải Đăng",
      maTau: "BV-91234-TS",
      lengthM: 15.2,
      homeProvince: "Bà Rịa - Vũng Tàu",
    },
    { id: "b2", name: "Tàu Bình Minh", maTau: "BV-77812-TS", lengthM: 12.4 },
  ],
  currentBoat: "b1",
  documents: [
    { id: "d1", boatId: "b1", kind: "dang_kiem", label: "Đăng kiểm tàu cá", number: "ĐK-2024-0571", expiresOn: "2026-08-05", note: "Liên hệ chi cục đăng kiểm để gia hạn." },
    { id: "d2", boatId: "b1", kind: "giay_phep_khai_thac", label: "Giấy phép khai thác thủy sản", number: "GP-VBT-3391", expiresOn: "2026-11-30" },
    { id: "d3", boatId: "b1", kind: "bao_hiem", label: "Bảo hiểm thân tàu", number: "BH-PVI-88102", expiresOn: "2027-03-14" },
  ],
  crew: [
    { id: "c1", name: "Nguyễn Văn Hai", role: "thuyen_truong", phone: "0901234567", shares: 2, hasInsurance: true, insuranceExpiry: "2026-11-20", certLabel: "Thuyền trưởng hạng II", certExpiry: "2026-08-12", advances: [{ id: "a1", date: "2026-07-02", amountVnd: 3000000, note: "Ứng trước chuyến" }] },
    { id: "c2", name: "Trần Minh Bảo", role: "may_truong", phone: "0912345678", shares: 1.5, hasInsurance: true, insuranceExpiry: "2027-02-01", certLabel: "Máy trưởng hạng II", certExpiry: "2027-01-10", advances: [] },
    { id: "c3", name: "Lê Văn Tùng", role: "thuyen_vien", phone: "0987654321", shares: 1, hasInsurance: false, advances: [] },
  ],
  trips: [
    { id: "t1", boatId: "b1", date: "2026-07-12", revenueVnd: 185000000, fuelVnd: 78000000, otherVnd: 32000000, note: "Chuyến 9 ngày, cá ngừ" },
    { id: "t2", boatId: "b1", date: "2026-06-24", revenueVnd: 142000000, fuelVnd: 71000000, otherVnd: 29000000 },
    { id: "t3", boatId: "b1", date: "2026-06-05", revenueVnd: 96000000, fuelVnd: 74000000, otherVnd: 31000000, note: "Gặp gió, về sớm" },
  ],
  debts: [
    { id: "n1", name: "Đại lý dầu Sáu Thành", kind: "dai-ly-dau", phone: "0913222444", entries: [ { id: "e1", date: "2026-07-01", type: "vay", amountVnd: 60000000, note: "Dầu chuyến tháng 7" }, { id: "e2", date: "2026-07-15", type: "tra", amountVnd: 25000000 } ] },
    { id: "n2", name: "Nậu Tư Lành", kind: "nau", phone: "0918777333", entries: [{ id: "e3", date: "2026-06-20", type: "vay", amountVnd: 20000000 }] },
  ],
  products: [
    { id: "p1", boatId: "b1", name: "Máy định vị GPS SDVICO GP-200", serial: "SDV-GP200-4471", purchasedOn: "2026-02-10", warrantyUntil: "2027-02-10" },
    { id: "p2", boatId: "b1", name: "Bộ đàm tầm xa SDVICO ICOM-M710", serial: "SDV-M710-1182", purchasedOn: "2025-09-05", warrantyUntil: "2026-09-05" },
  ],
  maintenance: [
    { id: "m1", boatId: "b1", item: "Thay nhớt máy chính", lastDone: "2026-05-20", intervalDays: 60 },
    { id: "m2", boatId: "b1", item: "Kiểm tra chân vịt", lastDone: "2026-04-02", intervalDays: 120 },
  ],
};

/** Đồ SDVICO trả về cho /api/me/sdvico khi chụp (khách đã đồng bộ). */
export const sdvicoAssets = {
  ok: true,
  // shape PHẢI khớp OwnedAssets (src/lib/owned-assets.ts) — thiếu field nào là
  // màn trắng lúc chụp; đã dính với `payments` ngày 2026-07-24.
  assets: {
    customerName: "Nguyễn Văn Hai",
    products: [
      { id: "sp1", name: "Máy định vị GPS SDVICO GP-200", serial: "SDV-GP200-4471", purchasedOn: "2026-02-10", warrantyUntil: "2027-02-10", orderCode: "DH-2026-0210" },
      { id: "sp2", name: "Bộ đàm tầm xa ICOM-M710", serial: "SDV-M710-1182", purchasedOn: "2025-09-05", warrantyUntil: "2026-09-05", orderCode: "DH-2025-0905" },
    ],
    services: [
      { id: "sv1", name: "Thuê bao giám sát hành trình", kind: "subscription", startedOn: "2026-01-01", nextDueOn: "2026-08-01", active: true },
      { id: "sv2", name: "Bảo trì định kỳ máy chính", kind: "maintenance", startedOn: "2026-03-15", nextDueOn: "2026-09-15", active: true },
    ],
    payments: [],
    requests: [],
  },
};

/** Các phần chữ (không kèm ảnh) — mở đầu và kết. */
export const prose = {
  intro: {
    id: "bat-dau",
    title: "Bắt đầu: cài app và đăng nhập",
    lead: "App chạy thẳng trên trình duyệt điện thoại, cài về màn hình chính cho tiện.",
    blocks: [
      { h3: "Cài app về màn hình chính", steps: [
        "Mở app bằng trình duyệt (Chrome trên Android, Safari trên iPhone).",
        "Android: bấm dấu ba chấm ở góc → chọn <b>Cài ứng dụng</b> (hoặc <b>Thêm vào màn hình chính</b>).",
        "iPhone: bấm nút chia sẻ (ô vuông có mũi tên đi lên) → <b>Thêm vào MH chính</b>.",
        "Xong, biểu tượng SDFish nằm ngoài màn hình chính như mọi app khác.",
      ] },
      { note: "<b>Không đăng nhập vẫn xem được</b> giá cá, mức phạt, gió sóng, danh bạ cảng. Những thứ riêng của bà con — giấy tờ, thuyền viên, lãi lỗ, công nợ — thì phải đăng nhập, để người khác cầm máy cũng không xem được." },
      { h3: "Xem chỉ dẫn ngay trên màn hình", p: "Trong app có nút <b>Hướng dẫn</b> ở góc trái dưới. Bấm vào là app tối màn lại, sáng đúng cái nút đang nói tới kèm một câu giải thích — giống hệt các ảnh trong sách này nhưng ngay trên máy của bà con. Lần đầu mở mỗi màn app tự chỉ một lượt; muốn xem lại thì bấm nút đó, hoặc vào nút tài khoản chọn <b>Chỉ lại từ đầu trên màn hình</b>." },
    ],
  },
  faq: {
    id: "hoi-dap",
    title: "Hỏi đáp nhanh",
    items: [
      { q: "Chữ nhỏ quá, đọc không ra", a: "Bấm nút tài khoản trên Trang chủ → <b>Cỡ giao diện</b> → <b>Chữ to</b>. Hoặc chỉnh cỡ chữ trong cài đặt điện thoại, app tự to theo." },
      { q: "Ngoài khơi mất sóng thì sao?", a: "Những gì đã ghi trong máy — giấy tờ, thuyền viên, sổ lãi lỗ, công nợ — vẫn xem được. Gió sóng, giá cá, tin bão cần mạng mới cập nhật được." },
      { q: "Sao mở màn Ra khơi lâu hơn màn khác?", a: "Bản đồ nặng nên nạp chậm hơn một chút. Nguồn dữ liệu nào hỏng thì app <b>nói rõ và cho nút Thử lại</b> — không bao giờ im lặng giả vờ như không có bão." },
      { q: "Tôi có mấy tàu, ghi chung hay riêng?", a: "Riêng theo tàu: giấy tờ, bảo dưỡng, sổ lãi lỗ. Chung cả chủ tàu: sổ bạn thuyền. Đổi tàu bằng nút chọn tàu ngay dưới phần đầu màn." },
      { q: "Xoá nhầm thì sao?", a: "App luôn hỏi lại trước khi xoá và nêu rõ xoá cái gì. Đã xoá thì không lấy lại được — đọc kỹ câu hỏi rồi hãy bấm." },
      { q: "Cần người hỗ trợ", a: "Vào <b>Tàu của tôi → Dịch vụ → Gọi SDVICO</b>, gửi yêu cầu kèm số điện thoại. Nhân viên gọi lại." },
    ],
  },
};

/** Danh sách màn được chụp, theo thứ tự trong sách. */
export const screens = [
  {
    id: "trang-chu",
    title: "Màn Trang chủ",
    url: "/",
    lead: "Nhìn một cái là biết có việc gì gấp, và đi đâu tiếp.",
    marks: [
      { sel: '[data-tour="tai-khoan"]', label: "Nút tài khoản", desc: "Hiện tên bà con. Bấm vào mở bảng: chỉnh cỡ chữ, xem hướng dẫn, đổi mật khẩu, đăng xuất." },
      { sel: '[data-tour="chon-tau"]', label: "Chọn tàu", desc: "Hiện tàu đang xem. Bấm để đổi tàu khác hoặc thêm tàu mới. Giấy tờ, bảo dưỡng, lãi lỗ đều tính theo tàu đang chọn ở đây — chọn nhầm tàu là xem nhầm sổ." },
      { sel: '[data-tour="nhac-viec"]', label: "Việc cần làm ngay", desc: "App tự nhắc giấy tờ, bảo hiểm, bảo dưỡng sắp hết hạn. Bấm vào dòng nhắc là tới thẳng chỗ xử lý, khỏi phải đi tìm." },
      { sel: '[data-tour="bon-viec"] a[href="/ngu-truong"]', label: "Ô Ra khơi", desc: "Bản đồ biển: gió sóng, chỗ có khả năng có cá, dẫn đường tiết kiệm dầu." },
      { sel: '[data-tour="bon-viec"] a[href="/tau"]', label: "Ô Tàu của tôi", desc: "Giấy tờ tàu, dịch vụ và đồ đã mua của SDVICO, tra mức phạt." },
      { sel: '[data-tour="bon-viec"] a[href="/nguoi"]', label: "Ô Bạn thuyền", desc: "Hồ sơ thuyền viên, chứng chỉ, bảo hiểm, sổ ứng tiền." },
      { sel: '[data-tour="bon-viec"] a[href="/tien"]', label: "Ô Sổ tiền", desc: "Giá cá, ai đang cần mua, lãi lỗ từng chuyến, công nợ." },
      { sel: '[data-tour="dock"]', label: "Thanh dưới cùng", desc: "Luôn có ở mọi màn: Trang chủ · Ra khơi · Tàu · Bạn thuyền · Tiền. Lạc chỗ nào thì bấm Trang chủ về lại." },
    ],
  },
  {
    id: "tai-khoan",
    title: "Bảng Tài khoản",
    url: "/",
    lead: "Bấm nút tài khoản ở đầu Trang chủ để mở bảng này.",
    click: '[data-tour="tai-khoan"]',
    settle: 900,
    marks: [
      { text: "Chữ to", label: "Cỡ giao diện", desc: "Ba kiểu: Theo máy (mặc định — chữ trong điện thoại to thì app to theo), Chữ to, Gọn. Bấm lại lựa chọn đang bật để về Theo máy." },
      { text: "Xem hướng dẫn đầy đủ", label: "Xem hướng dẫn đầy đủ", desc: "Mở đúng quyển sách hướng dẫn này, in ra giấy được." },
      { text: "Chỉ lại từ đầu", label: "Chỉ lại từ đầu trên màn hình", desc: "Bật lại phần chỉ dẫn từng nút ở mọi màn, như lúc mới dùng app." },
      { text: "Đổi mật khẩu", label: "Đổi mật khẩu", desc: "Đặt mật khẩu mới. Mật khẩu mới dùng được cả bên SDVICO." },
      { text: "Đăng xuất", label: "Đăng xuất", desc: "Thoát tài khoản. Dữ liệu riêng trên máy được dọn đi, người khác cầm máy không xem được." },
    ],
  },
  {
    id: "ra-khoi",
    title: "Màn Ra khơi",
    url: "/ngu-truong",
    lead: "Bản đồ biển chiếm cả màn hình. Mọi thứ khác nổi lên trên bản đồ.",
    settle: 6000,
    marks: [
      { sel: '[data-tour="rail"] button:nth-of-type(1)', label: "Nút Lớp / Ẩn", desc: "Thu gọn cả dãy nút cho thoáng bản đồ, bấm lại là hiện ra." },
      { text: "Hải đồ", scope: '[data-tour="rail"]', label: "Hải đồ", desc: "Chọn nền bản đồ: hải đồ độ sâu (mặc định, có số mét), nước nóng lạnh, vùng nhiều mồi, ảnh mây trời." },
      { text: "Ngư trường", scope: '[data-tour="rail"]', label: "Ngư trường", desc: "Vùng có khả năng có cá, chọn theo loài. Chấm càng đậm càng nhiều khả năng; hồng tâm là điểm nóng nhất." },
      { text: "Thời tiết", scope: '[data-tour="rail"]', label: "Thời tiết", desc: "Bật lớp gió hoặc sóng vẽ động theo giờ, có thanh thời gian kéo tới lui và nút chạy." },
      { text: "Điểm đã lưu", scope: '[data-tour="rail"]', label: "Điểm đã lưu", desc: "Ghim chỗ hay đánh và đặt tên. Đặt cảng nhà ở đây (gõ tìm trong 173 cảng cả nước)." },
      { text: "Công cụ", scope: '[data-tour="rail"]', label: "Công cụ", desc: "Đo khoảng cách giữa hai điểm trên biển." },
      { text: "Cài đặt", scope: '[data-tour="rail"]', label: "Cài đặt", desc: "Đổi đơn vị khoảng cách (hải lý / km) và kiểu toạ độ." },
      { sel: '[data-tour="sheet-day"]', label: "Bảng dưới đáy", desc: "Biển êm hay động, sóng mấy mét, gió cấp mấy ở chỗ đang xem. Chạm vào biển là bảng đổi sang chỗ vừa chạm; kéo bảng lên để xem đủ mưa dông, nước cạn, tuần trăng, toạ độ." },
    ],
    warn: "Số liệu là tham khảo. App nói biển êm hay động, sóng mấy mét, gió cấp mấy — app KHÔNG phán đi hay không đi. Quyết định vẫn là của thuyền trưởng. Ảnh vệ tinh luôn chậm vài ngày; chỗ trống trên ảnh là mây che, không phải biển trống.",
  },
  {
    id: "tau-giay-to",
    title: "Màn Tàu của tôi — tab Giấy tờ",
    url: "/tau?tab=giay-to",
    lead: "Bốn tab trên đầu màn. Tab Giấy tờ lo chuyện đủ điều kiện ra khơi.",
    marks: [
      { sel: '[data-tour="tab-giay-to"]', label: "Tab Giấy tờ", desc: "Checklist xuất bến + tủ giấy tờ của tàu đang chọn." },
      { sel: '[data-tour="tab-dich-vu"]', label: "Tab Dịch vụ", desc: "Dịch vụ SDVICO, cước chờ đóng, nút gọi SDVICO, sổ nhắc bảo dưỡng." },
      { sel: '[data-tour="tab-san-pham"]', label: "Tab Sản phẩm", desc: "Đồ đã mua và hạn bảo hành." },
      { sel: '[data-tour="tab-muc-phat"]', label: "Tab Mức phạt", desc: "Tra mức phạt theo Nghị định 38/2024." },
      { text: "Thêm giấy tờ", label: "Thêm giấy tờ", desc: "Ghi loại giấy, số giấy và ngày hết hạn. App tự nhắc trước khi hết hạn." },
    ],
  },
  {
    id: "tau-dich-vu",
    title: "Màn Tàu của tôi — tab Dịch vụ",
    url: "/tau?tab=dich-vu",
    lead: "Dịch vụ đang dùng của SDVICO và sổ nhắc bảo dưỡng tự ghi.",
    marks: [
      { text: "Gọi SDVICO sửa chữa", label: "Gọi SDVICO sửa chữa / bảo dưỡng", desc: "Gửi yêu cầu: sửa chữa, đặt bảo dưỡng, hỏi cước. Để lại tên và số điện thoại, SDVICO gọi lại. Gấp thì có số hotline ngay trong bảng." },
      { text: "Thêm việc bảo dưỡng", label: "Thêm việc bảo dưỡng", desc: "Tự ghi việc định kỳ (thay nhớt, kiểm tra chân vịt), ngày làm gần nhất và số ngày lặp lại. App nhắc khi tới hạn." },
    ],
  },
  {
    id: "tau-muc-phat",
    title: "Màn Tàu của tôi — tab Mức phạt",
    url: "/tau?tab=muc-phat",
    lead: "Tra mức phạt trước khi ra khơi. Không cần đăng nhập cũng xem được.",
    marks: [
      { sel: 'input[type="search"], input[placeholder*="Tìm"], input[placeholder*="tìm"]', label: "Ô tìm lỗi", desc: "Gõ vài chữ của lỗi muốn tra, danh sách lọc ngay." },
    ],
    note: "Mức phạt xếp từ nặng tới nhẹ. Đây là bản THAM KHẢO theo Nghị định 38/2024, không thay văn bản gốc.",
  },
  {
    id: "ban-thuyen",
    title: "Màn Bạn thuyền",
    url: "/nguoi",
    lead: "Ai đi tàu mình, giấy tờ tới đâu, ứng tiền bao nhiêu.",
    marks: [
      { sel: '[data-tour="them-thuyen-vien"]', label: "Thêm bạn thuyền", desc: "Ghi tên, số điện thoại, chứng chỉ, bảo hiểm và ngày hết hạn." },
    ],
    note: "Sổ bạn thuyền theo CHỦ TÀU, không theo từng tàu — đổi tàu vẫn thấy đủ người. Bảo hiểm hoặc chứng chỉ sắp hết hạn thì băng trên thẻ chuyển vàng, quá hạn thì đỏ.",
  },
  {
    id: "tien-giao-dich",
    title: "Màn Sổ tiền — tab Giao dịch",
    url: "/tien?tab=giao-dich",
    lead: "Nắm giá trước khi vào bờ, khỏi bị ép giá. Không cần đăng nhập.",
    marks: [
      { sel: '[data-tour="tab-giao-dich"]', label: "Tab Giao dịch", desc: "Giá cá, ai cần mua, bán ở đâu." },
      { sel: '[data-tour="tab-hieu-qua"]', label: "Tab Hiệu quả", desc: "Sổ lãi lỗ từng chuyến, báo cáo năm, máy tính chuyến, chia tiền." },
      { sel: '[data-tour="tab-cong-no"]', label: "Tab Công nợ", desc: "Ai nợ ai, ứng trước bao nhiêu." },
      { text: "Giá cá", label: "Giá cá", desc: "Giá tham khảo theo tuần, kèm giá dầu DO." },
      { text: "Ai cần mua", label: "Ai cần mua", desc: "Đầu nậu, nhà máy đang cần loài gì, bao nhiêu — bấm để gọi." },
      { text: "Bán ở đâu", label: "Bán ở đâu", desc: "Vựa, đầu mối, doanh nghiệp thu mua theo vùng và theo loài, có số điện thoại." },
    ],
  },
  {
    id: "tien-hieu-qua",
    title: "Màn Sổ tiền — tab Hiệu quả",
    url: "/tien?tab=hieu-qua",
    lead: "Lãi lỗ từng chuyến, tính theo tàu đang chọn.",
    marks: [
      { text: "Sổ lãi/lỗ", label: "Sổ lãi/lỗ", desc: "Mỗi chuyến ghi: dầu, đá, tổn khác, tiền bán cá — app tính lãi lỗ giúp." },
      { text: "Báo cáo năm", label: "Báo cáo năm", desc: "Tổng lãi lỗ cả năm, tách theo từng tháng." },
      { text: "Tính chuyến", label: "Tính chuyến", desc: "Máy tính tổn dự kiến trước khi đổ dầu và cần bán bao nhiêu cá mới hoà vốn." },
      { text: "Chia tiền", label: "Chia tiền", desc: "Chia phần cho bạn thuyền theo cách của tàu mình." },
    ],
    note: "Mọi ô nhập tiền đều tự chấm nghìn khi gõ và đọc lại thành chữ (“= 45 triệu đồng”) — nhìn dòng đó để chắc không thừa thiếu số không.",
  },
  {
    id: "tien-cong-no",
    title: "Màn Sổ tiền — tab Công nợ",
    url: "/tien?tab=cong-no",
    lead: "Mỗi chủ nợ một dư nợ riêng, có lịch sử vay và trả từng lần.",
    marks: [
      { text: "Thêm chủ nợ", label: "Thêm chủ nợ", desc: "Ghi tên đại lý dầu, nậu, ngân hàng… rồi ghi từng lần vay và trả." },
    ],
  },
  {
    id: "cang",
    title: "Màn Danh bạ cảng",
    url: "/cang",
    lead: "173 cảng cá chỉ định trên cả nước. Vào từ nút trên bản đồ Ra khơi.",
    marks: [
      { sel: 'input', label: "Ô tìm cảng", desc: "Gõ tên cảng, tên tỉnh hoặc huyện để lọc nhanh." },
    ],
  },
  {
    id: "login",
    title: "Màn Đăng nhập",
    url: "/login",
    lead: "Vào bằng số điện thoại đã đăng ký với SDVICO. Không cần email.",
    marks: [
      { sel: 'input[type="tel"], input[inputmode="numeric"], input[name*="phone"]', label: "Ô số điện thoại", desc: "Nhập đúng số bà con đã đăng ký với SDVICO." },
      { sel: 'input[type="password"]', label: "Ô mật khẩu", desc: "Khách mới do SDVICO cấp thì mật khẩu ban đầu là sd123456. Bấm nút Hiện để nhìn thấy mình gõ gì." },
      { text: "Quên mật khẩu", label: "Quên mật khẩu?", desc: "Nhập số điện thoại và họ tên, nhân viên SDVICO xét rồi đặt lại giúp." },
    ],
  },
];
