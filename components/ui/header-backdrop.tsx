/** Progressive header veil shared with Novae; text stays above the blur layers. */
export function HeaderBackdrop() {
  return (
    <span
      aria-hidden="true"
      className="header-backdrop"
      data-progressive="true"
    >
      <span data-status-bar-backdrop="" />
      <span data-blur-step="strong" />
      <span data-blur-step="medium" />
      <span data-blur-step="soft" />
    </span>
  );
}
