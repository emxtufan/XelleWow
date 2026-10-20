\# Xelle — Claude Code Instructions



\## Core rule



Work only on the user's explicit request.



Do not expand scope.

Do not perform unrelated cleanup.

Do not refactor working code unless required.

Do not redesign existing functionality unless explicitly requested.



Prefer the smallest safe change.



\---



\## Repository exploration



Do NOT scan the entire repository by default.



Start with targeted searches using:



\* exact error message

\* route

\* component name

\* function name

\* variable

\* endpoint

\* filename

\* visible UI text



Inspect only directly relevant files.



If the task can be solved with 1–3 files, do not inspect many unrelated files.



Expand investigation only when evidence requires it.



\---



\## Token / context efficiency



Minimize context usage.



Do not repeatedly reread unchanged files.



For large files:



1\. search first

2\. locate the relevant function/component

3\. inspect only the needed section



Do not read thousands of lines when a small region is sufficient.



Keep reasoning and reports concise.



\---



\## Ignore by default



Do not inspect unless directly required:



\* node\_modules/

\* dist/

\* build/

\* coverage/

\* .git/

\* logs/

\* backup/

\* backups/

\* temp/

\* tmp/

\* uploads/

\* generated bundles

\* source maps

\* minified files



Do not inspect lockfiles unless dependency resolution is part of the task.



\---



\## Existing project safety



Treat Xelle as an existing production-sensitive project.



Preserve:



\* existing routes

\* business logic

\* APIs

\* imports

\* database structures

\* user data

\* design

\* animations

\* responsive behavior

\* authentication

\* integrations



Do not reinterpret working code simply because another approach seems cleaner.



\---



\## Frontend



Preserve the current design unless explicitly told otherwise.



Do not modify unrelated:



\* typography

\* colors

\* spacing

\* layout

\* breakpoints

\* animations

\* transitions

\* navigation

\* responsive behavior



When changing one visual element, change only that element and its direct dependencies.



Do not make the UI more generic or template-like.



Do not add unnecessary:



\* gradients

\* cards

\* icons

\* badges

\* sections

\* animations

\* placeholder content



If the user provides a visual reference, follow it closely.



\---



\## Backend



Do not modify unrelated:



\* authentication

\* JWT

\* sessions

\* cookies

\* middleware

\* CORS

\* payments

\* webhooks

\* uploads

\* emails

\* database logic



Any backend change must preserve existing users and existing frontend behavior unless explicitly requested otherwise.



\---



\## Database / persisted data



Never:



\* delete existing records

\* reset collections

\* drop tables

\* drop collections

\* overwrite existing personalization

\* destructively rename persisted fields

\* run destructive migrations



Prefer backward-compatible, additive changes.



Existing records must continue to work.



Do not treat missing frontend state as proof that persisted server data should be removed.



A missing localStorage key must NEVER cause valid database data to be deleted or reset.



Server/database persisted data is authoritative when it exists.



\---



\## Minimal changes



Change as few files as possible.



Do not:



\* rename files unnecessarily

\* move folders

\* mass-format files

\* reorder unrelated imports

\* rename variables for style

\* rewrite full components for small fixes

\* introduce abstractions without need

\* modernize unrelated code



Match the existing project style.



\---



\## Dependencies



Do not add dependencies unless genuinely necessary.



Before installing anything:



1\. check whether the project already provides the functionality

2\. prefer existing libraries

3\. prefer native APIs when reasonable



Do not automatically run:



\* npm update

\* npm audit fix

\* dependency upgrades



\---



\## Commands



Avoid expensive commands unless necessary.



Do not automatically run:



\* npm install

\* npm run build

\* full test suites

\* migrations

\* docker builds



Prefer targeted validation.



Do not start duplicate development servers.



If a port is occupied, identify the owning process before terminating it.



Never broadly kill all Node processes unless explicitly requested.



\---



\## Git safety



Do not automatically:



\* commit

\* push

\* pull

\* merge

\* rebase

\* reset

\* clean

\* switch branches

\* discard local changes



Treat unrelated working-tree changes as user-owned.



Never overwrite or revert changes you did not create.



\---



\## Debugging



For bugs:



1\. identify the exact symptom

2\. find the smallest relevant code area

3\. form a likely cause

4\. confirm it in code

5\. apply the smallest fix

6\. validate the affected behavior



Do not make several speculative changes at once.



Fix root causes, not symptoms.



Do not silence errors using broad workarounds.



\---



\## Avoid shortcuts



Avoid unless technically justified:



\* any

\* @ts-ignore

\* eslint-disable

\* empty catch blocks

\* swallowed exceptions

\* arbitrary setTimeout fixes



Do not remove validations merely to make an error disappear.



\---



\## Admin and public frontend



Changes to the admin area must not unintentionally affect the public site.



Before changing shared structures, check whether public rendering depends on them.



Preserve:



\* existing content

\* product data

\* media

\* settings

\* user configuration



\---



\## Products and catalog



Never invent product data.



Do not alter without explicit instruction:



\* names

\* prices

\* descriptions

\* SKUs

\* categories

\* stock

\* variants

\* images



If information is missing, report it instead of fabricating values.



\---



\## Images and media



Preserve existing media references.



Do not rename or move uploaded files unnecessarily.



Do not replace real images with placeholders.



If an image fails to render, fix the path/rendering logic instead of changing user content.



\---



\## Responsive behavior



Every frontend change must preserve desktop and mobile behavior.



Do not fix one viewport by breaking another.



Avoid arbitrary breakpoint hacks unless necessary.



\---



\## Architecture



Do not introduce new:



\* state management

\* routing systems

\* UI frameworks

\* backend frameworks

\* design systems

\* service layers

\* architecture abstractions



for localized tasks.



Use the existing architecture.



\---



\## Validation



Validate only what is necessary.



Prefer:



\* targeted syntax/type checks

\* affected component verification

\* affected route verification

\* focused API checks



Do not run project-wide validation if local verification is enough.



\---



\## Communication



Keep responses concise.



Before a significant change, briefly state:



\* likely cause

\* relevant files

\* intended modification



After completion, report:



\* cause

\* files changed

\* what changed

\* important validation



Do not produce long architecture reports unless requested.



\---



\## Priority order



1\. Existing user/data safety

2\. Preserve current design

3\. Correctness

4\. Minimal scope

5\. Minimal file changes

6\. Backward compatibility

7\. Low context/token usage

8\. Maintainability



\---



\## Final rule



Read as little as necessary.



Change as little as necessary.



Run as little as necessary.



Preserve everything that already works.



