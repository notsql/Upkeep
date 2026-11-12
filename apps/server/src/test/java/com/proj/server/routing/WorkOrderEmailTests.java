package com.proj.server.routing;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class WorkOrderEmailTests {
    private static final byte[] JPEG = {1, 2, 3};
    private static final byte[] PNG = {4, 5};

    @Test
    void theEmailIsAddressedToTheCopiedContractorAndNamesTheWorkOrder() {
        OutboundEmail email = WorkOrderEmail.build(content("Lift stuck", "Doors won't open\nat level 3"));

        assertEquals("faults@acmelifts.example", email.to());
        assertNull(email.replyTo());
        assertEquals("Work order WO-000042: Lift at Maple Estate", email.subject());
    }

    @Test
    void theBodyCarriesTheResidentsWordsVerbatimAndWhereAndWhen() {
        var email = WorkOrderEmail.build(content("Lift stuck", "Doors won't open\nat level 3"));

        assertTrue(email.text().contains("Work order: WO-000042"));
        assertTrue(email.text().contains("Type of problem: Lift"));
        assertTrue(email.text().contains("Estate: Maple Estate, 1 Maple Road, 123456"));
        assertTrue(email.text().contains("Location: Block A › Level 4 › Lift lobby"));
        assertTrue(email.text().contains("Reported: 2026-10-26 06:05 UTC"));
        assertTrue(email.text().contains("Lift stuck"));
        assertTrue(email.text().contains("Doors won't open\nat level 3"));
        assertTrue(email.text().contains("Photos attached: 2"));
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
                base.category(),
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
        assertEquals("Work order WO-000042: Lift at Maple Estate", email.subject());
    }

    @Test
    void theEmailOmitsTheResidentsIdentityAndTheModelsJudgement() {
        var email = WorkOrderEmail.build(content("Lift stuck", "Doors"));

        assertFalse(email.text().contains("resident-a"));
        assertFalse(email.text().toLowerCase().contains("confidence"));
        assertFalse(email.text().contains("private/"));
    }

    @Test
    void aReportWithoutPhotosSaysSoAndAttachesNothing() {
        var base = content("Light out", "Corridor light");
        var email = WorkOrderEmail.build(new WorkOrderEmail.Content(
                base.reference(),
                EquipmentType.LIGHT,
                null,
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
        assertTrue(email.text().contains("Photos attached: none"));
        assertEquals("Work order WO-000042: Common-area light at Maple Estate", email.subject());
    }

    @Test
    void aReportWithACategoryIsNamedByItInTheSubjectAndBody() {
        var base = content("Bins overflowing", "Rubbish everywhere");
        var email = WorkOrderEmail.build(new WorkOrderEmail.Content(
                base.reference(),
                EquipmentType.CLEANING,
                FaultCategory.RUBBISH,
                base.contractorName(),
                base.contractorEmail(),
                "ATTA",
                base.estateAddress(),
                base.locationLabel(),
                base.reportedAt(),
                base.title(),
                base.description(),
                base.photos()));

        assertEquals("Work order WO-000042: Rubbish or litter at ATTA", email.subject());
        assertTrue(email.text().contains("Type of problem: Rubbish or litter"));
        assertFalse(email.text().contains("Equipment:"));
    }

    private static WorkOrderEmail.Content content(String title, String description) {
        return new WorkOrderEmail.Content(
                "WO-000042",
                EquipmentType.LIFT,
                null,
                "Acme Lifts",
                "faults@acmelifts.example",
                "Maple Estate",
                "1 Maple Road, 123456",
                "Block A › Level 4 › Lift lobby",
                OffsetDateTime.parse("2026-10-26T14:05:00+08:00"),
                title,
                description,
                List.of(new WorkOrderEmail.Image(JPEG, "image/jpeg"), new WorkOrderEmail.Image(PNG, "image/png")));
    }

    @Test
    void aJobWithoutAResidentReportCarriesTheWorkOrderDescriptionInstead() {
        var email = WorkOrderEmail.job(new WorkOrderEmail.Job(
                "MPL-W0007",
                "Ace Cleaning",
                "jobs@ace.example",
                "Maple Estate",
                "1 Maple Road, 123456",
                "Block A / Level 1 / Lobby",
                "Clean the lobby\nafter renovation"));

        assertEquals("jobs@ace.example", email.to());
        assertEquals("Work order MPL-W0007 at Maple Estate", email.subject());
        assertTrue(email.text().contains("Hello Ace Cleaning,"));
        assertTrue(email.text().contains("Work order: MPL-W0007"));
        assertTrue(email.text().contains("Location: Block A / Level 1 / Lobby"));
        assertTrue(email.text().contains("Clean the lobby\nafter renovation"));
        assertFalse(email.text().contains("resident"));
        assertTrue(email.attachments().isEmpty());
    }
}
