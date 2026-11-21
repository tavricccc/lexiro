import "@testing-library/jest-dom/vitest";

// jsdom stubs required for @ui-sdk/core top-layer popups, observers and layout queries.
if (typeof HTMLElement !== "undefined") {
  HTMLElement.prototype.showPopover = function () {};
  HTMLElement.prototype.hidePopover = function () {};
}
if (typeof Element !== "undefined") {
  Element.prototype.getAnimations = () => [];
  Element.prototype.scrollIntoView = function () {};
  Element.prototype.checkVisibility = () => true;
  Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
}
if (typeof document !== "undefined") {
  document.elementFromPoint = () => null;
  document.elementsFromPoint = () => [];
  document.head.append(
    Object.assign(document.createElement("style"), {
      textContent: "[popover] { display: block !important }",
    }),
  );
}
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
