package com.proj.server.catalogue;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Read-only lookups. Entries are added on the fly when an asset is saved (see {@link CatalogueRepository}). */
@Service
public class CatalogueService {
    private final CatalogueRepository repository;

    public CatalogueService(CatalogueRepository repository) {
        this.repository = repository;
    }

    public List<AssetCategoryResponse> categories() {
        return repository.categories();
    }

    public List<ManufacturerResponse> manufacturers(String query) {
        return repository.manufacturers(query);
    }

    public List<AssetModelResponse> models(UUID manufacturerId, String category, String query) {
        if (!repository.categoryExists(category)) {
            throw new CatalogueException(HttpStatus.BAD_REQUEST, "Unknown asset category.");
        }
        if (!repository.manufacturerExists(manufacturerId)) {
            throw new CatalogueException(HttpStatus.NOT_FOUND, "Manufacturer not found.");
        }
        return repository.models(manufacturerId, category, query);
    }
}
