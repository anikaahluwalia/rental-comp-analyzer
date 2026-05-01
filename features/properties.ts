import type { Property } from "./types";

/**
 * The ten target buildings — Midtown Toronto purpose-built rental comp set.
 *
 * Primary source of truth is each building's own official website. We
 * *also* pull from rental aggregators as a secondary read so a building
 * still shows pricing even when its own marketing site returns zero
 * (operator hasn't updated, JS widget failed to render, Cloudflare block,
 * etc.). The coordinator in `features/sources/index.ts` dedupes across
 * sources.
 *
 * Each entry carries:
 *   - `siteUrl`        the marketing site root, scraped to catch banner
 *                      promotions and any promo pages the operator publishes.
 *   - `floorplansUrl`  the specific page that lists units + pricing. For
 *                      most buildings this is /floorplans or /suites.
 *   - `rentalsCaUrl?`  rentals.ca listing page for the same building.
 *                      Optional — omit if unknown and that source is skipped.
 *   - `zillowUrl?`     Zillow listing page (zillow.com or zillow.ca — both
 *                      work, it's just a URL the scraper fetches). Optional.
 *                      Zillow's Canadian rental coverage is patchy, so only
 *                      the buildings that actually have a Zillow profile are
 *                      populated here.
 *   - `livRentUrl?`    liv.rent listing page. Also optional — liv.rent is
 *                      more common for Vancouver; only the Toronto buildings
 *                      with an actual profile on the platform are populated.
 *
 * All URLs below were verified by hand against the live aggregator pages.
 * If any drift (404 or redirect), the per-source ScrapeRun in the UI will
 * show the failure and the slug can be fixed here. Leaving a URL undefined
 * tells the scraper to skip that source cleanly ("skipped", not "failed").
 *
 * Note: E18HTEEN doesn't run a dedicated marketing site — their inventory
 * is listed on Realstar's myrental.ca platform — so siteUrl + floorplansUrl
 * point at the same URL there. The scraper handles that case fine.
 */
export const PROPERTIES: Property[] = [
  {
    id: "parker",
    name: "Parker",
    address: "200 Redpath Avenue, Toronto, ON",
    lat: 43.7093,
    lng: -79.3944,
    siteUrl: "https://www.parkerlife.ca",
    floorplansUrl: "https://www.parkerlife.ca/floorplans",
    rentalsCaUrl: "https://rentals.ca/toronto/200-redpath-avenue",
    zillowUrl: "https://www.zillow.com/apartments/toronto-on/parker/CkGFZj/",
    livRentUrl:
      "https://liv.rent/building/23131/the-parker-apartment-building-200-redpath-ave-toronto-on",
  },
  {
    id: "story-of-midtown",
    name: "Story of Midtown",
    address: "73 Broadway Avenue, Toronto, ON",
    lat: 43.7083,
    lng: -79.3963,
    siteUrl: "https://www.mystorymidtown.com",
    floorplansUrl: "https://www.mystorymidtown.com/suites",
    rentalsCaUrl: "https://rentals.ca/toronto/73-broadway-avenue",
  },
  {
    id: "the-selby",
    name: "The Selby",
    address: "25 Selby Street, Toronto, ON",
    lat: 43.6733,
    lng: -79.3774,
    siteUrl: "https://triconliving.com/apartment/the-selby/",
    floorplansUrl:
      "https://triconliving.com/apartment/the-selby/#your-perfect-layout",
    rentalsCaUrl: "https://rentals.ca/toronto/25-selby-street-1",
    zillowUrl: "https://www.zillow.com/apartments/toronto-on/the-selby/BNQ8Vm/",
  },
  {
    id: "ecentral",
    name: "eCentral",
    address: "15 Roehampton Avenue, Toronto, ON",
    lat: 43.7077,
    lng: -79.3973,
    siteUrl: "https://www.ecentralliving.com",
    floorplansUrl: "https://www.ecentralliving.com/rental-suites",
    rentalsCaUrl: "https://rentals.ca/toronto/15-roehampton-avenue-id1197586",
    zillowUrl: "https://www.zillow.com/apartments/toronto-on/ecentral/Cmftqw/",
  },
  {
    id: "the-montgomery",
    name: "The Montgomery",
    address: "2388 Yonge Street, Toronto, ON",
    lat: 43.7105,
    lng: -79.3985,
    siteUrl: "https://www.themontgomery.ca",
    floorplansUrl: "https://www.themontgomery.ca/floorplans",
    rentalsCaUrl: "https://rentals.ca/toronto/the-montgomery",
  },
  {
    id: "the-whitney",
    name: "The Whitney",
    address: "71 Redpath Avenue, Toronto, ON",
    lat: 43.7078,
    lng: -79.3946,
    siteUrl: "https://www.thewhitneyonredpath.com",
    floorplansUrl: "https://www.thewhitneyonredpath.com/apartments/",
    rentalsCaUrl: "https://rentals.ca/toronto/71-redpath-ave",
    zillowUrl:
      "https://www.zillow.com/b/the-whitney-on-redpath-toronto-on-BMWMwX/",
  },
  {
    id: "the-hampton",
    name: "The Hampton",
    address: "101 Roehampton Avenue, Toronto, ON",
    lat: 43.7081,
    lng: -79.3952,
    siteUrl: "https://thehampton.ca",
    floorplansUrl: "https://thehampton.ca/floorplans/",
    rentalsCaUrl: "https://rentals.ca/toronto/the-hampton",
    zillowUrl: "https://www.zillow.com/b/the-hampton-toronto-on-BgqrRH/",
  },
  {
    id: "e18hteen",
    name: "E18HTEEN",
    address: "18 Erskine Avenue, Toronto, ON",
    lat: 43.7091,
    lng: -79.3968,
    // E18HTEEN publishes availability on Realstar's myrental.ca platform
    // rather than a dedicated marketing site. Both URLs point at the same
    // listing page as a result.
    siteUrl: "https://www.myrental.ca/apartments-for-rent/18-erskine-ave",
    floorplansUrl:
      "https://www.myrental.ca/apartments-for-rent/18-erskine-ave",
    rentalsCaUrl: "https://rentals.ca/toronto/18-erskine-ave-toronto",
    zillowUrl: "https://www.zillow.com/apartments/toronto-on/e18hteen/CkGFxt/",
  },
  {
    id: "corner-on-broadway",
    name: "Corner on Broadway",
    address: "223 Redpath Avenue, Toronto, ON",
    lat: 43.7099,
    lng: -79.3942,
    siteUrl: "https://thecornerrentals.com",
    floorplansUrl: "https://thecornerrentals.com/suites",
    rentalsCaUrl: "https://rentals.ca/toronto/the-corner-on-broadway",
    zillowUrl:
      "https://www.zillow.com/apartments/toronto-on/the-corner-on-broadway/BkcSQb/",
    livRentUrl:
      "https://liv.rent/building/39745/the-corner-on-broadway-apartment-building-223-redpath-ave-toronto-on",
  },
  {
    id: "akoya-living",
    name: "Akoya Living",
    address: "55 Broadway Avenue, Toronto, ON",
    lat: 43.7085,
    lng: -79.3968,
    siteUrl: "https://www.akoyaliving.ca",
    floorplansUrl: "https://www.akoyaliving.ca/suites",
    rentalsCaUrl: "https://rentals.ca/toronto/akoya",
    zillowUrl: "https://www.zillow.com/apartments/toronto-on/akoya/BMJ7xv/",
  },
];

export function getProperty(id: string): Property | undefined {
  return PROPERTIES.find((p) => p.id === id);
}
