import { Alert, AlertDescription, AlertTitle } from "@proj/ui/components/alert";
import { isPossiblyWrong, type ReadingFlag } from "@/lib/readings";

/**
 * The "possibly wrong reading" warning: shown once above readings when any
 * of them is flagged. There is no confirm/reject action today, so the next
 * step is plain text (spec plain-english-wording.md, Warnings).
 */
export function PossiblyWrongNote({
  readings,
}: {
  readings: readonly { flags: readonly ReadingFlag[] }[];
}) {
  if (!readings.some((reading) => reading.flags.some(isPossiblyWrong))) {
    return null;
  }
  return (
    <Alert aria-label="Some readings may be wrong" role="note">
      <AlertTitle>Some readings may be wrong</AlertTitle>
      <AlertDescription>
        <p>
          Readings marked outside normal range, sent twice or with a gap may not
          be accurate.
        </p>
        <p>Look at the sensor, or take a manual reading to compare.</p>
      </AlertDescription>
    </Alert>
  );
}
