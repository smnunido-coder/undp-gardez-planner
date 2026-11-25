import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/auth";
import { matchStaff, normalizeNameInput } from "@/lib/names";
import { listStaff } from "@/lib/queries";

export async function POST(request: Request) {
  const form = await request.formData();
  const cleaned = normalizeNameInput(String(form.get("lastName") ?? ""));
  const staffId = String(form.get("staffId") ?? "");
  const back = (query: string) => NextResponse.redirect(new URL(`/login?${query}`, request.url), 303);

  if (!cleaned) return back("error=empty");

  let staff;
  try {
    staff = await listStaff();
  } catch {
    return back("error=database");
  }

  const any = matchStaff(staff, cleaned, { includeInactive: true });
  const matches = any.filter((person) => person.active);
  if (any.length > 0 && matches.length === 0) {
    return back(`error=inactive&name=${encodeURIComponent(cleaned)}`);
  }

  const chosen = staffId ? matches.find((person) => person.id === staffId) : matches.length === 1 ? matches[0] : undefined;
  if (!chosen && matches.length > 1) return back(`choose=${encodeURIComponent(cleaned)}`);
  if (!chosen) return back(`error=none&name=${encodeURIComponent(cleaned)}`);

  const cookie = sessionCookie(chosen.id);
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
