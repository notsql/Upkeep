package com.proj.server;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.proj.server.storage.InMemoryObjectStorage;
import jakarta.servlet.ServletContext;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.SmartRequestBuilder;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.json.JsonMapper;

/**
 * A create request whose photos were already sent straight to storage (decision 0050). Each {@link #file} is put into
 * the in-memory storage under a key of the shape the photo-slot endpoint issues, the way the browser's PUT would, and
 * its key goes in the JSON body. Fields read like the multipart parameters they replace.
 */
final class StoredUploadSubmission implements SmartRequestBuilder {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private final String path;
    private final InMemoryObjectStorage storage;
    private final String idField;
    private final String keysField;
    private final String prefix;
    private final UUID id = UUID.randomUUID();
    private final Map<String, Object> fields = new LinkedHashMap<>();
    private final List<String> keys = new ArrayList<>();
    private final List<RequestPostProcessor> processors = new ArrayList<>();

    private StoredUploadSubmission(
            String path, InMemoryObjectStorage storage, String idField, String keysField, String prefix) {
        this.path = path;
        this.storage = storage;
        this.idField = idField;
        this.keysField = keysField;
        this.prefix = prefix;
    }

    static StoredUploadSubmission report(InMemoryObjectStorage storage) {
        return new StoredUploadSubmission("/resident/reports", storage, "reportId", "imageKeys", "reports/");
    }

    static StoredUploadSubmission inspection(String path, InMemoryObjectStorage storage) {
        return new StoredUploadSubmission(path, storage, "inspectionId", "photoKeys", "inspections/");
    }

    UUID id() {
        return id;
    }

    List<String> keys() {
        return keys;
    }

    StoredUploadSubmission param(String name, String value) {
        fields.put(name, value);
        return this;
    }

    StoredUploadSubmission file(MockMultipartFile file) {
        try {
            return file(file.getContentType(), file.getBytes());
        } catch (IOException error) {
            throw new UncheckedIOException(error);
        }
    }

    StoredUploadSubmission file(String contentType, byte[] bytes) {
        var key = prefix + id + "/" + UUID.randomUUID();
        storage.upload(key, bytes, contentType);
        keys.add(key);
        return this;
    }

    /** A key that was never uploaded, for the "nothing behind the key" path. */
    StoredUploadSubmission missingFile() {
        keys.add(prefix + id + "/" + UUID.randomUUID());
        return this;
    }

    StoredUploadSubmission with(RequestPostProcessor processor) {
        processors.add(processor);
        return this;
    }

    private MockHttpServletRequestBuilder delegate() {
        var body = new LinkedHashMap<String, Object>(fields);
        if (!keys.isEmpty()) {
            body.put(idField, id.toString());
            body.put(keysField, keys);
        }
        var request = post(path).contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsString(body));
        for (var processor : processors) request.with(processor);
        return request;
    }

    private MockHttpServletRequestBuilder built;

    @Override
    public MockHttpServletRequest buildRequest(ServletContext context) {
        built = delegate();
        return built.buildRequest(context);
    }

    @Override
    public MockHttpServletRequest postProcessRequest(MockHttpServletRequest request) {
        return built.postProcessRequest(request);
    }
}
