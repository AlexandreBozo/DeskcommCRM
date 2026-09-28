import { requireAuth } from "@/lib/auth/server";
import { FornecedoresClient } from "./FornecedoresClient";

export default async function FornecedoresPage() {
  await requireAuth();
  return <div className="p-6"><FornecedoresClient /></div>;
}
