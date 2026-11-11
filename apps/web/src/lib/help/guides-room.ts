import type { Guide } from './types';

/**
 * The Writers Room (addendum 07). Written as a walk-through that two people
 * can follow end to end — a showrunner and one writer — because that is also
 * how the release check (/admin/release-check) tests it.
 */
export const GUIDES_ROOM: ReadonlyArray<Guide> = [
  {
    slug: 'writers-room',
    group: 'rooms',
    title: 'The Writers Room',
    summary: 'Run a room: invite writers, hand out tasks, review what comes back, and work the best of it into the master.',
    sections: [
      {
        heading: 'What the room is',
        body: [
          'A Writers Room is one project shared by a showrunner and the writers they invite. The showrunner keeps the **master** — the agreed script. Writers draft in VC Writer on the desktop and send their drafts in; nothing reaches the master until the showrunner puts it there.',
          'The room lives on the website, under **Writers Room** at the top of vc-writer.com. The writing itself happens in the desktop program, which opens straight onto the right beat from a task.',
        ],
      },
      {
        heading: 'Start a room',
        steps: [
          'Sign in at vc-writer.com and click **Writers Room** at the top of the page.',
          'Choose **Start a new project for the room**, give it a title and a format — or choose **Bring a project from VC Writer** and pick a .vcw file.',
          'Optionally name the room, then press **Start the room**.',
          'Finish the room subscription when asked. The room opens on its **Tasks** board.',
        ],
        tip: 'Bringing a project in copies it into your account; the file on your computer is not changed.',
      },
      {
        heading: 'Ask somebody in',
        steps: [
          'Open the room and go to its people (the names at the top).',
          'Under **Ask somebody in**, type the writer’s email, choose their **Role**, and optionally a **Title** such as Staff Writer.',
          'Press **Send the invitation**. The writer gets an email with a link.',
          'As the writer: open the link, sign in or make an account, and join. The room appears under **Writers Room**.',
        ],
        tip: 'The role is what they may do; the title is what they are called. Changing one never changes the other.',
      },
      {
        heading: 'Hand out a task',
        steps: [
          'On the **Tasks** board, open **+ New task**.',
          'Under **What is it?**, choose **A task** for work not tied to the script, or **Part of the script** and pick the episode, act, scene or beat.',
          'Say **What is being asked**, choose a **Priority**, and optionally a **Wanted by** date.',
          'In **Writers** on the right, tick one writer, several, or **Everyone**. Several writers each get their own task, linked as a group.',
          'Press **Assign** (or **Assign to 2 writers**). The task appears in **To Do**.',
        ],
      },
      {
        heading: 'Assign from the script',
        steps: [
          'In the room’s menu, open **Script**. The script reads down the left.',
          'Highlight the words you want rewritten. The **Assign** panel on the right shows the passage.',
          'Or press **Assign this scene** or **Assign this beat** to give out the whole of it.',
          'Say what is being asked, tick the writers, and press **Assign**.',
          'Open the task on the board: it shows the passage as it read when you assigned it.',
        ],
        tip: 'Writers can read the script here too; only the showrunner sees the Assign panel.',
      },
      {
        heading: 'Write it (the writer)',
        steps: [
          'Open the task on the board and press **Start draft**. It moves to **In Progress**.',
          'Press **Open in VC Writer**. The desktop program opens on the task’s beat.',
          'Write. Press **View master** to read the showrunner’s current version beside your draft.',
          'Press **Submit** at the top of the window. The task is already chosen; send it. It moves to **Awaiting Review**.',
          'Press **Back to Writer’s Room** to return to the board.',
        ],
        tip: 'If the master has moved on since you started, the bar says so. Your draft is kept; read the new master before you submit.',
      },
      {
        heading: 'Review it (the showrunner)',
        steps: [
          'Open the task in **Awaiting Review**.',
          'Read the draft. Press **Approve** to accept it, **Return with notes** to send it back with what to change, or **Not taken** to close it without using it.',
          'A returned task goes back to the writer as **Needs revision**; they revise and press **Submit** again, and the new version is listed beside the old.',
        ],
      },
      {
        heading: 'Work it into the master',
        steps: [
          'On an approved task, press **Integrate into the master**.',
          'Select the words you want from the writer’s draft on one side, and the place in the master on the other.',
          'Choose **Replace selection**, **Insert before**, **Insert after** or **Delete master selection**. Repeat for as many passages as you want.',
          'Press **Preview diff** to see exactly what changes. **Undo last** takes back a step.',
          'Press **Commit new beat version**. The master gets a new version, and the writer is credited.',
        ],
        tip: 'If somebody changed the master while you worked, the commit is refused rather than overwriting. Press **Start again from the current master**.',
      },
      {
        heading: 'Close, cancel and reopen',
        steps: [
          'On any task, press **Close task** or **Cancel task**, say why, and confirm.',
          'Find it under **Archive** in the **Workflow** menu, and press **Reopen**, saying why. It returns to the board.',
          'Open the task’s **History** to see every step recorded, with who did it and why.',
        ],
      },
      {
        heading: 'Asking to revise finished work (the writer)',
        steps: [
          'Open one of your approved or integrated tasks and press **Request permission to revise**.',
          'Say why, and press **Ask the showrunner**.',
          'As the showrunner: open **Permission requests** in the **Workflow** menu and press **Grant — make a revision task** or **Deny**.',
        ],
      },
      {
        heading: 'Reports',
        steps: [
          'Press **Export tasks** above the board.',
          'Choose what to include and how to group it — by writer, status or, in a series, by episode.',
          'Press **Print / Save as PDF**.',
        ],
        tip: 'A writer’s report shows only their own tasks.',
      },
    ],
    related: ['getting-started', 'the-workspace'],
  },
];
