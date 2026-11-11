package com.proj.server.notification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.proj.server.estate.CouncilRepository.Member;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AnomalyAlertEmailTests {
    static final UUID ESTATE = UUID.fromString("11111111-1111-1111-1111-111111111111");
    static final UUID ASSET = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Test
    void theEmailSaysWhatLooksUnusualAndLinksToTheAsset() {
        var email = AnomalyAlertEmail.build(new AnomalyAlertEmail.Content(
                "manager@example.com", "Pump 3", "Sunrise Estate", "https://upkeep.example/", ESTATE, ASSET));
        assertEquals("manager@example.com", email.to());
        assertEquals("Unusual readings: Pump 3 at Sunrise Estate", email.subject());
        assertNull(email.replyTo());
        assertTrue(email.attachments().isEmpty());
        assertEquals("""
                Hello,

                The readings from Pump 3 at Sunrise Estate look unusual. It may need a check.

                See the asset: https://upkeep.example/estates/11111111-1111-1111-1111-111111111111/assets/22222222-2222-2222-2222-222222222222

                You are getting this because you manage Sunrise Estate. A manager can turn these messages off under the estate's Notification settings.
                """, email.text());
    }

    @Test
    void theSubjectStaysOnOneLine() {
        var email = AnomalyAlertEmail.build(new AnomalyAlertEmail.Content(
                "m@example.com", "Pump\n3", "Sunrise\r\nEstate", "http://localhost:3001", ESTATE, ASSET));
        assertEquals("Unusual readings: Pump 3 at Sunrise Estate", email.subject());
    }

    @Test
    void theOwnerAndEveryManagerAreRecipientsOnce() {
        var members = List.of(
                new Member("owner", true, "MANAGER"),
                new Member("manager", false, "MANAGER"),
                new Member("crew", false, "CREW"),
                new Member("council", false, "COUNCIL"),
                new Member("manager", false, "MANAGER"));
        assertEquals(List.of("owner", "manager"), AnomalyAlertEmail.recipients("owner", members));
    }

    @Test
    void theOwnerIsARecipientEvenWhenNotListed() {
        assertEquals(
                List.of("owner", "manager"),
                AnomalyAlertEmail.recipients("owner", List.of(new Member("manager", false, "MANAGER"))));
    }
}
