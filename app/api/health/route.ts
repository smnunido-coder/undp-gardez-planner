import { connection } from "next/server";
import { listStaff } from "@/lib/queries";

export async function GET() {
  await connection();
  const url = process.env.TURSO_DATABASE_URL ?? "";
  try {
    const staff = await listStaff();
    return Response.json({
      ok: true,
      staff: staff.length,
      hasDatabaseUrl: url.length > 0,
      databaseUrlLooksRight: url.startsWith("libsql://") || url.startsWith("https://"),
      hasToken: Boolean(process.env.TURSO_AUTH_TOKEN),
      hasSessionSecret: Boolean(process.env.SESSION_SECRET),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return Response.json({
      ok: false,
      message: message.slice(0, 300),
      hasDatabaseUrl: url.length > 0,
      databaseUrlLooksRight: url.startsWith("libsql://") || url.startsWith("https://"),
      hasToken: Boolean(process.env.TURSO_AUTH_TOKEN),
      hasSessionSecret: Boolean(process.env.SESSION_SECRET),
    });
  }
}
