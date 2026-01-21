// Stub for @sentry/nextjs in standalone builds
// This prevents the real @sentry/nextjs from loading and trying to require 'next'

const noop = () => {};
const noopPromise = () => Promise.resolve();

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
};
