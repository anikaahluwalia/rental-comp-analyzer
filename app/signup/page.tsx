/**
 * The create an account screen.
 *
 * If the user is already signed in, they skip this screen and go
 * straight to the dashboard. Otherwise they get the signup form.
 *
 * Everyone who signs up starts as a read-only viewer. Admin and analyst
 * roles are invite-only / provisioned manually.
 *
 * The page is designed to match the sign-in screen visually so the
 * onboarding flow feels seamless.
 */
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/features/auth";
import { BrandMark } from "@/interface/BrandMark";
import { SignupForm } from "@/interface/SignupForm";
import {
  COLORS,
  clayAccentBar,
  clayBrandStripe,
  clayText,
  displayHeadline,
  displayHeadlinePaper,
  labelItalic,
  labelItalicPaper,
} from "@/features/ui-style";

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-paper">
      <div style={clayBrandStripe} />

      <main className="grid min-h-[calc(100vh-8px)] grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
        {/* LEFT — brand + form */}
        <section className="flex flex-col justify-between px-8 py-10 sm:px-14 lg:px-20 lg:py-14">
          <header className="flex items-center gap-3 text-ink">
            <BrandMark className="h-9 w-9" />
            <div className="text-sm">
              <div className="font-black tracking-[0.08em] text-ink">
                MIDTOWN COMP
              </div>
              <div style={{ ...labelItalic, fontSize: 11 }}>
                Rental Comp
              </div>
            </div>
          </header>

          <div className="mx-auto w-full max-w-2xl py-10">
            <div className="flex items-center gap-3">
              <span style={clayAccentBar} aria-hidden />
              <span style={{ ...labelItalic, fontSize: 14 }}>
                Create Access
              </span>
            </div>
            <h1
              style={displayHeadline}
              className="headline mt-5 text-[4.5rem] sm:text-[6rem]"
            >
              Request
              <br />
              access<span style={clayText}>.</span>
            </h1>
            <p className="mt-8 max-w-md text-base leading-relaxed text-ash">
              Passwords are hashed with scrypt and stored locally. Admin access
              is provisioned manually.
            </p>

            <div className="mt-10">
              <SignupForm />
            </div>

            <p className="mt-8 text-xs tracking-[0.1em] text-ash">
              Already have an account?{" "}
              <Link
                href="/"
                className="font-semibold uppercase tracking-[0.2em] text-ink underline decoration-clay decoration-2 underline-offset-[5px] hover:text-clay"
              >
                Sign in →
              </Link>
            </p>
          </div>

          <footer className="flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-ash">
            <span>© Midtown Rental Comp · Toronto</span>
            <span
              style={{ color: COLORS.clay }}
              className="hidden sm:inline"
            >
              v0.1 · Preview
            </span>
          </footer>
        </section>

        {/* RIGHT — hero */}
        <aside className="relative hidden min-h-[420px] overflow-hidden bg-ink lg:block">
          <Image
            src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1800&q=85&auto=format&fit=crop"
            alt="Modern residential building at dusk"
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 0vw"
            className="object-cover grayscale-[10%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-ink/0" />
          <div className="absolute inset-x-0 bottom-0 p-12 text-paper">
            <div className="flex items-center gap-3">
              <span style={clayAccentBar} aria-hidden />
              <span style={{ ...labelItalicPaper, fontSize: 14 }}>
                Membership
              </span>
            </div>
            <h2
              style={displayHeadlinePaper}
              className="mt-4 text-[3.5rem]"
            >
              Precision
              <br />
              by design<span style={clayText}>.</span>
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-paper/75">
              Ten competing buildings. Every unit type. Effective rent net of
              incentives. One screen.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
