# Agent Authentication Setup

## Environment Variables

To use the agent login feature, you need to set the following environment variables in your `.env` file:

```env
# Agent Authentication Credentials
AGENT_USERNAME=FAdmin@112&8
AGENT_PASSWORD=Qeen@3344))98

# JWT Secret for Agent Authentication (optional, will use JWT_SECRET if not set)
AGENT_JWT_SECRET=your-secret-key-change-in-production
```

## Setup Instructions

1. Create a `.env` file in the `backend` directory if it doesn't exist
2. Add the above environment variables to your `.env` file
3. Make sure there are no extra spaces or quotes around the values
4. Restart your backend server after adding the variables

## Important Notes

- The credentials are case-sensitive
- Special characters in the password must match exactly
- Do NOT commit the `.env` file to version control
- The `.env` file is already in `.gitignore`

## Testing

After setting up the environment variables, you can test the agent login at:
- Frontend: `/agent-login`
- API: `POST /api/agent-auth/login`

## Troubleshooting

If you get "Invalid credentials" error:
1. Check that the `.env` file exists in the `backend` directory
2. Verify the credentials match exactly (including special characters)
3. Make sure there are no extra spaces in the `.env` file
4. Restart the backend server after making changes
5. Check the server console for any warnings about missing environment variables

