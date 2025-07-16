# PickleGlass Web

PickleGlass is a personalized AI assistant platform designed to help users in various contexts such as learning, meetings, sales, recruiting, and customer support. This is the Next.js frontend for PickleGlass, providing a modern, responsive, and accessible user interface.

## Project Overview

-   **Framework:** Next.js (React, TypeScript)
-   **Styling:** Tailwind CSS
-   **State & Data:** Firebase, REST API, Local Storage
-   **UI Components:** Custom and Lucide React icons

## Main Features

-   **Personalized AI Contexts:**
    -   Choose or create custom AI assistant presets for different scenarios (school, meetings, sales, recruiting, customer support, etc.).
-   **User Authentication:**
    -   Supports both Firebase (Google sign-in) and local mode for privacy.
-   **Activity Tracking:**
    -   View, manage, and delete your past AI sessions and conversations.
-   **Settings & Personalization:**
    -   Manage your profile, privacy settings, billing (coming soon), and API keys.
-   **Search:**
    -   Quickly search through your conversations and activities.
-   **Responsive Sidebar Navigation:**
    -   Collapsible sidebar with quick access to main sections and external resources.
-   **Download Center:**
    -   Download PickleGlass for desktop, mobile, or tablet platforms.
-   **Help Center:**
    -   Access guides and support resources.

## Recent Improvements

-   **Reusable Loading Spinner:**
    -   All loading states now use a consistent, accessible `<LoadingSpinner />` component for better UX and maintainability.
-   **UI Consistency:**
    -   Loading spinners and empty states are now visually unified across all pages.
-   **Code Maintainability:**
    -   Reduced code duplication and improved readability by refactoring repeated UI patterns.

## Getting Started

1. **Install dependencies:**
    ```bash
    npm install
    ```
2. **Run the development server:**
    ```bash
    npm run dev
    ```
3. **Open your browser:**
   Visit [http://localhost:3000](http://localhost:3000)

## Contributing

Contributions are welcome! Please fork the repository, create a feature branch, and submit a pull request. For major changes, open an issue first to discuss your ideas.

## License

This project is licensed under the MIT License.
