import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
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
    (estateId: string | null) => {
      if (!estateId) {
        return;
      }
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

  const items = [
    { value: "", label: "Choose an estate" },
    ...options.map((estate) => ({ value: estate.id, label: estate.name })),
  ];

  return (
    <div className="flex items-center gap-2">
      <Label className="text-sm" htmlFor="current-estate">
        Current estate
      </Label>
      <Select items={items} onValueChange={switchEstate} value={current}>
        <SelectTrigger id="current-estate">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem disabled value="">
            Choose an estate
          </SelectItem>
          {options.map((estate) => (
            <SelectItem key={estate.id} value={estate.id}>
              {estate.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
