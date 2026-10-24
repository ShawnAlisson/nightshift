/** The `error` message from one of our JSON API responses, or the fallback. */
export async function errorFrom(response: Response, fallback: string) {
  const { error } = await response.json().catch(() => ({}));
  return typeof error === "string" ? error : fallback;
}
