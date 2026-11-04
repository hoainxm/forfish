import { RequireLogin } from "@/components/require-login";
import { BanDoTheoVai } from "@/components/ban-do-theo-vai";
import { HaiDo } from "@/components/hai-do/hai-do";

export const metadata = { title: "Hải đồ — SDFish" };

/*
  CHẾ ĐỘ HẢI ĐỒ (2026-11-04, đợt 1) — màn RIÊNG kiểu máy hải đồ, không đụng màn
  bản đồ cũ `/ngu-truong`. Bà con quen kiểu máy hải đồ thì chuyển sang (nút ở khay ⋯
  màn bản đồ), máy nhớ lựa chọn (`forfish.haiDo.v1` (trường moHaiDo)) để lần sau bấm "Bản đồ"
  trên dock mở thẳng màn này. Khung giống `/ngu-truong`: `.full-map` chừa dock.
  Spec: docs/app-map/07-design-spec.md §10.8 · hướng: docs/research/hai-do-thuan-sdvico-2026-11.md
*/
export default function HaiDoPage() {
  return (
    <div className="full-map fixed inset-x-0 top-0 mx-auto max-w-(--w-app)">
      <RequireLogin what="hải đồ" laTieuDeChinh>
        <h1 className="sr-only">Hải đồ</h1>
        <BanDoTheoVai>
          <HaiDo />
        </BanDoTheoVai>
      </RequireLogin>
    </div>
  );
}
