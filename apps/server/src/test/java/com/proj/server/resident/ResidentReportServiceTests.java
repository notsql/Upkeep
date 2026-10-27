package com.proj.server.resident;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.proj.server.routing.RoutingRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

class ResidentReportServiceTests {
    private final ResidentReportRepository reports = mock(ResidentReportRepository.class);
    private final ResidentImageValidator validator = mock(ResidentImageValidator.class);
    private final ResidentImageStore images = mock(ResidentImageStore.class);
    private final TransactionTemplate transactions = mock(TransactionTemplate.class);
    private final RoutingRepository routing = mock(RoutingRepository.class);
    private final ResidentReportService service =
            new ResidentReportService(reports, validator, images, transactions, routing);

    @Test
    void rejectsAFiftyOneCharacterTitleBeforeLookingUpTheEstate() {
        var error = assertThrows(
                ResidentReportException.class,
                () -> service.create(
                        "resident-a", UUID.randomUUID(), "x".repeat(51), "Description", UUID.randomUUID(), List.of()));
        assertEquals(HttpStatus.BAD_REQUEST, error.status());
        verifyNoInteractions(reports, validator, images, transactions);
    }

    @Test
    void rejectsBlankAndOverFiftyCharacterTitlesBeforeAnyPersistenceOrUpload() {
        var locationId = UUID.randomUUID();
        for (var title : new String[] {null, "", "   ", "x".repeat(51), "  " + "x".repeat(51) + "  "}) {
            var error = assertThrows(
                    ResidentReportException.class,
                    () -> service.create("resident-a", UUID.randomUUID(), title, "Description", locationId, List.of()));
            assertEquals(HttpStatus.BAD_REQUEST, error.status());
            assertEquals("Enter a title in 1 to 50 characters.", error.getMessage());
        }
        verifyNoInteractions(reports, validator, images, transactions);
    }

    @Test
    void acceptsAndTrimsAFiftyCharacterTitleBeforeSaving() {
        var estateId = UUID.randomUUID();
        var locationId = UUID.randomUUID();
        var estate = new ResidentContextResponse.EstateLabel(estateId, "Maple Estate");
        var title = "x".repeat(50);
        var now = OffsetDateTime.now();
        var detail = new IssueReportDetailResponse(
                UUID.randomUUID(), title, "Description", "Maple Estate", null, "SUBMITTED", now, now, List.of());
        when(reports.activeAssignment("resident-a", estateId, false)).thenReturn(Optional.of(estate));
        when(reports.activeAssignment("resident-a", estateId, true)).thenReturn(Optional.of(estate));
        when(reports.activeReportLocation(estateId, locationId)).thenReturn(true);
        when(reports.detail(eq("resident-a"), any())).thenReturn(Optional.of(detail));
        when(transactions.execute(any())).thenAnswer(call -> {
            TransactionCallback<IssueReportDetailResponse> callback = call.getArgument(0);
            return callback.doInTransaction(null);
        });

        assertEquals(
                detail,
                service.create("resident-a", estateId, "  " + title + "  ", "Description", locationId, List.of()));
        verify(reports).create(any(), eq("resident-a"), eq(estateId), eq(locationId), eq(title), eq("Description"));
        verifyNoInteractions(validator, images);
    }
}
