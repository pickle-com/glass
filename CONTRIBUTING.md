# Contributing to Glass

Thank you for considering contributing to **Glass by Pickle**! Contributions make the open-source community vibrant, innovative, and collaborative. We appreciate every contribution you make—big or small.

This document guides you through the entire contribution process, from finding an issue to getting your pull request merged.

---

## 🚀 Contribution Workflow

To ensure a smooth and effective workflow, all contributions must go through the following process. Please follow these steps carefully.

### 1. Find or Create an Issue

All work begins with an issue. This is the central place to discuss new ideas and track progress.

-   Browse our existing [**Issues**](https://github.com/pickle-com/glass/issues) to find something you'd like to work on. We recommend looking for issues labeled `good first issue` if you're new!
-   If you have a new idea or find a bug that hasn't been reported, please **create a new issue** using our templates.

### 2. Claim the Issue

To avoid duplicate work, you must claim an issue before you start coding.

-   On the issue you want to work on, leave a comment with the command:
    ```
    /assign
    ```
-   Our GitHub bot will automatically assign the issue to you. Once your profile appears in the **`Assignees`** section on the right, you are ready to start development.

### 3. Fork & Create a Branch

Now it's time to set up your local environment.

1.  **Fork** the repository to your own GitHub account.
2.  **Clone** your forked repository to your local machine.
3.  **Create a new branch** from `main`. A clear branch name is recommended.
    -   For new features: `feat/short-description` (e.g., `feat/user-login-ui`)
    -   For bug fixes: `fix/short-description` (e.g., `fix/header-rendering-bug`)

### 4. Develop

Write your code! As you work, please adhere to our quality standards.

-   **Code Style & Quality**: Our project uses `Prettier` and `ESLint` to maintain a consistent code style.
-   **Architecture & Design Patterns**: All new code must be consistent with the project's architecture. Please read our **[Design Patterns Guide](https://github.com/pickle-com/glass/blob/main/docs/DESIGN_PATTERNS.md)** before making significant changes.

### 5. Create a Pull Request (PR)

Once your work is ready, create a Pull Request to the `main` branch of the original repository.

-   **Fill out the PR Template**: Our template will appear automatically. Please provide a clear summary of your changes.
-   **Link the Issue**: In the PR description, include the line `Closes #XXX` (e.g., `Closes #123`) to link it to the issue you resolved. This is mandatory.
-   **Code Review**: A maintainer will review your code, provide feedback, and merge it.

---

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