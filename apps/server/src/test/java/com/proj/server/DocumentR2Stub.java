package com.proj.server;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

/** A local S3-compatible boundary, not a mock of the future document implementation. */
final class DocumentR2Stub implements AutoCloseable {
    static final String BUCKET = "test-documents";
    final Map<String, StoredObject> objects = new ConcurrentHashMap<>();
    final AtomicReference<Runnable> afterWrite = new AtomicReference<>();
    volatile boolean unavailable;
    volatile boolean deletionUnavailable;
    private final HttpServer server;
    private final java.util.concurrent.ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    DocumentR2Stub() {
        try {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/", this::handle);
            server.setExecutor(executor);
            server.start();
            Runtime.getRuntime()
                    .addShutdownHook(Thread.ofPlatform()
                            .name("document-test-storage-shutdown")
                            .unstarted(this::close));
        } catch (IOException error) {
            throw new IllegalStateException("Unable to start local document storage", error);
        }
    }

    String endpoint() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    void reset() {
        objects.clear();
        afterWrite.set(null);
        unavailable = false;
        deletionUnavailable = false;
    }

    private void handle(HttpExchange exchange) throws IOException {
        try (exchange) {
            if (unavailable
                    || (deletionUnavailable && exchange.getRequestMethod().equals("DELETE"))) {
                respond(
                        exchange,
                        503,
                        "<Error><Code>ServiceUnavailable</Code></Error>".getBytes(StandardCharsets.UTF_8));
                return;
            }
            String path = exchange.getRequestURI().getPath();
            String key = path.startsWith("/" + BUCKET + "/") ? path.substring(BUCKET.length() + 2) : path.substring(1);
            switch (exchange.getRequestMethod()) {
                case "PUT" -> {
                    var bytes = exchange.getRequestBody().readAllBytes();
                    String encoding = exchange.getRequestHeaders().getFirst("Content-Encoding");
                    if (encoding != null && encoding.contains("aws-chunked")) bytes = decodeChunks(bytes);
                    objects.put(
                            key,
                            new StoredObject(
                                    bytes, exchange.getRequestHeaders().getFirst("Content-Type"), Instant.now()));
                    var callback = afterWrite.getAndSet(null);
                    if (callback != null) callback.run();
                    exchange.getResponseHeaders().set("ETag", "\"" + checksum(bytes) + "\"");
                    respond(exchange, 200, new byte[0]);
                }
                case "DELETE" -> {
                    objects.remove(key);
                    respond(exchange, 204, new byte[0]);
                }
                case "GET" -> {
                    String query = exchange.getRequestURI().getRawQuery();
                    if (query != null && query.contains("list-type=2")) {
                        list(exchange, query);
                        return;
                    }
                    var object = objects.get(key);
                    if (object == null) {
                        respond(
                                exchange,
                                404,
                                "<Error><Code>NoSuchKey</Code></Error>".getBytes(StandardCharsets.UTF_8));
                        return;
                    }
                    exchange.getResponseHeaders().set("Content-Type", object.contentType());
                    respond(exchange, 200, object.bytes());
                }
                default -> respond(exchange, 405, new byte[0]);
            }
        }
    }

    /** S3 streaming signatures frame the body independently of HTTP transfer encoding. */
    private static byte[] decodeChunks(byte[] bytes) throws IOException {
        var output = new java.io.ByteArrayOutputStream();
        int position = 0;
        while (position < bytes.length) {
            int end = position;
            while (end + 1 < bytes.length && !(bytes[end] == '\r' && bytes[end + 1] == '\n')) end++;
            String header = new String(bytes, position, end - position, StandardCharsets.US_ASCII);
            int length = Integer.parseInt(header.split(";", 2)[0], 16);
            if (length == 0) return output.toByteArray();
            position = end + 2;
            if (length < 0 || length > bytes.length - position - 2) throw new IOException("Invalid S3 chunk");
            output.write(bytes, position, length);
            position += length + 2;
        }
        throw new IOException("Unterminated S3 chunk stream");
    }

    private static String checksum(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("MD5").digest(bytes));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("The Java runtime must support MD5 for S3 ETags", error);
        }
    }

    private void list(HttpExchange exchange, String query) throws IOException {
        String prefix = "";
        String cursor = "";
        int limit = 100;
        for (String part : query.split("&")) {
            var pair = part.split("=", 2);
            String value = pair.length == 2 ? URLDecoder.decode(pair[1], StandardCharsets.UTF_8) : "";
            if (pair[0].equals("prefix")) prefix = value;
            if (pair[0].equals("continuation-token")) cursor = value;
            if (pair[0].equals("max-keys")) limit = Integer.parseInt(value);
        }
        final String selectedPrefix = prefix;
        final String selectedCursor = cursor;
        var keys = objects.keySet().stream()
                .filter(key -> key.startsWith(selectedPrefix) && key.compareTo(selectedCursor) > 0)
                .sorted()
                .toList();
        var page = keys.stream().limit(limit).toList();
        var xml = new StringBuilder(
                "<ListBucketResult xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"><Name>" + BUCKET + "</Name>");
        for (String key : page) {
            var object = objects.get(key);
            xml.append("<Contents><Key>")
                    .append(escape(key))
                    .append("</Key><LastModified>")
                    .append(object.modifiedAt())
                    .append("</LastModified><Size>")
                    .append(object.bytes().length)
                    .append("</Size></Contents>");
        }
        boolean more = page.size() < keys.size();
        xml.append("<IsTruncated>").append(more).append("</IsTruncated>");
        if (more)
            xml.append("<NextContinuationToken>").append(escape(page.getLast())).append("</NextContinuationToken>");
        xml.append("</ListBucketResult>");
        exchange.getResponseHeaders().set("Content-Type", "application/xml");
        respond(exchange, 200, xml.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private static void respond(HttpExchange exchange, int status, byte[] bytes) throws IOException {
        exchange.sendResponseHeaders(status, bytes.length == 0 ? -1 : bytes.length);
        if (bytes.length > 0) exchange.getResponseBody().write(bytes);
    }

    @Override
    public void close() {
        server.stop(0);
        executor.close();
    }

    record StoredObject(byte[] bytes, String contentType, Instant modifiedAt) {}
}
