# 08 — ba-spec: Đa tàu — hồ sơ cố-định-theo-tàu vs động-theo-chủ

> Load khi: task chạm hành vi quản lý nhiều tàu, vòng đời thêm/xóa/đổi tàu, phân loại hồ sơ, gán hàng SDVICO theo tàu, nhắc việc đa-tàu.
covers: src/components/boat-switcher.tsx, src/components/document-vault.tsx, src/components/maintenance-reminders.tsx, src/components/crew-list.tsx, src/components/boat-products.tsx, src/components/urgent-strip.tsx, src/lib/boats.ts
last_verified: 2026-07-31
ttl_days: 90

> **Mục đích**: oracle HÀNH VI cho đa-tàu — định nghĩa hồ sơ nào gắn TÀU, hồ sơ nào gắn CHỦ, vòng đời thêm/xóa/đổi tàu chạy ra sao, đúng-sai đo bằng AC nào. KHÔNG mô tả giao diện (việc của [07-design-spec](07-design-spec.md)).

<!-- re-verified: 2026-07-31 — document-vault / maintenance-reminders / crew-list: CHỈ đổi cách nói + đường ghi khi MÁY HẾT CHỖ, KHÔNG đụng hành vi đa-tàu. (a) Ghi qua `lib/user-store.ts` mới (saveUserJson trả boolean, mượn chỗ của dự báo qua reclaimForecastSpace) → hết chỗ thì hiện banner ĐỎ "CHƯA lưu được" thay vì nuốt lỗi im lặng. (b) Tủ giấy tờ + lịch bảo dưỡng nay TỰ XƯNG LÀ MẪU khi đang hiện dữ liệu seed (mirror crew-list) + nút xoá mẫu — trước iOS xoá storage sau ~7 ngày là rơi về sổ mẫu trông y như giấy tờ thật. Phân loại cố-định-theo-tàu vs động-theo-chủ (R1/R2), cascade R3, guard R7 giữ nguyên. -->
<!-- re-verified: 2026-07-27b — boat-switcher.tsx CHỈ đổi CHỮ ConfirmDialog xóa tàu: bỏ "sổ lãi/lỗ" khỏi danh sách thứ bị xóa (feature sổ lãi/lỗ đã XÓA HẲN 2026-07-27). Hành vi đa-tàu giữ nguyên: cascade R3, guard R7, hồ sơ động không mất. -->
<!-- re-verified: 2026-07-27 — crew-list.tsx đổi UX cảnh báo thuyền viên (tra INLINE khi gõ CCCD + nút Cảnh báo = báo cáo, sheet ReportSheet). KHÔNG đụng hành vi đa-tàu: thuyền viên VẪN động-theo-chủ (R2), không gắn boatId, không mất khi xóa tàu. Spec §hồ-sơ-động còn đúng. -->
<!-- re-verified: 2026-07-27c — crew-list.tsx: định danh thuyền viên CCCD HOẶC SĐT (1 trong 2, IdentityCheck), + admin tự thêm/xóa cảnh báo ở /quan-tri. Vẫn KHÔNG đụng đa-tàu: thuyền viên động-theo-chủ (R2), không boatId. Hồ sơ giờ cần CCCD hoặc SĐT (trước bắt buộc CCCD) — không ảnh hưởng vòng đời tàu. -->

---

## 1. Vấn đề & JTBD
- **Job**: Khi một chủ tàu sở hữu **nhiều tàu**, họ muốn mỗi tàu có hồ sơ riêng đúng đắn (giấy tờ/bảo dưỡng/lãi-lỗ của tàu nào ra tàu đó) trong khi người + đồ của họ (thuyền viên, hàng SDVICO) dùng chung — để **nhắc việc đúng tàu**, không lẫn lộn.
- **Vì sao làm bây giờ**: triage 2026-06-15 phát hiện đổi tàu KHÔNG cập nhật màn đang mở (xem [07 §10](07-design-spec.md)); + chuyến biển đang gộp chung mọi tàu; + hàng SDVICO chưa gán được tàu nên nhắc không biết của tàu nào.
- **Đo thành công bằng**: 0 trường hợp hiển thị/nhắc sai tàu sau khi đổi/xóa tàu (chi tiết §8).

