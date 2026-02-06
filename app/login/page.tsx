"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        // Clear any errors
        setError(null);
        // Redirect to dashboard on successful sign in
        router.push("/dashboard");
        router.refresh();
      } else if (event === "USER_UPDATED") {
        // Handle user updates
        router.refresh();
      }
    });

    // Listen for auth errors
    const checkAuthErrors = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        setError(sessionError.message);
      }
    };

    checkAuthErrors();

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#fef7f1] via-[#faf9f6] to-[#e1eff0] p-4">
      <div className="bg-white rounded-kasa-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-kasa-black-500 mb-2">
            Welcome to Kasa
          </h1>
          <p className="text-gray-700">
            Sign in to access your reputation dashboard
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-kasa-error rounded-kasa-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Authentication Error
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                  {error.includes("rate limit") && (
                    <p className="mt-2 text-xs">
                      Too many requests. Please wait a few minutes and try
                      again, or contact support to manually create your account.
                    </p>
                  )}
                  {error.includes("Invalid login") && (
                    <p className="mt-2 text-xs">
                      Please check your email and password. If you haven't
                      signed up yet, create an account first.
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-auto flex-shrink-0 text-red-500 hover:text-red-700"
              >
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: "#195c8c",
                  brandAccent: "#144a70",
                },
              },
            },
            className: {
              container: "w-full",
              button: "w-full px-4 py-2 rounded-kasa font-semibold min-h-kasa-button-md",
              input: "w-full px-4 py-2 rounded-kasa-sm border border-kasa-neutral-medium h-kasa-button-md",
              label: "!text-gray-700",
            },
          }}
          providers={[]}
          redirectTo="/dashboard"
          view="sign_in"
          showLinks={true}
          localization={{
            variables: {
              sign_in: {
                email_label: "Email Address",
                password_label: "Password",
                button_label: "Sign In",
                loading_button_label: "Signing in...",
                social_provider_text: "Sign in with {{provider}}",
                link_text: "Already have an account? Sign in",
              },
              sign_up: {
                email_label: "Email Address",
                password_label: "Password",
                button_label: "Sign Up",
                loading_button_label: "Signing up...",
                social_provider_text: "Sign up with {{provider}}",
                link_text: "Don't have an account? Sign up",
                confirmation_text: "Check your email for the confirmation link",
              },
            },
          }}
          onAuthError={(error) => {
            setError(error.message);
          }}
        />

        <div className="mt-6 text-center text-sm text-gray-700">
          <p>By signing in, you agree to our Terms of Service</p>
        </div>
      </div>
    </div>
  );
}
