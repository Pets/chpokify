import * as Sentry from '@sentry/nextjs';
import React from 'react';

import { isSentryEnabled } from '@lib/sentry-enabled';
import { NextCustomError } from '@components/domains/layouts/NextCustomError';

export type TSentryErrorBoundaryProps = Record<string, any>;

const SentryErrorBoundary = (props: TSentryErrorBoundaryProps): React.ReactElement | null => {
  const {
    children,
    ...other
  } = props;

  // If Sentry is not enabled, just render children without error boundary
  if (!isSentryEnabled()) {
    return <>{children}</>;
  }

  // Handle case where Sentry.ErrorBoundary might be undefined (older versions or stub)
  if (!Sentry.ErrorBoundary) {
    return <>{children}</>;
  }

  return (
    <Sentry.ErrorBoundary
      showDialog
      fallback={<NextCustomError />}
      {...other}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
};

export {
  SentryErrorBoundary,
};
