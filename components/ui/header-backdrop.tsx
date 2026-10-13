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
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}
