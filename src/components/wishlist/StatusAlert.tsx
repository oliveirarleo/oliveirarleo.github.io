import type { Notice } from "./notice";

/** The single alert rendering used by both the list and the add panel. */
export default function StatusAlert(props: { notice: Notice; class?: string }) {
  return (
    <div
      class={`alert alert-soft text-sm ${props.class ?? ""}`}
      classList={{
        "alert-error": props.notice.tone === "error",
        "alert-success": props.notice.tone === "success",
        "alert-info": props.notice.tone === "info",
      }}
      role="status"
    >
      {props.notice.text}
    </div>
  );
}
