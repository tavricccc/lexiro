export function createSourceRef(index: number, childIndex?: number): string {
  const sourceRef = `source-${index + 1}`
  return childIndex === undefined ? sourceRef : `${sourceRef}-${childIndex + 1}`
}
