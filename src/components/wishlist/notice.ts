export type NoticeTone = "info" | "success" | "error";

/** One message channel for the whole island. */
export interface Notice {
  text: string;
  tone: NoticeTone;
}
