// src/ui/title.mjs -- title screen.
//
// Renders the game title, primary Start/Continue button, a best-score stub,
// a settings cog, and an Insect Farm button. Buttons are >=48px hit targets
// and carry `data-testid` attributes per the Data-testid convention.

import { setState } from '../state.mjs';
import { hasProgress } from '../storage.mjs';

// Continue only when there's progress to continue (a saved setting such as
// mute alone doesn't count).
function hasSave() {
  return hasProgress();
}

export function renderTitle(root) {
  if (!root) return;
  root.innerHTML = '';

  const screen = document.createElement('div');
  screen.className = 'title-screen';

  const heading = document.createElement('h1');
  heading.textContent = 'Touch Grass';
  screen.appendChild(heading);

  const best = document.createElement('p');
  best.className = 'best';
  best.textContent = 'Best: --';
  screen.appendChild(best);

  const actions = document.createElement('div');
  actions.className = 'actions';

  const continueMode = hasSave();
  const primary = document.createElement('button');
  primary.type = 'button';
  primary.className = 'btn primary';
  if (continueMode) {
    primary.textContent = 'Continue';
    primary.setAttribute('data-testid', 'btn-continue');
  } else {
    primary.textContent = 'Start';
    primary.setAttribute('data-testid', 'btn-start');
  }
  primary.addEventListener('click', () => {
    setState('playing');
  });
  actions.appendChild(primary);

  const secondaryRow = document.createElement('div');
  secondaryRow.className = 'secondary-row';

  const settingsBtn = document.createElement('button');
  settingsBtn.type = 'button';
  settingsBtn.className = 'btn icon';
  settingsBtn.setAttribute('data-testid', 'btn-settings');
  settingsBtn.setAttribute('aria-label', 'Settings');
  settingsBtn.textContent = '\u2699';   // gear icon
  settingsBtn.addEventListener('click', () => {
    setState('settings');
  });
  secondaryRow.appendChild(settingsBtn);

  const farmBtn = document.createElement('button');
  farmBtn.type = 'button';
  farmBtn.className = 'btn';
  farmBtn.setAttribute('data-testid', 'btn-farm');
  farmBtn.setAttribute('aria-label', 'Insect Farm');
  farmBtn.textContent = 'Insect Farm';
  farmBtn.addEventListener('click', () => {
    setState('farm');
  });
  secondaryRow.appendChild(farmBtn);

  actions.appendChild(secondaryRow);
  screen.appendChild(actions);
  root.appendChild(screen);
}
