import { redirect } from "next/navigation";

/** A gestão de membros pertence às Configurações da organização ativa. */
export default function TenantUsersSettingsPage() {
  redirect("/app/team");
}
