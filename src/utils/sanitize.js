export const sanitizeHtml = (html) => {
  if (!html) return '';
  try {
    // Lazy require to avoid adding to initial bundle unnecessarily
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const DOMPurify = require('dompurify');
    return DOMPurify.sanitize(String(html), {
      USE_PROFILES: { html: true },
    });
  } catch (e) {
    // Fallback: strip tags
    return String(html).replace(/<[^>]*>/g, '');
  }
};

