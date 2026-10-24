package com.proj.server;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;

/** Apply the real expand migration over populated preset-era data, never a hand-built test schema. */
class CustomEstateRoleMigrationTests {
    private static final String LAST_PRE_CUSTOM_MIGRATION = "20261020044009_flatline_policies";
    private static final UUID ESTATE = UUID.randomUUID();
    private static PostgreSQLContainer postgres;
    private Connection connection;

    @BeforeAll
    static void migratePopulatedLegacyDatabase() throws Exception {
        List<Path> migrations;
        try (var folders = Files.list(migrationsDirectory())) {
            migrations = folders.filter(Files::isDirectory).sorted().toList();
        }
        postgres = new PostgreSQLContainer("postgres:18-alpine");
        int index = 0;
        for (var folder : migrations) {
            if (folder.getFileName().toString().compareTo(LAST_PRE_CUSTOM_MIGRATION) <= 0) {
                postgres.withCopyFileToContainer(
                        MountableFile.forHostPath(folder.resolve("migration.sql")),
                        "/docker-entrypoint-initdb.d/%03d.sql".formatted(index++));
            }
        }
        postgres.start();
        try (var db = connect()) {
            execute(db, """
                    insert into "Estate" (id, "ownerUserId", name, code, address, "postalCode", "updatedAt")
                    values (?, 'owner', 'Legacy estate', 'CUSTOM-MIGRATION', 'Road', '123456', now())
                    """, ESTATE);
            for (var role : List.of("MANAGER", "COUNCIL", "RESIDENT", "CREW", "MEMBER")) {
                execute(
                        db,
                        "insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)",
                        ESTATE,
                        role,
                        role);
                if (!role.equals("MEMBER")) {
                    execute(
                            db,
                            """
                            insert into "EstateInvitation" (id, "estateId", name, email, "inviterUserId", role, status, "providerInvitationId", "expiresAt")
                            values (?, ?, '', ?, 'MANAGER', ?, 'PENDING', ?, '2030-01-01T00:00:00Z')
                            """,
                            UUID.randomUUID(),
                            ESTATE,
                            role.toLowerCase() + "@example.com",
                            role,
                            "provider-" + role);
                }
            }
            for (var folder : migrations) {
                if (folder.getFileName().toString().compareTo(LAST_PRE_CUSTOM_MIGRATION) > 0) {
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
    void seedsExactlyTheNineSupportedPermissionsAndLeavesCustomDefinitionsEmpty() throws Exception {
        var actual = new ArrayList<String>();
        try (var statement = connection.createStatement();
                var rows = statement.executeQuery("select code, label, description from \"Permission\"")) {
            while (rows.next()) {
                actual.add(rows.getString("code"));
                assertFalse(rows.getString("label").isBlank());
                assertFalse(rows.getString("description").isBlank());
            }
        }
        assertEquals(new java.util.HashSet<>(CustomEstateRoleTestSupport.CODES), new java.util.HashSet<>(actual));
        assertEquals(9, actual.size());
        assertEquals(0, count("select count(*) from \"EstateRoleDefinition\""));
        assertEquals(0, count("select count(*) from \"EstateRolePermission\""));
    }

    @Test
    void expansionPreservesPresetMembershipsAndInvitationDeliveryMetadataWithNullCustomReferences() throws Exception {
        assertEquals(
                5,
                count(
                        "select count(*) from \"EstateUser\" where \"estateId\"=? and role=\"userId\" and \"customRoleId\" is null",
                        ESTATE));
        assertEquals(4, count("""
                select count(*) from "EstateInvitation" where "estateId"=? and "customRoleId" is null
                and status='PENDING' and "providerInvitationId"='provider-' || role
                and "expiresAt"='2030-01-01T00:00:00Z'::timestamptz
                """, ESTATE));
    }

    @ParameterizedTest
    @ValueSource(strings = {"EstateUser", "EstateInvitation"})
    void customRowsRequireANonNullSameEstateDefinitionAndPresetRowsRejectReferences(String table) throws Exception {
        var role = definition(ESTATE);
        var foreignEstate = anotherEstate();
        var foreign = definition(foreignEstate);
        assertEquals("23514", rejected(rowSql(table), rowValues(table, "CUSTOM", null)));
        assertEquals("23514", rejected(rowSql(table), rowValues(table, "COUNCIL", role)));
        assertEquals("23503", rejected(rowSql(table), rowValues(table, "CUSTOM", foreign)));
        assertEquals("23503", rejected(rowSql(table), rowValues(table, "CUSTOM", UUID.randomUUID())));
        execute(connection, rowSql(table), rowValues(table, "CUSTOM", role));
        assertEquals(1, count("select count(*) from \"" + table + "\" where \"customRoleId\"=?", role));
    }

    @Test
    void permissionLinksRejectUnknownCodesDuplicatesAndDeletionOrRenamingOfReferencedCodes() throws Exception {
        var role = definition(ESTATE);
        execute(
                connection,
                "insert into \"EstateRolePermission\" (\"roleId\", permission) values (?, 'VIEW_ESTATE')",
                role);
        assertEquals(
                "23503",
                rejected(
                        "insert into \"EstateRolePermission\" (\"roleId\", permission) values (?, 'UNSUPPORTED')",
                        role));
        assertEquals(
                "23505",
                rejected(
                        "insert into \"EstateRolePermission\" (\"roleId\", permission) values (?, 'VIEW_ESTATE')",
                        role));
        assertTrue(java.util.Set.of("23503", "23001")
                .contains(rejected("delete from \"Permission\" where code='VIEW_ESTATE'")));
        assertTrue(java.util.Set.of("23503", "23001")
                .contains(rejected("update \"Permission\" set code='RENAMED' where code='VIEW_ESTATE'")));
        assertEquals(1, count("select count(*) from \"EstateRolePermission\" where \"roleId\"=?", role));
    }

    @ParameterizedTest
    @ValueSource(strings = {"EstateUser", "EstateInvitation"})
    void restrictiveForeignKeysPreventDeletingReferencedRoles(String table) throws Exception {
        var role = definition(ESTATE);
        execute(connection, rowSql(table), rowValues(table, "CUSTOM", role));
        assertTrue(java.util.Set.of("23503", "23001")
                .contains(rejected("delete from \"EstateRoleDefinition\" where id=?", role)));
        assertEquals(1, count("select count(*) from \"EstateRoleDefinition\" where id=?", role));
    }

    @Test
    void normalizedNamesAreUniqueWithinAnEstateButReusableAcrossEstates() throws Exception {
        var first = definition(ESTATE);
        execute(connection, "update \"EstateRoleDefinition\" set \"normalizedName\"='reader' where id=?", first);
        var second = definition(ESTATE);
        assertEquals(
                "23505",
                rejected("update \"EstateRoleDefinition\" set \"normalizedName\"='reader' where id=?", second));
        var foreign = definition(anotherEstate());
        execute(connection, "update \"EstateRoleDefinition\" set \"normalizedName\"='reader' where id=?", foreign);
        assertEquals(2, count("select count(*) from \"EstateRoleDefinition\" where \"normalizedName\"='reader'"));
    }

    private UUID definition(UUID estate) throws Exception {
        var id = UUID.randomUUID();
        execute(connection, """
                insert into "EstateRoleDefinition" (id, "estateId", name, "normalizedName", "createdByUserId", "updatedAt", version)
                values (?, ?, 'Reader', ?, 'owner', now(), 1)
                """, id, estate, id.toString());
        return id;
    }

    private UUID anotherEstate() throws Exception {
        var id = UUID.randomUUID();
        execute(connection, """
                insert into "Estate" (id, "ownerUserId", name, code, address, "postalCode", "updatedAt")
                values (?, 'other', 'Other', ?, 'Road', '123456', now())
                """, id, id.toString());
        return id;
    }

    private static String rowSql(String table) {
        return table.equals("EstateUser")
                ? "insert into \"EstateUser\" (\"estateId\", \"userId\", role, \"customRoleId\") values (?, ?, ?, ?)"
                : "insert into \"EstateInvitation\" (\"estateId\", id, role, \"customRoleId\", name, email, \"inviterUserId\", status) values (?, ?, ?, ?, '', 'custom@example.com', 'MANAGER', 'IN_APP')";
    }

    private static Object[] rowValues(String table, String discriminator, UUID role) {
        return new Object[] {
            ESTATE, table.equals("EstateUser") ? UUID.randomUUID().toString() : UUID.randomUUID(), discriminator, role
        };
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
