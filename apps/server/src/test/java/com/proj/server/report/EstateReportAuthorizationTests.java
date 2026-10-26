package com.proj.server.report;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.proj.server.db.tables.records.EstateRecord;
import com.proj.server.estate.EstatePermissionCode;
import com.proj.server.resident.ResidentImageStore;
import com.proj.server.resident.ResidentReportException;
import com.proj.server.resident.ResidentReportRepository;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;

class EstateReportAuthorizationTests {
    private final EstateReportRepository repository = mock(EstateReportRepository.class);
    private final EstateReportService service =
            new EstateReportService(repository, mock(ResidentReportRepository.class), mock(ResidentImageStore.class));
    private final UUID estateId = UUID.randomUUID();

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void reportReadersCanReadRegardlessOfWhetherTheEstateIsLocked(boolean lock) {
        var estate = customMember(lock);
        when(repository.hasPermission(estateId, "reader", EstatePermissionCode.VIEW_FAULT_REPORTS))
                .thenReturn(true);

        assertSame(estate, service.authorize(estateId, "reader", EstatePermissionCode.VIEW_FAULT_REPORTS, lock));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void readingPermissionNeverAuthorizesRelocationRegardlessOfLocking(boolean lock) {
        customMember(lock);
        when(repository.hasPermission(estateId, "reader", EstatePermissionCode.VIEW_FAULT_REPORTS))
                .thenReturn(true);

        var error = assertThrows(
                ResidentReportException.class,
                () -> service.authorize(estateId, "reader", EstatePermissionCode.RELOCATE_FAULT_REPORTS, lock));
        assertEquals(HttpStatus.FORBIDDEN, error.status());
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void relocationPermissionAuthorizesRelocationRegardlessOfLocking(boolean lock) {
        var estate = customMember(lock);
        when(repository.hasPermission(estateId, "reader", EstatePermissionCode.RELOCATE_FAULT_REPORTS))
                .thenReturn(true);

        assertSame(estate, service.authorize(estateId, "reader", EstatePermissionCode.RELOCATE_FAULT_REPORTS, lock));
    }

    private EstateRecord customMember(boolean lock) {
        var estate = new EstateRecord();
        estate.setOwneruserid("owner");
        when(repository.estate(estateId, lock)).thenReturn(estate);
        when(repository.role(estateId, "reader", lock)).thenReturn("CUSTOM");
        return estate;
    }
}
