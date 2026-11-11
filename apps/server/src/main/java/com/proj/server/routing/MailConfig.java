package com.proj.server.routing;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The email sender exists only when a Resend API key is set. Without it, DispatchDeliveryJob records
 * MAIL_NOT_CONFIGURED.
 */
@Configuration(proxyBeanMethods = false)
public class MailConfig {
    @Bean
    @ConditionalOnExpression("!'${app.mail.resend-api-key:}'.isBlank()")
    EmailSender emailSender(
            @Value("${app.mail.resend-api-key}") String apiKey,
            @Value("${app.mail.resend-base-url:}") String baseUrl,
            @Value("${app.mail.from:}") String from,
            @Value("${app.mail.reply-to:}") String replyTo) {
        if (from.isBlank()) {
            throw new IllegalStateException("APP_MAIL_FROM must be set when RESEND_API_KEY is set.");
        }
        return new ResendEmailSender(apiKey, baseUrl, from, replyTo);
    }
}
