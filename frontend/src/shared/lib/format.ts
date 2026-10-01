const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
const integer = new Intl.NumberFormat('es-GT');
const date = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium' });
const dateTime = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' });

export const formatMoney = (value: string | number) => money.format(Number(value));
export const formatNumber = (value: number) => integer.format(value);
export const formatDate = (iso: string) => date.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

const rating = new Intl.NumberFormat('es-GT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
export const formatRating = (value: number) => rating.format(value);
