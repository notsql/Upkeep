package com.proj.server;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class DocumentRolePermissionsIntegrationTests extends DocumentTestSupport {
    @Test
    void theCatalogueRegistersBothDocumentPermissionsAndTheEditPrerequisite() throws Exception {
        mvc.perform(as("owner", get(path() + "/role-permissions")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].code", hasItems("VIEW_DOCUMENTS", "EDIT_DOCUMENTS")))
                .andExpect(jsonPath(
                        "$[?(@.code == 'VIEW_DOCUMENTS')].label", contains("View invoices and service reports")))
                .andExpect(jsonPath(
                        "$[?(@.code == 'EDIT_DOCUMENTS')].label", contains("Edit invoices and service reports")))
                .andExpect(
                        jsonPath("$[?(@.code == 'VIEW_DOCUMENTS')].requires[0]").doesNotExist())
                .andExpect(jsonPath("$[?(@.code == 'EDIT_DOCUMENTS')].requires[0]", contains("VIEW_DOCUMENTS")));
        assertEquals(
                2,
                db.fetchOne("select count(*) from \"Permission\" where code in ('VIEW_DOCUMENTS', 'EDIT_DOCUMENTS')")
                        .get(0, Integer.class));
    }

    @Test
    void readOnlyCustomRolesCanSearchAndDownloadWithoutGeneralEstateAccess() throws Exception {
        var document = upload("crew", "invoice.pdf");
        grant("author", "VIEW_DOCUMENTS");

        mvc.perform(as("author", get(documents()).param("filename", "invoice")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(id(document).toString()))
                .andExpect(jsonPath("$.items[0].canDelete").value(false));
        mvc.perform(as("author", get(downloadPath(id(document))))).andExpect(status().isOk());
        mvc.perform(as("author", submission("INVOICE", pdfFile("new.pdf")))).andExpect(status().isForbidden());
        mvc.perform(as("author", delete(documents() + "/" + id(document)))).andExpect(status().isForbidden());
        mvc.perform(as("author", get(path()))).andExpect(status().isForbidden());
        var access = body(mvc.perform(as("author", get("/access/context"))).andExpect(status().isOk()));
        var estate = access.get("estates").get(0);
        assertTrue(access.get("canEnterWorkspace").asBoolean());
        assertTrue(estate.get("canViewDocuments").asBoolean());
        assertFalse(estate.get("canUploadDocuments").asBoolean());
        assertFalse(estate.get("canViewManagement").asBoolean());
    }

    @Test
    void editCustomRolesCanUploadAndDeleteOnlyTheirOwnFiles() throws Exception {
        grant("author", "VIEW_DOCUMENTS", "EDIT_DOCUMENTS");
        var own = upload("author", "own.pdf");
        var other = upload("crew", "other.pdf");

        mvc.perform(as("author", delete(documents() + "/" + id(other)))).andExpect(status().isForbidden());
        mvc.perform(as("author", delete(documents() + "/" + id(own)))).andExpect(status().isNoContent());
        assertEquals(1, documentList("author").get("items").size());
        mvc.perform(as("author", get("/access/context")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canViewDocuments").value(true))
                .andExpect(jsonPath("$.estates[0].canUploadDocuments").value(true));
    }

    @Test
    void editCannotBeGrantedWithoutItsReadPrerequisite() throws Exception {
        send("owner", post(roles()), roleBody("Incomplete document editor", "EDIT_DOCUMENTS"))
                .andExpect(status().isBadRequest());
        assertEquals(
                0,
                db.fetchOne("select count(*) from \"EstateRoleDefinition\" where \"estateId\"=?", estateId)
                        .get(0, Integer.class));
    }

    @Test
    void removingEditAccessPreventsFurtherUploadsAndOwnFileDeletionWithTheSameToken() throws Exception {
        var role = grant("author", "VIEW_DOCUMENTS", "EDIT_DOCUMENTS");
        var own = upload("author", "own.pdf");
        send("owner", put(roles() + "/" + id(role)), updateBody(role, "Role for author", "VIEW_DOCUMENTS"))
                .andExpect(status().isOk());

        mvc.perform(as("author", get(downloadPath(id(own))))).andExpect(status().isOk());
        mvc.perform(as("author", submission("INVOICE", pdfFile("new.pdf")))).andExpect(status().isForbidden());
        mvc.perform(as("author", delete(documents() + "/" + id(own)))).andExpect(status().isForbidden());
        mvc.perform(as("author", get(documents())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].canDelete").value(false));
    }

    @Test
    void customRolesWithoutDocumentGrantsDoNotGainAccessAutomatically() throws Exception {
        grant("author", "VIEW_ESTATE");

        mvc.perform(as("author", get(documents()))).andExpect(status().isForbidden());
        mvc.perform(as("author", submission("INVOICE", pdfFile("new.pdf")))).andExpect(status().isForbidden());
        mvc.perform(as("author", get("/access/context")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canViewDocuments").value(false))
                .andExpect(jsonPath("$.estates[0].canUploadDocuments").value(false));
    }

    @Test
    void aDocumentRoleAuthorCanGrantOnlyTheDocumentPermissionsTheyHold() throws Exception {
        grant("author", "CREATE_ROLES", "VIEW_DOCUMENTS");

        send("author", post(roles()), roleBody("Document readers", "VIEW_DOCUMENTS"))
                .andExpect(status().isCreated());
        send("author", post(roles()), roleBody("Document editors", "VIEW_DOCUMENTS", "EDIT_DOCUMENTS"))
                .andExpect(status().isForbidden());
        mvc.perform(as("author", get(path() + "/role-permissions")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].code", hasItem("VIEW_DOCUMENTS")))
                .andExpect(jsonPath("$[*].code", not(hasItem("EDIT_DOCUMENTS"))));
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "member", "crew"})
    void presetRolesKeepReadAccessWhenInactiveButCannotUpload(String user) throws Exception {
        inactive();

        var access = body(mvc.perform(as(user, get("/access/context"))).andExpect(status().isOk()));
        var estate = access.get("estates").get(0);
        assertTrue(estate.get("canViewDocuments").asBoolean());
        assertFalse(estate.get("canUploadDocuments").asBoolean());
    }
}
