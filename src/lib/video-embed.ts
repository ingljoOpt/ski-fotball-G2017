export function videoEmbedUrl(value: string): string | null {
  if (!value) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1);
  if (["youtube.com", "www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com"].includes(host)) {
    id = url.pathname === "/watch" ? url.searchParams.get("v") : /^\/(?:embed|shorts)\/([^/]+)\/?$/.exec(url.pathname)?.[1] ?? null;
  }
  if (id && /^[\w-]{11}$/.test(id)) return `https://www.youtube.com/embed/${id}`;
  if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) {
    const match = /^\/(?:video\/)?(\d+)\/?$/.exec(url.pathname);
    if (match) return `https://player.vimeo.com/video/${match[1]}`;
  }
  return null;
}

export function videoWatchUrl(value: string): string | null {
  const embedUrl = videoEmbedUrl(value);
  if (!embedUrl) return null;
  const url = new URL(embedUrl);
  const id = url.pathname.split("/").pop();
  return url.hostname === "www.youtube.com"
    ? `https://www.youtube.com/watch?v=${id}`
    : `https://vimeo.com/${id}`;
}
