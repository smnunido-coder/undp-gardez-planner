import { getCurrentUser } from "@/lib/auth";
import { getBtorPhoto } from "@/lib/queries";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await getCurrentUser();
  const { id } = await context.params;
  const photo = await getBtorPhoto(id);
  if (!photo || photo.bytes.length === 0) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
