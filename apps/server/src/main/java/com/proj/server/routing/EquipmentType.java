package com.proj.server.routing;

/** The equipment an external contractor can be engaged for. Separate from AssetCategory, which has no gate. */
public enum EquipmentType {
    PUMP("Pump"),
    LIFT("Lift"),
    GATE("Gate"),
    LIGHT("Common-area light");

    private final String label;

    EquipmentType(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
