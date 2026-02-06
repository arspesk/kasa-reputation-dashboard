# Supabase Client Usage

This directory contains the official Supabase client setup for Next.js App Router.

## Files

- **`client.ts`** - Browser client for Client Components (with "use client")
- **`server.ts`** - Server client for Server Components and API routes
- **`middleware.ts`** - Middleware client for auth session refresh

## Usage Examples

### 1. Client Components (Browser)

Use when you need interactivity (useState, useEffect, event handlers, etc.)

```tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export default function ClientComponent() {
  const [data, setData] = useState(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase.from("hotels").select();
      setData(data);
    }
    fetchData();
  }, []);

  return <div>{/* Render data */}</div>;
}
```

### 2. Server Components (Default)

Use for data fetching on the server (faster, more secure)

```tsx
import { createClient } from "@/lib/supabase/server";

export default async function ServerComponent() {
  const supabase = await createClient();
  const { data: hotels } = await supabase.from("hotels").select();

  return (
    <ul>
      {hotels?.map((hotel) => (
        <li key={hotel.id}>{hotel.name}</li>
      ))}
    </ul>
  );
}
```

### 3. API Routes

Use the server client in API routes

```tsx
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("hotels").select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
```

### 4. Authentication

**Sign Up:**
```tsx
const supabase = createClient();
const { data, error } = await supabase.auth.signUp({
  email: "user@example.com",
  password: "password123",
});
```

**Sign In:**
```tsx
const supabase = createClient();
const { data, error } = await supabase.auth.signInWithPassword({
  email: "user@example.com",
  password: "password123",
});
```

**Sign Out:**
```tsx
const supabase = createClient();
await supabase.auth.signOut();
```

**Get Current User (Server Component):**
```tsx
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
```

## Important Notes

1. **Client vs Server**: Use client for interactivity, server for data fetching
2. **Cookies**: The server client properly handles auth cookies
3. **Middleware**: The middleware automatically refreshes expired sessions
4. **Environment Variables**: Make sure `.env.local` has correct Supabase credentials
