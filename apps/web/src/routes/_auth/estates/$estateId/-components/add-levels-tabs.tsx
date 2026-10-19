import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@proj/ui/components/tabs";
import {
  type Location,
  type LocationNode,
  nextLevelPosition,
} from "@/lib/locations";
import {
  AddFloorsForm,
  type AddFloorsResult,
} from "@/routes/_auth/estates/$estateId/-components/add-floors-form";
import {
  LocationForm,
  type LocationFormValues,
} from "@/routes/_auth/estates/$estateId/-components/location-form";

/**
 * One "Add levels" dialog with two ways in: a standard range of floors (ID-99),
 * or one level with its own name and position, such as "Roof" or "Mezzanine".
 */
export function AddLevelsTabs({
  block,
  items,
  onSaveFloors,
  onSaveLevel,
  onCancel,
  onPendingChange,
}: {
  block: LocationNode;
  items: Location[];
  onSaveFloors: (lowest: number, highest: number) => Promise<AddFloorsResult>;
  onSaveLevel: (values: LocationFormValues) => Promise<unknown>;
  onCancel: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  return (
    <Tabs defaultValue="range">
      <TabsList className="w-full">
        <TabsTrigger value="range">Range of floors</TabsTrigger>
        <TabsTrigger value="custom">One custom level</TabsTrigger>
      </TabsList>
      <TabsContent value="range">
        <AddFloorsForm
          existingLevels={items.filter(
            (item) => item.type === "LEVEL" && item.parentId === block.id
          )}
          onCancel={onCancel}
          onDone={onCancel}
          onPendingChange={onPendingChange}
          onSave={onSaveFloors}
          title={`Add floors to ${block.name}`}
        />
      </TabsContent>
      <TabsContent value="custom">
        <LocationForm
          initialParentId={block.id}
          initialSortOrder={nextLevelPosition(items, block.id)}
          onCancel={onCancel}
          onPendingChange={onPendingChange}
          onSave={onSaveLevel}
          showPosition
          title={`Add level to ${block.name}`}
        />
      </TabsContent>
    </Tabs>
  );
}
