package com.proj.server.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import org.springframework.web.multipart.support.StandardServletMultipartResolver;

/** A larger CSV transport ceiling must not enlarge any other upload's existing limits. */
@Configuration
public class ReadingImportMultipartConfiguration {
    @Bean
    StandardServletMultipartResolver multipartResolver() {
        return new StandardServletMultipartResolver() {
            @Override
            public MultipartHttpServletRequest resolveMultipart(HttpServletRequest request) throws MultipartException {
                boolean imports = request.getRequestURI().matches("/estates/[^/]+/readings/imports");
                if (!imports && request.getContentLengthLong() > 17L * 1024 * 1024)
                    throw new MaxUploadSizeExceededException(17L * 1024 * 1024);
                var parsed = super.resolveMultipart(request);
                try {
                    long total = 0;
                    for (var part : request.getParts()) {
                        total += part.getSize();
                        long limit = imports ? 25L * 1024 * 1024 : 5L * 1024 * 1024;
                        if (part.getSubmittedFileName() != null && part.getSize() > limit)
                            throw new MaxUploadSizeExceededException(limit);
                    }
                    if (!imports && total > 17L * 1024 * 1024)
                        throw new MaxUploadSizeExceededException(17L * 1024 * 1024);
                    return parsed;
                } catch (java.io.IOException | jakarta.servlet.ServletException error) {
                    throw new MultipartException("Couldn't read the file. Try again.", error);
                } catch (RuntimeException error) {
                    cleanupMultipart(parsed);
                    throw error;
                }
            }
        };
    }
}
