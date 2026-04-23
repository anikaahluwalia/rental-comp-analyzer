/**
 * The "Ask the market" page.
 *
 * Type a question in plain English — "cheapest 2-bed",
 * "buildings with incentives", "average rent for 1-beds" — and get an
 * answer card with the headline, supporting data, and some follow-up
 * questions you might want to ask next.
 *
 * The answers come from the latest scrape data, so what you see is
 * always based on the most recent numbers. The chip suggestions shown
 * under the input are examples we know the system handles well, so
 * first-time users have somewhere to start.
 */
import { QueryBar } from "@/interface/QueryBar";
import { QUERY_SUGGESTIONS } from "@/features/query";
import {
  clayAccentBar,
  clayText,
  displayHeadline,
  labelItalic,
} from "@/features/ui-style";

export const dynamic = "force-dynamic";

export default async function QueryPage() {
  return (
    <div className="space-y-10">
      <div className="border-b border-line pb-10">
        <div className="flex items-center gap-3">
          <span style={clayAccentBar} aria-hidden />
          <span style={{ ...labelItalic, fontSize: 14 }}>Ask the Market</span>
        </div>
        <h1
          style={displayHeadline}
          className="headline mt-4 text-[4rem] sm:text-[5.5rem]"
        >
          Ask
          <br />
          anything<span style={clayText}>.</span>
        </h1>
        <p
          style={{ ...labelItalic, fontSize: 12 }}
          className="mt-6 max-w-2xl"
        >
          Powered by a typed intent parser · production swaps in Claude with
          tool-use for open-ended questions.
        </p>
      </div>

      <QueryBar suggestions={QUERY_SUGGESTIONS} />
    </div>
  );
}
