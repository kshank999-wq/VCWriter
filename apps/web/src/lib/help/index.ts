import type { Guide, GuideGroup } from './types';
import { GUIDES_START } from './guides-start';
import { GUIDES_SCRIPTS } from './guides-scripts';
import { GUIDES_PROSE } from './guides-prose';
import { GUIDES_PLANNING } from './guides-planning';
import { GUIDES_FINISHING } from './guides-finishing';

export type { Guide, GuideGroup, GuideSection, ShotPath } from './types';

/** Every guide, in the order the index lists them. */
export const GUIDES: ReadonlyArray<Guide> = [
  ...GUIDES_START,
  ...GUIDES_SCRIPTS,
  ...GUIDES_PROSE,
  ...GUIDES_PLANNING,
  ...GUIDES_FINISHING,
];

export const GROUPS: ReadonlyArray<{ id: GuideGroup; title: string; lede: string }> = [
  { id: 'start', title: 'Getting started', lede: 'Install, make a project, find your way around, and bring in notes from your phone.' },
  { id: 'modules', title: 'Modules', lede: 'What each kind of project does, and how to write in it.' },
  { id: 'rooms', title: 'Rooms and tools', lede: 'Research, planning, checking, hearing it back and finishing the book.' },
];

export const guideBySlug = (slug: string): Guide | undefined => GUIDES.find((guide) => guide.slug === slug);

export const guidesIn = (group: GuideGroup): Guide[] => GUIDES.filter((guide) => guide.group === group);
