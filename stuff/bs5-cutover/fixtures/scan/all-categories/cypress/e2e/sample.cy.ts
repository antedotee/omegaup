describe('sample', () => {
  it('toggles', () => {
    cy.get('[data-toggle="collapse"]').click();
    cy.get('[data-toggle-layout-sidebar]').click();
  });
});
