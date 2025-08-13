export const parseCTCToLPA = (value) => {
  if (value == null) return 0;
  if (typeof value === 'number') {
    if (value >= 100000) return +(value / 100000).toFixed(2);
    return +value.toFixed(2);
  }
  const raw = String(value).trim();
  let cleaned = raw.replace(/[\,\s]/g, '').replace(/₹|rs\.?|inr/gi, '').toLowerCase();
  if (/lpa$/.test(cleaned)) {
    const num = parseFloat(cleaned.replace(/lpa$/, ''));
    return isNaN(num) ? 0 : +num.toFixed(2);
  }
  if (/lac|lakh|lakhs/.test(cleaned)) {
    const num = parseFloat(cleaned.replace(/lac|lakh|lakhs/, ''));
    return isNaN(num) ? 0 : +num.toFixed(2);
  }
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  if (num >= 100000) return +(num / 100000).toFixed(2);
  return +num.toFixed(2);
};

export const summarizeCTCs = (lpaValues) => {
  const vals = (lpaValues || []).filter(v => typeof v === 'number' && v > 0).sort((a, b) => a - b);
  if (!vals.length) return { min: 0, max: 0, avg: 0, p50: 0, p90: 0 };
  const sum = vals.reduce((s, v) => s + v, 0);
  const avg = +(sum / vals.length).toFixed(2);
  const p = (q) => {
    const idx = Math.ceil((q / 100) * vals.length) - 1;
    return +vals[Math.max(0, Math.min(vals.length - 1, idx))].toFixed(2);
  };
  return {
    min: +vals[0].toFixed(2),
    max: +vals[vals.length - 1].toFixed(2),
    avg,
    p50: p(50),
    p90: p(90),
  };
};