## 2. User registry
| User | Là ai | Vòng đời | Bối cảnh |
|---|---|---|---|
| `chủ tàu` (ngư dân) | chủ duy nhất, toàn quyền (B2C, 1 vai — xem [07 §1](07-design-spec.md)) | mới → quen | mobile, ngoài biển/bến |
| `SDVICO sync` (hệ thống ngoài) | actor tự động — đẩy hàng đã mua/dịch vụ về qua `/api/me/sdvico` | — | nền, sau đăng nhập |

> KHÔNG có nhiều chủ tàu. "Chuyển tàu sang chủ khác" = OUT scope (§7).

## 3. User × Nghiệp vụ (mỗi nghiệp vụ 1 owner-user)
| # | Nghiệp vụ | Owner-user | Cross | Phụ thuộc | Tần suất | Ưu tiên |
|---|---|---|---|---|---|---|
| NV1 | Thêm/khai báo tàu | chủ tàu | — | — | thấp | Must |
| NV2 | Xóa tàu | chủ tàu | — | NV1 | rất thấp | Must |
| NV3 | Đổi tàu đang xem | chủ tàu | — | NV1 | cao | Must |
| NV4 | Gán hàng SDVICO cho tàu | chủ tàu | SDVICO sync (đẩy món mới) | NV1 | trung | Must |
| NV5 | Nhắc việc theo tàu | hệ thống (dải nhắc) | — | NV1,NV4 | cao (mỗi lần mở app) | Must |

## 4. Cross-user handoff map
| Chặng | Nghiệp vụ | Từ | → Nhận | Điều kiện | Điểm kết nếu treo |
|---|---|---|---|---|---|
| H1 | NV4 | SDVICO sync (món mới về) | chủ tàu (gán tàu) | đồng bộ trả món chưa có trong máy | chủ chưa gán → món ở trạng thái **"chưa gán" = của chung**, vẫn nhắc (không nhãn tàu) |

> Còn lại: 1 user → không cross.

## 5. Flows

### Flow NV1 — Thêm tàu · owner: chủ tàu
- **Start**: chủ đang có ≥1 tàu
- **Input**: tên tàu (bắt buộc), mã tàu/cảng nhà/chiều dài (tùy)
- **Steps**: khai thông tin → lưu → tàu mới thành tàu đang chọn
- **Output**: 1 tàu mới + **bộ hồ sơ cố định TRỐNG** (giấy tờ=0, bảo dưỡng=0, chuyến biển=0); hồ sơ động (thuyền viên, hàng SDVICO) không đổi
- **End**: tàu mới hiển thị là tàu đang chọn, các màn hồ sơ cố định ở trạng thái trống

### Flow NV2 — Xóa tàu · owner: chủ tàu
- **Start**: chủ có ≥2 tàu (không xóa được tàu cuối)
- **Input**: tàu cần xóa T
- **Steps**: chọn xóa → xác nhận (nêu rõ sẽ xóa hồ sơ cố định của T)
- **Output**: mọi giấy tờ/bảo dưỡng/chuyến biển `boatId==T` bị xóa; thuyền viên giữ nguyên; hàng SDVICO từng gán T → **về "chưa gán"** (không xóa); tàu đang chọn nhảy sang tàu còn lại
- **End**: T biến mất, dữ liệu động còn nguyên

### Flow NV3 — Đổi tàu đang xem · owner: chủ tàu
- **Start**: chủ có ≥2 tàu
- **Input**: tàu muốn xem T'
- **Steps**: chọn T'
- **Output**: **MỌI màn đang mở** phản ánh T' ngay trong cùng phiên (giấy tờ/bảo dưỡng/chuyến biển = của T'); KHÔNG cần tải lại trang / đổi tab
- **End**: toàn app nhất quán theo T'

