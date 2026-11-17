-- CreateTable
CREATE TABLE "PresetRolePermission" (
    "role" VARCHAR(20) NOT NULL,
    "permission" VARCHAR(64) NOT NULL,

    CONSTRAINT "PresetRolePermission_pkey" PRIMARY KEY ("role","permission")
);

-- AddForeignKey
ALTER TABLE "PresetRolePermission" ADD CONSTRAINT "PresetRolePermission_permission_fkey" FOREIGN KEY ("permission") REFERENCES "Permission"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Built-in roles are fixed bundles of catalogue codes (spec: estate-role-permissions).
ALTER TABLE "PresetRolePermission" ADD CONSTRAINT "PresetRolePermission_role_check"
  CHECK (role IN ('MANAGER', 'COUNCIL', 'CREW'));

INSERT INTO "Permission" ("code", "label", "description") VALUES
 ('TRIAGE_FAULT_REPORTS', 'Sort fault reports', 'Change a report''s urgency, Safety flag and type, confirm or reject duplicates, and dismiss reports. Requires VIEW_FAULT_REPORTS.'),
 ('VIEW_WORK_ORDERS', 'View work orders', 'List and open work orders, their history and documents, the contractor list and contractor email status.'),
 ('PROGRESS_ASSIGNED_WORK_ORDERS', 'Work on assigned work orders', 'Start and complete work orders assigned to you. Requires VIEW_WORK_ORDERS.'),
 ('MANAGE_WORK_ORDERS', 'Manage work orders', 'Create, edit and assign work orders, update any of them, send reports to contractors, email contractors and edit the contractor list. Requires VIEW_WORK_ORDERS.'),
 ('VIEW_ASSETS', 'View assets', 'Open the asset register, asset details, history, maintenance records, failure risk and service intervals.'),
 ('EDIT_ASSETS', 'Edit assets', 'Add, edit, retire, restore and correct assets, and record maintenance. Requires VIEW_ASSETS.'),
 ('VIEW_COSTS', 'View costs', 'See the costliest assets and the 12-month budget forecast. Requires VIEW_ASSETS.'),
 ('VIEW_READINGS', 'View readings', 'See and export sensor readings for the estate and each asset.'),
 ('RECORD_READINGS', 'Record readings', 'Enter readings by hand and review flagged readings. Requires VIEW_READINGS.'),
 ('IMPORT_READINGS', 'Import readings', 'Import readings from CSV files and undo imports. Requires VIEW_READINGS.'),
 ('VIEW_DEVICES', 'View devices', 'See an asset''s devices and which sensors have stopped reporting.'),
 ('MANAGE_DEVICES', 'Manage devices', 'Add, replace and remove devices, issue device keys, and set or pause stopped-sensor alerts. Requires VIEW_DEVICES.'),
 ('VIEW_INSPECTIONS', 'View inspections', 'See inspection results, what is due for inspection and who can inspect.'),
 ('RECORD_INSPECTIONS', 'Record inspections', 'Record an inspection result with photos. Requires VIEW_INSPECTIONS.'),
 ('MANAGE_INSPECTIONS', 'Manage inspections', 'Set check schedules, build the list of what is due and send crew to inspect. Requires VIEW_INSPECTIONS.');

-- Managers hold every code.
INSERT INTO "PresetRolePermission" ("role", "permission")
SELECT 'MANAGER', "code" FROM "Permission";

INSERT INTO "PresetRolePermission" ("role", "permission") VALUES
 ('COUNCIL', 'VIEW_ESTATE'),
 ('COUNCIL', 'VIEW_ASSETS'),
 ('COUNCIL', 'EDIT_ASSETS'),
 ('COUNCIL', 'VIEW_COSTS'),
 ('COUNCIL', 'VIEW_DEVICES'),
 ('COUNCIL', 'VIEW_DOCUMENTS'),
 ('COUNCIL', 'EDIT_DOCUMENTS'),
 ('CREW', 'VIEW_FAULT_REPORTS'),
 ('CREW', 'RELOCATE_FAULT_REPORTS'),
 ('CREW', 'TRIAGE_FAULT_REPORTS'),
 ('CREW', 'VIEW_WORK_ORDERS'),
 ('CREW', 'PROGRESS_ASSIGNED_WORK_ORDERS'),
 ('CREW', 'VIEW_READINGS'),
 ('CREW', 'RECORD_READINGS'),
 ('CREW', 'VIEW_INSPECTIONS'),
 ('CREW', 'RECORD_INSPECTIONS');

-- The legacy Member role becomes Council. Rejecting MEMBER and dropping the
-- column default follow in a later contract migration, once no code uses it.
UPDATE "EstateUser" SET role = 'COUNCIL' WHERE role = 'MEMBER';
