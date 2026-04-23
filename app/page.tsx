/**
 * This is the sign-in screen, the first page anyone sees.
 *
 * If the user is already signed in, they skip this screen and go
 * straight to the dashboard. Otherwise, they see the sign in page
 *
 * The page is designed to look almost identical to the sign-up screen
 * so the two feel like one cohesive product.
 */
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/features/auth";
import { FitzroviaMark } from "@/interface/FitzroviaMark";
import { LoginForm } from "@/interface/LoginForm";
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

export default async function LoginPage() {
  // If already signed in, skip the login screen.
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-paper">
      {/* Clay brand stripe — matches the dashboard treatment. */}
      <div style={clayBrandStripe} />

      <main className="grid min-h-[calc(100vh-8px)] grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
        {/* LEFT — brand + form */}
        <section className="flex flex-col justify-between px-8 py-10 sm:px-14 lg:px-20 lg:py-14">
          <header className="flex items-center gap-3 text-ink">
            <FitzroviaMark className="h-9 w-9" />
            <div className="text-sm">
              <div className="font-black tracking-[0.08em] text-ink">
                FITZROVIA
              </div>
              <div style={{ ...labelItalic, fontSize: 11 }}>
                Rental Comp
              </div>
            </div>
          </header>

          <div className="mx-auto w-full max-w-2xl py-10">
            <h1
              style={{ ...displayHeadline, lineHeight: 0.95 }}
              className="headline text-[3.75rem] sm:text-[5rem] lg:text-[6.25rem]"
            >
              Fitzrovia —
              <br />
              rental
              <br />
              competition
              <br />
              analyzer<span style={clayText}>.</span>
            </h1>

            <p className="mt-10 max-w-md text-base leading-relaxed text-ash">
              Sign in to view consolidated unit-type performance and
              effective-rent comparisons.
            </p>

            <div className="mt-12">
              <LoginForm />
            </div>
          </div>

          <footer className="flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-ash">
            <span>© Fitzrovia · Toronto</span>
            <span
              style={{ color: COLORS.clay }}
              className="hidden sm:inline"
            >
              v0.1 · Preview
            </span>
          </footer>
        </section>

        {/* RIGHT — hero image + tagline */}
        <aside className="relative hidden min-h-[420px] overflow-hidden bg-ink lg:block">
          <Image
            src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1800&q=85&auto=format&fit=crop"
            alt="Modern purpose-built rental tower at dusk"
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
                Designed by anika
              </span>
            </div>
            <h2
              style={displayHeadlinePaper}
              className="mt-4 text-[3.5rem]"
            >
              Rise to a higher
              <br />
              rental standard<span style={clayText}>.</span>
            </h2>
          </div>
        </aside>
      </main>
    </div>
  );
}
