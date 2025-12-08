/**
 * Token Verification Utility
 * Verifies Google OAuth ID tokens and extracts user information
 * Requirements: 3.1, 3.4
 */

const { OAuth2Client } = require('google-auth-library');

// Initialize OAuth2 client with Google Client ID from environment
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify a Google ID token and extract the user ID
 * @param {string} token - The Google ID token to verify
 * @returns {Promise<string>} - The user's Google ID (sub claim)
 * @throws {Error} - If token is invalid, expired, or verification fails
 */
async function verifyGoogleToken(token) {
  if (!token) {
    const error = new Error('No token provided');
    error.statusCode = 401;
    throw error;
  }

  try {
    // Verify the token with Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    // Extract the payload containing user information
    const payload = ticket.getPayload();
    
    // Return the user's unique Google ID (sub = subject)
    return payload.sub;
  } catch (error) {
    // Token verification failed (invalid, expired, or wrong audience)
    const verificationError = new Error('Invalid or expired token');
    verificationError.statusCode = 401;
    verificationError.originalError = error.message;
    throw verificationError;
  }
}

/**
 * Extract token from Authorization header
 * @param {Object} headers - Request headers object
 * @returns {string|null} - The extracted token or null if not found
 */
function extractTokenFromHeaders(headers) {
  const authHeader = headers?.Authorization || headers?.authorization;
  
  if (!authHeader) {
    return null;
  }

  // Remove 'Bearer ' prefix if present
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return authHeader;
}

module.exports = {
  verifyGoogleToken,
  extractTokenFromHeaders
};