### Flow NV4 — Gán hàng SDVICO cho tàu · owner: chủ tàu (trigger: SDVICO sync)
- **Start**: đồng bộ SDVICO trả về danh sách hàng đã mua
- **Input**: món hàng chưa có gán trong máy
- **Steps**: phát hiện món mới → hỏi chủ gán cho tàu nào (hoặc "của chung") → lưu gán cục bộ
- **Output**: món có `boatId` = tàu chủ chọn (hoặc null = của chung); gán lưu cục bộ (lớp annotation trên dữ liệu sync read-only)
- **End**: món được nhắc đúng tàu (NV5)

### Flow NV5 — Nhắc việc theo tàu · owner: hệ thống
- **Start**: chủ mở app
- **Input**: hồ sơ cố định mọi tàu (quá hạn/tới hạn) + hàng SDVICO (bảo hành/cước) đã gán tàu
- **Steps**: gom việc cần làm của TẤT CẢ tàu → mỗi việc gắn nhãn tàu của nó
- **Output**: danh sách việc gộp đa-tàu, mỗi việc nêu rõ thuộc tàu nào; món "chưa gán" hiện không nhãn (của chung)
- **End**: chủ thấy đúng việc nào của tàu nào

## 6. Flow optimization log
| Flow | Candidate | Chọn/Loại | Lý do (rubric) | Bởi |
|---|---|---|---|---|
| NV3 | A: đổi tàu reload toàn trang · B: store dùng chung cập nhật live | Chọn B | A treo/chậm + mất state đang nhập (rubric #3,#5); B đúng "Output quan sát ngay" | Orchestrator |
| NV4 | A: tự đoán tàu theo loại hàng · B: hỏi chủ lúc đồng bộ · C: để global, không gán | Chọn B (user chốt) | A đoán sai → nhắc sai tàu; C không đạt "nhắc đúng tàu" | Orchestrator |
| NV2 | A: xóa tàu xóa luôn thuyền viên/hàng · B: chỉ xóa hồ sơ cố định | Chọn B | thuyền viên/hàng là của chủ, mất oan = sai chuẩn (rubric #1 định hướng) | Orchestrator |

## 7. Scope & Priority
- **IN (MVP)**: NV1–NV5 trong mô hình **1 chủ tàu**.
- **OUT (sau / không làm)**: **chuyển tàu sang chủ tàu khác** (cần khái niệm nhiều chủ + auth/owner_id/RLS — RED, bàn riêng khi lên Supabase). Mô hình cố-định/động ở đây đã chuẩn bị sẵn cho việc đó (hồ sơ cố định đi theo tàu = đi theo chủ mới khi chuyển).

## 8. Success metric
| Nghiệp vụ | Metric | Ngưỡng |
|---|---|---|
| NV3 | hiển thị sai tàu sau đổi tàu | 0 lần (mọi màn đúng tàu trong ≤1s, không reload) |
| NV2 | hồ sơ động mất oan khi xóa tàu | 0 (thuyền viên/hàng SDVICO còn nguyên) |
| NV5 | việc nhắc không rõ tàu | 0 (mọi việc đa-tàu có nhãn tàu) |

## 9. Rules & Invariants
| # | Rule | Edge case |
|---|---|---|
| R1 | Hồ sơ **CỐ ĐỊNH** = giấy tờ tàu, bảo dưỡng, **chuyến biển/sổ lãi-lỗ** → gắn `boatId`; chỉ hiện/đếm cho tàu đang chọn | chuyến biển hiện global → phải thêm `boatId` |
| R2 | Hồ sơ **ĐỘNG** = **thuyền viên**, hàng SDVICO → thuộc chủ; hiện như nhau qua mọi tàu; KHÔNG xóa khi xóa 1 tàu | thuyền viên hiện boat-scoped → phải bỏ gắn-tàu |
| R3 | Xóa tàu → xóa hết hồ sơ cố định `boatId==tàu`; hàng SDVICO đang gán tàu đó → về "chưa gán" (không xóa) | — |
| R4 | Thêm tàu THẬT → bộ hồ sơ cố định TRỐNG (không seed demo); demo seed chỉ cho lần-đầu/tàu-mẫu (xem isDemo [02 §4.4](02-architecture.md)) | — |
| R5 | Đổi tàu đang xem → mọi màn phản ánh tàu đó ngay, không cần reload/đổi tab | nguồn: bug triage 2026-06-15 |
| R6 | Nhắc việc gộp mọi tàu, mỗi việc nhãn rõ tàu; hàng SDVICO chưa gán → của chung (không nhãn) | — |
| R7 | Luôn còn ≥1 tàu — chặn xóa tàu cuối | — |

## 10. Acceptance Criteria — ORACLE

### AC-1 — Thêm tàu cho bộ hồ sơ cố định trống · Maps to: NV1 · Test: e2e
- **Given** chủ tàu đang có ≥1 tàu
- **When** thêm tàu mới T2 với tên hợp lệ
- **Then** T2 thành tàu đang chọn và bộ hồ sơ cố định của T2 rỗng
- **Assert**: `count(documents where boatId==T2)==0 && count(maintenance where boatId==T2)==0 && count(trips where boatId==T2)==0 && currentBoat==T2`

### AC-2 — Xóa tàu xóa hồ sơ cố định, giữ hồ sơ động · Maps to: NV2 · Test: e2e
- **Given** T2 có ≥1 giấy tờ + ≥1 chuyến biển; chủ có ≥1 thuyền viên; ≥1 hàng SDVICO gán T2; tồn tại tàu T1 khác
- **When** chủ xóa T2 và xác nhận
- **Then** hồ sơ cố định của T2 bị xóa hết; thuyền viên không đổi; hàng SDVICO từng gán T2 về "chưa gán"; tàu đang chọn = T1
- **Assert**: `count(fixed where boatId==T2)==0 && count(crew)==giá_trị_trước && sdvicoItem(prev boatId==T2).boatId==null && currentBoat==T1`

### AC-3 — Không xóa được tàu cuối · Maps to: NV2 · Test: unit
- **Given** chủ chỉ còn đúng 1 tàu
- **When** thử xóa tàu đó
- **Then** thao tác bị từ chối, vẫn còn 1 tàu
- **Assert**: `count(boats)==1` sau thao tác; lệnh xóa trả về bị-chặn

### AC-4 — Đổi tàu cập nhật hồ sơ cố định ngay, không reload · Maps to: NV3 · Test: e2e
- **Given** T1 có 1 giấy tờ, T2 có 0 giấy tờ, đang xem T1, KHÔNG tải lại trang
- **When** đổi sang T2
- **Then** danh sách giấy tờ/bảo dưỡng/chuyến biển hiển thị thành của T2
- **Assert**: trong ≤1s, không navigation/reload, `documentList.count == count(documents where boatId==T2) == 0`

### AC-5 — Hồ sơ động không đổi theo tàu · Maps to: NV3 · Test: integration
- **Given** chủ có 2 tàu và 2 thuyền viên
- **When** đổi qua lại T1 ↔ T2
- **Then** danh sách thuyền viên luôn là 2 ở cả hai tàu
- **Assert**: `crewList.count == 2` với mọi `currentBoat ∈ {T1,T2}`

### AC-6 — Hàng SDVICO mới về hỏi gán tàu · Maps to: NV4 · Test: e2e
- **Given** đồng bộ SDVICO trả 1 món chưa có gán trong máy, chủ có ≥2 tàu
- **When** món mới được nhận
- **Then** chủ được hỏi gán món cho tàu nào (hoặc của chung); trước khi chọn, món ở trạng thái chưa-gán
- **Assert**: `newItem.boatId==null` cho tới khi chủ chọn; tồn tại đúng 1 lời hỏi-gán cho `newItem`

### AC-7 — Nhắc việc gắn đúng tàu · Maps to: NV5 · Test: e2e
- **Given** T1 có giấy quá hạn, T2 có bảo dưỡng tới hạn, 1 hàng SDVICO gán T2 sắp hết bảo hành
- **When** mở dải nhắc việc
- **Then** mỗi việc nêu rõ thuộc tàu nào; việc của T2 nhắc kèm nhãn T2; món chưa-gán không nhãn tàu
- **Assert**: mỗi urgent item có `boatLabel == boat(record)`; item SDVICO `boatId==T2` → nhãn T2; `shownCount == tổng việc của mọi tàu`

> Mỗi AC: atomic · testable · map 1 flow · không từ UI. Flow mới (NV1–NV5) → mặc định E2E trừ AC-3/AC-5 logic thuần.

## 11. Assumptions / Open
- **Assumptions** (tự quyết, fail-closed):
  - 1 chủ tàu duy nhất (account = chủ); không có chuyển-chủ → "đi theo chủ mới" chỉ là lý do phân loại, chưa hiện thực.
  - Thuyền viên dùng chung toàn bộ tàu của chủ (không tách ca theo tàu).
  - Hàng SDVICO "chưa gán" = của chung → vẫn nhắc nhưng không nhãn tàu.
  - Giữ ≥1 tàu; xóa tàu cuối bị chặn.
  - Demo/sổ mẫu chỉ cho lần đầu (isDemo); tàu thật thêm vào = trống (R4).
- **Open (RED — chờ user)**: không còn (4 quyết định chốt ở elicitation 2026-06-15).
- **Risk-tier (ai-simple #06)**: 🟡 YELLOW — cross-trục (đụng mọi màn dùng `useBoats` + thêm `boatId` cho trips + bỏ boat-scope crew). Hiện localStorage, reversible. **Khi lên Supabase**: cần `owner_id` + `boat_id` trên bảng tương ứng → cập nhật [04-data-model](04-data-model.md) + contract CÙNG COMMIT lúc build (chưa làm ở pha BA này).

## History
- v1 (2026-06-15): khởi tạo từ nhu cầu "đa tàu — hồ sơ cố định/động" của chủ tàu; 4 quyết định chốt qua elicitation; transfer-chủ OUT scope.

<!-- re-verified: 2026-06-15 — build 5/5 XONG: AC-6 (lib/sdvico-assign.ts store + SdvicoAssignPrompt "Đồ này của tàu nào?" trên /tau Sản phẩm; verify unit, e2e cần SDVICO login) + AC-7 (urgent-strip gắn nhãn tàu mỗi việc, gộp mọi tàu, chưa-gán=của chung). TOÀN BỘ AC-1..7 đã hiện thực. -->
- build 1/5 (2026-06-15): AC-4 + AC-3-guard hiện thực (boat-store).
- build 2/5 (2026-06-15): AC-1 (trips boatId — sổ lãi/lỗ lọc theo tàu) + AC-5 (crew owner-scope). *(Sổ lãi/lỗ money-insights/trip-log XÓA HẲN 2026-07-27; AC-1 phần trips không còn hiệu lực, giữ AC-5.)*
- build 3/5 (2026-06-15): AC-2 (cascade `lib/boat-cascade.ts` purgeBoatData + UI Xóa tàu + reload-on-count 4 component) + AC-3 (guard ≥1 tàu UI + store).
- build 4-5/5 (2026-06-15): AC-6 (`lib/sdvico-assign.ts` + `SdvicoAssignPrompt`) + AC-7 (urgent-strip nhãn tàu). **HOÀN THÀNH AC-1..7.** AC-6 e2e chờ verify khi có tài khoản SDVICO đăng nhập (preview demo không có synced data).
