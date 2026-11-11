package com.proj.server.routing;

import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.Attachment;
import com.resend.services.emails.model.CreateEmailOptions;
import java.time.Duration;
import java.util.Base64;
import java.util.Locale;

/** Sends email through Resend's HTTP API. Errors become internal codes, never provider text. */
public class ResendEmailSender implements EmailSender {
    private final Resend resend;
    private final String from;
    private final String replyTo;

    /**
     * @param baseUrl Resend's API root; blank means the SDK default
     * @param replyTo used when the message has none of its own; blank means no reply-to
     */
    public ResendEmailSender(String apiKey, String baseUrl, String from, String replyTo) {
        var builder = Resend.builder()
                .apiKey(apiKey)
                .connectTimeout(Duration.ofSeconds(10))
                .callTimeout(Duration.ofSeconds(60));
        if (baseUrl != null && !baseUrl.isBlank()) builder.baseUrl(baseUrl);
        this.resend = builder.build();
        this.from = from;
        this.replyTo = replyTo;
    }

    @Override
    public void send(OutboundEmail email) {
        var options = CreateEmailOptions.builder()
                .from(from)
                .to(email.to())
                .subject(email.subject())
                .text(email.text());
        var reply = email.replyTo() != null && !email.replyTo().isBlank() ? email.replyTo() : replyTo;
        if (reply != null && !reply.isBlank()) options.replyTo(reply);
        var encoder = Base64.getEncoder();
        for (var attachment : email.attachments()) {
            options.attachments(Attachment.builder()
                    .fileName(attachment.filename())
                    .content(encoder.encodeToString(attachment.bytes()))
                    .contentType(attachment.contentType())
                    .build());
        }
        try {
            resend.emails().send(options.build());
        } catch (ResendException failed) {
            throw new EmailSendException(code(failed), "The email provider did not accept the email.", failed);
        } catch (RuntimeException failed) {
            throw new EmailSendException("PROVIDER_ERROR", "The email provider could not be reached.", failed);
        }
    }

    private static String code(ResendException failed) {
        var status = failed.getStatusCode();
        if (status == null) return "PROVIDER_ERROR";
        if (status == 401 || status == 403) return "AUTH";
        if (status == 413 || (status == 422 && tooLarge(failed))) return "MESSAGE_TOO_LARGE";
        if (status == 422) return "MESSAGE_INVALID";
        return "PROVIDER_ERROR";
    }

    /** Resend reports oversized attachments as a validation error whose message mentions the size limit. */
    private static boolean tooLarge(ResendException failed) {
        var text = (failed.getMessage() + " " + failed.getErrorName()).toLowerCase(Locale.ROOT);
        return text.contains("too large") || text.contains("exceeds") || text.contains("size limit");
    }
}
