package com.proj.server.routing;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;

/**
 * The work order sender exists only when an SMTP host is configured, matching Spring Boot's own condition for
 * creating a {@link JavaMailSender}. Without it, WorkOrderDeliveryJob records MAIL_NOT_CONFIGURED.
 */
@Configuration(proxyBeanMethods = false)
public class MailConfig {
    @Bean
    @ConditionalOnProperty(prefix = "spring.mail", name = "host")
    WorkOrderEmailSender workOrderEmailSender(
            JavaMailSender mail,
            @Value("${app.mail.from:}") String from,
            @Value("${spring.mail.username:}") String account,
            @Value("${app.mail.reply-to:}") String replyTo) {
        return new SmtpWorkOrderEmailSender(mail, from, account, replyTo);
    }
}
