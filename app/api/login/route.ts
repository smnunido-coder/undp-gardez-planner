import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/auth";
import { getStaff } from "@/lib/queries";
import { checkSignIn } from "@/lib/sign-in";

export async function POST(request: Request) {
  const form = await request.formData();
  const result = await checkSignIn({
    lastName: String(form.get("lastName") ?? ""),
    staffId: String(form.get("staffId") ?? ""),
    password: String(form.get("password") ?? ""),
  });
  if (!result.ok) {
    return NextResponse.redirect(new URL(`/login?${result.query}`, request.url), 303);
  }
  const staff = await getStaff(result.staffId);
  if (!staff) {
    return NextResponse.redirect(new URL("/login?error=database", request.url), 303);
  }
  const cookie = sessionCookie(staff.id, staff.sessionVersion);
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
