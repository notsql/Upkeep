package com.proj.server.routing;

/**
 * The kinds of work an external contractor can be engaged for. Separate from AssetCategory, which has no gate.
 */
public enum EquipmentType {
    PUMP("Pump"),
    LIFT("Lift"),
    GATE("Gate"),
    LIGHT("Common-area light"),
    PLUMBING("Plumbing"),
    CLEANING("Cleaning"),
    REPAIRS("Painting and repairs"),
    SECURITY("Security");

    private final String label;

    EquipmentType(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
