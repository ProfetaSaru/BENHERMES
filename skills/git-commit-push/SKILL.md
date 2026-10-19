---
name: git-commit-push
description: >-
  Automate analyzing working directory changes, verifying project build/integrity,
  creating conventional semantic commits (feat, fix, chore, refactor, docs), and
  pushing safely to the remote git repository. Use whenever the user asks to commit,
  push, or sync git changes to remote VCS.
---

# Git Commit & Push Workflow Skill (Global)

This skill defines the standardized procedure for inspecting changes, validating code integrity, authoring Conventional Commits, and pushing them to the remote Git repository.

---

## 📋 Standard Workflow Steps

### Step 1: Pre-Commit Inspection
Before staging any files, inspect the current git status and modified files:
```powershell
git status
git branch --show-current
git diff --stat
```
Verify:
1. You are on the intended branch (e.g., `main`).
2. There are no temporary files, secrets, or unwanted scratch files.

---

### Step 2: Quality & Build Validation
Before committing code, ensure the project builds and has zero type/syntax errors:
- If `package.json` exists with a build script:
  ```powershell
  npm run build
  ```
- If TypeScript is used without a build script:
  ```powershell
  npx tsc --noEmit
  ```
> **Rule**: If the build or tests fail, **DO NOT** commit or push. Fix errors first.

---

### Step 3: Stage Files & Formulate Semantic Commit
Group related changes and stage them cleanly:
```powershell
git add <files>
```

Craft commit messages following the **Conventional Commits** specification:
- `feat:` for new features or capabilities
- `fix:` for bug fixes
- `refactor:` for code restructurings without behavior changes
- `chore:` for dependency updates, toolings, or config changes
- `docs:` for documentation or README changes
- `style:` for formatting, CSS or visual adjustments

Format:
```powershell
git commit -m "<type>: <concise description in lowercase>"
```

---

### Step 4: Push to Remote Repository
Push changes to the current tracked upstream branch:
```powershell
git push origin <branch>
```
If the branch has no upstream set yet:
```powershell
git push -u origin <branch>
```

---

### Step 5: Verification & Confirmation
Verify that the working tree is clean and commits are synced:
```powershell
git status
git log -n 3 --oneline
```
Provide the user with:
1. Commit hash and message.
2. Target branch and remote URL/status.
3. Summary of staged and pushed components.
