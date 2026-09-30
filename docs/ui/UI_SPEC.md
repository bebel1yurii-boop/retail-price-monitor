# UI specification — Competitor Price Monitoring PWA

## Product intent
A field-sales PWA for quickly recording competitor prices in retail stores. The interface must minimize typing, work comfortably one-handed, and make sync state obvious.

## Core UX rules
- Mobile-first.
- From Home to price entry in no more than 3 meaningful steps.
- One dominant primary action per screen.
- Large tap targets.
- Sticky primary CTA where useful.
- Clear progress through SKU collection.
- Autosave locally before server sync.
- Offline-first status must always be understandable.
- Avoid decorative UI that slows field work.

## Visual direction
Use the Canva concept as the visual source of truth.

Default visual language:
- light neutral background;
- dark text;
- restrained blue for primary actions;
- green only for success;
- amber for pending/offline;
- red only for errors;
- rounded cards, approx. 12–16 px radius;
- subtle shadows/borders;
- modern enterprise/SaaS appearance;
- minimal clutter.

## Required screens
1. Login / employee identification
2. Home
3. Select retail outlet
4. Select competitor
5. SKU/product list
6. Price entry
7. Offline / pending sync state
8. Sync completed state
9. History
10. Profile
11. Manager/admin summary if the current role supports it

## Navigation
Where relevant, use bottom navigation:
- Головна
- Моніторинг
- Історія
- Профіль

## Home
Show:
- today's progress;
- sync status;
- primary CTA: **Почати моніторинг**;
- any pending locally saved records.

## Store selection
- Search.
- Recently used stores.
- Large touch-friendly rows/cards.
- Minimize additional confirmation steps.

## Competitor selection
- Simple tiles/cards.
- Name + compact visual marker/avatar.
- Real logos are not required unless already available in project assets.

## SKU list
Each product item should support:
- product name;
- pack size;
- category;
- previous/last known price where available;
- completion/status;
- category filtering;
- quick continuation to price input.

## Price entry — highest priority screen
Must contain:
- product name;
- pack size;
- competitor;
- previous/last known price;
- very large numeric price input;
- currency UAH;
- toggle **Промо**;
- optional photo action;
- progress, e.g. **12 із 38 SKU**;
- primary CTA **Зберегти і далі**.

The workflow after saving should make the next SKU immediately actionable.

## Offline-first UI states
Explicitly represent:
- Online
- Offline
- Saved locally
- Pending sync
- Syncing
- Synced
- Sync error

The user should never have to guess whether data has reached the server.

## Reusable components
Prefer reusable components instead of screen-specific duplication:
- AppHeader
- BottomNavigation
- PrimaryButton
- SecondaryButton
- StatusChip
- ProgressBar
- SearchInput
- StoreCard
- CompetitorCard
- ProductCard
- PriceInput
- OfflineBanner
- SyncStatus
- EmptyState
- ErrorState
- LoadingState

Adapt names to the current project conventions rather than forcing this exact naming.

## Responsive acceptance
Verify at minimum:
- 360 × 800
- 390 × 844
- 430 × 932
- desktop sanity check

Desktop is secondary; mobile must be the design priority.

## Implementation constraint
Do not change backend contracts, data model, parsers, or existing business logic solely for visual reasons. If the mockup conflicts with a real functional constraint, preserve function and document the visual deviation.
