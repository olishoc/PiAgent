# Beautiful UI Mode

Beautiful UI Mode is PiAgent's reusable frontend workflow for making polished interfaces. It is not a cosmetic prompt. PiAgent generates a local Pi skill package at:

`~/.config/pi-app/packages/beautiful-ui`

The backend loads it into every Pi RPC session with `--skill`, so the command is available from the composer.

## Use

From PiAgent chat:

```text
/beautiful-ui redesign this settings page
```

PiAgent sends that as:

```text
/skill:beautiful-ui redesign this settings page
```

## Workflow

Beautiful UI Mode requires:

- UI context scan with `scripts/ui-scan.mjs`
- short design brief before editing
- semantic design token pack
- implementation using existing components first
- browser QA at desktop, tablet, and mobile widths when the app can run
- screenshot critic pass with concrete fixes
- at least one patch loop after critique
- build/test/browser verification evidence

## Honest Controls

If a control is only prompt text, Beautiful UI Mode must either wire it to real behavior, rename it accurately, or remove it. This is why the old "fast" mode was removed: PiAgent did not have a real backend speed control, only model/thinking controls.

## Example Prompt

```text
/beautiful-ui Make the project dashboard feel like a serious agent workspace. Preserve existing data and routes, improve density and hierarchy, verify at 1440x900, 1024x768, and 390x844, then patch the screenshot issues.
```
