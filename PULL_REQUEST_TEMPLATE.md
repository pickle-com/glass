## Pull Request: Remove Hardcoded Firebase Secrets and Use Environment Variables

### Summary
This PR addresses a security issue where sensitive Firebase configuration values (including the API key) were hardcoded in the repository. The codebase is now refactored to load all Firebase config values from environment variables, and `.env` files are excluded from version control.

---

### Changes Made
- Removed hardcoded Firebase config from `src/common/services/firebaseClient.js`.
- Refactored to use environment variables for all Firebase configuration values.
- Added validation to throw an error if any required Firebase config value is missing.
- Updated `.gitignore` to ensure `.env` and `.env.*` files are not committed.
- Added security comments to guide contributors on secret management.

---

### Instructions for Reviewers
- Copy the provided `.env.example` template (see below) to `.env` and fill in your actual Firebase credentials.
- Ensure you have the required environment variables set before running the app.

#### Example `.env` file:
```env
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
FIREBASE_APP_ID=your_firebase_app_id
FIREBASE_MEASUREMENT_ID=your_firebase_measurement_id
```

---

### Security Note
- The previously hardcoded Firebase API key and related credentials should be considered compromised.  
- **Action Required:** Rotate the exposed Firebase API key and update your deployment environment with the new values. 

---

### Commands for Creating the PR

```sh
# 1. Create a new branch for the security fix
git checkout -b fix/remove-firebase-secrets

# 2. Stage all the relevant changes
git add glass/src/common/services/firebaseClient.js glass/.gitignore glass/PULL_REQUEST_TEMPLATE.md

# 3. Commit your changes with a clear message
git commit -m "Remove hardcoded Firebase secrets, use environment variables, and update .gitignore"

# 4. Push the branch to your remote repository
git push origin fix/remove-firebase-secrets
```

After pushing, go to your repository on GitHub (or your Git hosting provider) and you should see an option to “Compare & pull request.”  
Open the pull request and the template you created will be automatically used.

**Don’t forget:**  
After merging, rotate your Firebase API key in the Firebase console and update your deployment environment with the new value.

Let me know if you want a command to create the PR from the command line as well! 