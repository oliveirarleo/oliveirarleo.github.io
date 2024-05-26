import mdx from "@astrojs/mdx";
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
import { defineConfig } from "astro/config";

import playformCompress from "@playform/compress";
import AstroPWA from "@vite-pwa/astro";
import rehypeExternalLinks from "rehype-external-links";

// https://astro.build/config
export default defineConfig({
  compressHTML: true,
  site: "https://oliveirarleo.com",
  integrations: [
    mdx({
      rehypePlugins: [
        [rehypeExternalLinks, { rel: ["noopener"], target: ["_blank"] }],
      ],
    }),
    sitemap(),
    AstroPWA({
      devOptions: {
        enabled: true,
      },
      workbox: {
        navigateFallback: "/",
        globPatterns: ["**/*.{css,js,html,svg,png,ico,txt}"],
      },
      mode: "production",
      base: "/",
      scope: "/",
      includeAssets: ["favicon.svg"],
      registerType: "autoUpdate",
      manifest: {
        name: "OliveiraRLeo Blog",
        short_name: "oliveirarleo",
        theme_color: "#015293",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
    playformCompress(),
  ],
  markdown: {
    rehypePlugins: [rehypeExternalLinks],
    shikiConfig: {
      // https://shiki.style/themes
      theme: "github-dark",
      // https://shiki.style/languages
      langs: [],
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
