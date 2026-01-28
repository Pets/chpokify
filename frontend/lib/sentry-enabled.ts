/**
 * Helper to determine if Sentry is enabled.
 * Sentry is only enabled if CLIENT_SENTRY_DSN is explicitly set.
 */

export const isSentryEnabled = (): boolean => {
  // Check if CLIENT_SENTRY_DSN is set (client-side or SSR)
  const dsn = typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_SENTRY_DSN
    : process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

  return Boolean(dsn);
};
