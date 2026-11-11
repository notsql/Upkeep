package com.proj.server.routing;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class MailConfigTests {
    private final ApplicationContextRunner runner =
            new ApplicationContextRunner().withUserConfiguration(MailConfig.class);

    @Test
    void thereIsNoSenderWithoutAnApiKey() {
        runner.withPropertyValues("app.mail.from=work@upkeep.example")
                .run(context ->
                        assertTrue(context.getBeansOfType(EmailSender.class).isEmpty()));
        runner.withPropertyValues("app.mail.resend-api-key=", "app.mail.from=work@upkeep.example")
                .run(context ->
                        assertTrue(context.getBeansOfType(EmailSender.class).isEmpty()));
    }

    @Test
    void anApiKeyGivesTheResendSender() {
        runner.withPropertyValues("app.mail.resend-api-key=re_test", "app.mail.from=work@upkeep.example")
                .run(context -> assertInstanceOf(ResendEmailSender.class, context.getBean(EmailSender.class)));
    }

    @Test
    void anApiKeyWithoutAFromAddressFailsStartupNamingTheVariable() {
        runner.withPropertyValues("app.mail.resend-api-key=re_test", "app.mail.from= ")
                .run(context -> {
                    assertTrue(context.getStartupFailure() != null);
                    var message = new StringBuilder();
                    for (Throwable e = context.getStartupFailure(); e != null; e = e.getCause())
                        message.append(e.getMessage());
                    assertTrue(message.toString().contains("APP_MAIL_FROM"), message.toString());
                });
    }
}
