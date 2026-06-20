import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin/auth";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  if (!supabase) redirect("/");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminUser(user)) redirect("/");

  return <AdminShell>{children}</AdminShell>;
}
