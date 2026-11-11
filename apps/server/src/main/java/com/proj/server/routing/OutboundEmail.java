package com.proj.server.routing;

import java.util.List;

/** A plain-text email to one recipient. {@code replyTo} may be null, meaning the configured default. */
public record OutboundEmail(String to, String subject, String text, String replyTo, List<Attachment> attachments) {
    public record Attachment(String filename, String contentType, byte[] bytes) {}
}
