# Contributing to Glass

Thank you for considering contributing to **Glass by Pickle**! Contributions make the open-source community vibrant, innovative, and collaborative. We appreciate every contribution you make—big or small.

## 📌 Contribution Guidelines

### 👥 Avoid Work Duplication

Before creating an issue or submitting a pull request (PR), please check existing [Issues](https://github.com/pickle-com/glass/issues) and [Pull Requests](https://github.com/pickle-com/glass/pulls) to prevent duplicate efforts.

### ✅ Start with Approved Issues

- **Feature Requests**: Please wait for approval from core maintainers before starting work. Issues needing approval are marked with the `🚨 needs approval` label.
- **Bugs & Improvements**: You may begin immediately without explicit approval.

### 📝 Clearly Document Your Work

Provide enough context and detail to allow easy understanding. Issues and PRs should clearly communicate the problem or feature and stand alone without external references.

### 💡 Summarize Pull Requests

Include a brief summary at the top of your PR, describing the intent and scope of your changes.

### 🔗 Link Related Issues

Use GitHub keywords (`Closes #123`, `Fixes #456`) to auto-link and close issues upon PR merge.

### 🧪 Include Testing Information

Clearly state how your changes were tested.

> Example:  
> "Tested locally on macOS 14, confirmed all features working as expected."

### 🧠 Future-Proof Your Descriptions

Document trade-offs, edge cases, and temporary workarounds clearly to help future maintainers understand your decisions.

---

## 🔖 Issue Priorities

| Issue Type                                         | Priority            |
|----------------------------------------------------|---------------------|
| Minor enhancements & non-core feature requests     | 🟢 Low Priority     |
| UX improvements & minor bugs                       | 🟡 Medium Priority  |
| Core functionalities & essential features          | 🟠 High Priority    |
| Critical bugs & breaking issues                    | 🔴 Urgent           |
|


# Developing

### Prerequisites

Ensure the following are installed:
- [Node.js v20.x.x](https://nodejs.org/en/download)
- [Python](https://www.python.org/downloads/)
- (Windows users) [Build Tools for Visual Studio](https://visualstudio.microsoft.com/downloads/)

Ensure you're using Node.js version 20.x.x to avoid build errors with native dependencies.

```bash
# Check your Node.js version
node --version

# If you need to install Node.js 20.x.x, we recommend using nvm:
# curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
# nvm install 20
# nvm use 20
```

## Setup and Build

```bash
npm run setup
```
Please ensure that you can make a full production build before pushing code.



## Linting

```bash
npm run lint
```

If you get errors, be sure to fix them before committing.


## Making a Pull Request

- Be sure to [check the "Allow edits from maintainers" option](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/allowing-changes-to-a-pull-request-branch-created-from-a-fork) when creating your PR. (This option isn't available if you're [contributing from a fork belonging to an organization](https://github.com/orgs/community/discussions/5634))
- If your PR refers to or fixes an issue, add `refs #XXX` or `fixes #XXX` to the PR description. Replace `XXX` with the respective issue number. See more about [linking a pull request to an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue).
- Lastly, make sure to keep your branches updated (e.g., click the `Update branch` button on the GitHub PR page).