package com.proj.server;

import static com.proj.server.db.Tables.ASSETASSESSMENT;
import static org.assertj.core.api.Assertions.assertThat;

import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ServerApplicationTests {

    @Autowired
    private DSLContext dsl;

    @Test
    void contextLoads() {}

    @Test
    void queriesAPostgresMigratedByPrisma() {
        // AssetAssessment comes from the latest migration, so this passes only
        // once every migration has been applied to a real database.
        assertThat(dsl.fetchCount(ASSETASSESSMENT)).isZero();
    }
}
