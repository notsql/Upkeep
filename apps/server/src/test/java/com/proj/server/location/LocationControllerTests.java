package com.proj.server.location;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.proj.server.config.SecurityConfig;
import com.proj.server.estate.EstateRepository;
import com.proj.server.estate.EstateResponse;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@WebMvcTest(
        controllers = LocationController.class,
        properties = {
            "app.cors.allowed-origins=http://localhost:3001",
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app"
        })
@Import({SecurityConfig.class, LocationService.class, LocationExceptionHandler.class})
class LocationControllerTests {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    LocationRepository repository;

    @MockitoBean
    EstateRepository estates;

    @MockitoBean
    JwtDecoder jwtDecoder;

    private final UUID estateId = UUID.fromString("ac514a8e-c643-4a59-aa93-30138327f039");
    private final UUID blockId = UUID.fromString("00000000-0000-0000-0000-00000000000b");
    private final UUID otherBlockId = UUID.fromString("00000000-0000-0000-0000-0000000000bb");
    private final UUID levelId = UUID.fromString("00000000-0000-0000-0000-00000000000c");
    private final UUID areaId = UUID.fromString("00000000-0000-0000-0000-00000000000a");
    private final OffsetDateTime now = OffsetDateTime.parse("2026-09-27T00:00:00Z");
    private final String base = "/estates/" + estateId + "/locations";

    private EstateResponse estate(OffsetDateTime deactivatedAt) {
        return new EstateResponse(
                estateId, "Maple Grove", "MG-001", "1 Grove Road", "123456", null, now, now, deactivatedAt, true);
    }

    private LocationResponse location(UUID id, LocationType type, UUID parentId, Integer sortOrder) {
        return new LocationResponse(id, type, parentId, "Node", sortOrder, now, now, null);
    }

    private final LocationResponse block = location(blockId, LocationType.BLOCK, null, null);
    private final LocationResponse otherBlock = location(otherBlockId, LocationType.BLOCK, null, null);
    private final LocationResponse level = location(levelId, LocationType.LEVEL, blockId, 1);
    private final LocationResponse area = location(areaId, LocationType.COMMON_AREA, levelId, null);

    @BeforeEach
    void setup() {
        when(estates.findOwned(estateId, "owner", false)).thenReturn(Optional.of(estate(null)));
        when(estates.findOwned(estateId, "owner", true)).thenReturn(Optional.of(estate(null)));
        when(repository.find(blockId, estateId)).thenReturn(Optional.of(block));
        when(repository.find(otherBlockId, estateId)).thenReturn(Optional.of(otherBlock));
        when(repository.find(levelId, estateId)).thenReturn(Optional.of(level));
        when(repository.find(areaId, estateId)).thenReturn(Optional.of(area));
    }

    private MockHttpServletRequestBuilder asOwner(MockHttpServletRequestBuilder request, String json) {
        return request.with(jwt().jwt(t -> t.subject("owner")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json);
    }

    private static String create(String type, UUID parentId, String name, Integer sortOrder) {
        return "{\"type\":\"%s\",\"parentId\":%s,\"name\":\"%s\",\"sortOrder\":%s}"
                .formatted(type, parentId == null ? "null" : "\"" + parentId + "\"", name, sortOrder);
    }

    private static String update(UUID parentId, String name, Integer sortOrder) {
        return "{\"parentId\":%s,\"name\":\"%s\",\"sortOrder\":%s}"
                .formatted(parentId == null ? "null" : "\"" + parentId + "\"", name, sortOrder);
    }

    // --- Access ---

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(get(base)).andExpect(status().isUnauthorized());
    }

