import { useNavigate, useParams } from "@tanstack/react-router";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { useEstateList } from "@/lib/estates";

const storageKey = "upkeep:current-estate";

// Storage can be unavailable (private windows, blocked site data); the
// switcher still works, it just forgets the last choice.
function readRemembered(): string | undefined {
  try {
    return localStorage.getItem(storageKey) ?? undefined;
  } catch {
    return undefined;
  }
}

function remember(estateId: string): void {
  try {
    localStorage.setItem(storageKey, estateId);
  } catch {
    // See readRemembered.
  }
}

export function EstateSwitcher() {
  const estates = useEstateList("ACTIVE");
  const navigate = useNavigate();
  const { estateId: viewedEstateId } = useParams({ strict: false });
  const [rememberedEstateId, setRememberedEstateId] = useState<string>();
  useEffect(() => setRememberedEstateId(readRemembered()), []);

  const switchEstate = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const estateId = event.target.value;
      remember(estateId);
      setRememberedEstateId(estateId);
      navigate({ to: "/estates/$estateId", params: { estateId } });
    },
    [navigate]
  );

  const options = estates.data ?? [];
  if (options.length === 0) {
    return null;
  }

  // Prefer the estate on screen; a remembered estate the user has since lost
  // access to is ignored.
  const current =
    [viewedEstateId, rememberedEstateId].find((id) =>
      options.some((estate) => estate.id === id)
    ) ?? "";

  return (
    <label className="flex items-center gap-2 text-sm">
      Current estate
      <select
        className="border bg-background px-2 py-1"
        onChange={switchEstate}
        value={current}
      >
        <option disabled value="">
          Choose an estate
        </option>
        {options.map((estate) => (
          <option key={estate.id} value={estate.id}>
            {estate.name}
          </option>
        ))}
      </select>
    </label>
  );
}
