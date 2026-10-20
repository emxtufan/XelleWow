\# Xelle Project Instructions



\## Project status



Xelle is an existing project.



Treat it as a production-sensitive application.



Do not redesign, restructure or reinterpret the project unless the user explicitly asks for that.



Preserve all working behavior.



\---



\## Main rule



Work only on the exact task requested by the user.



Do not expand the scope.



Do not perform unrelated cleanup.



Do not refactor unrelated code.



Do not rewrite entire components when a small local change is sufficient.



Always prefer the smallest safe modification.



\---



\## Repository exploration



Do NOT scan the entire Xelle repository by default.



Start with targeted searches based on:



\* route

\* component name

\* exact UI text

\* function name

\* API endpoint

\* variable

\* error message

\* filename mentioned by the user



Inspect only directly relevant files.



If the task can be solved with 1-3 files, do not inspect 20 files.



Only expand the investigation when the code proves it is necessary.



\---



\## Ignore by default



Do not inspect these unless directly required:



\* node\_modules/

\* dist/

\* build/

\* .git/

\* coverage/

\* logs/

\* backups/

\* backup/

\* temp/

\* tmp/

\* uploads/

\* generated assets

\* compiled bundles

\* source maps

\* minified files



Do not inspect package lockfiles unless dependency resolution is directly part of the task.



\---



\## Existing design must be preserved



Xelle already has an existing visual direction.



Do not casually change:



\* layout

\* typography

\* colors

\* spacing

\* animations

\* transitions

\* responsive behavior

\* component positioning

\* visual hierarchy

\* navigation behavior



If the user asks to change one visual element, change only that element and what is directly required for it.



Do not make the site look more "AI generated".



Do not simplify or genericize the design.



Do not replace custom design with generic cards, gradients, dashboards or template-like UI.



\---



\## Frontend behavior



Preserve:



\* current routes

\* navigation

\* component hierarchy

\* existing animations

\* responsive behavior

\* mobile behavior

\* loading behavior

\* user interactions



Do not remove existing functionality because it appears unused unless the user explicitly asks.



Do not rename routes or public URLs without explicit instruction.



\---



\## Existing code style



Match the current Xelle code style.



Do not:



\* mass-format files

\* reorder imports without need

\* rename variables for stylistic reasons

\* convert working code to another pattern just for preference

\* replace components with a new architecture



Keep diffs small and easy to review.



\---



\## Backend safety



Assume backend logic may already be connected to real users and real data.



Do not modify unrelated:



\* authentication

\* authorization

\* sessions

\* cookies

\* JWT

\* middleware

\* API contracts

\* database access

\* emails

\* uploads

\* payments

\* webhooks



Any backend modification must preserve existing frontend behavior unless the task explicitly changes it.



\---



\## Database rules



Treat existing data as important.



Never:



\* delete existing records

\* reset collections

\* drop tables or collections

\* rename fields destructively

\* remove fields used by existing users

\* run destructive migrations



Prefer backward-compatible changes.



If a new field is required, prefer optional/additive behavior and safe defaults.



Existing records must continue to load correctly.



\---



\## Admin area



Changes to the Xelle admin area must not unintentionally affect the public frontend.



Do not change shared data structures without checking their public impact.



Preserve:



\* existing content

\* existing product data

\* existing media references

\* existing settings

\* existing user configuration



Do not reset values just because a field is missing in the browser or frontend state.



Database/server state is the source of truth when persisted data exists.



\---



\## Product / catalog data



Never invent product information unless explicitly requested.



Do not alter:



\* names

\* prices

\* SKUs

\* descriptions

\* images

\* stock values

\* categories

\* variants



unless the task specifically asks for it.



If product data is missing, report the missing data rather than fabricating it.



\---



\## Media and images



Do not replace existing image URLs unnecessarily.



Do not rename or move uploaded assets without need.



Preserve current image references.



Do not generate placeholder images in production code unless explicitly requested.



If an image bug exists, fix the rendering/path logic rather than replacing user content.



\---



\## Responsive design



Any frontend change must preserve desktop and mobile behavior.



Do not fix desktop by breaking mobile.



Do not fix mobile by removing desktop behavior.



Inspect only the relevant breakpoint logic when necessary.



Avoid adding arbitrary viewport-specific hacks unless no cleaner local solution exists.



\---



\## Performance



