# Supabase setup

1. Create a Supabase project.
2. In its SQL Editor, run `migrations/0001_initial_schema.sql` once.
3. Copy the project URL and publishable key into local `.env.local` using `.env.example` as the template.
4. Add the same two values to Netlify environment variables, then redeploy.

Never place the `service_role` key in Netlify's browser-exposed variables or in the repository.

Before production, add Storage bucket policies for `photographs` and test every RLS policy with both the owner and a different authenticated account.
