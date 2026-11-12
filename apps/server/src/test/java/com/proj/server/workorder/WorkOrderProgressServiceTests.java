package com.proj.server.workorder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.proj.server.db.tables.records.EstateRecord;
import com.proj.server.db.tables.records.WorkorderRecord;
import com.proj.server.estate.EstateRepository;
import com.proj.server.workos.WorkOSService;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class WorkOrderProgressServiceTests {
    private static final UUID ESTATE = UUID.randomUUID();
    private static final UUID ORDER = UUID.randomUUID();
    private static final ChangeWorkOrderStatusRequest START =
            new ChangeWorkOrderStatusRequest(WorkOrderStatus.IN_PROGRESS, 4);

    private WorkOrderRepository repository;
    private WorkOrderProgressService service;

    @BeforeEach
    void setUp() {
        repository = mock(WorkOrderRepository.class);
        var orders = mock(WorkOrderService.class);
        var estates = mock(EstateRepository.class);
        service = new WorkOrderProgressService(repository, orders, estates, mock(WorkOSService.class));
        when(orders.authorize(eq(ESTATE), any(), eq(false), eq(true))).thenReturn(new EstateRecord());
        when(estates.isManager(ESTATE, "crew_priya")).thenReturn(false);
        when(estates.isManager(ESTATE, "crew_sam")).thenReturn(false);
        when(repository.role(ESTATE, "crew_priya")).thenReturn("CREW");
        when(repository.role(ESTATE, "crew_sam")).thenReturn("CREW");
        var row = new WorkorderRecord();
        row.setId(ORDER);
        row.setStatus("ASSIGNED");
        row.setVersion(4);
        row.setAssigneeuserid("crew_priya");
        row.setAssigneename("Priya");
        when(repository.lockOrder(ESTATE, ORDER)).thenReturn(row);
    }

    @Test
    void theCrewMemberGivenTheOrderMayStartIt() {
        service.change(ESTATE, ORDER, "crew_priya", "Priya", START);

        verify(repository).updateStatus(eq(ORDER), eq(WorkOrderStatus.IN_PROGRESS), any(), eq(5));
    }

    @Test
    void anotherCrewMemberMayNot() {
        var error =
                assertThrows(WorkOrderException.class, () -> service.change(ESTATE, ORDER, "crew_sam", "Sam", START));

        assertEquals(HttpStatus.FORBIDDEN, error.status());
        verify(repository, never()).updateStatus(any(), any(), any(), anyInt());
    }
}
