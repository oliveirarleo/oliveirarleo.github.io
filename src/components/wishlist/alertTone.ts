/** DaisyUI tone for a status alert: an error when `isError`, otherwise info. */
export function alertTone(isError: boolean) {
  return { "alert-error": isError, "alert-info": !isError };
}
