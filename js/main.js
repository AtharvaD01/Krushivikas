/* ═══════════════════════════════════════════════════
   KRUSHIVIKAS v2.0 — Application Entry Point
   Bootstraps landing page and dashboard
   ═══════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  console.log(`[KV] ${KV_CONSTANTS.APP_NAME} v${KV_CONSTANTS.APP_VERSION} initialising`);
  KrushiVikasApp.init();
});

const KrushiVikasApp = {

  init() {
    this._bindLanding();
  },

  /* ── Landing page interactions ── */
  _bindLanding() {
    const launchBtn = document.getElementById('launch-btn');
    if (launchBtn) {
      launchBtn.addEventListener('click', () => this.showRoleSelection());
    }

    /* Also allow keyboard */
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const landingPage = document.getElementById('landing-page');
        if (landingPage && !landingPage.classList.contains('hidden')) {
          this.showRoleSelection();
        }
      }
    });
  },


  showRoleSelection() {
    const landing = document.getElementById('landing-page');
    const roles = document.getElementById('role-selection');
    if (!landing || !roles) return;

    landing.style.transition = 'opacity .4s ease, transform .4s ease';
    landing.style.opacity = '0';
    landing.style.transform = 'translateY(-12px)';

    setTimeout(() => {
      landing.classList.add('hidden');
      roles.classList.remove('hidden');
      roles.style.opacity = '0';
      roles.style.transform = 'translateY(12px)';
      requestAnimationFrame(() => {
        roles.style.transition = 'opacity .4s ease, transform .4s ease';
        roles.style.opacity = '1';
        roles.style.transform = 'none';
      });
    }, 400);
  },

  returnToRoles() {
    const roles = document.getElementById('role-selection');
    const dash = document.getElementById('dashboard');
    if (!roles || !dash) return;
    dash.classList.add('hidden');
    roles.classList.remove('hidden');
  },

  /* ── Transition to dashboard ── */
  launchDashboard() {
    const landing   = document.getElementById('landing-page');
    const dash      = document.getElementById('dashboard');

    if (!landing || !dash) return;

    /* Animate landing out */
    landing.style.transition = 'opacity .45s ease, transform .45s ease';
    landing.style.opacity    = '0';
    landing.style.transform  = 'translateY(-20px)';

    setTimeout(() => {
      landing.classList.add('hidden');
      dash.classList.remove('hidden');

      /* Initialise dashboard */
      dashboard.init();

      console.log('[KV] Dashboard launched');
    }, 450);
  },

  /* ── Return to landing ── */
  returnToLanding() {
    const landing = document.getElementById('landing-page');
    const dash    = document.getElementById('dashboard');

    if (!landing || !dash) return;

    dash.classList.add('hidden');
    landing.classList.remove('hidden');
    landing.style.opacity   = '0';
    landing.style.transform = 'translateY(20px)';

    requestAnimationFrame(() => {
      landing.style.transition = 'opacity .4s ease, transform .4s ease';
      landing.style.opacity    = '1';
      landing.style.transform  = 'none';
    });
  },

};

/* ── Wire back-to-landing button (deferred until dashboard exists) ── */
document.addEventListener('click', e => {
  if (e.target.closest('#back-to-landing')) {
    KrushiVikasApp.returnToLanding();
  }
});


document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('role-back')?.addEventListener('click', () => {
    const roles = document.getElementById('role-selection');
    const landing = document.getElementById('landing-page');
    if (!roles || !landing) return;
    roles.classList.add('hidden');
    landing.classList.remove('hidden');
    landing.style.opacity = '1';
    landing.style.transform = 'none';
  });

  document.getElementById('choose-buyer')?.addEventListener('click', () => {
    window.location.href = '/banana-marketplace.html';
  });

  document.getElementById('choose-farmer')?.addEventListener('click', () => {
    window.location.href = '/farmer-portal.html';
  });
});
