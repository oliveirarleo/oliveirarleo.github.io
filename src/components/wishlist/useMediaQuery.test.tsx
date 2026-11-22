import { render } from "@solidjs/testing-library";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useMediaQuery } from "./useMediaQuery";

// A phone viewport: every query matches, which is what used to break hydration.
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("starts at the server value so the first render matches the markup", () => {
  let firstRender: boolean | undefined;

  const Probe = () => {
    const isMobile = useMediaQuery("(max-width: 1023px)");
    firstRender ??= isMobile();
    return <span>{String(isMobile())}</span>;
  };

  const { container } = render(() => <Probe />);

  // Server rendering has no matchMedia and renders `false`. The client's first
  // render must agree, otherwise Solid hydrates against different markup.
  expect(firstRender).toBe(false);
  // After mount the real media query value takes over.
  expect(container.textContent).toBe("true");
});
