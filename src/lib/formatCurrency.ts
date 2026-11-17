export function formatINR(amount: number | string | null | undefined): string {
  const num = Number(amount || 0);
  if (!Number.isFinite(num)) return '₹0';
  const hasDecimals = Math.round(num * 100) % 100 !== 0;
  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  })}`;
}
