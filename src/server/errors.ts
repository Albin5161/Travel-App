// Every failure the API reports has a code the app can branch on and a sentence it can show as is.
export type ErrorCode =
  | 'bad_request'
  | 'unsupported_link'
  | 'video_unavailable'
  | 'missing_key'
  | 'upstream'
  | 'quota';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** A failed call to YouTube, Gemini or Places, reported without leaking its body to the app. */
export async function upstreamError(service: string, res: Response): Promise<ApiError> {
  const detail = await res.text().catch(() => '');
  console.error(`[${service}] ${res.status} ${detail.slice(0, 500)}`);
  if (res.status === 429) {
    return new ApiError(503, 'quota', 'We’re at our limit for now. Try again in a few minutes.');
  }
  return new ApiError(502, 'upstream', 'Something went wrong on our side. Try again.');
}

/** Runs a route body and turns its result or its ApiError into a JSON response. */
export async function respond(run: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await run());
  } catch (e) {
    if (e instanceof ApiError) {
      return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status });
    }
    // A timeout from AbortSignal.timeout surfaces as a DOMException named TimeoutError.
    if (e instanceof Error && e.name === 'TimeoutError') {
      console.error('[timeout]', e.message);
      return Response.json(
        { error: { code: 'upstream', message: 'That took too long. Try again.' } },
        { status: 504 },
      );
    }
    console.error('[unexpected]', e);
    return Response.json(
      { error: { code: 'upstream', message: 'Something went wrong on our side. Try again.' } },
      { status: 500 },
    );
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError(400, 'bad_request', 'Send a JSON body.');
  }
}
