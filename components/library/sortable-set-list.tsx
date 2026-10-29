import { Reorder, useDragControls } from "motion/react";
import { useRef, useState, type KeyboardEvent } from "react";

import { SetRow } from "@/components/library/library-rows";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import type { LibrarySet } from "@/types";

interface Metrics {
  questionCount: number;
  senseCount: number;
}

/** The folder pill under a pointer, found by the `data-folder-id` it carries. */
function folderAt(point: { x: number; y: number }) {
  const element = document.elementFromPoint(
    point.x - window.scrollX,
    point.y - window.scrollY,
  );
  return (
    element?.closest<HTMLElement>("[data-folder-id]")?.dataset.folderId ?? null
  );
}

/**
 * The library's sets while it is being reordered, as in the app's edit mode:
 * each set is dragged by its handle, or moved with the arrow keys on it, and
 * a set let go over a folder pill moves into that folder.
 */
export function SortableSetList({
  sets,
  metrics,
  onReorder,
  onDropInFolder,
  onHoverFolder,
}: {
  sets: LibrarySet[];
  metrics: (id: string) => Metrics;
  onReorder: (id: string, toIndex: number) => void;
  onDropInFolder: (id: string, folderId: string) => void;
  onHoverFolder: (folderId: string | null) => void;
}) {
  const [order, setOrder] = useState(() => sets.map((entry) => entry.id));
  // Read when a drag ends, after the last reorder has landed.
  const latest = useRef(order);
  latest.current = order;
  const byId = new Map(sets.map((entry) => [entry.id, entry]));

  return (
    <Reorder.Group
      as="div"
      axis="y"
      className="grid gap-2"
      onReorder={setOrder}
      values={order}
    >
      {order.flatMap((id) => {
        const entry = byId.get(id);
        return entry
          ? [
              <SortableSet
                key={id}
                metrics={metrics(id)}
                name={entry.setName}
                onDrag={(point) => onHoverFolder(folderAt(point))}
                onDrop={(point) => {
                  onHoverFolder(null);
                  const folderId = folderAt(point);
                  if (folderId) {
                    setOrder(sets.map((set) => set.id));
                    onDropInFolder(id, folderId);
                  } else onReorder(id, latest.current.indexOf(id));
                }}
                onStep={(step) => {
                  const index = order.indexOf(id) + step;
                  if (index < 0 || index >= order.length) return;
                  const next = order.filter((other) => other !== id);
                  next.splice(index, 0, id);
                  setOrder(next);
                  onReorder(id, index);
                }}
                setId={id}
              />,
            ]
          : [];
      })}
    </Reorder.Group>
  );
}

function SortableSet({
  setId,
  name,
  metrics,
  onDrag,
  onDrop,
  onStep,
}: {
  setId: string;
  name: string;
  metrics: Metrics;
  onDrag: (point: { x: number; y: number }) => void;
  onDrop: (point: { x: number; y: number }) => void;
  onStep: (step: -1 | 1) => void;
}) {
  const controls = useDragControls();
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    onStep(event.key === "ArrowUp" ? -1 : 1);
  };
  return (
    <Reorder.Item
      as="div"
      className="relative flex items-center gap-2"
      dragControls={controls}
      dragListener={false}
      onDrag={(_, info) => onDrag(info.point)}
      onDragEnd={(_, info) => onDrop(info.point)}
      value={setId}
      whileDrag={{ scale: 1.02, zIndex: 10 }}
    >
      {/* The row is shown, not followed, while the order is being edited. */}
      <div className="pointer-events-none min-w-0 flex-1" inert>
        <SetRow id={setId} name={name} {...metrics} />
      </div>
      <button
        aria-label={t("library.dragSet", { name })}
        className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-muted-foreground hover:bg-[var(--brand-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:cursor-grabbing"
        onKeyDown={onKeyDown}
        onPointerDown={(event) => controls.start(event)}
        type="button"
      >
        <Icons.drag aria-hidden className="size-5" weight="bold" />
      </button>
    </Reorder.Item>
  );
}
