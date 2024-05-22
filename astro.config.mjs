import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import {
  transformerMetaHighlight,
  transformerMetaWordHighlight,
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";

import playformCompress from "@playform/compress";

// https://astro.build/config
export default defineConfig({
  compressHTML: true,
  site: 'https://oliveirarleo.github.io',
  integrations: [mdx(), sitemap(), playformCompress()],
  markdown: {
    shikiConfig: {
      // https://shiki.style/themes
      theme: "github-dark",
      // https://shiki.style/languages
      langs: ["typescript", "elixir"],
      wrap: true,
      // Add custom transformers: https://shiki.style/guide/transformers
      // Find common transformers: https://shiki.style/packages/transformers
      transformers: [
        transformerNotationDiff(),
        transformerNotationHighlight(),
        transformerNotationFocus(),
        transformerNotationErrorLevel(),
        transformerNotationWordHighlight(),
        transformerMetaHighlight(),
        transformerMetaWordHighlight(),
      ],
    },
  },
});
