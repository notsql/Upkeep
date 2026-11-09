import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { PiggyBank } from "lucide-react";
import { formatDay, formatSgd, useBudgetForecast } from "@/lib/estate-costs";

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** ID-33: the projected maintenance cost of the next 12 months. */
export function BudgetForecastCard({ estateId }: { estateId: string }) {
  const forecast = useBudgetForecast(estateId);
  const { data } = forecast;
  const nothing =
    data?.scheduledServices.services === 0 &&
    data.predictedRepairs.expectedRepairs === 0;
  return (
    <Card aria-label="Maintenance budget" role="region">
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-center gap-2">
            <PiggyBank aria-hidden="true" className="text-brand-2 size-4" />
            Maintenance budget
          </h2>
        </CardTitle>
        <CardDescription>
          {data
            ? `Next 12 months: ${formatDay(data.from)} – ${formatDay(data.to, true)}`
            : "Next 12 months"}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {forecast.error ? (
          <p className="text-destructive" role="alert">
            {forecast.error.message}
          </p>
        ) : null}
        {data ? (
          <>
            <p className="text-2xl font-semibold tabular-nums">
              {formatSgd(data.total)}
            </p>
            {nothing ? (
              <p className="text-muted-foreground">
                No services or repairs to project.
              </p>
            ) : (
              <>
                <p>{`Scheduled services: ${formatSgd(data.scheduledServices.total)} (${data.scheduledServices.services} ${plural(data.scheduledServices.services, "service", "services")})`}</p>
                <p>{`Predicted repairs: ${formatSgd(data.predictedRepairs.total)} (${data.predictedRepairs.expectedRepairs} ${plural(data.predictedRepairs.expectedRepairs, "expected repair", "expected repairs")})`}</p>
              </>
            )}
            {data.assetsWithoutCostBasis > 0 ? (
              <p className="text-muted-foreground">
                {`${data.assetsWithoutCostBasis} ${plural(data.assetsWithoutCostBasis, "asset", "assets")} left out: no cost history to estimate from`}
              </p>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
