package com.proj.server;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;

/**
 * Applies the estate-role-permissions expand migration over populated data from before it
 * (spec: .spec/features/estate-role-permissions.md, Phase 1).
 */
class PresetRolePermissionMigrationTests {
    private static final String LAST_BEFORE = "20261112112010_report_classification_category";
    private static final UUID ESTATE = UUID.randomUUID();
    private static final OffsetDateTime JOINED = OffsetDateTime.parse("2026-01-02T03:04:05Z");
    private static PostgreSQLContainer postgres;
    private Connection connection;

    static final Set<String> EXISTING = Set.of(
            "VIEW_ESTATE",
            "EDIT_ESTATE",
            "VIEW_FAULT_REPORTS",
            "RELOCATE_FAULT_REPORTS",
            "INVITE_MEMBERS",
            "CREATE_LOCATIONS",
            "EDIT_LOCATIONS",
            "CREATE_ROLES",
            "EDIT_ROLES",
            "VIEW_DOCUMENTS",
            "EDIT_DOCUMENTS");

    static final Set<String> ADDED = Set.of(
            "TRIAGE_FAULT_REPORTS",
            "VIEW_WORK_ORDERS",
            "PROGRESS_ASSIGNED_WORK_ORDERS",
            "MANAGE_WORK_ORDERS",
            "VIEW_ASSETS",
            "EDIT_ASSETS",
            "VIEW_COSTS",
            "VIEW_READINGS",
            "RECORD_READINGS",
            "IMPORT_READINGS",
            "VIEW_DEVICES",
            "MANAGE_DEVICES",
            "VIEW_INSPECTIONS",
            "RECORD_INSPECTIONS",
            "MANAGE_INSPECTIONS");

    static final Set<String> COUNCIL = Set.of(
            "VIEW_ESTATE",
            "VIEW_ASSETS",
            "EDIT_ASSETS",
            "VIEW_COSTS",
            "VIEW_DEVICES",
            "VIEW_DOCUMENTS",
            "EDIT_DOCUMENTS");

    static final Set<String> CREW = Set.of(
            "VIEW_FAULT_REPORTS",
            "RELOCATE_FAULT_REPORTS",
            "TRIAGE_FAULT_REPORTS",
            "VIEW_WORK_ORDERS",
            "PROGRESS_ASSIGNED_WORK_ORDERS",
            "VIEW_READINGS",
            "RECORD_READINGS",
            "VIEW_INSPECTIONS",
            "RECORD_INSPECTIONS");

    @BeforeAll
    static void migratePopulatedDatabase() throws Exception {
        List<Path> migrations;
        try (var folders = Files.list(migrationsDirectory())) {
            migrations = folders.filter(Files::isDirectory).sorted().toList();
        }
        postgres = new PostgreSQLContainer("postgres:18-alpine");
        int index = 0;
        for (var folder : migrations) {
            if (folder.getFileName().toString().compareTo(LAST_BEFORE) <= 0) {
                postgres.withCopyFileToContainer(
                        MountableFile.forHostPath(folder.resolve("migration.sql")),
                        "/docker-entrypoint-initdb.d/%03d.sql".formatted(index++));
            }
        }
        postgres.start();
        try (var db = connect()) {
            execute(db, """
                    insert into "Estate" (id, "ownerUserId", name, code, address, "postalCode", "updatedAt")
                    values (?, 'owner', 'Before presets', 'PRESET-MIGRATION', 'Road', '123456', now())
                    """, ESTATE);
            for (var role : List.of("MANAGER", "COUNCIL", "RESIDENT", "CREW", "MEMBER")) {
                execute(
                        db,
                        "insert into \"EstateUser\" (\"estateId\", \"userId\", role, \"createdAt\") values (?, ?, ?, ?)",
                        ESTATE,
                        role.toLowerCase(),
                        role,
                        JOINED);
            }
            for (var folder : migrations) {
                if (folder.getFileName().toString().compareTo(LAST_BEFORE) > 0) {
                    ScriptUtils.executeSqlScript(db, new FileSystemResource(folder.resolve("migration.sql")));
                }
            }
        }
    }

    @BeforeEach
    void begin() throws Exception {
        connection = connect();
        connection.setAutoCommit(false);
    }

    @AfterEach
    void rollback() throws Exception {
        if (connection != null) {
            try {
                connection.rollback();
            } finally {
                connection.close();
            }
        }
    }

