package com.proj.server;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;

/**
 * A throwaway Postgres for context tests, migrated with Prisma's own SQL (see
 * .spec/decisions/0019). {@code @ServiceConnection} points the datasource at it,
 * outranking any {@code SPRING_DATASOURCE_*} in the environment.
 */
@TestConfiguration(proxyBeanMethods = false)
class TestcontainersConfiguration {

    private static final Path MIGRATIONS = Path.of("packages", "db", "prisma", "migrations");

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgres() throws IOException {
        var container = new PostgreSQLContainer("postgres:18-alpine")
                // Nothing here is worth keeping: data in memory, durability off.
                .withTmpFs(Map.of("/var/lib/postgresql", "rw"))
                .withCommand(
                        "postgres", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off");
        // The image runs /docker-entrypoint-initdb.d in name order on first
        // start, so a zero-padded prefix keeps Prisma's migration order.
        List<Path> migrations = migrations();
        for (int i = 0; i < migrations.size(); i++) {
            container.withCopyFileToContainer(
                    MountableFile.forHostPath(migrations.get(i)), "/docker-entrypoint-initdb.d/%03d.sql".formatted(i));
        }
        return container;
    }

    /** Every migration.sql, in folder (timestamp) order. */
    private static List<Path> migrations() throws IOException {
        Path dir = findMigrationsDir();
        try (Stream<Path> folders = Files.list(dir)) {
            List<Path> sql = folders.filter(Files::isDirectory)
                    .sorted()
                    .map(folder -> folder.resolve("migration.sql"))
                    .filter(Files::isRegularFile)
                    .toList();
            if (sql.isEmpty()) {
                throw new IllegalStateException("No migration.sql files found under " + dir);
            }
            return sql;
        }
    }

    /**
     * Walks up from the working directory (apps/server under Maven, often the
     * repo root in an IDE) to packages/db/prisma/migrations.
     */
    private static Path findMigrationsDir() {
        Path start = Path.of("").toAbsolutePath();
        for (Path dir = start; dir != null; dir = dir.getParent()) {
            Path candidate = dir.resolve(MIGRATIONS);
            if (Files.isDirectory(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Could not find " + MIGRATIONS + " in " + start + " or any parent directory");
    }
}
