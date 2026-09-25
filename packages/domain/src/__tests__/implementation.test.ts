import { describe, expect, it } from 'vitest';
import { createProjectFile, parseProjectFile, serializeProjectFile } from '../project-file.js';
import type { ProjectFile } from '../project-file.js';
import { addChoice, addElement, removeElement, updateElement } from '../narrative.js';
import {
  fingerprintOf,
  implementationCounts,
  implementationOverview,
  implementationStatus,
} from '../implementation.js';
import { implementationBindingSchema } from '../entities/implementation.js';
import type { ImplementationBinding } from '../entities/implementation.js';
import { newId } from '../ids.js';
import type { ImplementationBindingId } from '../ids.js';

/**
 * Addendum 25 §2: VC Writer keeps what Game Studio writes, and reads how far
 * each authored thing has been built without storing a status anywhere.
 */

const game = (): ProjectFile => createProjectFile({ title: 'The Sunken Vault', format: 'game' });

const bind = (
  file: ProjectFile,
  sourceType: string,
  sourceId: string,
  record: unknown,
  extra: Partial<ImplementationBinding> = {},
): ProjectFile => {
  const at = new Date().toISOString();
  const binding = implementationBindingSchema.parse({
    id: newId<ImplementationBindingId>(),
    projectId: file.project.id,
    sourceType,
    sourceId,
    engine: 'godot',
    target: `res://scenes/${sourceId}.tscn`,
    sourceHash: fingerprintOf(record),
    complete: true,
    createdAt: at,
    updatedAt: at,
    ...extra,
  });
  return { ...file, implementationBindings: [...file.implementationBindings, binding] };
};

describe('the file keeps what Game Studio writes', () => {
  it('carries bindings through a save and a load unchanged', () => {
    const { file, element } = addElement(game(), { name: 'The Vault Door' });
    const bound = bind(file, 'element', element.id, element);
    const saved = serializeProjectFile(bound);
    const reopened = parseProjectFile(JSON.parse(saved));
    expect(reopened.implementationBindings).toEqual(bound.implementationBindings);
    // Everything but the moment of the save comes back exactly.
    const { savedAt: _first, ...before } = JSON.parse(saved);
    const { savedAt: _second, ...after } = JSON.parse(serializeProjectFile(reopened));
    expect(after).toEqual(before);
  });

  it('opens an older file with no bindings at all', () => {
    const { implementationBindings: _gone, ...older } = JSON.parse(serializeProjectFile(game()));
    expect(parseProjectFile(older).implementationBindings).toEqual([]);
  });

  it('keeps a binding of a kind this build does not know, and reads it as nothing', () => {
    // A newer Game Studio binding something VC Writer has not heard of yet —
    // an engine and a kind that no enum here lists.
    const file = bind(game(), 'navmesh_volume', 'vol-17', { id: 'vol-17' }, { engine: 'my-own-engine' });
    const reopened = parseProjectFile(JSON.parse(serializeProjectFile(file)));
    expect(reopened.implementationBindings).toHaveLength(1);
    expect(reopened.implementationBindings[0]!.engine).toBe('my-own-engine');
    expect(implementationOverview(reopened)).toEqual([]);
  });
});

describe('implementation status is a reading', () => {
  it('reads unbound, partial and implemented', () => {
    let { file, element } = addElement(game(), { name: 'The Vault Door' });
    expect(implementationStatus(file, 'element', element.id)).toBe('unbound');
    const partial = bind(file, 'element', element.id, element, { complete: false });
    expect(implementationStatus(partial, 'element', element.id)).toBe('partial');
    file = bind(file, 'element', element.id, element);
    expect(implementationStatus(file, 'element', element.id)).toBe('implemented');
  });

  it('reads needs update the moment the writing changes after it was built', () => {
    const made = addElement(game(), { name: 'The Vault Door' });
    const file = bind(made.file, 'element', made.element.id, made.element);
    const edited = updateElement(file, made.element.id, { note: 'The door is now a portcullis.' });
    expect(implementationStatus(edited, 'element', made.element.id)).toBe('needs_update');
  });

  it('does not call a record changed when only its timestamps moved', () => {
    const made = addElement(game(), { name: 'The Vault Door' });
    const file = bind(made.file, 'element', made.element.id, made.element);
    const touched = {
      ...file,
      narrativeElements: file.narrativeElements.map((one) => ({ ...one, updatedAt: '2030-01-01T00:00:00.000Z' })),
    };
    expect(implementationStatus(touched, 'element', made.element.id)).toBe('implemented');
  });

  it('reads conflict when the writing it was built from is gone', () => {
    const made = addElement(game(), { name: 'The Vault Door' });
    const file = removeElement(bind(made.file, 'element', made.element.id, made.element), made.element.id);
    expect(implementationStatus(file, 'element', made.element.id)).toBe('conflict');
    expect(implementationOverview(file)).toContainEqual({
      sourceType: 'element', sourceId: made.element.id, status: 'conflict',
    });
  });

  it('counts every bindable record, choices included', () => {
    const a = addElement(game(), { name: 'Arrival' });
    const b = addElement(a.file, { name: 'The Fork' });
    const c = addChoice(b.file, { elementId: a.element.id, text: 'Take the lantern', toElementId: b.element.id });
    const file = bind(c.file, 'choice', c.choice.id, c.choice);
    expect(implementationCounts(file)).toEqual({ unbound: 2, partial: 0, implemented: 1, needs_update: 0, conflict: 0 });
  });
});

describe('fingerprintOf', () => {
  it('ignores key order and changes with content', () => {
    expect(fingerprintOf({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(fingerprintOf({ b: [1, { d: 3, c: 2 }], a: 1 }));
    expect(fingerprintOf({ a: 1 })).not.toBe(fingerprintOf({ a: 2 }));
    expect(fingerprintOf({ a: 1, updatedAt: 'x' })).toBe(fingerprintOf({ a: 1, updatedAt: 'y' }));
  });
});
