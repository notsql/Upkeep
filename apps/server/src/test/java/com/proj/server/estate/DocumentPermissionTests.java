package com.proj.server.estate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

/** Document grants must work without granting general estate-management access. */
class DocumentPermissionTests {
    @Test
    void acceptsDocumentReadAccessWithoutEstateReadAccess() {
        var grants = EstatePermissions.validatedGrants(List.of("VIEW_DOCUMENTS"));

        assertEquals(Set.of("VIEW_DOCUMENTS"), grants.stream().map(Enum::name).collect(Collectors.toSet()));
    }

    @Test
    void acceptsDocumentReadAndEditAccessWithoutOtherPermissions() {
        var grants = EstatePermissions.validatedGrants(List.of("VIEW_DOCUMENTS", "EDIT_DOCUMENTS"));

        assertEquals(
                Set.of("VIEW_DOCUMENTS", "EDIT_DOCUMENTS"),
                grants.stream().map(Enum::name).collect(Collectors.toSet()));
    }

    @Test
    void documentEditExplicitlyRequiresDocumentReadAccess() {
        var edit = Arrays.stream(EstatePermissionCode.values())
                .filter(code -> code.name().equals("EDIT_DOCUMENTS"))
                .findFirst();

        assertTrue(edit.isPresent(), "EDIT_DOCUMENTS must be a supported permission");
        assertEquals(
                List.of("VIEW_DOCUMENTS"),
                edit.orElseThrow().requires().stream().map(Enum::name).toList());
    }

    @Test
    void rejectsAnEditOnlyOrUnknownGrantSetRatherThanCreatingReadAccess() {
        assertEquals(Set.of(), EstatePermissions.validatedGrants(List.of("EDIT_DOCUMENTS")));
        assertEquals(Set.of(), EstatePermissions.validatedGrants(List.of("VIEW_DOCUMENTS", "UNKNOWN_DOCUMENT_CODE")));
    }
}
