package com.proj.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;

class ResidentReportTitleMigrationTests {
    private static final String LAST_PRE_TITLE_MIGRATION = "20261013090100_resident_membership_contract";

    private static Path migrationsDirectory() {
        for (var dir = Path.of("").toAbsolutePath(); dir != null; dir = dir.getParent()) {
            var candidate = dir.resolve("packages/db/prisma/migrations");
            if (Files.isDirectory(candidate)) return candidate;
        }
        throw new IllegalStateException("Could not find Prisma migrations");
    }

    private static void execute(Connection connection, String sql, Object... values) throws SQLException {
        try (var statement = connection.prepareStatement(sql)) {
            for (int i = 0; i < values.length; i++) statement.setObject(i + 1, values[i]);
            statement.execute();
        }
    }

    @Test
    void backfillsExistingTitlesWithoutLosingDescriptionsOrImagesAndRequiresTitlesForNewRows() throws Exception {
        java.util.List<Path> folders;
        try (var stream = Files.list(migrationsDirectory())) {
            folders = stream.filter(Files::isDirectory).sorted().toList();
        }
        try (var postgres = new PostgreSQLContainer("postgres:18-alpine")) {
            int index = 0;
            for (var folder : folders) {
                if (folder.getFileName().toString().compareTo(LAST_PRE_TITLE_MIGRATION) > 0) break;
                postgres.withCopyFileToContainer(
                        MountableFile.forHostPath(folder.resolve("migration.sql")),
                        "/docker-entrypoint-initdb.d/%03d.sql".formatted(index++));
            }
            postgres.start();
            try (var connection = DriverManager.getConnection(
                    postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
                var estate = UUID.randomUUID();
                var block = UUID.randomUUID();
                var level = UUID.randomUUID();
                var image = UUID.randomUUID();
                execute(
                        connection,
                        "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, 'owner', 'Estate', 'TITLE-MIGRATION', 'Road', '123456', now())",
                        estate);
                execute(
                        connection,
                        "insert into \"Location\" (id, \"estateId\", type, name, \"updatedAt\") values (?, ?, 'BLOCK', 'Block', now())",
                        block,
                        estate);
                execute(
                        connection,
                        "insert into \"Location\" (id, \"estateId\", type, \"parentId\", \"parentType\", name, \"sortOrder\", \"updatedAt\") values (?, ?, 'LEVEL', ?, 'BLOCK', 'Level', 1, now())",
                        level,
                        estate,
                        block);
                var descriptions = new String[] {"  Leaking pipe  ", "x".repeat(200), "   ", ""};
                var expectedTitles = new String[] {"Leaking pipe", "x".repeat(150), "Fault report", "Fault report"};
                var reportIds = new UUID[descriptions.length];
                for (int i = 0; i < descriptions.length; i++) {
                    reportIds[i] = UUID.randomUUID();
                    execute(
                            connection,
                            "insert into \"IssueReport\" (id, \"submittedByUserId\", \"estateId\", \"locationId\", description, \"updatedAt\") values (?, 'resident', ?, ?, ?, now())",
                            reportIds[i],
                            estate,
                            level,
                            descriptions[i]);
                }
                execute(
                        connection,
                        "insert into \"IssueReportImage\" (id, \"reportId\", \"storageKey\", \"contentType\", \"sizeBytes\") values (?, ?, 'private/title-preserved', 'image/png', 3)",
                        image,
                        reportIds[0]);
                for (var folder : folders) {
                    if (folder.getFileName().toString().compareTo(LAST_PRE_TITLE_MIGRATION) > 0) {
                        ScriptUtils.executeSqlScript(
                                connection, new FileSystemResource(folder.resolve("migration.sql")));
                    }
                }
                for (int i = 0; i < descriptions.length; i++) {
                    try (var query =
                            connection.prepareStatement("select title, description from \"IssueReport\" where id=?")) {
                        query.setObject(1, reportIds[i]);
                        try (var rows = query.executeQuery()) {
                            assertTrue(rows.next());
                            assertEquals(expectedTitles[i], rows.getString("title"));
                            assertEquals(descriptions[i], rows.getString("description"));
                        }
                    }
                }
                try (var query = connection.prepareStatement(
                        "select \"reportId\", \"storageKey\" from \"IssueReportImage\" where id=?")) {
                    query.setObject(1, image);
                    try (var rows = query.executeQuery()) {
                        assertTrue(rows.next());
                        assertEquals(reportIds[0], rows.getObject("reportId", UUID.class));
                        assertEquals("private/title-preserved", rows.getString("storageKey"));
                    }
                }
                try (var query = connection.createStatement();
                        var rows = query.executeQuery(
                                "select is_nullable, column_default, character_maximum_length from information_schema.columns where table_name='IssueReport' and column_name='title'")) {
                    assertTrue(rows.next());
                    assertEquals("NO", rows.getString("is_nullable"));
                    assertEquals(null, rows.getString("column_default"));
                    assertEquals(150, rows.getInt("character_maximum_length"));
                    assertFalse(rows.next());
                }
                assertThrows(
                        SQLException.class,
                        () -> execute(
                                connection,
                                "insert into \"IssueReport\" (id, \"submittedByUserId\", \"estateId\", \"locationId\", description, \"updatedAt\") values (?, 'resident', ?, ?, 'New report', now())",
                                UUID.randomUUID(),
                                estate,
                                level));
            }
        }
    }
}
