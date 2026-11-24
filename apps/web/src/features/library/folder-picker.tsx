import { useMemo, useState } from "react";
import { Books, CaretRight, FolderSimple, FolderSimplePlus } from "@phosphor-icons/react";
import type { Folder } from "@lexiro/contract";
import { Button, ListGroup, Sheet, cn } from "design-kit";
import { LIBRARY_ROOT, folderTree } from "./folders";
import { FolderNameDialog, TreeRow } from "./folder-dialogs";

/**
 * Picks where something goes in the real folder tree: 我的單字 at the top,
 * nested folders indented beneath it. With `canCreate`, any level can make a
 * new folder there, which is picked right away.
 */
export function FolderPickerField({
  folders,
  value,
  onChange,
  canCreate = false,
  disabled = false,
  label = "位置",
}: {
  folders: Folder[];
  value: string | null;
  onChange: (folderId: string | null) => void;
  canCreate?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState<{ type: "create"; parentId: string | null; order: number; parentName?: string } | null>(null);
  const tree = useMemo(() => folderTree(folders), [folders]);
  const current = tree.get(value) ? value : null;
  const display = current ? tree.path(current) : LIBRARY_ROOT;

  return (
    <div className="grid gap-1.5">
      <span className="px-1 text-sm font-medium text-ink-muted">{label}</span>
      <button
        aria-label={`${label}：${display}`}
        className={cn(
          "flex min-h-11 w-full items-center gap-3 rounded-tile border border-line bg-surface px-4 py-2.5 text-left outline-none",
          "transition-[background-color,border-color,scale] duration-[var(--motion-control)] ease-[var(--ease-move)]",
          "hover:bg-surface-raised active:scale-[var(--motion-card-press-scale)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-40",
        )}
        disabled={disabled}
        onClick={() => setOpen(true)}
        type="button"
      >
        <FolderSimple aria-hidden className="size-5 shrink-0 text-ink-muted" weight="fill" />
        <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium text-ink">{display}</span>
        <CaretRight aria-hidden className="size-4 shrink-0 text-ink-faint" weight="bold" />
      </button>

      <Sheet onOpenChange={setOpen} open={open} title={`選擇${label}`}>
        <div className="grid gap-4">
          <ListGroup label={`選擇${label}`}>
            <TreeRow
              checked={current === null}
              depth={0}
              disabled={disabled}
              icon={<Books weight="duotone" />}
              label={LIBRARY_ROOT}
              onSelect={() => { onChange(null); setOpen(false); }}
              trailing={canCreate ? (
                <Button
                  aria-label={`在「${LIBRARY_ROOT}」新增資料夾`}
                  disabled={disabled}
                  onClick={() => setCreating({ type: "create", parentId: null, order: tree.children(null).length, parentName: LIBRARY_ROOT })}
                  size="icon-sm"
                  title="在此新增資料夾"
                  variant="ghost"
                >
                  <FolderSimplePlus />
                </Button>
              ) : undefined}
            />
            {tree.flat.map(({ folder: entry, depth }) => (
              <TreeRow
                checked={current === entry.id}
                depth={depth + 1}
                disabled={disabled}
                icon={<FolderSimple weight="fill" />}
                key={entry.id}
                label={entry.name}
                onSelect={() => { onChange(entry.id); setOpen(false); }}
                trailing={canCreate ? (
                  <Button
                    aria-label={`在「${entry.name}」新增資料夾`}
                    disabled={disabled}
                    onClick={() => setCreating({ type: "create", parentId: entry.id, order: tree.children(entry.id).length, parentName: tree.path(entry.id) })}
                    size="icon-sm"
                    title="在此新增子資料夾"
                    variant="ghost"
                  >
                    <FolderSimplePlus />
                  </Button>
                ) : undefined}
              />
            ))}
          </ListGroup>
        </div>
      </Sheet>

      <FolderNameDialog
        mode={creating}
        onClose={() => setCreating(null)}
        onCreated={(created) => {
          onChange(created.id);
          setOpen(false);
        }}
      />
    </div>
  );
}
