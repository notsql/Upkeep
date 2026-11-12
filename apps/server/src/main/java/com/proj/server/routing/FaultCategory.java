package com.proj.server.routing;

/**
 * What kind of problem a report describes (fault-categories-and-report-page.md). Declared in the fault category
 * model's output order, which {@link Classification#fromProbabilities} relies on.
 */
public enum FaultCategory {
    BROKEN_LIGHT("Broken light", EquipmentType.LIGHT),
    DRAINAGE("Blocked drain", EquipmentType.PLUMBING),
    GRAFFITI("Graffiti or vandalism", EquipmentType.REPAIRS),
    ILLEGAL_DUMPING("Dumped items", EquipmentType.CLEANING),
    NOISE("Noise", EquipmentType.SECURITY),
    OTHER("Something else", null),
    PARKING("Parking", EquipmentType.SECURITY),
    ROAD_DAMAGE("Damaged road or path", EquipmentType.REPAIRS),
    RUBBISH("Rubbish or litter", EquipmentType.CLEANING),
    WATER_LEAK("Water leak", EquipmentType.PLUMBING);

    private final String label;
    private final EquipmentType equipmentType;

    FaultCategory(String label, EquipmentType equipmentType) {
        this.label = label;
        this.equipmentType = equipmentType;
    }

    public String label() {
        return label;
    }

    /** The contractor type this category routes to; null when it is always a Manager decision. */
    public EquipmentType equipmentType() {
        return equipmentType;
    }
}
