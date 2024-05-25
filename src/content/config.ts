import { defineCollection, z } from "astro:content";

export const blog = defineCollection({
  type: "content",
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: image(),
    }),
});

export const collections = { tech: blog, personal: blog };
