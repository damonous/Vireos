export type FrontendRole = 'advisor' | 'admin' | 'compliance-officer' | 'super-admin';

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  subscriptionStatus?: string;
}

export interface UserSettings {
  preferredMode?: 'easy' | 'boss';
  [key: string]: unknown;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: FrontendRole;
  orgId: string;
  organization?: OrganizationSummary;
  settings?: UserSettings;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    orgId: string;
  };
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface OrganizationListItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  subscriptionStatus: string;
  creditBalance: number;
  createdAt: string;
}

export interface FeatureFlag {
  id: string;
  organizationId: string;
  flag: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
