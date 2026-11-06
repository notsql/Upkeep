import {
  floorName,
  floorRange,
  type Location,
  MAX_FLOORS,
  parseFloor,
} from "@/lib/locations";

/** Floor names the server created and skipped. */
export interface AddFloorsResult {
  created: string[];
  skipped: string[];
}

export interface PreviewFloor {
  exists: boolean;
  floor: number;
  name: string;
}

type Range =
  | { ok: true; floors: PreviewFloor[] }
  | { ok: false; message: string };

export function checkRange(
  lowestText: string,
  highestText: string,
  existingLevels: Location[]
): Range {
  const lowest = parseFloor(lowestText);
  const highest = parseFloor(highestText);
  if (lowest === undefined || highest === undefined) {
    return {
      ok: false,
      message: "Enter floors like B2 or L25. There is no floor 0.",
    };
  }
  if (lowest > highest) {
    return {
      ok: false,
      message: "The lowest floor must not be above the highest floor.",
    };
  }
  const floors = floorRange(lowest, highest);
  if (!floors) {
    return {
      ok: false,
      message: `Add at most ${MAX_FLOORS} floors at a time.`,
    };
  }
  // The same rule the server applies: a taken position or name is skipped.
  const positions = new Set(existingLevels.map((level) => level.sortOrder));
  const names = new Set(
    existingLevels.map((level) => level.name.toLowerCase())
  );
  return {
    ok: true,
    floors: floors.map((floor) => {
      const name = floorName(floor);
      return {
        floor,
        name,
        exists: positions.has(floor) || names.has(name.toLowerCase()),
      };
    }),
  };
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}
