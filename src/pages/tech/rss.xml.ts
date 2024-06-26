import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { SITE_DESCRIPTION, SITE_TITLE } from "../../consts";

export async function GET(context: APIContext) {
  const posts = await getCollection("tech");
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site ?? "oliveirarleo.com",
    items: posts.map((post) => ({
      ...post.data,
      link: `/${post.collection}/${post.slug}/`,
    })),
  });
}
