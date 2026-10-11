export function promoExpiryPatch(action: 'keep' | 'set' | 'clear', value: string): { expiresAt?: string | null } {
  if (action === 'keep') return {};
  if (action === 'clear') return { expiresAt: null };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Geçerli bir son kullanma tarihi seçin.');
  const date = new Date(`${value}:00+03:00`);
  if (Number.isNaN(date.getTime())) throw new Error('Geçerli bir son kullanma tarihi seçin.');
  return { expiresAt: date.toISOString() };
}
