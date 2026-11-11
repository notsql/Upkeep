package com.proj.server.routing;

/** Hands an outbound email to the email provider. */
public interface EmailSender {
    /** @throws EmailSendException when the provider did not accept the message */
    void send(OutboundEmail email);
}
