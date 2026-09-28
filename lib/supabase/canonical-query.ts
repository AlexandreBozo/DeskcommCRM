type CanonicalResponse<T> = {
  data: T | null;
  error: { message: string } | null;
  count: number | null;
};

type CanonicalBuilder<T> = {
  select(columns: string, options?: { count?: "exact"; head?: boolean }): CanonicalQuery<T>;
  eq(column: string, value: unknown): CanonicalQuery<T>;
  is(column: string, value: null): CanonicalQuery<T>;
  in(column: string, values: readonly string[]): CanonicalQuery<T>;
  not(column: string, operator: string, value: string): CanonicalQuery<T>;
  gte(column: string, value: string): CanonicalQuery<T>;
  or(filters: string): CanonicalQuery<T>;
  order(column: string, options?: { ascending?: boolean }): CanonicalQuery<T>;
  limit(count: number): CanonicalQuery<T>;
  single(): CanonicalSingleQuery<T>;
};

export type CanonicalQuery<T> = PromiseLike<CanonicalResponse<T[]>> & CanonicalBuilder<T>;
type CanonicalSingleQuery<T> = PromiseLike<CanonicalResponse<T>> & CanonicalBuilder<T>;

type CanonicalOrganization = {
  id: string;
  name: string;
  slug: string;
  status: string;
  primary_domain: string | null;
  subdomain: string | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

type CanonicalMembership = {
  user_id: string;
  organization_id: string;
  status: string;
  joined_at: string | null;
  deleted_at: string | null;
  member_roles: Array<{ roles: { code: string; deleted_at: string | null } | null }> | null;
  organizations: { name: string; slug: string; deleted_at: string | null } | null;
};

type CanonicalPlatformAdmin = {
  user_id: string;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
};

type CanonicalRows = {
  organizations: CanonicalOrganization;
  organization_members: CanonicalMembership;
  platform_admins: CanonicalPlatformAdmin;
};

export type CanonicalFrom = <T extends keyof CanonicalRows>(
  relation: T,
) => CanonicalQuery<CanonicalRows[T]>;
