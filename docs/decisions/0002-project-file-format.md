# 0002 — One versioned, platform-neutral project document

**Status:** accepted, 5 September 2026
**Context:** spec §3.1 (a project created on Windows opens on macOS without
losing structure, links, manuscript or metadata), §14 (keep the project format
platform-neutral), §17 (updates preserve projects, with rollback protection),
§19 (convert before implementing, not after).

## Decision

A project is a single JSON document validated by the schema in
`packages/domain/src/project-file.ts`. It carries a `formatVersion` and an
explicit, contiguous migration chain. The same shape maps onto Supabase rows,
so the local file and the synced copy are one model rather than two.

## Why one document

- Structure, research, links and manuscript are read together and edited
  together. Splitting them across files invites a half-saved project, which
  §15 forbids outright.
- Portability becomes a property of the format rather than a hope about two
  independent implementations agreeing.
- Snapshots are trivial: a recovery point is a copy of one file.

## Why an explicit version and migration chain

Silent tolerance of unknown shapes is how data goes missing during an upgrade.
So:

- Opening a file written by an **older** build runs the migrations in order,
  after writing a `pre_migration` snapshot that is never pruned.
- Opening a file written by a **newer** build is refused with a message telling
  the writer to update. Reading it partially and saving over it would discard
  whatever the newer build added.
- Validation failures report which fields failed rather than returning a
  partial project.

## Consequences

- Very large projects eventually need incremental loading; §15 already calls
  for not pulling every rich object into the editor at once. The document shape
  does not prevent that — beats hold their own manuscript, so a lazy read is a
  change to the loader, not to the format.
- Every schema change needs a migration entry, even a trivial one. That is the
  point: the chain is the record of what changed and how old files reach the
  present.
