# Conference tracker maintenance

## Submission deadline preference

- The main row date, “Time left” countdown, urgency styling, and default upcoming sort must use the full paper submission deadline (`kind: "paper"`), never an abstract, enrollment, or registration deadline. This applies to official and estimated schedules and every research area.
- When researching or updating conferences, verify the full paper deadline separately from abstract/enrollment dates using official sources. Preserve distinct milestones and their published timezones; do not substitute an earlier prerequisite for a missing paper date or invent a confirmed date.
- Keep earlier required steps visible as secondary dates and in the expanded schedule. Preserve warnings when a required step has closed. Optional next-step sorting may use prerequisites, but must not change the row's paper countdown.
- Calendar exports include only the full paper deadline (`kind: "paper"`), one event per conference. The main export includes bookmarked conferences only, for the selected Upcoming or Closed period, regardless of search or area filters. Individual conference exports also include only the paper deadline.
- Identify special submission rounds and invitation-only stages explicitly. A camera-ready or revision date is not the initial full paper submission deadline. RSS currently has an explicitly labelled invited stage-two paper deadline; retain its required stage-one extended abstract.
- The 60-day “Update needed” reminder still starts before the earliest required submission step so missing official dates can be checked in time.
- Keep these rules when adding venues or refreshing dates through future LLM research. See README.md for the data format and validation workflow.
- Every milestone must retain its exact source URL. Prefer a verified page anchor or text fragment for the relevant section and record its heading in `sourceSection` when checked; never invent anchors. Estimated schedules must link to the source edition, with the link labelled as the estimate basis. Keep one compact source icon beside each displayed date, without nesting links inside row buttons.
