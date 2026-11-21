import { Data, Effect } from "effect";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiErrorCode } from "../shared/api-errors.ts";

export class HttpError extends Data.TaggedError("HttpError")<{
  status: ContentfulStatusCode;
  code: ApiErrorCode;
  message: string;
}> {}

export const errorBody = (code: ApiErrorCode, message: string) => ({
  error: { code, message },
});

export const jsonError = (
  status: ContentfulStatusCode,
  code: ApiErrorCode,
  message: string,
) => Effect.fail(new HttpError({ status, code, message }));

/** The one wire shape for failures: `{ error: { code, message } }`. */
export const jsonApiError = (
  c: Context,
  status: ContentfulStatusCode,
  code: ApiErrorCode,
  message: string,
) => c.json(errorBody(code, message), status);

/** Maps anything that is not already an `HttpError` onto an internal error. */
export const asHttpError = (error: unknown) =>
  error instanceof HttpError
    ? error
    : new HttpError({
        status: 500,
        code: "internal",
        message: "The request could not be completed.",
      });

export async function respond<A>(
  c: Context,
  effect: Effect.Effect<A, HttpError>,
  successStatus: ContentfulStatusCode = 200,
) {
  return Effect.runPromise(
    Effect.match(effect, {
      onFailure: (error) =>
        c.json(errorBody(error.code, error.message), error.status),
      onSuccess: (value) => c.json(value, successStatus),
    }),
  );
}
