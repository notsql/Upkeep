package com.proj.server.routing;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * The plain-text email that carries a work order to its contractor: the resident's own words and photos, never
 * their identity or the model's judgement.
 */
public record WorkOrderEmail(String to, String toName, String subject, String body, List<Attachment> attachments) {
    private static final DateTimeFormatter REPORTED = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm 'UTC'");

    public record Attachment(String filename, String contentType, byte[] bytes) {}

    public record Content(
            String reference,
            EquipmentType equipmentType,
            String contractorName,
            String contractorEmail,
            String estateName,
            String estateAddress,
            String locationLabel,
            OffsetDateTime reportedAt,
            String title,
            String description,
            List<FaultClassifier.Image> photos) {}

    public static WorkOrderEmail build(Content content) {
        var subject = "Work order %s: %s fault at %s"
                .formatted(content.reference(), content.equipmentType().label(), oneLine(content.estateName()));
        var photos = content.photos().isEmpty()
                ? "none"
                : Integer.toString(content.photos().size());
        var body = """
                Hello %s,

                A resident reported the fault below. Their words and photos are included unchanged.

                Work order: %s
                Equipment: %s
                Estate: %s, %s
                Location: %s
                Reported: %s

                Resident's report
                -----------------
                %s

                %s

                Photos attached: %s
                """.formatted(
                content.contractorName(),
                content.reference(),
                content.equipmentType().label(),
                content.estateName(),
                content.estateAddress(),
                content.locationLabel(),
                content.reportedAt().withOffsetSameInstant(ZoneOffset.UTC).format(REPORTED),
                content.title(),
                content.description(),
                photos);
        var attachments = new ArrayList<Attachment>();
        for (int i = 0; i < content.photos().size(); i++) {
            var photo = content.photos().get(i);
            var extension = "image/png".equals(photo.contentType()) ? "png" : "jpg";
            attachments.add(
                    new Attachment("photo-%d.%s".formatted(i + 1, extension), photo.contentType(), photo.bytes()));
        }
        return new WorkOrderEmail(
                content.contractorEmail(), oneLine(content.contractorName()), subject, body, List.copyOf(attachments));
    }

    /** Header values must stay on one line, or a CR/LF could inject further headers. */
    private static String oneLine(String value) {
        return value.replaceAll("\\p{Cntrl}", " ");
    }
}
