const EXPORT_HEADER =
  "reading_id,measured_at,asset_id,asset_reference,asset_name,metric,value,unit,source,device_id,device_identifier,recorded_by_user_id,recorded_by_name,recorded_at,flags";

export function readImportSample(file: File): Promise<string[][]> {
  if (file.size > 25 * 1024 * 1024) {
    return Promise.reject(new Error("Choose a CSV no larger than 25 MiB."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read this CSV file."));
    reader.onload = () => {
      try {
        resolve(parseImportSample(String(reader.result)));
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsText(file.slice(0, 64 * 1024), "UTF-8");
  });
}

class CsvSample {
  rows: string[][] = [];
  private row: string[] = [];
  private value = "";
  private quoted = false;

  character(text: string, index: number): number {
    const char = text[index];
    if (char === '"') {
      if (this.quoted && text[index + 1] === '"') {
        this.append('"');
        return 1;
      }
      this.quoted = !this.quoted;
      return 0;
    }
    if (this.quoted) {
      this.append(char);
      return 0;
    }
    if (char === ",") {
      this.cell();
      return 0;
    }
    if (char === "\n" || char === "\r") {
      this.finishRow();
      return char === "\r" && text[index + 1] === "\n" ? 1 : 0;
    }
    this.append(char);
    return 0;
  }
  finish() {
    if (
      (this.value || this.row.length > 0) &&
      !this.quoted &&
      this.rows.length < 6
    ) {
      this.finishRow();
    }
    return this.rows;
  }
  private append(char: string) {
    this.value += char;
    if (this.value.length > 4096) {
      throw new Error("CSV fields exceed the import limits.");
    }
  }
  private cell() {
    this.row.push(this.value);
    this.value = "";
    if (this.row.length > 128) {
      throw new Error("CSV columns exceed the import limits.");
    }
  }
  private finishRow() {
    this.cell();
    if (this.row.some((cell) => cell.trim())) {
      this.rows.push(this.row);
    }
    this.row = [];
  }
}

/** Preview only. Spring validates every byte and measurement when the file is submitted. */
export function parseImportSample(raw: string): string[][] {
  const text = raw.startsWith("\uFEFF") ? raw.slice(1) : raw;
  const parser = new CsvSample();
  for (
    let index = 0;
    index < text.length && parser.rows.length < 6;
    index += 1
  ) {
    index += parser.character(text, index);
  }
  const rows = parser.finish();
  const [header] = rows;
  if (
    !header?.length ||
    header.some((cell) => !cell.trim()) ||
    new Set(header).size !== header.length
  ) {
    throw new Error("Every CSV column needs a distinct, nonblank header.");
  }
  return rows;
}
export function importPreset(headers: string[]): "EXPORT" | "VENDOR" {
  return headers.join(",") === EXPORT_HEADER ? "EXPORT" : "VENDOR";
}
