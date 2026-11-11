package com.proj.server.notification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.proj.server.estate.CouncilIdentity;
import com.proj.server.estate.CouncilIdentity.Person;
import com.proj.server.estate.CouncilRepository;
import com.proj.server.estate.CouncilRepository.Member;
import com.proj.server.routing.EmailSendException;
import com.proj.server.routing.EmailSender;
import com.proj.server.routing.OutboundEmail;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.task.SyncTaskExecutor;

/** Email for a new unusual-readings alert, after commit. */
class AnomalyAlertEmailSenderTests {
    static final UUID ESTATE = UUID.randomUUID();
    static final UUID ASSET = UUID.randomUUID();
    static final AnomalyAlertRaised RAISED = new AnomalyAlertRaised(UUID.randomUUID(), ESTATE, ASSET);

    final List<OutboundEmail> sent = new ArrayList<>();
    final EmailSender mail = sent::add;
    CouncilRepository council;
    CouncilIdentity identity;
    NotificationRepository notifications;
    ObjectProvider<EmailSender> provider;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setup() {
        council = mock(CouncilRepository.class);
        identity = mock(CouncilIdentity.class);
        notifications = mock(NotificationRepository.class);
        provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(mail);
        when(notifications.alertNames(RAISED.notificationId()))
                .thenReturn(Optional.of(new NotificationRepository.AlertNames("Sunrise", "Pump 3")));
        when(council.ownerUserId(ESTATE)).thenReturn("owner");
        when(council.members(ESTATE))
                .thenReturn(List.of(
                        new Member("owner", true, "MANAGER"),
                        new Member("manager", false, "MANAGER"),
                        new Member("crew", false, "CREW")));
        when(identity.user("owner")).thenReturn(new Person("owner", "Owner", "owner@example.com", true));
        when(identity.user("manager")).thenReturn(new Person("manager", "Manager", "manager@example.com", true));
    }

    AnomalyAlertEmailSender sender(ObjectProvider<EmailSender> mail) {
        return new AnomalyAlertEmailSender(
                mail, council, identity, notifications, new SyncTaskExecutor(), List.of("https://web.example"));
    }

    List<String> recipients() {
        return sent.stream().map(OutboundEmail::to).toList();
    }

    @Test
    void theOwnerAndManagersGetOneEmailEach() {
        sender(provider).raised(RAISED);
        assertEquals(List.of("owner@example.com", "manager@example.com"), recipients());
        assertEquals("Unusual readings: Pump 3 at Sunrise", sent.getFirst().subject());
        verify(identity, never()).user("crew");
    }

    @Test
    void noEmailWhenMailIsNotConfigured() {
        when(provider.getIfAvailable()).thenReturn(null);
        sender(provider).raised(RAISED);
        verify(council, never()).members(any());
    }

    @Test
    void aFailedOrUnverifiedOrBlankAddressIsSkipped() {
        when(council.members(ESTATE))
                .thenReturn(List.of(
                        new Member("owner", true, "MANAGER"),
                        new Member("broken", false, "MANAGER"),
                        new Member("unverified", false, "MANAGER"),
                        new Member("blank", false, "MANAGER"),
                        new Member("manager", false, "MANAGER")));
        when(identity.user("broken")).thenThrow(new IllegalStateException("WorkOS down"));
        when(identity.user("unverified")).thenReturn(new Person("unverified", "U", "u@example.com", false));
        when(identity.user("blank")).thenReturn(new Person("blank", "B", " ", true));
        sender(provider).raised(RAISED);
        assertEquals(List.of("owner@example.com", "manager@example.com"), recipients());
    }

    @Test
    void theSameAddressIsEmailedOnce() {
        when(identity.user("manager")).thenReturn(new Person("manager", "Manager", "OWNER@example.com", true));
        sender(provider).raised(RAISED);
        assertEquals(List.of("owner@example.com"), recipients());
    }

    @Test
    void aSendFailureDoesNotStopTheOthers() {
        var failing = mock(EmailSender.class);
        doThrow(new EmailSendException("rejected", "Rejected"))
                .when(failing)
                .send(org.mockito.ArgumentMatchers.argThat(email -> email.to().startsWith("owner")));
        when(provider.getIfAvailable()).thenReturn(failing);
        sender(provider).raised(RAISED);
        verify(failing)
                .send(org.mockito.ArgumentMatchers.argThat(email -> email.to().equals("manager@example.com")));
    }

    @Test
    void aVanishedAlertSendsNothing() {
        when(notifications.alertNames(RAISED.notificationId())).thenReturn(Optional.empty());
        sender(provider).raised(RAISED);
        assertEquals(List.of(), sent);
    }
}
