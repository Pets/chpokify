// Stub for @sentry/nextjs in standalone builds
// This prevents the real @sentry/nextjs from loading and trying to require 'next'

const React = require('react');

const noop = () => {};
const noopPromise = () => Promise.resolve();

// ErrorBoundary stub component - just renders children
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.props.fallback) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

module.exports = {
  init: noop,
  captureException: noop,
  captureMessage: noop,
  captureEvent: noop,
  addBreadcrumb: noop,
  setUser: noop,
  setTag: noop,
  setTags: noop,
  setExtra: noop,
  setExtras: noop,
  setContext: noop,
  configureScope: noop,
  withScope: (fn) => fn({ setTag: noop, setExtra: noop, setUser: noop }),
  startTransaction: () => ({ finish: noop, setTag: noop, setData: noop }),
  flush: noopPromise,
  close: noopPromise,
  defaultIntegrations: [],
  Severity: {
    Fatal: 'fatal',
    Error: 'error',
    Warning: 'warning',
    Log: 'log',
    Info: 'info',
    Debug: 'debug',
  },
  // React components
  ErrorBoundary: ErrorBoundary,
};
