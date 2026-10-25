import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { InstallBanner } from "@/components/install-prompt";
import { EmptyState } from "@/components/ui/primitives";
import { loadPublicPost } from "@/lib/kairos/server";
import type { KairosPost } from "@/lib/kairos/types";
import { shareText, tenMien } from "@/lib/kairos/social";
import { NHAN } from "@/lib/labels";

/*
  TRANG CÔNG KHAI MỘT BÀI `/k/[id]` (14 §3.6, AC11, A34) — cho người CHƯA có app mở link Zalo.
  Server render, nhìn như KHÁCH (loadPublicPost): tên báo / tên gọi, chữ, ảnh, số Hay, 2 bình
  luận đầu, nút Cài app; thẻ og:* để Zalo hiện khung xem trước.
  Cài app = hộp cài PWA sẵn có (InstallBanner `force`: Android bung hộp cài của Chrome / chỉ
  đường menu ⋮, iPhone chỉ "Thêm vào Màn hình chính") — repo chưa có link CH Play công khai
  (14 A73). Máy không cài được (máy tính, đã cài, mất sóng) ⇒ nút "Mở app" về `/`. KHÔNG SĐT (DTO không có trường
  nào mang SĐT — AC21), KHÔNG nút ghi. Bài ẩn / xoá / báo chưa duyệt ⇒ "Bài này không còn".
*/

type Props = { params: Promise<{ id: string }> };
type Got = { post: KairosPost | null; down: boolean };

// generateMetadata + trang gọi chung một lượt đọc trong cùng request
const getPost = cache(async (id: string): Promise<Got> => {
  try {
    return { post: await loadPublicPost(id), down: false };
  } catch (e) {
    console.error("[kairos] /k đọc bài hỏng:", (e as Error)?.message);
    return { post: null, down: true };
  }
});

const who = (p: KairosPost) => (p.kind === "bao" ? p.outlet || "Báo" : p.kind === "chinh-thuc" ? "SDVICO" : p.author?.handle || "Bà con");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { post } = await getPost((await params).id);
  if (!post) return { title: "Kairos — SDFish", robots: { index: false } };
  const title = post.kind === "bao" && post.title ? post.title : `${who(post)} trên Kairos`;
  const description = shareText(post);
  const image = post.images[0] ?? post.coverUrl ?? undefined;
  return {
    title: `${title} — SDFish`,
    description,
    openGraph: { title, description, type: "article", siteName: "SDFish", ...(image ? { images: [image] } : {}) },
  };
}

// cùng trần 99+ với thẻ bài (feed-client.countLabel — file đó kéo kho chuỗi phía máy, không vào trang server)
const countLabel = (n: number) => (n > 99 ? "99+" : String(Math.max(0, Math.floor(n))));
const pad = (n: number) => String(n).padStart(2, "0");
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : "";
};

export default async function PublicPostPage({ params }: Props) {
  const { post, down } = await getPost((await params).id);
  const install = (
    <InstallBanner
      force
      fallback={
        <Link href="/" className="flex h-(--h-cta) w-full items-center justify-center rounded-xl bg-trim font-semibold text-white">
          {NHAN.moApp}
        </Link>
      }
    />
  );
  if (!post) {
    return (
      <main className="space-y-4 px-4 py-6">
        <EmptyState>{down ? "Chưa xem được bài lúc này, thử lại sau." : "Bài này không còn."}</EmptyState>
        {install}
      </main>
    );
  }
  const text = post.kind === "bao" ? post.summary || post.body : post.body;
  return (
    <main className="space-y-4 px-4 py-6">
      <p className="text-[0.875rem] font-semibold text-sea">Kairos · SDFish — tin biển và chuyện bà con</p>
      <article className="surface overflow-hidden">
        <div className="px-4 pt-3 pb-2">
          <p className="font-bold text-navy">
            {who(post)}
            {(post.kind === "chinh-thuc" || post.author?.official) && <span className="ml-2 text-[0.75rem] text-sea">{NHAN.chinhThuc}</span>}
          </p>
          <p className="text-[0.8125rem] text-foreground/65">{[post.author?.subline, when(post.publishedAt)].filter(Boolean).join(" · ")}</p>
        </div>
        {post.title && post.kind !== "bao" && <h1 className="px-4 pb-1 text-[1.25rem] font-bold leading-snug text-navy">{post.title}</h1>}
        {text && <p className="whitespace-pre-line break-words px-4 pb-3 text-[1rem] leading-relaxed">{text}</p>}
        {/* bài báo: THẺ LINK như thẻ bài trong app (K3-04) — ảnh bìa + dải tên miền · tiêu đề, chạm cả khối mở bài gốc */}
        {post.kind === "bao" && (post.title || post.coverUrl) && (
          <a href={post.url ?? undefined} target="_blank" rel="noopener noreferrer" className="mb-2 block border-y border-line">
            {post.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- ảnh bìa là link RSS của báo (A12)
              <img src={post.coverUrl} alt="" referrerPolicy="no-referrer" className="aspect-[16/9] w-full bg-field object-cover" />
            )}
            <span className="flex flex-col gap-0.5 bg-field px-4 py-2">
              {tenMien(post.url) && <span className="truncate text-[0.75rem] uppercase tracking-wide text-foreground/55">{tenMien(post.url)}</span>}
              {post.title && <h1 className="line-clamp-2 text-[1rem] font-bold leading-snug text-navy">{post.title}</h1>}
            </span>
          </a>
        )}
        {post.images.map((u, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh kho kairos-media public, đã nén ở máy
          <img key={u} src={u} alt={`Ảnh ${i + 1}`} className="w-full bg-field object-cover" />
        ))}
        {!post.images.length && post.coverUrl && post.kind !== "bao" && (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh bìa là link RSS của báo (A12)
          <img src={post.coverUrl} alt="" referrerPolicy="no-referrer" className="aspect-[16/9] w-full bg-field object-cover" />
        )}
        {post.reshareOf && (
          <div className="mx-4 my-2 rounded-2xl border border-line px-3 py-2">
            <p className="text-[0.8125rem] font-semibold text-foreground/65">{who(post.reshareOf)}</p>
            <p className="line-clamp-3">{post.reshareOf.title || post.reshareOf.summary || post.reshareOf.body}</p>
          </div>
        )}
        <p className="border-t border-line px-4 py-2 text-[0.875rem] text-foreground/65">
          {countLabel(post.hayCount)} {NHAN.hay} · {countLabel(post.commentCount)} {NHAN.binhLuan.toLowerCase()}
        </p>
        {post.topComments.length > 0 && (
          <ul className="space-y-2 px-4 pb-3">
            {post.topComments.map((c) => (
              <li key={c.id} className="rounded-2xl bg-field px-3 py-1.5">
                <p className="text-[0.8125rem] font-bold text-navy">{c.author.handle}</p>
                <p className="line-clamp-3 break-words">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
      </article>
      <p className="text-[1rem]">Cài SDFish để Hay, bình luận và đọc tin biển cả khi mất sóng.</p>
      {install}
    </main>
  );
}
