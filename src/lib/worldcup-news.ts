export type WorldCupNewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
};

const defaultNewsRssUrl =
  "https://news.google.com/rss/search?q=Copa%20Mundial%20FIFA%202026%20Mundial%202026&hl=es-419&gl=CO&ceid=CO:es-419";

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function tagValue(item: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i");
  return decodeHtml(item.match(pattern)?.[1] || "");
}

export async function fetchWorldCupNews() {
  const newsRssUrl = process.env.NEWS_RSS_URL || defaultNewsRssUrl;

  const response = await fetch(newsRssUrl, {
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`No se pudieron cargar noticias: ${response.status}`);
  }

  const xml = await response.text();
  const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi))
    .slice(0, 8)
    .map((match) => {
      const item = match[1];
      const publishedAt = tagValue(item, "pubDate");

      return {
        title: tagValue(item, "title"),
        link: tagValue(item, "link"),
        source: tagValue(item, "source") || "Noticias Mundial 2026",
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null,
      };
    })
    .filter((item) => item.title && item.link);

  return {
    source: newsRssUrl,
    items,
  };
}
