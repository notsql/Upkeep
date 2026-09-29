import { Alert, AlertDescription } from "@proj/ui/components/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Spinner } from "@proj/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { api } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function ApiStatus() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const response = await api.GET("/health");
      if (response.error) {
        throw new Error("Failed to load API health");
      }
      return response.data;
    },
  });

  if (isPending) {
    return (
      <p className="flex items-center gap-2 text-muted-foreground text-sm">
        <Spinner aria-hidden="true" />
        Checking...
      </p>
    );
  }
  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>API unreachable</AlertDescription>
      </Alert>
    );
  }
  return (
    <ul className="text-sm">
      <li>API: {data.ok ? "up" : "down"}</li>
      <li>Database: {data.database ? "up" : "down"}</li>
    </ul>
  );
}

const TITLE_TEXT = `
 ██████╗ ███████╗████████╗████████╗███████╗██████╗
 ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗
 ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝
 ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗
 ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║
 ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝

 ████████╗    ███████╗████████╗ █████╗  ██████╗██╗  ██╗
 ╚══██╔══╝    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝
    ██║       ███████╗   ██║   ███████║██║     █████╔╝
    ██║       ╚════██║   ██║   ██╔══██║██║     ██╔═██╗
    ██║       ███████║   ██║   ██║  ██║╚██████╗██║  ██╗
    ╚═╝       ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
 `;

function HomeComponent() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-2">
      <pre className="overflow-x-auto font-mono text-sm">{TITLE_TEXT}</pre>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>API Status</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ApiStatus />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
