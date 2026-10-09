/** Read a JSON request with a hard streaming limit, including chunked uploads. */
export async function readLimitedJson(
  request: Request,
  maxBytes: number
): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Request body is required');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error('Request too large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
