/**
 * The active storage adapter.
 *
 * To move Rainy onto Supabase later:
 *   1. Write src/data/adapter.supabase.js implementing the same methods
 *      documented in adapter.local.js.
 *   2. Change the import below.
 * Nothing else in the app needs to change.
 */

import { localAdapter } from './adapter.local.js'

export const adapter = localAdapter

export { isPersistent, StorageFullError } from './adapter.local.js'
