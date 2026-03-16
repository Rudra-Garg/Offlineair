Screen 1 — Flight Search
Mobile app screen, 390x844px, dark theme. Background #0A0A0F. 
Top: large bold white text "Where are you flying?" with a soft subtitle "Search your flight number". 
Below: a rounded search bar with glass morphism effect, placeholder "e.g. AI101", with a search icon. 
Below that: a "Recent Flights" section header in muted gray, followed by 2 flight cards — each card has dark glass background (#1C1C2E), airline logo placeholder on left, flight number in bold white, route "DEL → BOM" in medium gray, departure time in accent blue (#4A9EFF), and a colored status pill ("On Time" in green). 
Bottom: a glowing blue primary button "Find Flight". 
Overall aesthetic: Flightly app style — dark, premium, lots of breathing room, SF Pro font.

Screen 2 — Pre-flight Download
Mobile app screen, 390x844px, dark theme. Background #0A0A0F.
Top navigation bar with back arrow and title "AI 101 · DEL → BOM" in white.
Center: a large animated circular progress ring in electric blue (#4A9EFF) with percentage in bold white inside. Below the ring, 4 download step rows — each row has a small icon, label in white ("Route & Waypoints", "Speed Profile", "Weather SIGMETs", "Offline Map Tiles"), and a status on the right — either a green checkmark (done), a spinning loader (in progress), or a muted gray dash (pending).
Bottom: a pill-shaped status bar "Downloading... 2 of 4" in muted text, and a disabled gray "Ready to Fly" button that becomes glowing blue when all steps complete.
Dark glass card wrapping the steps. Flightly-style premium dark aesthetic.

Screen 3 — Live Tracking Map
Mobile app screen, 390x844px. Full bleed dark map (Mapbox dark style) as background covering 65% of the screen.
On the map: a glowing curved route line in electric blue (#4A9EFF) from bottom-left to top-right. A white airplane icon with a soft blue glow halo as the current position. Translucent red/orange polygon overlay for a SIGMET zone. Small pin markers for 2 landmarks.
Top: floating pill with flight number "AI 101" on left, and "Live" badge with a pulsing green dot on right. Back arrow top-left.
Bottom sheet (35% height, dark glass #1C1C2E, rounded top corners 24px): 
  - Row 1: three stat chips side by side — "ALT 35,000 ft", "SPD 487 kts", "ETA 1h 24m" each in a dark rounded tile with white value and muted label
  - Row 2: small altitude graph — a smooth white curve showing climb→cruise→descent, with a glowing blue dot at current position
  - Row 3: "CRUISE PHASE" phase badge in blue pill, and a muted gray "Nudge Position" text button on the right.
Premium aviation dark aesthetic, Flightly style.

Screen 4 — Landmark Notification
Mobile app screen, 390x844px. Same live tracking map as background (dark Mapbox, blue route line, airplane icon).
Center-bottom: a bottom sheet modal (not full screen) sliding up, height ~280px, dark glass background #1C1C2E, rounded corners 24px, with a subtle blue top border glow.
Inside the sheet:
  - Top: a colored icon badge (mountain icon in orange circle) aligned left
  - Title: "Crossing the Himalayas" in bold white 20px
  - Subtitle: "Estimated position · 8,848m peak range below" in muted gray
  - A horizontal divider
  - Two stat rows: "Distance from route" → "12 km south" and "Elevation" → "8,848 m"
  - A glowing blue "Got it" dismiss button full width at bottom
Background map slightly dimmed. Flightly-style notification card. Premium, minimal.

Screen 5 — Flight Complete + Sync Prompt
Mobile app screen, 390x844px, dark background #0A0A0F.
Top: large green checkmark icon in a glowing circle. Below: "Flight Complete" in bold white 28px. Subtitle: "AI 101 · DEL → BOM · 2h 07m" in muted gray.
Middle: a summary card (dark glass, rounded 20px) with 4 stat rows — Departed, Landed, Distance, Est. Accuracy (showing "—" until synced).
Below the card: a glowing section with a wifi icon — headline "Sync actual flight data" in white, subtitle "Download real ADS-B track to compare with your estimate" in muted gray.
Two buttons stacked: primary glowing blue "Sync Now", and a ghost button "Skip for now" in muted text.
Bottom: small text "Data available ~1 hour after landing" in very muted gray.
Flightly premium aesthetic, celebratory but clean.

Screen 6 — Comparison View
Mobile app screen, 390x844px. Full bleed dark map (65% height).
On the map: TWO route lines — one electric blue (#4A9EFF) labeled "Estimated", one bright green (#00E676) labeled "Actual". Lines diverge slightly in the middle. Color-coded deviation dots along the estimated line: green dots (< 10km off), amber dots (10–50km), red dots (> 50km). A subtle gradient haze between the two lines showing deviation.
Top: floating pill toggle with two tabs — "Estimated" and "Actual" and "Both" — "Both" currently selected in blue.
Bottom sheet (35% height, dark glass):
  - Title row: "Flight Comparison" bold white left, "Score: 84" in a glowing blue badge right
  - Deviation legend: three colored pills — green "< 10km", amber "10–50km", red "> 50km"
  - Timeline scrubber: thin track with a draggable glowing white thumb, timestamps at each end
  - Phase accuracy row: three small tiles — "Climb 91", "Cruise 82", "Descent 79" each with small circular progress rings
Premium, data-rich, Flightly dark aesthetic.

Screen 7 — Accuracy Report Card
Mobile app screen, 390x844px, dark background #0A0A0F.
Top navigation: back arrow, title "Accuracy Report" in white, share icon top right.
Hero section: large circular score ring (stroke 8px, electric blue arc on dark track) with "84" in bold white 48px inside and "/ 100" in muted gray below. Below ring: "Good Accuracy" label in blue.
Stats grid (2x2 dark glass cards, rounded 16px, gap 12px):
  - "Avg Deviation" → "18.4 km" 
  - "Max Deviation" → "41.2 km"
  - "RMSE" → "21.7 km"
  - "Track Points" → "248"
Phase breakdown section: three horizontal bar rows labeled "Climb", "Cruise", "Descent" with colored fill bars (green/amber) and score values "91", "82", "79" on the right.
Bottom: "AI 101 · DEL → BOM · Mar 14 2026" in muted gray. Glowing blue "Share Report" button.
Flightly premium dark aesthetic, clean data visualization feel.