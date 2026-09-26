/**
 * SNAPSHOT SCHEMA — the identity and version facts shared by two layers.
 *
 * WHAT THIS OWNS
 *   The snapshot format version, and how a snapshot is uniquely identified.
 *
 * WHAT THIS MUST NEVER DO
 *   Contain domain logic. There is no RS here, no ranking, no comparison —
 *   only a version number and a key format.
 *
 * WHY IT LIVES IN config/ RATHER THAN IN THE ENGINE OR THE STORE
 *   Both layers need these facts, and neither may import the other. The
 *   engine stamps the version onto snapshots it builds; the store uses the
 *   version to discard records from an older shape, and the key to address
 *   them. If the key format lived in the engine, the data layer would have to
 *   reach up into it — which the architecture forbids, and which the boundary
 *   lint correctly rejected when this was first written that way.
 *
 *   config/ is the dependency-free leaf precisely for facts like these:
 *   things every layer must agree on and no layer should own.
 */

/** Bump when the snapshot's shape changes. Snapshots are reproducible from
 *  bars, so a version change CLEARS them rather than migrating — unlike user
 *  positions, which are not reproducible and must always be migrated. */
export const SNAPSHOT_VERSION = 1;

/** Stable identity for one (universe x window x month). */
export function snapshotKey(snapshot) {
  return `${snapshot.universeKey}:${snapshot.lookbackMonths}:${snapshot.monthKey}`;
}
