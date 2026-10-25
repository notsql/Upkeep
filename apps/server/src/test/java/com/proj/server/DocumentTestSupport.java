package com.proj.server;

import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

/** Commit real HTTP operations so storage callbacks and deletion retries observe committed data. */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
abstract class DocumentTestSupport extends CustomEstateRoleTestSupport {
    static final DocumentR2Stub STORAGE = new DocumentR2Stub();
    private final List<UUID> fixtureEstates = new ArrayList<>();

    @Autowired
    ScheduledAnnotationBeanPostProcessor scheduler;

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry properties) {
        properties.add("app.r2.endpoint", STORAGE::endpoint);
        properties.add("app.r2.access-id", () -> "document-test-access-id");
        properties.add("app.r2.secret-access-key", () -> "document-test-secret");
        properties.add("app.r2.bucket-name", () -> DocumentR2Stub.BUCKET);
    }

    @Override
    UUID estate(String owner) {
        var id = super.estate(owner);
        fixtureEstates.add(id);
        return id;
    }

    @BeforeEach
    void documentPeopleAndStorage() {
        STORAGE.reset();
        member(estateId, "crew", "CREW");
        member(estateId, "second-crew", "CREW");
        member(estateId, "resident", "RESIDENT");
        member(estateId, "legacy-member", "MEMBER");
    }

    @AfterEach
    void removeOnlyThisTestsCommittedFixtures() {
        boolean documentsExist = db.fetchValue("select to_regclass('public.\"Document\"')") != null;
        if (documentsExist)
            db.execute("alter table \"Document\" drop constraint if exists document_test_write_failure");
        for (var estate : fixtureEstates) {
            if (documentsExist) db.execute("delete from \"Document\" where \"estateId\"=?", estate);
            db.execute("delete from \"EstateInvitation\" where \"estateId\"=?", estate);
            db.execute("delete from \"EstateUser\" where \"estateId\"=?", estate);
            db.execute(
                    "delete from \"EstateRolePermission\" where \"roleId\" in (select id from \"EstateRoleDefinition\" where \"estateId\"=?)",
                    estate);
            db.execute("delete from \"EstateRoleDefinition\" where \"estateId\"=?", estate);
            db.execute("delete from \"Estate\" where id=?", estate);
        }
        STORAGE.reset();
    }

    String documents() {
        return path() + "/documents";
    }

    String downloadPath(UUID id) {
        return documents() + "/" + id + "/content";
    }

    MockMultipartHttpServletRequestBuilder submission(String type, MockMultipartFile... files) {
        var request = multipart(documents());
        if (type != null) request.param("documentType", type);
        for (var file : files) request.file(file);
        return request;
    }

    MockMultipartHttpServletRequestBuilder as(String user, MockMultipartHttpServletRequestBuilder request) {
        return request.with(jwt().jwt(token -> token.subject(user).claim("role", "admin"))
                .authorities(new SimpleGrantedAuthority("ROLE_admin")));
    }

    MockMultipartFile pdfFile(String filename) {
        return new MockMultipartFile("file", filename, "application/pdf", pdf());
    }

    JsonNode upload(String user, String filename) throws Exception {
        return body(
                mvc.perform(as(user, submission("INVOICE", pdfFile(filename)))).andExpect(status().isCreated()));
    }

    JsonNode documentList(String user) throws Exception {
        return body(mvc.perform(as(user, get(documents()))).andExpect(status().isOk()));
    }

    String storageKey(UUID document) {
        return db.fetchOne("select \"storageKey\" from \"Document\" where id=?", document)
                .get(0, String.class);
    }

    void revoke(String user) {
        db.deleteFrom(ESTATEUSER)
                .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq(user)))
                .execute();
    }

    void runCleanup() {
        // Run registered work synchronously rather than sleeping for an hourly timer.
        for (var task : scheduler.getScheduledTasks())
            task.getTask().getRunnable().run();
    }

    static byte[] image(String format, int width, int height) throws Exception {
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), format, output);
        return output.toByteArray();
    }

    static byte[] pdf() {
        var output = new StringBuilder("%PDF-1.4\n");
        var offsets = new ArrayList<Integer>();
        var objects = List.of(
                "<< /Type /Catalog /Pages 2 0 R >>",
                "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R >>",
                "<< /Length 0 >>\nstream\n\nendstream");
        for (int i = 0; i < objects.size(); i++) {
            offsets.add(output.length());
            output.append(i + 1).append(" 0 obj\n").append(objects.get(i)).append("\nendobj\n");
        }
        int xref = output.length();
        output.append("xref\n0 5\n0000000000 65535 f \n");
        for (int offset : offsets) output.append("%010d 00000 n \n".formatted(offset));
        output.append("trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n")
                .append(xref)
                .append("\n%%EOF\n");
        return output.toString().getBytes(StandardCharsets.US_ASCII);
    }

    void ageObject(String key, Instant time) {
        var object = STORAGE.objects.get(key);
        STORAGE.objects.put(key, new DocumentR2Stub.StoredObject(object.bytes(), object.contentType(), time));
    }
}
