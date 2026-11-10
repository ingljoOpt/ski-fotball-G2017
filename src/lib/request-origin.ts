export function isSameOrigin(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.slice(0, -1);
  return Boolean(host && (protocol === "http" || protocol === "https") && request.headers.get("origin") === `${protocol}://${host}`);
}