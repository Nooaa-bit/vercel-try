// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr"; // use for Server Components, API routes, middleware. Handles authentication with cookies for server components
import { createClient as createSupabaseClient } from "@supabase/supabase-js"; //Direct database connection with full admin privileges. Full CRUD operations tasks, user creation, bypassing RLS
import { cookies } from "next/headers"; //Server-side only (won't work in client components) Read and write HTTP cookies on the server, 


const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; //Public API key (safe to expose, has RLS restrictions)
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Private admin key (NEVER expose to client, bypasses all security)

// Helper to safely set cookies
const safe = (fn: () => void) => {
  try {
    fn();
  } catch {
    // Expected: can't set cookies after response started
  }
};
/* Create a Supabase connection that works with user login cookies */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      get: (name) => cookieStore.get(name)?.value,
      set: (name, value, options) =>
        safe(() => cookieStore.set(name, value, options)),
      remove: (name, options) =>
        safe(() => cookieStore.set(name, "", { ...options, maxAge: 0 })),
    },
  });
}

/* For server-actions that need admin privileges */
export const createAdminClient = () =>
  createSupabaseClient(URL, SERVICE, { auth: { persistSession: false } });


/*// Add retry logic for failed connections
export async function createServerAnonClientWithRetry(maxRetries = 3) {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await createServerAnonClient();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      }
    }
  }
  
  throw lastError!;
} */



/* // In an API route
export async function POST(request: Request) {
  const supabase = createAdminClient();
  
  // This bypasses all security rules
  const { data: allUsers } = await supabase
    .from('users')
    .select('*'); // Gets ALL users regardless of RLS
    
  // Can create users
  const { data: newUser } = await supabase.auth.admin.createUser({
    email: 'newuser@example.com',
    password: 'password123'
  });
}    */





/*    🔧 Enhanced Error Handling
// Add logging utility

function logError(error: Error, context: string) {
  console.error(`[Supabase ${context}]:`, error.message);
  // Could send to monitoring service like Sentry
}

export async function createServerAnonClient() {
  try {
    const cookieStore = await cookies();
    return createServerClient(URL, ANON, {
      cookies: {
        get: (name) => {
          try {
            return cookieStore.get(name)?.value;
          } catch (error) {
            logError(error as Error, 'Cookie Get');
            return undefined;
          }
        },
        set: (name, value, options) =>
          safe(() => cookieStore.set(name, value, options)),
        remove: (name, options) =>
          safe(() => cookieStore.set(name, "", { ...options, maxAge: 0 })),
      },
    });
  } catch (error) {
    logError(error as Error, 'Server Client Creation');
    throw error;
  }
}
*/





/* Regular functions start lowercase
export function createClient() { } 
export function calculateTax(price: number) { }
export function updateUserProfile(userId: string, data: object) { }

  Components start with capital
export default function DashboardPage() { }
export default function AuthHeader() { }
export function useAuth() { }  // Custom hook (not a component)
// But when used as components:
export default function AuthProvider() { }  // Component wrapper

export default function Button() { }
//Importing - can name it anything:
import Button from '@/components/Button'
import MyButton from '@/components/Button' 

export function formatDate() { }
export function validateEmail() { }
export default function mainHelper() { }
// Importing - must use exact names:
import { formatDate, validateEmail } from '@/utils/helpers'
import mainHelper, { formatDate } from '@/utils/helpers'  // Can import just one */

