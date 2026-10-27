package com.proj.server.routing;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class WorkOrderEmailTests {
    private static final byte[] JPEG = {1, 2, 3};
    private static final byte[] PNG = {4, 5};

    @Test
    void theEmailIsAddressedToTheCopiedContractorAndNamesTheWorkOrder() {
        var email = WorkOrderEmail.build(content("Lift stuck", "Doors won't open\nat level 3"));

        assertEquals("faults@acmelifts.example", email.to());
        assertEquals("Acme Lifts", email.toName());
        assertEquals("Work order WO-000042: Lift fault at Maple Estate", email.subject());
    }

    @Test
    void theBodyCarriesTheResidentsWordsVerbatimAndWhereAndWhen() {
        var email = WorkOrderEmail.build(content("Lift stuck", "Doors won't open\nat level 3"));

        assertTrue(email.body().contains("Work order: WO-000042"));
        assertTrue(email.body().contains("Equipment: Lift"));
        assertTrue(email.body().contains("Estate: Maple Estate, 1 Maple Road, 123456"));
        assertTrue(email.body().contains("Location: Block A › Level 4 › Lift lobby"));
        assertTrue(email.body().contains("Reported: 2026-10-26 06:05 UTC"));
        assertTrue(email.body().contains("Lift stuck"));
        assertTrue(email.body().contains("Doors won't open\nat level 3"));
        assertTrue(email.body().contains("Photos attached: 2"));
    }

    @Test
    void thePhotosAreAttachedInOrderWithTheirStoredBytes() {
        var email = WorkOrderEmail.build(content("Lift stuck", "Doors"));

        assertEquals(2, email.attachments().size());
        assertEquals("photo-1.jpg", email.attachments().get(0).filename());
        assertEquals("image/jpeg", email.attachments().get(0).contentType());
        assertArrayEquals(JPEG, email.attachments().get(0).bytes());
        assertEquals("photo-2.png", email.attachments().get(1).filename());
        assertEquals("image/png", email.attachments().get(1).contentType());
        assertArrayEquals(PNG, email.attachments().get(1).bytes());
    }

    @Test
    void headerValuesCannotCarryLineBreaks() {
        var base = content("Lift", "Doors");
        var email = WorkOrderEmail.build(new WorkOrderEmail.Content(
                base.reference(),
                base.equipmentType(),
                "Acme\r\nBcc: someone@example.com",
                base.contractorEmail(),
                "Maple\nEstate",
                base.estateAddress(),
                base.locationLabel(),
                base.reportedAt(),
                base.title(),
                base.description(),
                base.photos()));

        assertFalse(email.subject().contains("\n"));
        assertFalse(email.subject().contains("\r"));
        assertEquals("Work order WO-000042: Lift fault at Maple Estate", email.subject());
        assertEquals("Acme  Bcc: someone@example.com", email.toName());
    }

    @Test
    void theEmailOmitsTheResidentsIdentityAndTheModelsJudgement() {
        var email = WorkOrderEmail.build(content("Lift stuck", "Doors"));

        assertFalse(email.body().contains("resident-a"));
        assertFalse(email.body().toLowerCase().contains("confidence"));
        assertFalse(email.body().contains("private/"));
    }

    @Test
    void aReportWithoutPhotosSaysSoAndAttachesNothing() {
        var base = content("Light out", "Corridor light");
        var email = WorkOrderEmail.build(new WorkOrderEmail.Content(
                base.reference(),
                EquipmentType.LIGHT,
                base.contractorName(),
                base.contractorEmail(),
                base.estateName(),
                base.estateAddress(),
                base.locationLabel(),
                base.reportedAt(),
                base.title(),
                base.description(),
                List.of()));

        assertTrue(email.attachments().isEmpty());
        assertTrue(email.body().contains("Photos attached: none"));
        assertEquals("Work order WO-000042: Common-area light fault at Maple Estate", email.subject());
    }

    private static WorkOrderEmail.Content content(String title, String description) {
        return new WorkOrderEmail.Content(
                "WO-000042",
                EquipmentType.LIFT,
                "Acme Lifts",
                "faults@acmelifts.example",
                "Maple Estate",
                "1 Maple Road, 123456",
                "Block A › Level 4 › Lift lobby",
                OffsetDateTime.parse("2026-10-26T14:05:00+08:00"),
                title,
                description,
                List.of(new FaultClassifier.Image(JPEG, "image/jpeg"), new FaultClassifier.Image(PNG, "image/png")));
    }
}
