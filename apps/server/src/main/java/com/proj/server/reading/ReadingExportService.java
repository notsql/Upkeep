package com.proj.server.reading;

import com.proj.server.device.DeviceMetric;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReadingExportService {
    private final AssetReadingRepository repository;
    private final EstateReadingService access;

    public ReadingExportService(AssetReadingRepository repository, EstateReadingService access) {
        this.repository = repository;
        this.access = access;
    }
    /** The transaction must start on the streaming worker, not the original servlet thread. */
    @Transactional(readOnly = true, timeout = 230)
    public void write(
            UUID estate,
            String user,
            UUID asset,
            DeviceMetric metric,
            OffsetDateTime from,
            OffsetDateTime to,
            Set<ReadingFlagType> flags,
            HttpServletResponse response,
            OutputStream output)
            throws IOException {
        access.validateExport(estate, user, asset, from, to);
        try (var cursor = repository.exportEstate(estate, asset, metric, from, to, flags)) {
            var first = cursor.fetchNext();
            response.setHeader(
                    "X-Export-Row-Count",
                    first == null
                            ? "0"
                            : first.get(AssetReadingRepository.EXPORT_ROWS).toString());
            var writer = new OutputStreamWriter(output, StandardCharsets.UTF_8);
            writer.write('\uFEFF');
            writer.write(ReadingCsvWriter.HEADER);
            writer.flush();
            int buffered = 0;
            for (var row = first; row != null; row = cursor.fetchNext()) {
                ReadingCsvWriter.row(writer, AssetReadingRepository.toEstateResponse(row));
                if (++buffered % 128 == 0) writer.flush();
            }
            writer.flush();
        }
    }
}
