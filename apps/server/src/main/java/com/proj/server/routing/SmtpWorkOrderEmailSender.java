package com.proj.server.routing;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;

/** Sends work order emails over SMTP (Gmail in this deployment). Errors become internal codes, never provider text. */
public class SmtpWorkOrderEmailSender implements WorkOrderEmailSender {
    private final JavaMailSender mail;
    private final String from;
    private final String replyTo;

    /**
     * @param from the From address; blank means {@code account}, the authenticated SMTP user
     * @param replyTo added as Reply-To only when not blank
     */
    public SmtpWorkOrderEmailSender(JavaMailSender mail, String from, String account, String replyTo) {
        this.mail = mail;
        this.from = from.isBlank() ? account : from;
        this.replyTo = replyTo;
    }

    @Override
    public void send(WorkOrderEmail email) {
        var message = mail.createMimeMessage();
        try {
            var helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setTo(new InternetAddress(email.to(), email.toName(), StandardCharsets.UTF_8.name()));
            if (!from.isBlank()) helper.setFrom(from);
            if (!replyTo.isBlank()) helper.setReplyTo(replyTo);
            helper.setSubject(email.subject());
            helper.setText(email.body(), false);
            for (var attachment : email.attachments()) {
                helper.addAttachment(
                        attachment.filename(), new ByteArrayResource(attachment.bytes()), attachment.contentType());
            }
        } catch (MessagingException | UnsupportedEncodingException invalid) {
            throw new WorkOrderSendException("MESSAGE_INVALID", "The work order email could not be built.", invalid);
        }
        try {
            mail.send(message);
        } catch (MailAuthenticationException rejected) {
            throw new WorkOrderSendException("SMTP_AUTH", "The mail server rejected the credentials.", rejected);
        } catch (MailException failed) {
            throw new WorkOrderSendException(
                    tooLarge(failed) ? "MESSAGE_TOO_LARGE" : "SMTP_ERROR",
                    "The mail server did not accept the work order email.",
                    failed);
        }
    }

    /** SMTP 552 is "message size exceeds fixed maximum"; Gmail answers it for anything over 25 MB. */
    private static boolean tooLarge(Throwable error) {
        for (var cause = error; cause != null; cause = cause.getCause()) {
            var message = cause.getMessage();
            if (message != null && message.contains("552")) return true;
        }
        return false;
    }
}
