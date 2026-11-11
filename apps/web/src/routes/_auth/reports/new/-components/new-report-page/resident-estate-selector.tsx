import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@proj/ui/components/combobox";
import { Field, FieldDescription, FieldLabel } from "@proj/ui/components/field";
import { useCallback, useState } from "react";
import {
  ESTATE_SEARCH_MIN_LENGTH,
  type ReportEstate,
  useEstateSearch,
} from "@/lib/reports";

function estateLabel(estate: ReportEstate): string {
  return estate.name;
}

function sameEstate(a: ReportEstate, b: ReportEstate): boolean {
  return a.id === b.id;
}

/** The user's own estates first, then other estates matching the search. */
function estateChoices(
  assigned: ReportEstate[],
  found: ReportEstate[] | undefined,
  query: string
): ReportEstate[] {
  if (!found) {
    return assigned;
  }
  const text = query.toLowerCase();
  const own = assigned.filter((estate) =>
    estate.name.toLowerCase().includes(text)
  );
  const ownIds = new Set(own.map((estate) => estate.id));
  return [...own, ...found.filter((estate) => !ownIds.has(estate.id))];
}

function searchHint({
  query,
  hasEstate,
  isError,
  noMatches,
}: {
  query: string;
  hasEstate: boolean;
  isError: boolean;
  noMatches: boolean;
}): string | undefined {
  if (isError) {
    return "Couldn't search estates. Try again.";
  }
  if (noMatches) {
    return "No estates match";
  }
  if (!hasEstate && query.length < ESTATE_SEARCH_MIN_LENGTH) {
    return "Type at least 2 letters of your estate's name.";
  }
}

/**
 * Pick the estate to report in: the user's own estates are offered first, and
 * typing searches every active estate, so anyone signed in can report a fault.
 */
export function ResidentEstateSelector({
  estates: assignedEstates,
  estate,
  onChange: changeEstate,
  id,
}: {
  estates: ReportEstate[];
  estate?: ReportEstate;
  onChange: (estate: ReportEstate | null) => void;
  id: string;
}) {
  const [text, setText] = useState(estate?.name ?? "");
  const [open, setOpen] = useState(false);
  const query = text.trim();
  // Showing the chosen estate's name is not a new search.
  const searching = query !== (estate?.name ?? "");
  const search = useEstateSearch(searching ? query : "");
  const found = searching ? search.data : undefined;
  const items = estateChoices(assignedEstates, found, query);
  const hint = searchHint({
    query: searching ? query : "",
    hasEstate: !!estate,
    isError: searching && search.isError,
    noMatches: !!found && items.length === 0,
  });
  // Typing opens the list; base-ui alone only opens on trusted input.
  const type = useCallback((next: string) => {
    setText(next);
    setOpen(true);
  }, []);
  const select = useCallback(
    (next: ReportEstate | null) => {
      if (next) {
        setText(next.name);
        changeEstate(next);
      }
      setOpen(false);
    },
    [changeEstate]
  );
  const inputId = `${id}-estate`;
  const hintId = `${id}-estate-hint`;

  return (
    <Field>
      <FieldLabel htmlFor={inputId}>Estate</FieldLabel>
      <Combobox
        filter={null}
        inputValue={text}
        isItemEqualToValue={sameEstate}
        items={items}
        itemToStringLabel={estateLabel}
        onInputValueChange={type}
        onOpenChange={setOpen}
        onValueChange={select}
        open={open && items.length > 0}
        value={estate ?? null}
      >
        <ComboboxInput
          aria-describedby={hint ? hintId : undefined}
          className="w-full"
          id={inputId}
          placeholder="Find your estate"
        />
        <ComboboxContent>
          <ComboboxList>
            {(item: ReportEstate) => (
              <ComboboxItem key={item.id} value={item}>
                {item.name}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {hint ? <FieldDescription id={hintId}>{hint}</FieldDescription> : null}
    </Field>
  );
}
