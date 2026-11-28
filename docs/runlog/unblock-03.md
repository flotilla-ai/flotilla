# unblock-03 web composer cards

Implemented the remaining composer-card web wiring on existing APIs: `/btw` creates and starts a fresh subagent side thread; request cards render approval option buttons plus Later/Dismiss/Dismiss all; `approval.updated` frames remove synced cards; provider-error cards offer Retry with an optional model; composer command parsing and nested tool-call trees are fixture-tested. `/plan` uses the existing runner plan gate: the typed prefix is sent unchanged and its plan approval appears as a request card.

Focused verification: web typecheck passes; helper tests cover command parsing and nested tool parentage. Full browser interaction remains unverified in this unit.
