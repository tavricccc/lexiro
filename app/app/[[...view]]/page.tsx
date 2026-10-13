/**
 * Every address under /app lands here. The screens themselves are drawn on
 * the client by the view host in the app layout, so this page has nothing of
 * its own to render and never has to be asked for again.
 */
// The page is the same empty shell for every address, so it is built once
// per address and served from the cache rather than rendered per request.
export const dynamic = "force-static";
export const generateStaticParams = () => [{ view: [] }];

export default function Page() {
  return null;
}
