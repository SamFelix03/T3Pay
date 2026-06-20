import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = process.env.VAULTPAY_API_BASE ?? "http://127.0.0.1:4000";

type Params = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: NextRequest, context: Params) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: Params) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: Params) {
  return proxy(request, context);
}

async function proxy(request: NextRequest, context: Params) {
  const { path } = await context.params;
  const target = new URL(`/${path.join("/")}`, BACKEND_BASE);
  target.search = request.nextUrl.search;

  const method = request.method;
  const hasBody = !["GET", "HEAD"].includes(method);
  const response = await fetch(target, {
    method,
    headers: hasBody ? { "content-type": request.headers.get("content-type") ?? "application/json" } : undefined,
    body: hasBody ? await request.text() : undefined,
    cache: "no-store"
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
