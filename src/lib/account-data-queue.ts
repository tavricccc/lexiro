import { createMutationQueue } from "./mutation-queue";

/** Account changes and operations spanning both stores must finish in order. */
const queue = createMutationQueue();
export const serializeAccountDataAction = queue.serial;
