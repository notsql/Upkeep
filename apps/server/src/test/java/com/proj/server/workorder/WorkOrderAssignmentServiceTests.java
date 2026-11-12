package com.proj.server.workorder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.proj.server.db.tables.records.EstateRecord;
import com.proj.server.db.tables.records.WorkorderRecord;
import com.proj.server.notification.WorkOrderNotifications;
import com.proj.server.routing.RoutingRepository;
import com.proj.server.workos.WorkOSService;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

class WorkOrderAssignmentServiceTests {
    private static final UUID ESTATE = UUID.randomUUID();
    private static final UUID ORDER = UUID.randomUUID();
    private static final UUID ACE = UUID.randomUUID();
    private static final UUID BOLT = UUID.randomUUID();

    private WorkOrderRepository repository;
    private WorkOrderService orders;
    private RoutingRepository routing;
    private WorkOrderNotifications notifications;
    private WorkOrderAssignmentService service;
    private WorkorderRecord row;

    @BeforeEach
    void setUp() {
        repository = mock(WorkOrderRepository.class);
        orders = mock(WorkOrderService.class);
        routing = mock(RoutingRepository.class);
        notifications = mock(WorkOrderNotifications.class);
        var workOS = mock(WorkOSService.class);
        when(workOS.findDisplayName("user_priya")).thenReturn(Optional.of("Priya Tan"));
        service = new WorkOrderAssignmentService(
                repository,
                orders,
                routing,
                notifications,
                workOS,
                new TransactionTemplate(mock(PlatformTransactionManager.class)));
        when(orders.authorize(ESTATE, "manager", true, true)).thenReturn(new EstateRecord());
        when(repository.provider(ESTATE, ACE)).thenReturn(new WorkOrderRepository.Provider(ACE, "Ace", "a@x.example"));
        when(repository.provider(ESTATE, BOLT))
                .thenReturn(new WorkOrderRepository.Provider(BOLT, "Bolt", "b@x.example"));
        when(repository.isAssignableMember(ESTATE, "user_priya")).thenReturn(true);
        row = new WorkorderRecord();
        row.setId(ORDER);
        row.setEstateid(ESTATE);
        row.setStatus("ASSIGNED");
        row.setVersion(3);
        when(repository.lockOrder(ESTATE, ORDER)).thenReturn(row);
    }

    private void assign(String userId, UUID providerId, int version) {
        service.assign(ESTATE, ORDER, "manager", "Mia", new AssignWorkOrderRequest(userId, providerId, version));
    }

    @Test
    void reassigningFromOneContractorToAnotherSupersedesThePendingEmailAndQueuesANewOne() {
        row.setAssigneeproviderid(ACE);
        row.setAssigneename("Ace");

        assign(null, BOLT, 3);

        verify(routing).supersedePending(eq(ORDER), any());
        verify(routing).createDispatch(ORDER, ESTATE, null, BOLT, "Bolt", "b@x.example", "manager");
        verify(repository)
                .updateAssignee(
                        eq(ORDER),
                        eq(null),
                        eq(BOLT),
                        eq("Bolt"),
                        eq("manager"),
                        eq(WorkOrderStatus.ASSIGNED),
                        any(),
                        eq(4));
    }

    @Test
    void givingAJobToAMemberNotifiesThemAndResolvesThePreviousMembersNotification() {
        row.setAssigneeuserid("user_old");
        row.setAssigneename("Old");

        assign("user_priya", null, 3);

        verify(notifications).resolve(ORDER, "user_old");
        verify(notifications).assigned(ESTATE, ORDER, null, "user_priya", "Given to you by Mia");
        verify(routing, never()).supersedePending(any(), any());
        verify(routing, never()).createDispatch(any(), any(), any(), any(), anyString(), anyString(), anyString());
    }

    @Test
    void assigningTheCurrentAssigneeAgainWritesNothing() {
        row.setAssigneeproviderid(ACE);
        row.setAssigneename("Ace");

        assign(null, ACE, 3);

        verify(repository, never()).updateAssignee(any(), any(), any(), any(), any(), any(), any(), anyInt());
        verifyNoInteractions(routing, notifications);
    }

    @Test
    void aStaleVersionIsAConflict() {
        var error = assertThrows(WorkOrderException.class, () -> assign("user_priya", null, 2));

        assertEquals(HttpStatus.CONFLICT, error.status());
        verifyNoInteractions(notifications);
    }

    @Test
    void someoneWhoIsNotAManagerOrCrewMemberCannotBeGivenAJob() {
        when(repository.isAssignableMember(ESTATE, "user_resident")).thenReturn(false);

        var error = assertThrows(WorkOrderException.class, () -> assign("user_resident", null, 3));

        assertEquals(HttpStatus.UNPROCESSABLE_CONTENT, error.status());
    }

    @Test
    void aContractorOutsideTheDirectoryIsRejected() {
        var error = assertThrows(WorkOrderException.class, () -> assign(null, UUID.randomUUID(), 3));

        assertEquals(HttpStatus.UNPROCESSABLE_CONTENT, error.status());
    }

    @Test
    void crewCannotAssignEvenThemselves() {
        when(orders.authorize(ESTATE, "crew", true, true))
                .thenThrow(new WorkOrderException(HttpStatus.FORBIDDEN, "No"));

        var error = assertThrows(
                WorkOrderException.class,
                () -> service.assign(ESTATE, ORDER, "crew", null, new AssignWorkOrderRequest("crew", null, 3)));

        assertEquals(HttpStatus.FORBIDDEN, error.status());
        verify(repository, never()).lockOrder(any(), any());
    }

    @Test
    void unassigningAContractorSupersedesItsPendingEmailAndReopensTheOrder() {
        row.setAssigneeproviderid(ACE);
        row.setAssigneename("Ace");

        service.unassign(ESTATE, ORDER, "manager", "Mia", 3);

        verify(routing).supersedePending(eq(ORDER), any());
        verify(repository)
                .updateAssignee(
                        eq(ORDER), eq(null), eq(null), eq(null), eq(null), eq(WorkOrderStatus.OPEN), any(), eq(4));
        verify(repository)
                .appendEvent(
                        eq(ORDER),
                        eq(ESTATE),
                        eq(WorkOrderStatus.ASSIGNED),
                        eq(WorkOrderStatus.OPEN),
                        eq("manager"),
                        eq("Mia"),
                        any(),
                        eq(4),
                        eq(WorkOrderStatusEventKind.UNASSIGNED),
                        eq(null));
    }
}
