import {
  type PreviewFloor,
  plural,
} from "@/routes/_auth/estates/$estateId/-components/locations-section/add-floors-form/add-floors-range";

export function AddFloorsPreview({ floors }: { floors: PreviewFloor[] }) {
  const newCount = floors.filter((floor) => !floor.exists).length;
  return (
    <div className="grid gap-1">
      <p className="text-sm">
        {plural(floors.length, "floor")}: {newCount} new,{" "}
        {floors.length - newCount} already exist
        {floors.length - newCount === 1 ? "s" : ""}.
      </p>
      <ul
        aria-label="Floors to add"
        className="max-h-48 overflow-y-auto rounded-md border p-2 text-sm"
      >
        {floors.map((floor) => (
          <li
            className={floor.exists ? "text-muted-foreground" : undefined}
            key={floor.floor}
          >
            {floor.exists
              ? `${floor.name} (already exists, will be skipped)`
              : floor.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
