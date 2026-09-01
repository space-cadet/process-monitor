export const MAX_API_RESPONSE_BYTES = 2 * 1024 * 1024;

export function serializeBoundedJson(payload: unknown, maxBytes: number = MAX_API_RESPONSE_BYTES): { body: string; tooLarge: boolean } {
  const body = JSON.stringify(payload);
  return { body, tooLarge: Buffer.byteLength(body, 'utf8') > maxBytes };
}
