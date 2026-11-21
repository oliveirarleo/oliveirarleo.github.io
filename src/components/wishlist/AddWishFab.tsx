import { Gift } from "lucide-solid";

/**
 * DaisyUI's single-FAB pattern: one `.fab` wrapper with one button as its
 * child. The wrapper handles fixed placement and pointer events.
 */
export default function AddWishFab(props: { onPress: () => void }) {
  return (
    <div
      class="fab"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        class="btn btn-lg btn-circle btn-primary shadow-[0_10px_24px_rgba(23,63,53,0.35)]"
        aria-label="Add a wish"
        aria-haspopup="dialog"
        aria-controls="add-wish-dialog"
        onClick={props.onPress}
      >
        <Gift size={26} strokeWidth={1.7} aria-hidden="true" />
      </button>
    </div>
  );
}
