import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import { normalizeUsername } from "./auth.ts";

it("usernames are trimmed and lowercased", () => {
  expect(normalizeUsername("  Léa  ")).toBe("léa");
});

it("username normalization does not depend on the process locale", () => {
  // Dotted capital I lowercases to "i" + combining dot under toLowerCase in any
  // locale. Under tr_TR, toLocaleLowerCase would drop the dot instead.
  const authUrl = new URL("./auth.ts", import.meta.url).href;
  const script = `import { normalizeUsername } from ${JSON.stringify(authUrl)}; process.stdout.write(normalizeUsername("İZMİR"));`;
  const turkish = execFileSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      encoding: "utf8",
      env: { ...process.env, LANG: "tr_TR.UTF-8", LC_ALL: "tr_TR.UTF-8" },
    },
  );
  expect(turkish).toBe("i\u0307zmi\u0307r");
});
