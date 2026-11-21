import { X } from "lucide-solid";

/**
 * DaisyUI-style corner close button for a native <dialog>. Submitting a
 * `method="dialog"` form closes it, which also fires the dialog's close event.
 */
export default function DialogClose(props: {
  label?: string;
  disabled?: boolean;
}) {
  return (
    <form method="dialog" class="absolute right-3 top-3">
      <button
        type="submit"
        class="btn btn-circle btn-ghost btn-sm"
        aria-label={props.label ?? "Close"}
        title="Close"
        disabled={props.disabled}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </form>
  );
}