    @AfterAll
    static void stop() {
        if (postgres != null) postgres.close();
    }

    @Test
    void catalogueHoldsTheElevenExistingAndFifteenNewCodesWithLabels() throws Exception {
        var codes = new HashSet<String>();
        try (var statement = connection.createStatement();
                var rows = statement.executeQuery("select code, label, description from \"Permission\"")) {
            while (rows.next()) {
                codes.add(rows.getString("code"));
                assertFalse(rows.getString("label").isBlank(), rows.getString("code"));
                assertFalse(rows.getString("description").isBlank(), rows.getString("code"));
            }
        }
        var expected = new HashSet<>(EXISTING);
        expected.addAll(ADDED);
        assertEquals(expected, codes);
    }

    @Test
    void builtInRolesHoldExactlyTheAgreedBundles() throws Exception {
        var manager = new HashSet<>(EXISTING);
        manager.addAll(ADDED);
        assertEquals(Map.of("MANAGER", manager, "COUNCIL", COUNCIL, "CREW", CREW), bundles());
    }

    @Test
    void bundlesAcceptOnlyManagerCouncilAndCrewAndOnlyCataloguedCodes() throws Exception {
        assertEquals("23514", rejected("insert into \"PresetRolePermission\" values ('RESIDENT', 'VIEW_ESTATE')"));
        assertEquals("23514", rejected("insert into \"PresetRolePermission\" values ('CUSTOM', 'VIEW_ESTATE')"));
        assertEquals("23503", rejected("insert into \"PresetRolePermission\" values ('CREW', 'UNSUPPORTED')"));
        assertEquals("23505", rejected("insert into \"PresetRolePermission\" values ('CREW', 'VIEW_READINGS')"));
        assertTrue(
                Set.of("23503", "23001").contains(rejected("delete from \"Permission\" where code='VIEW_READINGS'")));
    }

    @Test
    void legacyMembersBecomeCouncilKeepingTheirMembership() throws Exception {
        assertEquals(0, count("select count(*) from \"EstateUser\" where role='MEMBER'"));
        assertEquals(1, count("""
                select count(*) from "EstateUser"
                where "estateId"=? and "userId"='member' and role='COUNCIL'
                and "createdAt"=? and "customRoleId" is null
                """, ESTATE, JOINED));
        for (var role : List.of("MANAGER", "COUNCIL", "RESIDENT", "CREW")) {
            assertEquals(
                    1,
                    count(
                            "select count(*) from \"EstateUser\" where \"estateId\"=? and \"userId\"=? and role=?",
                            ESTATE,
                            role.toLowerCase(),
                            role),
                    role);
        }
    }

    private Map<String, Set<String>> bundles() throws Exception {
        var result = new HashMap<String, Set<String>>();
        try (var statement = connection.createStatement();
                var rows = statement.executeQuery("select role, permission from \"PresetRolePermission\"")) {
            while (rows.next()) {
                result.computeIfAbsent(rows.getString("role"), role -> new HashSet<>())
                        .add(rows.getString("permission"));
            }
        }
        return result;
    }

    private String rejected(String sql, Object... values) throws Exception {
        var savepoint = connection.setSavepoint();
        try {
            execute(connection, sql, values);
            return "accepted";
        } catch (SQLException error) {
            return error.getSQLState();
        } finally {
            connection.rollback(savepoint);
        }
    }

    private long count(String sql, Object... values) throws Exception {
        try (var statement = connection.prepareStatement(sql)) {
            for (int i = 0; i < values.length; i++) statement.setObject(i + 1, values[i]);
            try (var rows = statement.executeQuery()) {
                rows.next();
                return rows.getLong(1);
            }
        }
    }

    private static void execute(Connection db, String sql, Object... values) throws SQLException {
        try (var statement = db.prepareStatement(sql)) {
            for (int i = 0; i < values.length; i++) statement.setObject(i + 1, values[i]);
            statement.execute();
        }
    }

    private static Connection connect() throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private static Path migrationsDirectory() {
        for (var dir = Path.of("").toAbsolutePath(); dir != null; dir = dir.getParent()) {
            var candidate = dir.resolve("packages/db/prisma/migrations");
            if (Files.isDirectory(candidate)) return candidate;
        }
        throw new IllegalStateException("Could not find Prisma migrations.");
    }
}
