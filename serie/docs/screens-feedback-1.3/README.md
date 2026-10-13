# Serie 1.3 — browser verification

Actual exported app, fixed test date 13 October 2026, application source `23485a3438d16ea6221dc9c67677523e96c3f660`. Local validation passed 927 tests/53 suites, types/lint, all 57 browser journeys and nine native pixel-tool tests. All browser reports have zero errors and warnings. Native execution is a separate candidate gate and is not established by these browser captures.

- [Compact Home at 390px](01-compact-home-390.png)
- [One duration input at 320px with a 500px usable height](02-compact-duration-320.png)
- [Inline history at 390px](03-inline-history-390.png) and [320px](03-inline-history-320.png)
- [Bulk notes while preserving other details, 320px](06-bulk-notes-320.png)
- [Preserved new-session draft after bulk changes and restart](07-bulk-after-restart.png)

[Machine-readable verification](verification.json) contains all five browser reports and the six repeated first-row reveal measurements. Saved row comparisons verify that toast dismissal does not undo data and bulk edits preserve every unselected session. Input checks include numeric typing, paste, selection/backspace, timezone regression and exact-second preservation. The production and memory-provider exports are separate; no memory provider is enabled in the IPA.
