import HomePage from "@/components/home/HomePage";
import PromoLanding from "@/components/promo/PromoLanding";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return <HomePage />;
    }
  }

  return <PromoLanding />;
}
