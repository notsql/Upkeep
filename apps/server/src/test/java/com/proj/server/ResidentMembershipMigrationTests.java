package com.proj.server;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.datasource.init.ScriptException;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;

/** Verify data conversion against the legacy schema, then apply the actual new migrations. */
class ResidentMembershipMigrationTests {
    private static final String LEGACY_LAST_MIGRATION = "20261012122402_resident_fault_reporting";

    private static Path migrationsDirectory() {
        for (var current = Path.of("").toAbsolutePath(); current != null; current = current.getParent()) {
            var candidate = current.resolve("packages/db/prisma/migrations");
            if (Files.isDirectory(candidate)) return candidate;
        }
        throw new IllegalStateException("Could not find Prisma migrations");
    }

    private static void execute(Connection connection, String sql, Object... values) throws Exception {
        try (var statement = connection.prepareStatement(sql)) {
            for (int i = 0; i < values.length; i++) statement.setObject(i + 1, values[i]);
            statement.execute();
        }
    }

    private static long count(Connection connection, String sql) throws Exception {
        try (var statement = connection.createStatement();
                var rows = statement.executeQuery(sql)) {
            rows.next();
            return rows.getLong(1);
        }
    }

    private static List<Path> folders() throws Exception {
        try (var stream = Files.list(migrationsDirectory())) {
            return stream.filter(Files::isDirectory).sorted().toList();
        }
    }

    private static List<Path> pivotMigrations(List<Path> folders) {
        return folders.stream()
                .filter(folder -> folder.getFileName().toString().compareTo(LEGACY_LAST_MIGRATION) > 0)
                .map(folder -> folder.resolve("migration.sql"))
                .filter(Files::isRegularFile)
                .toList();
    }

    private static PostgreSQLContainer legacyDatabase(List<Path> folders) {
        var postgres = new PostgreSQLContainer("postgres:18-alpine");
        int index = 0;
        for (var folder : folders) {
            if (folder.getFileName().toString().compareTo(LEGACY_LAST_MIGRATION) > 0) break;
            postgres.withCopyFileToContainer(
                    MountableFile.forHostPath(folder.resolve("migration.sql")),
                    "/docker-entrypoint-initdb.d/%03d.sql".formatted(index));
            index += 1;
        }
        return postgres;
    }

