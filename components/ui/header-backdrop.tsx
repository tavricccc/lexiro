/** Progressive header veil shared with Novae; text stays above the blur layers. */
export function HeaderBackdrop({
  contained = false,
}: { contained?: boolean } = {}) {
  return (
    <span
      aria-hidden="true"
      className="header-backdrop"
      data-progressive="true"
      style={contained ? { left: 0, right: 0 } : undefined}
    >
      <span data-status-bar-backdrop="" />
      <span data-blur-step="strong" />
      <span data-blur-step="medium" />
      <span data-blur-step="soft" />
    </span>
  );
}
