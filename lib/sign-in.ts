import { matchStaff, normalizeNameInput } from "@/lib/names";
import { verifyPassword } from "@/lib/passwords";
import { getPasswordHash, listStaff } from "@/lib/queries";

export async function checkSignIn(input: {
  lastName: string;
  staffId: string;
  password: string;
}): Promise<{ ok: true; staffId: string } | { ok: false; query: string }> {
  const cleaned = normalizeNameInput(input.lastName);
  if (!cleaned) return { ok: false, query: "error=empty" };

  let staff;
  try {
    staff = await listStaff();
  } catch {
    return { ok: false, query: "error=database" };
  }

  const any = matchStaff(staff, cleaned, { includeInactive: true });
  const matches = any.filter((person) => person.active);
  if (any.length > 0 && matches.length === 0) {
    return { ok: false, query: `error=inactive&name=${encodeURIComponent(cleaned)}` };
  }

  const chosen = input.staffId
    ? matches.find((person) => person.id === input.staffId)
    : matches.length === 1
      ? matches[0]
      : undefined;
  if (!chosen && matches.length > 1) return { ok: false, query: `choose=${encodeURIComponent(cleaned)}` };
  if (!chosen) return { ok: false, query: `error=none&name=${encodeURIComponent(cleaned)}` };

  const hash = await getPasswordHash(chosen.id);
  if (!(await verifyPassword(input.password, hash))) {
    return { ok: false, query: `error=password&name=${encodeURIComponent(cleaned)}` };
  }
  return { ok: true, staffId: chosen.id };
}
