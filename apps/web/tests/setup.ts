import "@testing-library/jest-dom/vitest";

// jsdom has no media queries: a wide viewport that asks for less motion.
window.matchMedia ??= ((query: string) => ({ matches: query.includes("reduced-motion"), media: query, addEventListener() {}, removeEventListener() {} })) as never;
