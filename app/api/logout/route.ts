import { NextResponse } from "next/server";

const COOKIE = "gardez_session";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
