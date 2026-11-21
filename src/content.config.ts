import { defineCollection, type SchemaContext } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "zod";

const schema = ({ image }: SchemaContext) =>
  z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: image(),
  });

const blog = (collection: "personal" | "tech") =>
  defineCollection({
    loader: glob({
      pattern: "**/*.{md,mdx}",
      base: `./src/content/${collection}`,
    }),
    schema,
  });

export const collections = {
  tech: blog("tech"),
  personal: blog("personal"),
};
