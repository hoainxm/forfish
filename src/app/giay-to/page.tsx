import { DocumentVault } from "@/components/document-vault";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export const metadata = {
  title: "Tủ giấy tờ — ForFish",
};

export default function GiayToPage() {
  return (
    <div>
      <header className="bg-gradient-to-br from-[#5a2c73] to-t4 px-5 pb-6 pt-8 text-white">
        <p className="text-xs uppercase tracking-widest text-white/70">
          Trục 4 · Tuân thủ dễ hơn
        </p>
        <h1 className="mt-1 text-2xl font-bold">Tủ giấy tờ của tàu</h1>
        <p className="mt-1 text-sm text-white/85">
          Nhắc trước khi đăng kiểm, giấy phép hết hạn — tránh bị phạt oan.
        </p>
      </header>

      <DocumentVault supabaseReady={isSupabaseConfigured()} />
    </div>
  );
}
