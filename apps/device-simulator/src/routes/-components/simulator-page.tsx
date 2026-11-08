import { Alert, AlertDescription, AlertTitle } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@proj/ui/components/field";
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
import { Tabs, TabsList, TabsTrigger } from "@proj/ui/components/tabs";
import {
  type ChangeEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CsvRow } from "@/lib/csv";
import { anomalyWindows, experiments, parseReadingsCsv } from "@/lib/csv";
import type { Mode } from "@/lib/readings";
import type { Run, RunState } from "@/lib/run";
import { runSimulation } from "@/lib/run";
import { sendTelemetry } from "@/lib/send-telemetry";
import { createWorkerSleep } from "@/lib/worker-timer";

const STATUSES = ["CREATED", "ALREADY_STORED", "INVALID", "CONFLICT"] as const;

export function SimulatorPage() {
  const [apiUrl, setApiUrl] = useState("http://localhost:8080");
  const [deviceKey, setDeviceKey] = useState("");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileError, setFileError] = useState<string>();
  const [experiment, setExperiment] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("backfill");
  const [runState, setRunState] = useState<RunState>();
  const run = useRef<Run>(null);

  const list = useMemo(() => experiments(rows), [rows]);
  const selectedRows = useMemo(
    () => rows.filter((row) => row.experiment === experiment),
    [rows, experiment]
  );
  const windows = useMemo(() => anomalyWindows(selectedRows), [selectedRows]);
  const running = runState?.status === "running";
  const canStart =
    !running && selectedRows.length > 0 && deviceKey !== "" && apiUrl !== "";

  const onApiUrl = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setApiUrl(event.target.value);
  }, []);
  const onDeviceKey = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDeviceKey(event.target.value);
  }, []);
  const onExperiment = useCallback((value: string | null) => {
    setExperiment(value);
  }, []);
  const onMode = useCallback((value: unknown) => {
    setMode(value as Mode);
  }, []);
  const onStop = useCallback(() => {
    run.current?.stop();
  }, []);

  const onFile = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setRows([]);
    setExperiment(null);
    setFileError(undefined);
    setRunState(undefined);
    if (!file) {
      return;
    }
    const result = parseReadingsCsv(await file.text());
    if (!result.ok) {
      setFileError(result.error);
      return;
    }
    setRows(result.rows);
    setExperiment(result.rows[0].experiment);
  }, []);

  const onStart = useCallback(() => {
    // A worker timer keeps Live on schedule while the tab is hidden.
    const timer = createWorkerSleep();
    run.current = runSimulation({
      rows: selectedRows,
      mode,
      send: (readings) =>
        sendTelemetry({ data: { apiUrl, deviceKey, readings } }),
      onUpdate: setRunState,
      sleep: timer.sleep,
    });
    run.current.done.finally(timer.dispose);
  }, [apiUrl, deviceKey, mode, selectedRows]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Device simulator</h1>

      <Card>
        <CardHeader>
          <CardTitle>Run</CardTitle>
          <CardDescription>
            Replays one experiment from the test-readings CSV to POST
            /device-api/telemetry. The file never leaves this machine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="api-url">API URL</FieldLabel>
              <Input
                disabled={running}
                id="api-url"
                onChange={onApiUrl}
                value={apiUrl}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="device-key">Device key</FieldLabel>
              <Input
                autoComplete="off"
                disabled={running}
                id="device-key"
                onChange={onDeviceKey}
                type="password"
                value={deviceKey}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="csv-file">CSV file</FieldLabel>
              <Input
                accept=".csv,text/csv"
                disabled={running}
                id="csv-file"
                onChange={onFile}
                type="file"
              />
            </Field>
            {fileError ? (
              <Alert variant="destructive">
                <AlertTitle>The file was rejected</AlertTitle>
                <AlertDescription>{fileError}</AlertDescription>
              </Alert>
            ) : null}
            {list.length > 0 ? (
              <Field>
                <FieldLabel htmlFor="experiment">Experiment</FieldLabel>
                <Select
                  disabled={running}
                  onValueChange={onExperiment}
                  value={experiment}
                >
                  <SelectTrigger className="w-full" id="experiment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {list.map((item) => (
                      <SelectItem key={item.name} value={item.name}>
                        {item.name} ({item.rowCount} rows)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            <Field>
              <FieldLabel>Mode</FieldLabel>
              <Tabs onValueChange={onMode} value={mode}>
                <TabsList>
                  <TabsTrigger disabled={running} value="backfill">
                    Backfill
                  </TabsTrigger>
                  <TabsTrigger disabled={running} value="live">
                    Live
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <div className="flex gap-2">
              <Button disabled={!canStart} onClick={onStart}>
                Start
              </Button>
              <Button disabled={!running} onClick={onStop} variant="outline">
                Stop
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      {runState ? <Progress state={runState} /> : null}

      {experiment ? (
        <Card>
          <CardHeader>
            <CardTitle>Labelled anomaly windows</CardTitle>
            <CardDescription>
              Ground truth for {experiment}, as row offsets from its first row.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {windows.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No rows are labelled as anomalies.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Start offset</TableHead>
                    <TableHead>End offset</TableHead>
                    <TableHead>Length</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {windows.map((window) => (
                    <TableRow key={window.start}>
                      <TableCell>{window.start}</TableCell>
                      <TableCell>{window.end}</TableCell>
                      <TableCell>{window.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

function Progress({ state }: { state: RunState }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {state.rowsSent} of {state.totalRows} rows sent ({state.status})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state.error ? (
          <Alert variant="destructive">
            <AlertTitle>The run stopped</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              {STATUSES.map((status) => (
                <TableHead key={status}>{status}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              {STATUSES.map((status) => (
                <TableCell key={status}>{state.counts[status]}</TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
        {state.messages.length > 0 ? (
          <ul className="list-disc pl-5 text-sm">
            {state.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
