I will modify `index.html` to update the "Battle Overview" target cards in the right-side pane.

**Specific Changes:**
1.  **Locate Target Card**: Find the `.target-card` loop in the right pane (around lines 321-340).
2.  **Insert Temporary HP Display**:
    -   Find the HP display line: `<div class="hp">{{p.hpCurrent}}/{{p.hpMax}}</div>` (Line 333).
    -   Find the AC display line: `<div class="small muted" ...>AC {{p.ac}}</div>` (Line 334).
    -   Insert a new `div` between them for Temporary HP.
3.  **Implement Logic & Styling**:
    -   Use `v-if="p.tempHp > 0"` to hide when 0.
    -   Use `v-show` or `<transition>` if smoother toggling is desired, but `v-if` is standard for "hide when 0". Given the "smooth transition animation" request, I will wrap it in a `<transition>` with a CSS class, or simply use Vue's transition system if configured. However, since no global transition classes for this specific case exist, I will use a simple inline style or existing classes, but primarily focus on the structure. The user asked for "smooth transition animation when value changes", which might imply the number counting up/down OR the element sliding in. I'll add a simple CSS transition class for opacity/width.
    -   **Format**: `虚假生命：{{p.tempHp}}`.
    -   **Style**: Inherit font style from `.hp` (bold) or similar. The user said "same font style and color as HP". The `.hp` class has `font-weight: 700`. I will use that.
    -   **Layout**: Add margins/padding to ensure equal spacing.
    -   **Adaptive**: Use `flex-shrink` or `min-width` to ensure it fits. The user wants "priority to compress spacing rather than truncate text". I'll use `white-space: nowrap` and appropriate flex settings.

**Plan details:**
1.  Add a `<style>` block or update `style.css` (if accessible/preferred, but inline style or new class in `index.html` header is easier for small tweaks) to define a transition class if needed. I'll stick to inline styles or standard CSS for simplicity unless complex animation is needed.
2.  Modify the HTML structure in `index.html`.

**Revised HTML snippet plan:**
```html
<div class="hp">{{p.hpCurrent}}/{{p.hpMax}}</div>

<!-- Inserted Temp HP -->
<div v-if="p.tempHp > 0" class="hp" style="margin-left: 8px; font-size: 0.9em; transition: all 0.3s ease;">
    虚假生命：{{p.tempHp}}
</div>

<div class="small muted" style="min-width: 50px; margin-left: 8px;">AC {{p.ac}}</div>
```
*Correction*: The user wants "equal spacing". The current layout uses `margin-left: 8px` on the AC element. I should apply similar spacing.

**Animation**: To support "smooth transition animation", I'll add a standard Vue `<transition>` name if possible, or just rely on the DOM update. "Numerical transition" (counting) is complex to add without a new component, so I'll assume "visual transition of the element appearing/disappearing/changing width" is what's meant, or just the text updating. I will focus on the layout and visibility transition.

**Step-by-step Implementation:**
1.  Edit `index.html`.
2.  Find the `div` with `class="hp"` inside `.target-card`.
3.  Insert the new `div` for Temporary HP.
4.  Apply `v-if`, styling, and flex properties.

*Refining the "Adaptive" requirement*: "When space is insufficient, prioritize compressing spacing".
The container is a flex row (`.row`).
Items: Avatar, Name, Spacer, HP, TempHP, AC, Initiative, Buttons.
The `Spacer` takes up available space.
If I put TempHP between HP and AC, they are all pushed to the right by the spacer.
If the screen is narrow, the Spacer shrinks.
If Spacer is 0, then we need to shrink margins.
Flexbox handles this if I set `flex-shrink: 1` on the margins (not possible directly) or allow wrapping? No, usually we want single line.
I will set `flex-shrink: 0` on the text to prevent truncation, and let the `spacer` absorb the reduction.

**Action**:
Update `index.html` at line 333.