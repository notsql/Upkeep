package com.proj.server.location;

import com.proj.server.estate.EstateRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Every write locks the owning estate's row first (decision 0010). That serializes
 * all location writes within one estate, so the duplicate-name and level-position
 * checks below cannot race each other, and a write cannot slip past a concurrent
 * estate deactivation.
 */
@Service
public class LocationService {
    private final LocationRepository repository;
    private final EstateRepository estates;

    public LocationService(LocationRepository repository, EstateRepository estates) {
        this.repository = repository;
        this.estates = estates;
    }

    public List<LocationResponse> list(UUID estateId, String user, boolean includeInactive) {
        if (includeInactive) {
            estates.findOwned(estateId, user, false).orElseThrow(LocationService::estateNotFound);
        } else {
            estates.findAccessible(estateId, user).orElseThrow(LocationService::estateNotFound);
        }
        return includeInactive ? repository.listAll(estateId) : repository.listActive(estateId);
    }

    @Transactional
    public LocationResponse create(UUID estateId, String owner, CreateLocationRequest request) {
        lockActiveEstate(estateId, owner);
        var parentType = checkPlacement(estateId, request.type(), request.parentId(), request.sortOrder());
        checkUnique(estateId, request.type(), request.parentId(), request.name(), request.sortOrder(), null);
        return repository.create(estateId, request, parentType);
    }

    @Transactional
    public LocationResponse update(UUID estateId, UUID id, String owner, UpdateLocationRequest request) {
        lockActiveEstate(estateId, owner);
        var location = activeLocation(estateId, id);
        var parentType = checkPlacement(estateId, location.type(), request.parentId(), request.sortOrder());
        checkUnique(estateId, location.type(), request.parentId(), request.name(), request.sortOrder(), id);
        return repository.update(id, request, parentType);
    }

    /** Floors per request. Most condo and HDB blocks have 50 storeys or fewer. */
    static final int MAX_FLOORS = 50;

    /**
     * Adds every floor from lowest to highest, skipping 0 and any floor the block already has
     * (an active level with the same position or name). One transaction: all or nothing.
     */
    @Transactional
    public AddFloorsResponse addFloors(UUID estateId, UUID blockId, String owner, AddFloorsRequest request) {
        var floors = floorRange(request.lowestFloor(), request.highestFloor());
        lockActiveEstate(estateId, owner);
        var block = repository.find(blockId, estateId).orElseThrow(LocationService::locationNotFound);
        if (block.type() != LocationType.BLOCK) {
            throw badRequest("Floors can only be added to a block.");
        }
        if (block.deactivatedAt() != null) {
            throw new LocationException(HttpStatus.CONFLICT, "This location is deactivated and cannot be changed.");
        }
        var existing = repository.listActiveLevels(blockId);
        var takenPositions = new HashSet<Integer>();
        var takenNames = new HashSet<String>();
        for (var level : existing) {
            takenPositions.add(level.sortOrder());
            takenNames.add(level.name().toLowerCase(Locale.ROOT));
        }
        var created = new ArrayList<LocationResponse>();
        var skipped = new ArrayList<String>();
        for (var floor : floors) {
            var name = floorName(floor);
            if (takenPositions.contains(floor) || takenNames.contains(name.toLowerCase(Locale.ROOT))) {
                skipped.add(name);
                continue;
            }
            created.add(repository.create(
                    estateId, new CreateLocationRequest(LocationType.LEVEL, blockId, name, floor), LocationType.BLOCK));
        }
        return new AddFloorsResponse(created, skipped);
    }

    /** Highest floor first, with no floor 0. */
    private static List<Integer> floorRange(int lowest, int highest) {
        if (lowest == 0 || highest == 0) {
            throw badRequest("There is no floor 0. B1 sits directly below L1.");
        }
        if (lowest > highest) {
            throw badRequest("The lowest floor must not be above the highest floor.");
        }
        // Both ends are non-zero, so the range spans 0 exactly when they differ in sign.
        long count = (long) highest - lowest + 1 - (lowest < 0 && highest > 0 ? 1 : 0);
        if (count > MAX_FLOORS) {
            throw badRequest("Add at most " + MAX_FLOORS + " floors at a time.");
        }
        var floors = new ArrayList<Integer>();
        for (int floor = highest; floor >= lowest; floor--) {
            if (floor != 0) {
                floors.add(floor);
            }
        }
        return floors;
    }

