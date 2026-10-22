# Bootstrap 5 parity checklist

These are the visual differences PR3 accepts. A difference that is not in this list is a defect.

Layout choices for the nine hand conversions are in `.audit/pr3/manual-conversions.md`. The residual rows are repeated below so a review can stop at this page.

## Accepted differences

| ID | Difference | Why it stands |
| --- | --- | --- |
| D1 | The problem-creator sidebar is `BOffcanvas`. | PR2 replaced the Bootstrap 4 sidebar. The removed stopgap used the Bootstrap 5.3.8 offcanvas defaults. |
| D2 | Icons come from `bootstrap-icons`. | bootstrap-vue-next does not ship `b-icon`. |
| D3 | Four former `title` tooltips use `v-b-tooltip`. | `course/AdmissionMode.vue`, `course/ViewProgress.vue`, `problem/Tags.vue`, and `qualitynomination/Details.vue`. The tooltip text is the old title. |
| D4 | The homepage carousels advance. | `BCarousel` in `homepage/Carousel.vue` and `homepage/Testimonials.vue` uses a 5000 ms interval. The old `data-ride` markup did not start a carousel under Vue. |
| D5 | The Requests deny control is not red. | Bootstrap 5 `.btn-close` paints an SVG. `text-danger` remains only as the test hook. |
| D6 | Trash and check buttons are lighter. | They are `btn-link`, so they do not pick up the Bootstrap 4 `.close` opacity of 0.5. |
| D7 | A `select.form-control` has no arrow. | Bootstrap 5 draws the arrow on `.form-select`. Selects that stayed `.form-control` have none. |
| D8 | Inline selects stay auto width below 576 px. | Rows M1, M2, M3, M5, and M6. |
| D9 | Navbar dropdown toggles are `<a href="#">`. | Cypress clicks `a[data-nav-*]`. `navToggleAttrs` cancels the empty hash. `Navbar.vue` clears `.btn` padding on those toggles. |

## Manual conversions

| ID | Place | Residual difference |
| --- | --- | --- |
| M1 | `arena/Clarification.vue` answer form | Below 576 px the select is auto width. The cell `min-width` is 15 rem, so the narrow rule is not reached in practice. |
| M2 | `arena/ClarificationList.vue` filter row | Below 576 px the selects are auto width. |
| M3 | `common/GridPaginator.vue` filter input | Below 576 px the input is auto width. |
| M4 | `course/AdmissionMode.vue` copy row | None. |
| M5 | `problem/SearchBar.vue` | Below 576 px the language select is auto width. |
| M6 | `grader/Ephemeral.vue` toolbar | Below 576 px the language select is auto width. |
| M7 | `grader/MonacoEditor.vue` toolbar | None. `flex-wrap` is the only added utility. |
| M8 | `contest/AddProblem.vue` search-type select | None. The select is a direct `.input-group` child with `w-25`. |
| M9 | `course/GenerateLinkClone.vue` URL input | None. `input-group-append` was an extra class on the input. |

## Datepicker

| Check | Result |
| --- | --- |
| Popup stacking | `.datepicker.dropdown-menu` and `.bootstrap-datetimepicker-widget.dropdown-menu` use `$zindex-popover` in `frontend/www/sass/components/_datepicker.scss`. |
| Padding and min-width | Unchanged. |
| 375 px and 1280 px grid check | Not recorded. That check is manual. |
