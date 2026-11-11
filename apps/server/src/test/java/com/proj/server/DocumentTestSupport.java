package com.proj.server;

import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

/**
 * Commit real HTTP operations so deletion retries observe committed data. Files are "uploaded" by putting them into
 * the shared in-memory storage under an issued key, as the browser's PUT would (decision 0050).
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
abstract class DocumentTestSupport extends CustomEstateRoleTestSupport {
    private final List<UUID> fixtureEstates = new ArrayList<>();

    @Autowired
    ScheduledAnnotationBeanPostProcessor scheduler;

    @Override
    UUID estate(String owner) {
        var id = super.estate(owner);
        fixtureEstates.add(id);
        return id;
    }

    @BeforeEach
    void documentPeopleAndStorage() {
        storage.reset();
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
        storage.reset();
    }

    String documents() {
        return path() + "/documents";
    }

    String downloadPath(UUID id) {
        return documents() + "/" + id + "/content";
    }

    MockHttpServletRequestBuilder submission(String type, MockMultipartFile... files) throws Exception {
        return submissionTo(estateId, type, files);
    }

    /** Uploads the file (if any) under a key issued for {@code estate}, then builds the JSON create call. */
    MockHttpServletRequestBuilder submissionTo(UUID estate, String type, MockMultipartFile... files) throws Exception {
        var body = json.createObjectNode();
        if (type != null) body.put("documentType", type);
        if (files.length > 0) {
            var key = "documents/" + estate + "/" + UUID.randomUUID();
            storage.upload(key, files[0].getBytes(), files[0].getContentType());
            body.put("objectKey", key);
            body.put("fileName", files[0].getOriginalFilename());
        }
        return post("/estates/" + estate + "/documents")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body));
    }

    MockHttpServletRequestBuilder slot(String fileName, String contentType, long size) throws Exception {
        var body = json.createObjectNode()
                .put("fileName", fileName)
                .put("contentType", contentType)
                .put("size", size);
        return post(documents() + "/upload-slots")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body));
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
        storage.age(key, time);
    }
}
