import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import {
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";

const FIELDS = ["asset", "metric", "measured_at", "value", "unit"] as const;
const LABELS = {
  asset: "Asset column",
  metric: "Measurement column",
  measured_at: "Measured at column",
  value: "Value column",
  unit: "Unit column (optional)",
};
type MappingSetter = Dispatch<SetStateAction<Record<string, string>>>;

function ImportColumn({
  field,
  column,
  headers,
  mapping,
  setMapping,
}: {
  field: (typeof FIELDS)[number];
  column: string;
  headers: string[];
  mapping: Record<string, string>;
  setMapping: MappingSetter;
}) {
  const change = useCallback(
    (value: string | null) =>
      setMapping((previous) => ({
        ...previous,
        [column]: value === "none" ? "" : (value ?? ""),
      })),
    [column, setMapping]
  );
  return (
    <Field>
      <FieldLabel htmlFor={`map-${field}`}>{LABELS[field]}</FieldLabel>
      <Select onValueChange={change} value={mapping[column] || "none"}>
        <SelectTrigger className="w-full" id={`map-${field}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Choose column</SelectItem>
          {headers.map((header) => (
            <SelectItem key={header} value={header}>
              {header}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function ImportFormFields({
  source,
  setSource,
  sample,
  mapping,
  setMapping,
  mode,
  setMode,
  error,
  onChoose,
}: {
  source: string;
  setSource: (value: string) => void;
  sample: string[][];
  mapping: Record<string, string>;
  setMapping: MappingSetter;
  mode: string;
  setMode: (value: string) => void;
  error: string;
  onChoose: (file: File | undefined) => Promise<void>;
}) {
  const changeFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChoose(event.target.files?.[0]);
    },
    [onChoose]
  );
  const changeSource = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSource(event.target.value),
    [setSource]
  );
  const changeMode = useCallback(
    (value: string | null) => {
      if (!value) {
        return;
      }
      setMode(value);
      setMapping((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(
            ([field]) => field !== "asset_id" && field !== "asset_reference"
          )
        )
      );
    },
    [setMode, setMapping]
  );
  const [headers = []] = sample;
  return (
    <>
      <Field>
        <FieldLabel htmlFor="import-file">CSV file</FieldLabel>
        <Input
          accept=".csv,text/csv"
          aria-describedby={error ? "import-error" : undefined}
          aria-invalid={Boolean(error)}
          id="import-file"
          onChange={changeFile}
          type="file"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="import-source">Name for this import</FieldLabel>
        <Input
          aria-describedby={error ? "import-error" : undefined}
          aria-invalid={Boolean(error)}
          id="import-source"
          maxLength={200}
          onChange={changeSource}
          value={source}
        />
      </Field>
      {headers.length ? (
        <>
          <Field>
            <FieldLabel htmlFor="asset-lookup">Asset lookup</FieldLabel>
            <Select onValueChange={changeMode} value={mode}>
              <SelectTrigger className="w-full" id="asset-lookup">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asset_id">Asset UUID</SelectItem>
                <SelectItem value="asset_reference">Asset reference</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {FIELDS.map((field) => (
            <ImportColumn
              column={field === "asset" ? mode : field}
              field={field}
              headers={headers}
              key={field}
              mapping={mapping}
              setMapping={setMapping}
            />
          ))}
          <ImportSample sample={sample} />
        </>
      ) : null}
    </>
  );
}

function ImportSample({ sample }: { sample: string[][] }) {
  const [headers] = sample;
  const records = sample
    .slice(1)
    .map((cells, position) => ({ recordNumber: position + 2, cells }));
  return (
    <section
      aria-label="CSV preview"
      className="max-w-full overflow-x-auto"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: This named overflow region needs keyboard scrolling.
      tabIndex={0}
    >
      <Table aria-label="CSV preview">
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.recordNumber}>
              {headers.map((header, column) => (
                <TableCell key={header}>{record.cells[column]}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
