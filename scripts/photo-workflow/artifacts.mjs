import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const digest = value => createHash('sha256').update(value).digest('hex');
export const save = (directory, name, value) => writeFile(join(directory, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
export const reasonText = reason => {
  const text = reason instanceof Error ? reason.message : String(reason);
  return process.env.OPENAI_API_KEY ? text.replaceAll(process.env.OPENAI_API_KEY, '[redacted]') : text;
};
