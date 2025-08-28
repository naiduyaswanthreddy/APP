export const formatAmount = (value) => {
  if (value === null || value === undefined) return null;
  const num = Number(String(value).toString().replace(/[,\s]/g, ''));
  if (!isFinite(num) || num <= 0) return null;
  try {
    return num.toLocaleString('en-IN');
  } catch (_) {
    return String(num);
  }
};

// Formats a value as Indian Rupees with grouping and optional symbol
// Examples:
//  formatINR(125000) => "₹ 1,25,000"
//  formatINR('25000', false) => "25,000"
export const formatINR = (value, withSymbol = true) => {
  const formatted = formatAmount(value);
  if (!formatted) return 'N/A';
  return withSymbol ? `₹ ${formatted}` : formatted;
};
