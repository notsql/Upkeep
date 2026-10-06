package com.proj.server.workos;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.workos.WorkOS;
import com.workos.common.exceptions.TransportException;
import com.workos.common.http.RequestOptions;
import com.workos.models.Invitation;
import com.workos.models.User;
import com.workos.types.InvitationState;
import com.workos.usermanagement.UserManagement;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class CouncilIdentityTests {
    final WorkOS client = mock(WorkOS.class);
    final UserManagement users = mock(UserManagement.class);
    final WorkOSService service = new WorkOSService("test-key", client);

    @Test
    void existingAccountsUseInAppAcceptanceInsteadOfFailingSignupInvitation() {
        when(client.getUserManagement()).thenReturn(users);
        when(users.sendInvitation(anyString(), isNull(), isNull(), eq(7L), anyString(), isNull(), any()))
                .thenThrow(new com.workos.common.exceptions.BadRequestException(
                        "req_existing", "user_already_exists", "User already exists", null, null));
        var result = service.send(UUID.randomUUID(), "existing@example.com", "owner");
        assertEquals("existing_account", result.state());
        assertEquals("existing@example.com", result.email());
        assertNull(result.id());
        assertTrue(result.expiresAt().isAfter(OffsetDateTime.now().plusDays(6)));
    }

    @Test
    void logsProviderDiagnosticsWithoutPrivateResponseDetails() {
        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(WorkOSService.class);
        var appender = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        appender.start();
        logger.addAppender(appender);
        try {
            when(client.getUserManagement()).thenReturn(users);
            when(users.getInvitation("inv_1"))
                    .thenThrow(new TransportException("private provider details", new RuntimeException()));
            assertThrows(ResponseStatusException.class, () -> service.invitation("inv_1"));
            assertEquals(1, appender.list.size());
            var event = appender.list.getFirst();
            assertTrue(event.getFormattedMessage().contains("WorkOS request failed: status="));
            assertTrue(event.getFormattedMessage().contains("requestId="));
            assertFalse(event.getFormattedMessage().contains("private provider details"));
            assertNull(event.getThrowableProxy());
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    @Test
    void sendsAnApplicationInvitationWithStableDeliveryKeyAndNoOrganizationRole() {
        when(client.getUserManagement()).thenReturn(users);
        var sent = mock(Invitation.class);
        when(sent.getId()).thenReturn("inv_1");
        when(sent.getEmail()).thenReturn("council@example.com");
        when(sent.getState()).thenReturn(InvitationState.Pending);
        var expiry = OffsetDateTime.now().plusDays(7);
        when(sent.getExpiresAt()).thenReturn(expiry);
        when(users.sendInvitation(anyString(), isNull(), isNull(), eq(7L), anyString(), isNull(), any()))
                .thenReturn(sent);
        var requestId = UUID.randomUUID();

        var result = service.send(requestId, "council@example.com", "owner");

        assertEquals("inv_1", result.id());
        assertEquals("pending", result.state());
        assertEquals(expiry, result.expiresAt());
        var options = ArgumentCaptor.forClass(RequestOptions.class);
        verify(users)
                .sendInvitation(
                        eq("council@example.com"),
                        isNull(),
                        isNull(),
                        eq(7L),
                        eq("owner"),
                        isNull(),
                        options.capture());
        assertEquals(requestId.toString(), options.getValue().idempotencyKey);
    }

    @Test
    void readsVerifiedIdentityAndAcceptedInvitationFromProvider() {
        when(client.getUserManagement()).thenReturn(users);
        var user = mock(User.class);
        when(user.getId()).thenReturn("recipient");
        when(user.getEmail()).thenReturn("council@example.com");
        when(user.getEmailVerified()).thenReturn(true);
        when(user.getFirstName()).thenReturn("Council");
        when(user.getLastName()).thenReturn("Member");
        when(users.get("recipient")).thenReturn(user);
        var accepted = mock(Invitation.class);
        when(accepted.getId()).thenReturn("inv_1");
        when(accepted.getState()).thenReturn(InvitationState.Accepted);
        when(accepted.getAcceptedUserId()).thenReturn("recipient");
        when(users.getInvitation("inv_1")).thenReturn(accepted);

        assertTrue(service.user("recipient").verified());
        assertEquals("Council Member", service.user("recipient").name());
        assertEquals("recipient", service.invitation("inv_1").acceptedUserId());
        assertEquals("accepted", service.invitation("inv_1").state());
    }

    @Test
    void reportsProviderFailuresAndMissingConfiguration() {
        when(client.getUserManagement()).thenReturn(users);
        when(users.getInvitation("inv_1"))
                .thenThrow(new TransportException("private provider details", new RuntimeException()));
        var failure = assertThrows(ResponseStatusException.class, () -> service.invitation("inv_1"));
        assertEquals(HttpStatus.BAD_GATEWAY, failure.getStatusCode());
        assertEquals("WorkOS request failed", failure.getReason());
        var unconfigured = new WorkOSService("", client);
        var missing = assertThrows(
                ResponseStatusException.class, () -> unconfigured.send(UUID.randomUUID(), "a@example.com", "owner"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, missing.getStatusCode());
    }
}
