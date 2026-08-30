# Demo Script: AGV Yard Map + Unified Incident Timeline

Every step below was checked against the actual component code, not assumed. Timings are a guide, adjust to your own pacing.

---

## Known issue to fix before you present

The Yard Map shows this hint text: *"Double-click any of the highlighted AGVs, which will take you to the incident queue page."*

This is wrong about the gesture. The real behavior (`YardMapVisualizer.tsx`) is a **single click** on an AGV that has an active incident, which both selects that AGV and navigates you to the Incident Queue page. There is no double-click handler anywhere in the frontend, so if you double-click live, nothing happens and it will look broken on stage.

Fix the hint text to say "Click" instead of "Double-click" before you demo this, or the audience will watch you double-click, get nothing, then have to click once anyway.

---

## Part 1: AGV Yard Map ("PAGE 1: REAL-TIME AGV YARD MAP VISUALIZER")

**Say:** "This is the live view of the Tuas yard. Every AGV you see here is a real vehicle, positioned from live telemetry, not a mockup."

1. **Point at the map.** Vehicles are drawn at their real coordinates, with a velocity arrow when moving.
2. **Point at the right-side Telemetry Roster.** Say: "Every vehicle's state, speed, battery, and any active fault register, live here." Use the search box and the ALL / FAULT / MOVING / LOW_BATT filter to show the roster narrowing down, e.g. click **FAULT** and say "this shows only the vehicles currently in an error state."
3. **Use the time scrubber / playback controls** at the top. Say: "This isn't just a snapshot, we can scrub back through recent history," and press play briefly to show vehicles actually moving.
4. **The key moment:** click on an AGV that is visually highlighted (has an active incident). Say: "Clicking a vehicle that's flagged with an incident takes us straight into that incident's investigation, no separate lookup step." The app will switch you to the Incident Queue page with that incident already selected.
5. **Click "Sync Database"** if you want to show it's pulling live data on demand, not cached.

**Do not** click an AGV with no fault and expect navigation. Clicking a healthy AGV only selects it in the roster; it will not change pages, because it has no `activeIncidentId` to route to. If you want to demo that distinction, click a healthy AGV first ("selecting it just highlights it here") then a faulted one ("but this one has an incident, so it takes us there").

---

## Part 2: Unified Incident Timeline ("PAGE 2: UNIFIED INCIDENT TIMELINE")

**Say:** "Every incident across the whole terminal shares one time axis here, so a controller can see everything happening at once instead of switching views."

1. **Point at the density bars.** Say: "These show how many incidents started in each time bucket, stacked by severity, this is what stays readable even if there are hundreds of incidents."
2. **Point out the two marker shapes** on the main track:
   - **Diamond** = a correlated incident (2 or more alerts grouped together).
   - **Hollow circle** = a singleton, one alert that didn't match anything else.
   Say: "The shape alone tells you whether this is a coordinated failure or a one-off."
3. **Point at any dashed vertical marker** if one is visible. Say: "Safety trips bypass priority scoring entirely and always show up distinctly, they're never buried under routine alerts."
4. **Click a diamond marker (a correlated incident).** This opens the "20s split" bracket capsules beneath the track for that incident, and populates the right-hand inspector panel with:
   - The incident name and primary sector.
   - The problem type label, if Stage 1 classified one.
   - A **"N Correlated Alerts"** tag, which only appears when there are 2 or more alerts (a singleton correctly shows no such tag, since there's nothing to correlate).
5. **Point at the "Resolve Incident" button** in the inspector panel. Say: "This is where a controller would act on it," without necessarily clicking it live unless you want to show the follow-on flow.
6. **Change the Timestamp** using the timestamp control to show the whole timeline is scrubbable, the same underlying time state as the Yard Map page.

---

## Closing line connecting both pages

"These two views are two lenses on the same live data, one spatial, one temporal, and clicking an incident on either one takes you into the same investigation, run by the same multi-agent pipeline."
