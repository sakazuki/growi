// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })


Cypress.Commands.add('getByTestid', (selector, options?) => {
  return cy.get(`[data-testid=${selector}]`, options);
});

Cypress.Commands.add('login', (username, password) => {
  cy.session(username, () => {
    cy.visit('/page-to-return-after-login');
    cy.getByTestid('tiUsernameForLogin').type(username);
    cy.getByTestid('tiPasswordForLogin').type(password);
    cy.getByTestid('btnSubmitForLogin').click();
  });
});

Cypress.Commands.add('collapseSidebar', (isCollapsed) => {
  const sidebarStatus = window.localStorage.getItem('sidebarStatus');
  if (sidebarStatus != null) {
    const { isSidebarCollapsed } = JSON.parse(sidebarStatus);

    if (isSidebarCollapsed === isCollapsed) {
      return;
    }
  }

  const isGrowiPage = Cypress.$('body.growi').length > 0;
  if (!isGrowiPage) {
    cy.visit('/page');
  }

  cy.getByTestid('grw-contextual-navigation-sub').then(($contents) => {
    const isCurrentCollapsed = $contents.hasClass('d-none');
    // toggle when the current state and isCoolapsed is not match
    if (isCurrentCollapsed !== isCollapsed) {
      cy.getByTestid("grw-navigation-resize-button").click({force: true});

      // wait until saving UserUISettings
      // eslint-disable-next-line cypress/no-unnecessary-waiting
      cy.wait(1500);
    }
  });

  window.localStorage.setItem('sidebarStatus', JSON.stringify({
    isSidebarCollapsed: isCollapsed,
  }));
});
