export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const r3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const DAY_MS = 86400000;

const offsetMin = () => Number(process.env.TZ_OFFSET_MIN ?? 330);
/** Midnight (UTC-encoded) of the kitchen's local "today". */
export const today = () => {
  const d = new Date(Date.now() + offsetMin() * 60000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};
export const addDays = (d, n) => new Date(d.getTime() + n * DAY_MS);
export const parseDay = (s) => new Date(`${s}T00:00:00.000Z`);
export const ymd = (d) => new Date(d).toISOString().slice(0, 10);
export const expiryWarnDays = () => Number(process.env.EXPIRY_WARN_DAYS ?? 3);
