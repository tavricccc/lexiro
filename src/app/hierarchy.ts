/**
 * The screen a path is drawn on. A word opens as a sheet over its set, so
 * both paths are one screen and moving between them does not re-enter it.
 */
export const screenKey = (pathname: string) => pathname.replace(/^(\/app\/sets\/[^/]+)\/words\/[^/]+$/, "$1");
