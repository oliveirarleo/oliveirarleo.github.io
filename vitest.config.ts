import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "server",
          environment: "node",
          include: ["server/**/*.test.ts", "src/lib/**/*.test.ts"],
          testTimeout: 30_000,
        },
      },
      {
        plugins: [solid()],
        test: {
          name: "ui",
          environment: "jsdom",
          globals: true,
          include: ["src/components/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