    @Test
    void backfillsOnlyUnrevokedAssignmentsAndPreservesReportsImagesAndOtherEstateRoles() throws Exception {
        var folders = folders();
        var pivot = pivotMigrations(folders);
        assertFalse(
                pivot.isEmpty(),
                "The EstateUser pivot needs new Prisma migrations; never rewrite an applied migration.");

        try (var postgres = legacyDatabase(folders)) {
            postgres.start();
            try (var connection = DriverManager.getConnection(
                    postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
                var residentEstate = UUID.randomUUID();
                var councilEstate = UUID.randomUUID();
                var block = UUID.randomUUID();
                var level = UUID.randomUUID();
                var report = UUID.randomUUID();
                var image = UUID.randomUUID();
                for (var estate : new UUID[] {residentEstate, councilEstate}) {
                    execute(
                            connection,
                            "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, 'owner', 'Estate', ?, 'Road', '123456', now())",
                            estate,
                            estate.toString());
                }
                execute(
                        connection,
                        "insert into \"Location\" (id, \"estateId\", type, name, \"updatedAt\") values (?, ?, 'BLOCK', 'Block', now())",
                        block,
                        residentEstate);
                execute(
                        connection,
                        "insert into \"Location\" (id, \"estateId\", type, \"parentId\", \"parentType\", name, \"sortOrder\", \"updatedAt\") values (?, ?, 'LEVEL', ?, 'BLOCK', 'Level', 1, now())",
                        level,
                        residentEstate,
                        block);
                execute(
                        connection,
                        "insert into \"ResidentAssignment\" (\"userId\", \"estateId\", \"createdAt\") values ('mixed-user', ?, '2026-09-01T00:00:00Z')",
                        residentEstate);
                execute(
                        connection,
                        "insert into \"ResidentAssignment\" (\"userId\", \"estateId\", \"revokedAt\") values ('removed-user', ?, now())",
                        residentEstate);
                execute(
                        connection,
                        "insert into \"EstateUser\" (\"userId\", \"estateId\", role) values ('mixed-user', ?, 'COUNCIL')",
                        councilEstate);
                execute(
                        connection,
                        "insert into \"IssueReport\" (id, \"submittedByUserId\", \"estateId\", \"locationId\", description, \"updatedAt\") values (?, 'removed-user', ?, ?, 'Keep my report', now())",
                        report,
                        residentEstate,
                        level);
                execute(
                        connection,
                        "insert into \"IssueReportImage\" (id, \"reportId\", \"storageKey\", \"contentType\", \"sizeBytes\") values (?, ?, 'private/preserved-image', 'image/png', 3)",
                        image,
                        report);

                for (var migration : pivot) ScriptUtils.executeSqlScript(connection, new FileSystemResource(migration));

                assertEquals(
                        1L,
                        count(
                                connection,
                                "select count(*) from \"EstateUser\" where \"userId\"='mixed-user' and role='RESIDENT' and \"createdAt\"='2026-09-01T00:00:00Z'"));
                assertEquals(
                        1L,
                        count(
                                connection,
                                "select count(*) from \"EstateUser\" where \"userId\"='mixed-user' and role='COUNCIL'"));
                assertEquals(
                        0L, count(connection, "select count(*) from \"EstateUser\" where \"userId\"='removed-user'"));
                assertEquals(
                        1L,
                        count(
                                connection,
                                "select count(*) from \"IssueReport\" where id='" + report
                                        + "' and \"submittedByUserId\"='removed-user' and description='Keep my report'"));
                assertEquals(
                        1L,
                        count(
                                connection,
                                "select count(*) from \"IssueReportImage\" where id='" + image
                                        + "' and \"storageKey\"='private/preserved-image'"));
                assertEquals(
                        0L,
                        count(
                                connection,
                                "select count(*) from information_schema.tables where table_schema='public' and table_name='ResidentAssignment'"));
                assertEquals(
                        0L,
                        count(
                                connection,
                                "select count(*) from information_schema.columns where table_schema='public' and table_name='EstateUser' and column_name='revokedAt'"));
            }
        }
    }

    @Test
    void backfillConflictsAbortWithoutOverwritingAnExistingManagementGrant() throws Exception {
        var folders = folders();
        var pivot = pivotMigrations(folders);
        assertFalse(pivot.isEmpty(), "The EstateUser pivot needs new Prisma migrations.");
        try (var postgres = legacyDatabase(folders)) {
            postgres.start();
            try (var connection = DriverManager.getConnection(
                    postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
                var estate = UUID.randomUUID();
                execute(
                        connection,
                        "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, 'owner', 'Estate', ?, 'Road', '123456', now())",
                        estate,
                        estate.toString());
                execute(
                        connection,
                        "insert into \"EstateUser\" (\"userId\", \"estateId\", role) values ('conflicted-user', ?, 'COUNCIL')",
                        estate);
                execute(
                        connection,
                        "insert into \"ResidentAssignment\" (\"userId\", \"estateId\") values ('conflicted-user', ?)",
                        estate);
                connection.setAutoCommit(false);
                try {
                    assertThrows(ScriptException.class, () -> {
                        for (var migration : pivot)
                            ScriptUtils.executeSqlScript(connection, new FileSystemResource(migration));
                    });
                } finally {
                    connection.rollback();
                }
                assertEquals(
                        1L,
                        count(
                                connection,
                                "select count(*) from \"EstateUser\" where \"userId\"='conflicted-user' and role='COUNCIL'"));
                assertEquals(
                        1L,
                        count(
                                connection,
                                "select count(*) from \"ResidentAssignment\" where \"userId\"='conflicted-user'"));
            }
        }
    }
}
