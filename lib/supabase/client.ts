//This is a foundational file for your frontend-backend communication.
//@supabase/ssr instead of the basic @supabase/supabase-js. handles SSR/SSG scenarios better in Next.js. Manages cookie-based authentication automatically
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! 
  );
}

/* 
This client is for client-side operations like:

Real-time features (Things that need to update instantly)
- A chat app where new messages appear immediately
- A collaborative document editor where you see other users' cursors moving
- A dashboard that shows live data updates without refreshing the page

User interactions (When users directly trigger actions)
- Clicking a "Like" button on a post
-Submitting a contact form
- Uploading a profile picture
- Logging out (clicking a "Sign Out" button)

Dynamic UI updates (When page needs to change based on user state)
- Showing/hiding a navbar login button based on whether someone is logged in
- Displaying personalized content after login
- Form validation that happens as you type

! Operator tells TypeScript we're certain this environment variable exists */


//Alternative version. Keeps client file focused on browser-specific functionality while maintaining separation from server-side operations.
/*
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const isDevelopment = process.env.NODE_ENV === "development"; //Checks if you're using npm run dev vs production.



  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        debug: isDevelopment, //Enables detailed authentication logging only in development, helping you debug auth issues without cluttering production logs
        persistSession: true, //Keeps the user's session stored in the browser (localStorage) so they stay logged in between visits
        autoRefreshToken: true, //Automatically refreshes the user's authentication token before it expires to maintain seamless login
      },
      global: {
        headers: isDevelopment
          ? { "x-environment": "development" } // adds custom headers to every request made to Supabase. Track environment in your Supabase logs and 
          : { "x-environment": "production" }, // analytics. Debug issues by knowing which environment requests come from. Implement environment-specific logic on your backend.
      },
    }
  );
}
*/