    @Test
    void hidesLocationsOfEstatesOwnedBySomeoneElse() throws Exception {
        mvc.perform(get(base).with(jwt().jwt(t -> t.subject("other")))).andExpect(status().isNotFound());
        mvc.perform(post(base)
                        .with(jwt().jwt(t -> t.subject("other")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(create("BLOCK", null, "Blk 1", null)))
                .andExpect(status().isNotFound());
    }

    @Test
    void treatsALocationFromAnotherEstateAsMissing() throws Exception {
        var unknown = UUID.fromString("00000000-0000-0000-0000-0000000000ff");
        mvc.perform(asOwner(patch(base + "/" + unknown), update(null, "Blk 1", null)))
                .andExpect(status().isNotFound());
        mvc.perform(asOwner(post(base + "/" + unknown + "/deactivate"), "{}")).andExpect(status().isNotFound());
    }

    // --- Browse ---

    @Test
    void listsTheEstatesActiveLocations() throws Exception {
        when(repository.listActive(estateId)).thenReturn(List.of(block, level, area));
        mvc.perform(get(base).with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[1].type").value("LEVEL"))
                .andExpect(jsonPath("$[1].parentId").value(blockId.toString()))
                .andExpect(jsonPath("$[1].sortOrder").value(1));
    }

    // --- Create ---

    @Test
    void createsABlockDirectlyUnderTheEstate() throws Exception {
        when(repository.create(
                        eq(estateId), eq(new CreateLocationRequest(LocationType.BLOCK, null, "Blk 1", null)), isNull()))
                .thenReturn(block);
        mvc.perform(asOwner(post(base), create("BLOCK", null, "  Blk 1  ", null)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", base + "/" + blockId))
                .andExpect(jsonPath("$.id").value(blockId.toString()));
    }

    @Test
    void createsALevelUnderABlock() throws Exception {
        when(repository.create(eq(estateId), any(), eq(LocationType.BLOCK))).thenReturn(level);
        mvc.perform(asOwner(post(base), create("LEVEL", blockId, "Level 1", 1))).andExpect(status().isCreated());
    }

    @Test
    void createsCommonAreasUnderABlockOrALevel() throws Exception {
        when(repository.create(eq(estateId), any(), any())).thenReturn(area);
        mvc.perform(asOwner(post(base), create("COMMON_AREA", blockId, "Lift", null)))
                .andExpect(status().isCreated());
        mvc.perform(asOwner(post(base), create("COMMON_AREA", levelId, "Lift lobby", null)))
                .andExpect(status().isCreated());
        verify(repository).create(eq(estateId), any(), eq(LocationType.BLOCK));
        verify(repository).create(eq(estateId), any(), eq(LocationType.LEVEL));
    }

    @ParameterizedTest(name = "{0} under {1} with sortOrder {2} is rejected")
    @CsvSource(
            nullValues = "none",
            value = {
                "BLOCK, block, none", // blocks sit directly under the estate
                "BLOCK, none, 1", // only levels have a sortOrder
                "LEVEL, none, 1", // a level needs a block
                "LEVEL, level, 2", // a level cannot sit under a level
                "LEVEL, area, 2",
                "LEVEL, block, none", // a level needs its position in the block
                "COMMON_AREA, none, none", // a common area needs a block or level
                "COMMON_AREA, area, none", // nothing sits under a common area
                "COMMON_AREA, block, 1",
            })
    void rejectsShapesTheHierarchyDoesNotAllow(String type, String parent, Integer sortOrder) throws Exception {
        var parentId =
                switch (parent == null ? "" : parent) {
                    case "block" -> blockId;
                    case "level" -> levelId;
                    case "area" -> areaId;
                    default -> null;
                };
        mvc.perform(asOwner(post(base), create(type, parentId, "Node", sortOrder)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
        verify(repository, never()).create(any(), any(), any());
    }

    @Test
    void rejectsBlankNamesAndMissingTypes() throws Exception {
        mvc.perform(asOwner(post(base), create("BLOCK", null, "   ", null))).andExpect(status().isBadRequest());
        mvc.perform(asOwner(post(base), "{\"name\":\"Blk 1\"}")).andExpect(status().isBadRequest());
    }

    @Test
    void rejectsAParentThatIsNotInThisEstate() throws Exception {
        var foreign = UUID.fromString("00000000-0000-0000-0000-0000000000ff");
        mvc.perform(asOwner(post(base), create("LEVEL", foreign, "Level 1", 1))).andExpect(status().isNotFound());
    }

    @Test
    void rejectsADeactivatedParent() throws Exception {
        when(repository.find(blockId, estateId))
                .thenReturn(Optional.of(
                        new LocationResponse(blockId, LocationType.BLOCK, null, "Old", null, now, now, now)));
        mvc.perform(asOwner(post(base), create("LEVEL", blockId, "Level 1", 1))).andExpect(status().isConflict());
    }

    @Test
    void rejectsChangesToAnInactiveEstate() throws Exception {
        when(estates.findOwned(estateId, "owner", true)).thenReturn(Optional.of(estate(now)));
        mvc.perform(asOwner(post(base), create("BLOCK", null, "Blk 1", null))).andExpect(status().isConflict());
        mvc.perform(asOwner(patch(base + "/" + blockId), update(null, "Blk 1", null)))
                .andExpect(status().isConflict());
        mvc.perform(asOwner(post(base + "/" + areaId + "/deactivate"), "{}")).andExpect(status().isConflict());
    }

    @Test
    void rejectsADuplicateNameAmongSiblings() throws Exception {
        when(repository.nameTaken(estateId, null, "Blk 1", null)).thenReturn(true);
        mvc.perform(asOwner(post(base), create("BLOCK", null, "Blk 1", null)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void rejectsTwoLevelsAtTheSamePositionInABlock() throws Exception {
        when(repository.sortOrderTaken(blockId, 1, null)).thenReturn(true);
        mvc.perform(asOwner(post(base), create("LEVEL", blockId, "Level 1", 1))).andExpect(status().isConflict());
    }

    @Test
    void reportsDatabaseConstraintViolationsAsConflictsWithoutSql() throws Exception {
        when(repository.create(any(), any(), any())).thenThrow(new DataIntegrityViolationException("sensitive SQL"));
        mvc.perform(asOwner(post(base), create("BLOCK", null, "Blk 1", null)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(not(containsString("SQL"))));
    }

    // --- Update and move ---

    @Test
    void renamesALocationIgnoringAnAttemptToChangeItsType() throws Exception {
        when(repository.update(eq(blockId), eq(new UpdateLocationRequest(null, "Blk 1A", null)), isNull()))
                .thenReturn(block);
        mvc.perform(asOwner(patch(base + "/" + blockId), "{\"type\":\"LEVEL\",\"name\":\" Blk 1A \"}"))
                .andExpect(status().isOk());
    }

    @Test
    void keepingItsOwnNameIsNotADuplicate() throws Exception {
        when(repository.update(any(), any(), any())).thenReturn(block);
        mvc.perform(asOwner(patch(base + "/" + blockId), update(null, "Node", null)))
                .andExpect(status().isOk());
        verify(repository).nameTaken(estateId, null, "Node", blockId);
    }

    @Test
    void movesALevelToAnotherBlock() throws Exception {
        when(repository.update(eq(levelId), any(), eq(LocationType.BLOCK))).thenReturn(level);
        mvc.perform(asOwner(patch(base + "/" + levelId), update(otherBlockId, "Level 1", 1)))
                .andExpect(status().isOk());
        verify(repository).sortOrderTaken(otherBlockId, 1, levelId);
    }

    @Test
    void rejectsMovingALevelUnderAnotherLevel() throws Exception {
        var otherLevel = UUID.fromString("00000000-0000-0000-0000-0000000000cc");
        when(repository.find(otherLevel, estateId))
                .thenReturn(Optional.of(location(otherLevel, LocationType.LEVEL, blockId, 2)));
        mvc.perform(asOwner(patch(base + "/" + levelId), update(otherLevel, "Level 1", 1)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsEditingADeactivatedLocation() throws Exception {
        when(repository.find(blockId, estateId))
                .thenReturn(Optional.of(
                        new LocationResponse(blockId, LocationType.BLOCK, null, "Old", null, now, now, now)));
        mvc.perform(asOwner(patch(base + "/" + blockId), update(null, "Blk 1", null)))
                .andExpect(status().isConflict());
    }

    // --- Deactivate ---

    @Test
    void deactivatesALocationWithoutDeletingIt() throws Exception {
        when(repository.deactivate(areaId))
                .thenReturn(
                        new LocationResponse(areaId, LocationType.COMMON_AREA, levelId, "Node", null, now, now, now));
        mvc.perform(asOwner(post(base + "/" + areaId + "/deactivate"), "{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(areaId.toString()))
                .andExpect(jsonPath("$.deactivatedAt").isNotEmpty());
    }

    @Test
    void refusesToDeactivateALocationThatStillHasActiveChildren() throws Exception {
        when(repository.hasActiveChildren(blockId)).thenReturn(true);
        mvc.perform(asOwner(post(base + "/" + blockId + "/deactivate"), "{}")).andExpect(status().isConflict());
        verify(repository, never()).deactivate(any());
    }

    @Test
    void repeatedDeactivationKeepsTheOriginalTimestamp() throws Exception {
        var earlier = OffsetDateTime.parse("2026-01-01T00:00:00Z");
        when(repository.find(areaId, estateId))
                .thenReturn(Optional.of(new LocationResponse(
                        areaId, LocationType.COMMON_AREA, levelId, "Node", null, now, now, earlier)));
        mvc.perform(asOwner(post(base + "/" + areaId + "/deactivate"), "{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deactivatedAt").value("2026-01-01T00:00:00Z"));
        verify(repository, never()).deactivate(any());
    }
}