    /** L1, L2, ... above ground; B1, B2, ... below. */
    static String floorName(int floor) {
        return floor > 0 ? "L" + floor : "B" + -floor;
    }

    @Transactional
    public LocationResponse deactivate(UUID estateId, UUID id, String owner) {
        lockActiveEstate(estateId, owner);
        var location = repository.find(id, estateId).orElseThrow(LocationService::locationNotFound);
        if (location.deactivatedAt() != null) {
            return location;
        }
        if (repository.hasActiveChildren(id)) {
            throw new LocationException(
                    HttpStatus.CONFLICT, "Deactivate the locations inside \"" + location.name() + "\" first.");
        }
        return repository.deactivate(id);
    }

    private void lockActiveEstate(UUID estateId, String owner) {
        var estate = estates.findOwned(estateId, owner, true).orElseThrow(LocationService::estateNotFound);
        if (estate.deactivatedAt() != null) {
            throw new LocationException(
                    HttpStatus.CONFLICT, "This estate is inactive. Its locations cannot be changed.");
        }
    }

    private LocationResponse activeLocation(UUID estateId, UUID id) {
        var location = repository.find(id, estateId).orElseThrow(LocationService::locationNotFound);
        if (location.deactivatedAt() != null) {
            throw new LocationException(HttpStatus.CONFLICT, "This location is deactivated and cannot be changed.");
        }
        return location;
    }

    /** Checks where a location of this type may go, and returns its parent's type (null at the estate root). */
    private LocationType checkPlacement(UUID estateId, LocationType type, UUID parentId, Integer sortOrder) {
        if ((type == LocationType.LEVEL) != (sortOrder != null)) {
            throw badRequest(
                    type == LocationType.LEVEL
                            ? "A level needs its position in the block."
                            : "Only levels have a position.");
        }
        var allowed = type.allowedParents();
        if (parentId == null) {
            if (!allowed.isEmpty()) {
                throw badRequest(describe(type) + " must sit inside " + describe(allowed) + ".");
            }
            return null;
        }
        if (allowed.isEmpty()) {
            throw badRequest("A block sits directly under the estate.");
        }
        var parent = repository
                .find(parentId, estateId)
                .orElseThrow(() -> new LocationException(HttpStatus.NOT_FOUND, "Parent location not found."));
        if (!allowed.contains(parent.type())) {
            throw badRequest(describe(type) + " must sit inside " + describe(allowed) + ".");
        }
        if (parent.deactivatedAt() != null) {
            throw new LocationException(HttpStatus.CONFLICT, "The chosen parent location is deactivated.");
        }
        return parent.type();
    }

    private void checkUnique(
            UUID estateId, LocationType type, UUID parentId, String name, Integer sortOrder, UUID excludeId) {
        if (repository.nameTaken(estateId, parentId, name, excludeId)) {
            throw new LocationException(
                    HttpStatus.CONFLICT, "Another location here is already called \"" + name + "\".");
        }
        if (type == LocationType.LEVEL
                && repository.sortOrderTaken(Objects.requireNonNull(parentId), sortOrder, excludeId)) {
            throw new LocationException(
                    HttpStatus.CONFLICT, "Another level in this block already has position " + sortOrder + ".");
        }
    }

    private static String describe(LocationType type) {
        return switch (type) {
            case BLOCK -> "A block";
            case LEVEL -> "A level";
            case COMMON_AREA -> "A common area";
        };
    }

    private static String describe(Set<LocationType> types) {
        return types.contains(LocationType.LEVEL) ? "a block or a level" : "a block";
    }

    private static LocationException badRequest(String message) {
        return new LocationException(HttpStatus.BAD_REQUEST, message);
    }

    private static LocationException estateNotFound() {
        return new LocationException(HttpStatus.NOT_FOUND, "Estate not found.");
    }

    private static LocationException locationNotFound() {
        return new LocationException(HttpStatus.NOT_FOUND, "Location not found.");
    }
}
