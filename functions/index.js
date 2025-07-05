/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const cors = require("cors")({origin: true});

admin.initializeApp();

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

/**
 * @name pickleGlassAuthCallback
 * @description
 * Validate Firebase ID token and return custom token.
 * On success, return success response with user information.
 * On failure, return error message.
 *
 * @param {object} request - HTTPS request object. Contains { token: "..." } in body.
 * @param {object} response - HTTPS response object.
 */
const authCallbackHandler = (request, response) => {
  cors(request, response, async () => {
    try {
      logger.info("pickleGlassAuthCallback function triggered", {
        body: request.body,
      });

      if (request.method !== "POST") {
        response.status(405).send("Method Not Allowed");
        return;
      }
      if (!request.body || !request.body.token) {
        logger.error("Token is missing from the request body");
        response.status(400).send({
          success: false,
          error: "ID token is required.",
        });
        return;
      }

      const idToken = request.body.token;

      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;

      logger.info("Successfully verified token for UID:", uid);

      const customToken = await admin.auth().createCustomToken(uid);
      
      response.status(200).send({
        success: true,
        message: "Authentication successful.",
        user: {
          uid: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name,
          picture: decodedToken.picture,
        },
        customToken,
      });
    } catch (error) {
      logger.error("Authentication failed:", error);
      response.status(401).send({
        success: false,
        error: "Invalid token or authentication failed.",
        details: error.message,
      });
    }
  });
};

exports.pickleGlassAuthCallback = onRequest(
    {region: "us-west1"},
    authCallbackHandler,
);
