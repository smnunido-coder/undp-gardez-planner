import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getStaff } from "@/lib/queries";
import type { Staff } from "@/lib/types";

const COOKIE = "gardez_session";
const MAX_AGE_SECONDS = 60 * 24 * 60 * 60;

type SessionPayload = { staffId: string; exp: number; v: number };

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Set SESSION_SECRET before running the planner in production. See the README.");
  }
  return "gardez-dev-session-secret-change-me";
}

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

function sign(staffId: string, sessionVersion: number, now: number): string {
  const body = Buffer.from(
    JSON.stringify({ staffId, exp: now + MAX_AGE_SECONDS * 1000, v: sessionVersion } satisfies SessionPayload),
    "utf8",
  ).toString("base64url");
  const signature = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function readToken(token: string, now: number): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!parsed.staffId || typeof parsed.exp !== "number" || parsed.exp < now || typeof parsed.v !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function sessionCookie(staffId: string, sessionVersion: number) {
  return {
    name: COOKIE,
    value: sign(staffId, sessionVersion, Date.now()),
    options: { ...cookieBase(), maxAge: MAX_AGE_SECONDS },
  };
}

export async function setSession(staffId: string): Promise<void> {
  await connection();
  const staff = await getStaff(staffId);
  if (!staff) return;
  const cookie = sessionCookie(staff.id, staff.sessionVersion);
  const jar = await cookies();
  jar.set(cookie.name, cookie.value, cookie.options);
}

export async function clearSession(): Promise<void> {
  try {
    const jar = await cookies();
    jar.set(COOKIE, "", { ...cookieBase(), maxAge: 0 });
  } catch {
    // A page render cannot clear a cookie. The next sign-in replaces it.
  }
}

export async function getOptionalUser(): Promise<Staff | null> {
  await connection();
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = readToken(token, Date.now());
  if (!session) {
    await clearSession();
    return null;
  }
  const staff = await getStaff(session.staffId);
  if (!staff || !staff.active || staff.sessionVersion !== session.v) {
    await clearSession();
    return null;
  }
  return staff;
}

export async function getCurrentUser(): Promise<Staff> {
  const user = await getOptionalUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<Staff> {
  const user = await getCurrentUser();
  if (!user.isAdmin) redirect("/");
  return user;
}