Do not introduce heavy dependencies for small UI features.



Prefer existing project libraries and native browser functionality.



Do not optimize unrelated areas.



Do not rewrite functioning animation systems without a demonstrated problem.



\---



\## Dependencies



Do not install a new dependency unless genuinely necessary.



Before adding one:



1\. check whether the functionality already exists in the project

2\. prefer existing utilities

3\. prefer native APIs where appropriate



Do not run:



\* npm update

\* npm audit fix

\* dependency upgrades



unless explicitly requested.



\---



\## Commands



Do not automatically run expensive commands unless needed.



Avoid by default:



\* npm install

\* npm run build

\* full test suites

\* dependency audits

\* production migrations



Use targeted checks first.



If a local dev server is already running, do not start a duplicate instance unnecessarily.



When dealing with ports, identify the owning process before terminating it.



Do not kill unrelated processes.



\---



\## Port handling



Xelle may run local development or preview servers.



If a port is occupied:



1\. identify the process using the port

2\. verify it belongs to the project or relevant tool

3\. terminate only the correct process



Do not terminate unrelated Node processes broadly.



Avoid commands that kill every `node.exe` process unless the user explicitly requests that.



\---



\## Git rules



Never automatically:



\* commit

\* push

\* pull

\* merge

\* rebase

\* reset

\* clean

\* checkout another branch

\* discard local changes



Treat existing working-tree changes as user-owned.



Do not overwrite changes you did not create.



Do not modify `.gitignore` unless the task directly requires it.



\---



\## Debugging



When debugging Xelle:



1\. identify the exact symptom

2\. locate the smallest relevant code area

3\. verify the likely cause

4\. fix the root cause

5\. validate only the affected behavior



Do not make multiple speculative changes at once.



Do not hide errors.



Do not remove checks merely to make an error disappear.



\---



\## Error handling



Avoid:



\* `any` used only to bypass TypeScript

\* `@ts-ignore`

\* `eslint-disable`

\* empty catch blocks

\* swallowing exceptions

\* arbitrary setTimeout fixes



unless technically justified.



Prefer fixing the underlying issue.



\---



\## User data safety



Never allow a frontend/browser state issue to overwrite valid persisted user data.



Do not interpret a missing localStorage value as proof that server-side data should be deleted.



Do not reset saved customization just because browser state is absent.



Persisted server/database data should remain intact unless the user explicitly requests a reset.



\---



\## UI modifications



When the user provides a visual reference:



Follow the supplied reference closely.



Do not add unrelated creative interpretation.



Do not invent extra sections, badges, icons, gradients, animations or text unless requested.



If exact reproduction is requested, prioritize fidelity over redesign.



\---



\## Text and content



Preserve supplied wording exactly when the user asks for exact text.



Do not rewrite marketing copy automatically.



Do not translate text unless requested.



Do not invent product claims or business claims.



\---



\## Architecture



Do not introduce:



\* new state management

\* new routing systems

\* new backend frameworks

\* new UI frameworks

\* new design systems

\* new abstraction layers



for localized tasks.



Use the current architecture.



\---



\## Production mindset



Assume Xelle can contain:



\* real users

\* real catalog data

\* real uploads

\* real configuration

\* real admin content



Any change should be safe for existing data and existing users.



Backward compatibility is preferred.



\---



\## Validation



Validate the smallest relevant surface.



Examples:



\* TypeScript check for the affected file if possible

\* targeted route behavior

\* targeted component rendering

\* focused API request

\* direct syntax verification



Do not run a full project-wide validation when a local check is enough.



\---



\## Communication



Keep explanations concise.



Before modifying multiple files, state briefly:



\* likely cause

\* relevant files

\* intended change



After the task, report:



\* what was wrong

\* what was changed

\* files changed

\* any important manual verification



Do not write long architecture reports unless requested.



\---



\## Xelle priority order



Always prioritize:



1\. Existing user/data safety

2\. Preserve current design

3\. Correctness

4\. Minimal scope

5\. Minimal file changes

6\. Backward compatibility

7\. Low context/token usage

8\. Maintainability



\---



\## Final rules



Do not over-engineer.



Do not redesign without permission.



Do not scan the whole project by default.



Do not touch unrelated files.



Do not destroy or reset existing data.



Read as little as necessary.



Change as little as necessary.



Run as little as necessary.



Preserve everything that already works.



