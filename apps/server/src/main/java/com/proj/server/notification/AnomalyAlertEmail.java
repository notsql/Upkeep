package com.proj.server.notification;

import com.proj.server.estate.CouncilRepository.Member;
import com.proj.server.routing.OutboundEmail;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

/** The plain-English email for a new unusual-readings alert: no scores, no codes. */
public final class AnomalyAlertEmail {
    public record Content(
            String to, String assetName, String estateName, String webOrigin, UUID estateId, UUID assetId) {}

    private AnomalyAlertEmail() {}

    public static OutboundEmail build(Content content) {
        var asset = oneLine(content.assetName());
        var estate = oneLine(content.estateName());
        var origin = content.webOrigin().replaceAll("/+$", "");
        var body = """
                Hello,

                The readings from %s at %s look unusual. It may need a check.

                See the asset: %s/estates/%s/assets/%s

                You are getting this because you manage %s. A manager can turn these messages off under the estate's Notification settings.
                """.formatted(asset, estate, origin, content.estateId(), content.assetId(), estate);
        return new OutboundEmail(
                content.to(), "Unusual readings: %s at %s".formatted(asset, estate), body, null, List.of());
    }

    /** The estate owner first, then every manager, each user once. */
    static List<String> recipients(String ownerUserId, List<Member> members) {
        var users = new LinkedHashSet<String>();
        users.add(ownerUserId);
        for (var member : members) {
            if ("MANAGER".equals(member.role())) {
                users.add(member.userId());
            }
        }
        return List.copyOf(users);
    }

    private static String oneLine(String value) {
        return value.replaceAll("\\s+", " ").strip();
    }
}
