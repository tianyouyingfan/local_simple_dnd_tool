I will implement the Temporary HP feature with the following steps:

1.  **Update State Management (`js/modules/state.js`)**:
    *   Add `tempHpInput` to the `ui.hpEditor` object to track the input value in the UI.

2.  **Update HP Logic (`js/modules/hp-status.js`)**:
    *   Modify `applyHPDelta` to handle damage priority: Temporary HP first, then Real HP.
    *   Add `setTempHp(participant, amount)` function to set temporary HP.
    *   Update `openHPEditor` to reset the temporary HP input field when opening the editor.

3.  **Update UI (`index.html`)**:
    *   **Initiative Tracker**: Display "Remaining Temporary HP: X" for participants who have it.
    *   **HP Editor Modal**: Add an input field and a "Set Temporary HP" button to the existing HP editor.

4.  **Verification**:
    *   I will verify the changes by simulating setting temporary HP and applying damage to ensure the logic works as expected (Temp HP absorbs damage before Real HP).