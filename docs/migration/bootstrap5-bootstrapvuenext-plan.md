# Bootstrap 5 migration

omegaUp is moving from Bootstrap 4 and BootstrapVue 2 to Bootstrap 5 and bootstrap-vue-next. Vue 3 compatibility mode is the bridge, because BootstrapVue 2 runs only on Vue 2 and bootstrap-vue-next runs only on Vue 3. Bootstrap 5 CSS comes after that library is in place.

The work is four pull requests. Each branch starts from the previous branch tip. PR4 stays unstarted until PR3 CI is green.

## Pull requests

| PR | Branch | Base | Status |
| --- | --- | --- | --- |
| 1 | `bs5/01-baseline-tooling` | `main` | Open as antedotee/omegaup#13. Docs and the measured baseline. |
| 2 | `bs5/02-vue3-compat` | PR1 | Open as antedotee/omegaup#14. Vue 3 compat and bootstrap-vue-next. Bootstrap 4 CSS still loads. CI is green. Tip `eb27ddf48`. |
| 3 | `bs5/03-bootstrap5-cutover` | PR2 | This branch. Bootstrap 5.3.8 CSS, class and data-attribute cutover, and the remaining widgets on bootstrap-vue-next. |
| 4 | not created | PR3 | Not started. Removes the Vue 3 compat shim. |

An earlier plan split the library swap into three family pull requests and left the CSS cutover as PR6. PR2 already swapped the library while Bootstrap 4 CSS was still loaded. That six-PR plan is superseded.

## Left for later

- `karel.js` and `rekarel` ship their own Bootstrap. They are submodules and this cutover does not edit them.
- Sass `@import` becomes `@use` in PR4.
- The datepicker and datetimepicker files under `frontend/www/third_party` stay as they are. PR3 only sets their popup `z-index`.

## Commands

Run these from the PR3 worktree. Put Node 24.21.0 on `PATH` first.

```sh
export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"
yarn jest --config stuff/bs5-cutover/jest.config.cjs
node stuff/bs5-cutover/codemod.mjs --check
node stuff/bs5-cutover/integrity.mjs --commit 4e88dc6bd
node stuff/bs5-cutover/scan.mjs
node stuff/bs5-cutover/smoke.mjs
node stuff/bs5-cutover/check-trail.mjs
yarn test
yarn build-development-frontend
yarn webpack --config-name=style --mode=development
```

Run `yarn test` and a webpack build one after the other. Running them together has crashed Jest workers in this repo.
