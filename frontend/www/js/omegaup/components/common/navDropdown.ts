// Toggle attributes for the navbar's BNavItemDropdowns.
//
// The toggle stays an `<a href="#" role="button">` (as under Bootstrap 4) so
// the `a[data-nav-*]` Cypress selectors keep matching and BButton's Enter/Space
// handling (which only runs for `href="#"`) keeps the toggle keyboard
// operable. Bootstrap 4's dropdown plugin cancelled the `#` navigation; BVN
// does not, so the click handler does, otherwise the hash routing in arena
// pages would see an empty hash.
export function navToggleAttrs(hook?: string): Record<string, unknown> {
  return {
    href: '#',
    role: 'button',
    ...(hook ? { [hook]: '' } : {}),
    onClick: (event: Event) => event.preventDefault(),
  };
}
