/**
 * Routes that are named in more than one place.
 *
 * 題目 is a section of 我的單字 rather than a destination of its own, so the one
 * place that spells that out is here: the tab lives in the URL, and every screen
 * that leads back to the question bank leads to the same address.
 */
export const LIBRARY_QUESTIONS_HREF = "/library?tab=questions";
