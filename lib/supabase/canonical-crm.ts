export const CANONICAL_CRM_PROJECT_REF = "dlozdzcxxapmizdprjcp";

/** True only for the known canonical CRM project endpoint. */
export function isCanonicalCrmUrl(url: string): boolean {
  try {
    return new URL(url).hostname === CANONICAL_CRM_PROJECT_REF + ".supabase.co";
  } catch {
    return false;
  }
}
