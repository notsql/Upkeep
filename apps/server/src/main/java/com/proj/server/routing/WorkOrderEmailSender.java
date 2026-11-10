package com.proj.server.routing;

/** Hands a work order email to the outgoing mail server. */
public interface WorkOrderEmailSender {
    /** @throws WorkOrderSendException when the mail server did not accept the message */
    void send(WorkOrderEmail email);
}
