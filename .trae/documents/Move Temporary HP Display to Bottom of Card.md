I will modify `index.html` to move the Temporary HP display in the combatant card.

**Steps:**
1.  **Locate the code**: Find the combatant card template (`.init-tile`) in `index.html` (lines 150-179).
2.  **Move the element**: 
    - Cut the Temporary HP display line:
      ```html
      <div class="small muted" v-if="p.tempHp > 0" style="color: var(--primary); width: 100%; text-align: right;">剩余虚假生命: {{p.tempHp}}</div>
      ```
      (Currently inside `.init-header`)
    - Paste it to the bottom of the card container, immediately after the button row (`<div class="row">...</div>`).
3.  **Result**: The "Temporary HP" text will appear at the very bottom of each combatant's card in the initiative queue, below the "Set as Current" and "Remove" buttons.

**Verification:**
I will check the code structure to ensure the `div` is correctly placed within the flex container of `.init-tile` but after all other elements.