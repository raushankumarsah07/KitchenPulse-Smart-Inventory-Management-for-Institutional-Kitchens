import { HttpError } from './utils.js';
export function validate(schema, data) {
  const out = schema.safeParse(data);
  if (!out.success) {
    const i = out.error.issues[0];
    const path = i.path.length ? `${i.path.join('.')}: ` : '';
    throw new HttpError(400, `${path}${i.message}`);
  }
  return out.data;
}
