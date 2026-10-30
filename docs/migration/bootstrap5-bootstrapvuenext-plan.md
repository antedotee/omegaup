# Bootstrap 4 to 5 and BootstrapVue to BootstrapVueNext migration

This document tracks the staged migration of the omegaUp frontend from Bootstrap 4
plus BootstrapVue 2 (Vue 2) to Bootstrap 5 plus BootstrapVueNext, routed through Vue 3
compatibility mode. The work ships as a stack of reviewable pull requests. Each PR
builds on the previous one and ends in a green state (install, Jest, webpack build).

## Why the order is what it is

BootstrapVue 2 runs only on Vue 2. BootstrapVueNext requires Vue 3. BootstrapVueNext
targets Bootstrap 5. That chain fixes the sequence. Vue 3 (compat) comes first, then the
component library swap, then the Bootstrap 5 CSS cutover. Compat mode suppresses the Vue 3
migration warnings so unrelated application behavior is not rewritten in the same pass.

## Starting point (this PR)

Baseline captured on the branch `bs5/01-baseline-tooling`, verified green:

- Node 24 (the `engines` field already requires `>=24`).
- `yarn install` with the committed lockfile.
- `git submodule update --init --recursive` (pagedown and the other `third_party`
  submodules are required for the Jest suite to resolve).
- `yarn test` (frontend Jest): 193 suites pass, 927 tests pass, 3 skipped.
- `yarn build-development-frontend` (webpack): succeeds.

The current stack is Vue 2.7.16, Bootstrap 4.6.0, BootstrapVue 2.21.2,
`vue-property-decorator` 8, `vuex` 3 with `vuex-class`, and `@vue/test-utils` 1.

## Surface area (measured on `main`)

- 274 files import `vue-property-decorator` (nearly every component).
- 103 `new Vue(...)` entry points.
- 267 `.vue` single-file components.
- 44 files import `bootstrap-vue`; 37 `.vue` files use `<b-*>` components.
- 19 Jest test files import `bootstrap-vue`.
- One `v-b-tooltip` directive usage. A large set of `b-icon-*` icons, which
  BootstrapVueNext does not ship. Those map to an external icon library.

## The stacked PRs

1. **Baseline and tooling (this PR).** Document the verified green starting point and
   the plan. No source change.
2. **Vue 3 compatibility runtime.** Move to the Vue 3 migration build with compat mode
   on. Migrate the class-component runtime (`vue-property-decorator`, `vuex-class`) and
   the Jest / `@vue/test-utils` runtime. BootstrapVue 2 stays in place. Gate: full Jest
   suite green under compat.
3. **BootstrapVueNext swap, part 1.** Replace `bootstrap-vue` with `bootstrap-vue-next`
   in the user, common, admin, teams, and libinteractive families.
4. **BootstrapVueNext swap, part 2.** The problem and arena/contest families.
5. **BootstrapVueNext swap, part 3.** The problem creator (the densest `<b-*>` user).
6. **Bootstrap 5 CSS cutover.** Flip `bootstrap` 4 to 5 and rewrite remaining raw
   Bootstrap 4 classes and data attributes to Bootstrap 5. The Vue 3 compat shim stays;
   it is reused by the ongoing Vue 2 to Vue 3 migration.

The exact split of PRs 3 to 5 may shift once per-family render failures are known. The
component migrations follow the BootstrapVueNext migration knowledge base.

## Local verification per PR

Run on Node 24 from the PR's branch:

```sh
yarn install
git submodule update --init --recursive   # first checkout only
yarn test
yarn build-development-frontend
```

Cypress and other end-to-end checks run in CI on the fork rather than locally.
