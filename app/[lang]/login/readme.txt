Two files needed for cron job. Delete data daily at 01:00 from DB
1) api/cron/cleanup-passreset-tokens.ts
2) hype-hire/vercel/vercel.json

3) page.tsx ---The main file
4) ForgotPassword.tsx ---'Forgot password' card. User enters email, clicks btn, component calls /api/password-reset

5) api/password_reset/route.ts 
---Gets email & language. Validates email. Makes token 24-hour expiration. Stores it in Prisma. Builds reset link.
Sends the Brevo email with the reset link and correct language. Returns success or error. If successful, redirects to login.

6) lib/email/send-forgot-password.ts ---The email. We test with: 
curl -X POST http://localhost:3000/api/password-reset \
  -H "Content-Type: application/json" \
  -d '{
    "email": "xenofon.pagoulatos@gmail.com",
    "language": "el"
  }' 

  and we want to see:     {"success":true,"message":"Password reset link sent to email"}%      

7) reset-password/page.tsx ---

8)/api/password-reset/validate ---Called on RestPass page load. Token exists in DB? Expired? If yes returns error. Does NOT update anything
9) /api/password-reset/verify ---Called when user submits new pass. Validate inputs — checks token and password exist and password is at least 6 characters​Queries DB, gets token & user​. Verify token exists, not expired or used.
Update password in Supabase — uses the admin API to update the user's password using their authUserId. Sets usedAt timestamp. Return success to frontend (reset-password/page.tsx)



User submits form → handlePasswordReset sends POST to /api/password-reset/verify with token and new password​
Verify API responds → If successful, returns { success: true, message: "..." } with status 200​
Page reads response → Checks if (!response.ok) — if status is 200, it means success​
Set success state → setSuccess(true) triggers the success UI to render​
Show success card → Displays the CheckCircle icon and success message​
Redirect to login → After 1 second, router.push(\/${lang}/login`)` redirects them back to login page