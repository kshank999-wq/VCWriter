# Addendum 44: Licences given rather than bought

From Ken: *in Writer itself, I want giveaway licenses for academic purposes or
a master license for myself that I can run it on as many computers as I
need, so I can have it on all my computers.*

## 1. Two kinds

| Kind | Computers | Ends | For |
| --- | --- | --- | --- |
| **Academic** | a set number, 2 unless said otherwise, up to 50 | on a date (a year by default) or never | a school, a class, a teacher, a student |
| **Master** | **any number** | never | the owner's own |

A bought licence (`purchase`) is unchanged: 2 computers, and an expiry only
when a subscription renews it.

## 2. One record, one new question

A given licence is an **ordinary `licenses` row behind a $0 order**. That is
how a licence issued by hand had always been kept, so activation, signed
downloads, the desk's read-only rule and the account page read it with no
second path. Migration 0069 adds three columns:

- `grant_kind`: `purchase`, `academic` or `master`. It is text with a check,
  for 0060's reason.
- `granted_to`: who it is for.
- `granted_by`: the administrator who issued it.

What differs is how many computers a licence covers. `seatLimit` in
`entities/commerce.ts` answers it, in one place: null (any number) for a
master licence, `maxActivations` otherwise. `isActivationSlotAvailable` and
`summariseActivations` read it.

A master row keeps the ordinary seat count, and nothing reads it. No large
number stands in for "unlimited", so nothing can compare against one.

## 3. Issuing

**Admin → Licenses** (`/admin/licenses`) has the form and the list:

- Kind, email, who it is for; for academic, the number of computers and the
  end date.
- The refusal under the form is `licenseGrantRefusal`. The route asks it
  again.
- The account is found by email, or made for it, exactly as a checkout without
  a sign-in does. The recipient signs in at vc-writer.com with an emailed link
  and the licence is already there.
- The `license_granted` email carries the serial and how to start. A failed
  send is reported and fails nothing: the serial is on the account page.
- From the list: **Suspend** or **Restore** a given licence, and **Extend a
  year** on an academic one.
- A bought licence is never changed from here. Stripe and the support tools
  own those.

## 4. What the writer sees

- **Account page**: the card says *Master license* or *Academic license*.
  - Master: "on any number of computers".
  - Academic: who it is for and when it ends.
- **Devices**: a master licence has no seat to free, and the line says so.
- **Desk**: when an academic licence ends, the read-only notice says *your
  academic licence ended* and asks for it to be extended. It does not say
  *subscription* or *renew*. `/api/licenses/standing` now sends `grant`, and
  `DeskStanding` keeps it.
- An account holding both a subscription and a master licence is heard as the
  master licence: of two live licences, the one that never ends answers.

## 5. Ken's own

Ken's existing licence (`VCW-W7N2A-…`, a $0 order from 19 October) was turned
into the master licence on the live project when 0069 was applied. This was a
data change, not part of the migration file, because a migration must not name
a generated id. Every computer he signs in on now activates on it.

Notes needs nothing for him. His first note predates 30 September, so his
account reads `included` (addendum 27 §14.1): the phone sends and syncs
without a subscription.
