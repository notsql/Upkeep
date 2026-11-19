package com.proj.server;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;

/**
 * VIEW_ASSETS now requires VIEW_ESTATE; custom roles saved before that gain VIEW_ESTATE rather than resolving to
 * no permissions (spec: .spec/features/estate-role-permissions.md).
 */
class AssetViewPrerequisiteMigrationTests {
    private static final String LAST_BEFORE = "20261117195033_estate_user_role_contract";
    private static final UUID ESTATE = UUID.randomUUID();
    private static final UUID VIEWER = UUID.randomUUID();
    private static final UUID BOTH = UUID.randomUUID();
    private static final UUID ESTATE_ONLY = UUID.randomUUID();
    private static PostgreSQLContainer postgres;

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
                    values (?, 'owner', 'Before prerequisite', 'ASSET-PREREQ', 'Road', '123456', now())
                    """, ESTATE);
            role(db, VIEWER, "Viewer", "VIEW_ASSETS");
            role(db, BOTH, "Both", "VIEW_ESTATE", "VIEW_ASSETS", "EDIT_ASSETS");
            role(db, ESTATE_ONLY, "Estate only", "VIEW_ESTATE");
            for (var folder : migrations) {
                if (folder.getFileName().toString().compareTo(LAST_BEFORE) > 0) {
                    ScriptUtils.executeSqlScript(db, new FileSystemResource(folder.resolve("migration.sql")));
                }
            }
        }
    }

    @AfterAll
    static void stop() {
        if (postgres != null) postgres.close();
    }

    @Test
    void anAssetViewerWithoutViewEstateGainsItAndANewVersion() throws Exception {
        assertEquals(Set.of("VIEW_ESTATE", "VIEW_ASSETS"), permissions(VIEWER));
        assertEquals(2, version(VIEWER));
    }

    @Test
    void rolesThatAlreadyMeetThePrerequisiteAreUntouched() throws Exception {
        assertEquals(Set.of("VIEW_ESTATE", "VIEW_ASSETS", "EDIT_ASSETS"), permissions(BOTH));
        assertEquals(1, version(BOTH));
        assertEquals(Set.of("VIEW_ESTATE"), permissions(ESTATE_ONLY));
        assertEquals(1, version(ESTATE_ONLY));
    }

    private static void role(Connection db, UUID id, String name, String... codes) throws SQLException {
        execute(db, """
                insert into "EstateRoleDefinition"
                    (id, "estateId", name, "normalizedName", "createdByUserId", "updatedAt")
                values (?, ?, ?, ?, 'owner', now())
                """, id, ESTATE, name, name.toLowerCase());
        for (var code : codes) {
            execute(db, "insert into \"EstateRolePermission\" (\"roleId\", permission) values (?, ?)", id, code);
        }
    }

    private static Set<String> permissions(UUID role) throws SQLException {
        var result = new HashSet<String>();
        try (var db = connect();
                var statement =
                        db.prepareStatement("select permission from \"EstateRolePermission\" where \"roleId\"=?")) {
            statement.setObject(1, role);
            try (var rows = statement.executeQuery()) {
                while (rows.next()) result.add(rows.getString(1));
            }
        }
        return result;
    }

    private static int version(UUID role) throws SQLException {
        try (var db = connect();
                var statement = db.prepareStatement("select version from \"EstateRoleDefinition\" where id=?")) {
            statement.setObject(1, role);
            try (var rows = statement.executeQuery()) {
                rows.next();
                return rows.getInt(1);
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
