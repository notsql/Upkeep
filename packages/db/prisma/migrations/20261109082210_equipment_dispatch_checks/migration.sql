-- Expand-only (spec equipment-dispatch.md): widen the allowed values and tie the new columns to their types.

ALTER TABLE "InspectionCheck"
  DROP CONSTRAINT "InspectionCheck_dueBasis_check",
  ADD CONSTRAINT "InspectionCheck_dueBasis_check" CHECK ("dueBasis" IN ('PREDICTION', 'INTERVAL', 'NEVER_INSPECTED', 'REQUESTED')),
  ADD CONSTRAINT "InspectionCheck_assigned_check" CHECK (
    ("dueBasis" = 'REQUESTED') = ("assignedToUserId" IS NOT NULL)
  );

ALTER TABLE "Notification"
  DROP CONSTRAINT "Notification_type_check",
  ADD CONSTRAINT "Notification_type_check" CHECK ("type" IN ('ANOMALY', 'SERVICE_DUE', 'REPAIR_PREDICTED', 'CHECK_REQUESTED', 'CHECK_FAILED')),
  ADD CONSTRAINT "Notification_check_requested_check" CHECK (("type" = 'CHECK_REQUESTED') = ("recipientUserId" IS NOT NULL)),
  ADD CONSTRAINT "Notification_check_failed_check" CHECK (("type" = 'CHECK_FAILED') = ("inspectionResultId" IS NOT NULL));
