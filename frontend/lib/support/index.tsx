const appDomain = typeof window !== 'undefined' ? window.location.hostname : (process.env.APP_DOMAIN || 'chpokify.com');
const emailSupport = `mailto:info@${appDomain}`;

const openEmailModal = () => window.open(emailSupport);

const support = {
  openEmailModal,
};

export { support };
