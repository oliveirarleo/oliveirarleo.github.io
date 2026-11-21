import { Data, Effect } from "effect";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class HttpError extends Data.TaggedError("HttpError")<{
  status: ContentfulStatusCode;
  message: string;
}> {}

export const jsonError = (status: ContentfulStatusCode, message: string) =>
  Effect.fail(new HttpError({ status, message }));

export async function respond<A>(
  c: Context,
  effect: Effect.Effect<A, HttpError>,
  successStatus: ContentfulStatusCode = 200,
) {
  return Effect.runPromise(
    Effect.match(effect, {
      onFailure: (error) => c.json({ error: error.message }, error.status),
      onSuccess: (value) => c.json(value, successStatus),
    }),
  );
}
