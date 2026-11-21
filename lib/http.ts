import { NextResponse } from 'next/server';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Wraps a route handler: JSON errors with the right status, never a stack trace. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response | unknown>) {
  return async (...args: A) => {
    try {
      const out = await fn(...args);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status });
    }
  };
}
