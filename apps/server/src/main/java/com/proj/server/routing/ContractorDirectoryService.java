package com.proj.server.routing;

import com.proj.server.resident.ResidentReportException;
import com.proj.server.workorder.WorkOrderService;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The estate's contractor directory and its default contractor per equipment type (work-order-assignment.md). */
@Service
public class ContractorDirectoryService {
    private final WorkOrderService orders;
    private final RoutingRepository routing;

    public ContractorDirectoryService(WorkOrderService orders, RoutingRepository routing) {
        this.orders = orders;
        this.routing = routing;
    }

    /** Owners, Managers and Crew may read the directory; only owners and Managers change it. */
    public ContractorDirectoryResponse list(UUID estateId, String user) {
        orders.authorize(estateId, user, false, false);
        return new ContractorDirectoryResponse(
                routing.directory(estateId).stream().map(ContractorResponse::of).toList());
    }

    @Transactional
    public ContractorResponse add(UUID estateId, String user, ContractorRequest request) {
        orders.authorize(estateId, user, true, true);
        var name = name(request);
        var email = email(request);
        if (routing.emailTaken(estateId, email, null)) throw duplicate();
        var id = routing.addContractor(estateId, name, email);
        return ContractorResponse.of(routing.directoryEntry(estateId, id).orElseThrow());
    }

    @Transactional
    public ContractorResponse edit(UUID estateId, String user, UUID contractorId, ContractorRequest request) {
        orders.authorize(estateId, user, true, true);
        var name = name(request);
        var email = email(request);
        if (routing.emailTaken(estateId, email, contractorId)) throw duplicate();
        if (!routing.editContractor(estateId, contractorId, name, email)) throw notFound();
        return ContractorResponse.of(
                routing.directoryEntry(estateId, contractorId).orElseThrow());
    }

    @Transactional
    public void remove(UUID estateId, String user, UUID contractorId) {
        orders.authorize(estateId, user, true, true);
        var entry = routing.directoryEntry(estateId, contractorId).orElseThrow(ContractorDirectoryService::notFound);
        int open = routing.openAssignments(estateId, contractorId);
        if (open > 0)
            throw error(
                    HttpStatus.CONFLICT,
                    entry.name() + " still has " + open + (open == 1 ? " open job" : " open jobs")
                            + ". Reassign them first.");
        routing.removeContractor(estateId, contractorId);
    }

    @Transactional
    public ContractorResponse setDefault(UUID estateId, String user, EquipmentType type, UUID contractorId) {
        orders.authorize(estateId, user, true, true);
        if (routing.directoryEntry(estateId, contractorId).isEmpty()) throw notFound();
        routing.setDefault(estateId, type, contractorId);
        return ContractorResponse.of(
                routing.directoryEntry(estateId, contractorId).orElseThrow());
    }

    @Transactional
    public void clearDefault(UUID estateId, String user, EquipmentType type) {
        orders.authorize(estateId, user, true, true);
        routing.clearDefault(estateId, type);
    }

    private static String name(ContractorRequest request) {
        var name = request.name().strip();
        if (name.isEmpty() || name.length() > 200 || hasControlCharacters(name))
            throw error(HttpStatus.BAD_REQUEST, "Enter a contractor name of 1 to 200 characters.");
        return name;
    }

    private static String email(ContractorRequest request) {
        var email = request.email().strip();
        if (hasControlCharacters(email)) throw error(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
        return email;
    }

    private static boolean hasControlCharacters(String value) {
        return value.chars().anyMatch(Character::isISOControl);
    }

    private static ResidentReportException duplicate() {
        return error(HttpStatus.CONFLICT, "Another contractor already uses this email address.");
    }

    private static ResidentReportException notFound() {
        return error(HttpStatus.NOT_FOUND, "Contractor not found.");
    }

    private static ResidentReportException error(HttpStatus status, String message) {
        return new ResidentReportException(status, message);
    }
}
