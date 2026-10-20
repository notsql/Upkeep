package com.proj.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** Separate committed transactions are essential: one transaction cannot demonstrate a write race. */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class FlatlinePauseConcurrencyTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    Clock clock;

    @Test
    void simultaneousFirstPausesCreateOnePauseAndRejectTheOtherWithoutExtendingIt() throws Exception {
        when(clock.instant()).thenReturn(Instant.parse("2026-10-20T04:00:00Z"));
        when(clock.getZone()).thenReturn(ZoneOffset.UTC);
        var data = new DeviceTestData(db);
        var ids = data.estateWithAsset("owner");
        var device = data.device(ids[0], ids[1], ids[2], null);
        var base = "/estates/" + ids[0];
        try (var executor = Executors.newFixedThreadPool(2)) {
            mvc.perform(put(base + "/flatline-policies/TEMPERATURE")
                            .with(jwt().jwt(token -> token.subject("owner")))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"durationMinutes\":2,\"tolerance\":0}"))
                    .andExpect(status().isOk());
            var ready = new CountDownLatch(2);
            var start = new CountDownLatch(1);
            Callable<Integer> pause = () -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) {
                    throw new IllegalStateException("Pause workers did not start.");
                }
                return mvc.perform(post(base + "/devices/" + device + "/flatline-pauses/TEMPERATURE")
                                .with(jwt().jwt(token -> token.subject("owner")))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"durationMinutes\":60}"))
                        .andReturn()
                        .getResponse()
                        .getStatus();
            };
            var first = executor.submit(pause);
            var second = executor.submit(pause);
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(new int[] {first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS)})
                    .containsExactlyInAnyOrder(201, 409);
            assertThat(((Number) db.fetchValue(
                                    "select count(*) from \"DeviceFlatlinePause\" where \"deviceId\"=?", device))
                            .intValue())
                    .isEqualTo(1);
        } finally {
            db.execute("delete from \"DeviceFlatlinePause\" where \"deviceId\"=?", device);
            db.execute("delete from \"FlatlinePolicy\" where \"estateId\"=?", ids[0]);
            db.execute("delete from \"Device\" where id=?", device);
            db.execute("delete from \"Asset\" where id=?", ids[2]);
            db.execute("delete from \"Location\" where id=?", ids[1]);
            db.execute("delete from \"Estate\" where id=?", ids[0]);
        }
    }
}
