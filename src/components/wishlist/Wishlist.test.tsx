import { fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Wishlist from "../Wishlist";

type MediaListener = (event: MediaQueryListEvent) => void;

let viewportWidth = 1280;
const mediaListeners = new Set<MediaListener>();

function matchesQuery(query: string) {
  const min = /min-width:\s*(\d+)px/.exec(query);
  const max = /max-width:\s*(\d+)px/.exec(query);
  const aboveMin = min ? viewportWidth >= Number(min[1]) : true;
  const belowMax = max ? viewportWidth <= Number(max[1]) : true;
  return aboveMin && belowMax;
}

beforeEach(() => {
  viewportWidth = 1280;
  mediaListeners.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ wishes: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matchesQuery(query),
    media: query,
    onchange: null,
    addEventListener: (_: string, listener: MediaListener) =>
      mediaListeners.add(listener),
    removeEventListener: (_: string, listener: MediaListener) =>
      mediaListeners.delete(listener),
    dispatchEvent: () => false,
  }));
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Wishlist layout", () => {
  it("puts the wishlist before the add form in document order", () => {
    const { container } = render(() => <Wishlist apiUrl="https://api.test" />);

    const list = container.querySelector(
      'section[aria-labelledby="wishes-title"]',
    );
    const form = container.querySelector("#wish-form");

    if (!list || !form) throw new Error("Wishlist or form did not render");

    // On small screens the grid stacks in document order, so the list must
    // come first. DOCUMENT_POSITION_FOLLOWING means `form` follows `list`.
    expect(
      list.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows the add-wish panel in place on desktop", () => {
    const { container } = render(() => <Wishlist apiUrl="https://api.test" />);

    const panel = container.querySelector<HTMLDialogElement>(
      'dialog[aria-labelledby="form-title"]',
    );
    expect(panel?.hasAttribute("open")).toBe(true);
    expect(screen.getByLabelText("What are you wishing for?")).not.toBeNull();
  });

  it("opens the add-wish dialog from the floating button on mobile", () => {
    viewportWidth = 390;
    const { container } = render(() => <Wishlist apiUrl="https://api.test" />);

    const panel = container.querySelector<HTMLDialogElement>(
      'dialog[aria-labelledby="form-title"]',
    );
    expect(panel?.open).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Add a wish" }));

    expect(panel?.open).toBe(true);
  });
});
