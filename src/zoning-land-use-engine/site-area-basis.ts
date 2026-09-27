/**
 * InvestScape™ E85 — site-area basis for regulatory site-area thresholds.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * A legal site-area threshold (e.g. Vancouver C-2C §3.1.1.2(c), "site area
 * ≥ 1,672 m²") is measured against the by-law's own site area. A caller's
 * `siteAreaSqm` of unstated or different basis — gross title area, a net
 * figure with dedications still pending, or no source at all — can neither
 * prove such a threshold met nor prove it failed. E85 therefore only admits a
 * site area into applicability evaluation when its basis is established, and
 * otherwise leaves the site-area dimension UNDETERMINED (a DATA_GAP), never
 * silently choosing a basis for the caller.
 *
 * The basis is still caller-declared: "established" here means the caller
 * asserted a by-law-defined site area with resolved deductions and a stated
 * source. E85 does not and cannot verify that assertion against a City record.
 */
import type { E85ParcelReference } from "./jurisdiction-types";

/**
 * Every reason `parcel.siteAreaBasis` falls short of a by-law-defined site
 * area with resolved deductions and a stated source. Empty when the basis is
 * established. An absent basis is reported as its own single reason.
 */
export function e85SiteAreaBasisProblems(parcel: E85ParcelReference): string[] {
  const basis = parcel.siteAreaBasis;
  if (basis === undefined) return ["no siteAreaBasis was declared"];
  const problems: string[] = [];
  if (basis.kind !== "BYLAW_DEFINED_SITE_AREA") problems.push(`site area kind is ${basis.kind}, not confirmed as the by-law-defined site area`);
  if (basis.deductionStatus === "POSSIBLE_OR_PENDING" || basis.deductionStatus === "UNKNOWN") problems.push(`dedication/deduction status is ${basis.deductionStatus}`);
  if (basis.sourceReference === undefined || basis.sourceReference.trim() === "") problems.push("no source reference was given for the site area");
  return problems;
}

/**
 * The site area applicability evaluation may compare against a legal
 * threshold, or undefined when there is none or its basis is not established.
 * `siteAreaBasisIssue` explains a withheld figure so the resulting gap is not mistaken for
 * a site area that was simply never supplied.
 */
export function e85ThresholdSiteArea(parcel: E85ParcelReference): { siteAreaSqm?: number; siteAreaBasisIssue?: string } {
  if (parcel.siteAreaSqm === undefined) return {};
  const problems = e85SiteAreaBasisProblems(parcel);
  if (problems.length === 0) return { siteAreaSqm: parcel.siteAreaSqm };
  return {
    siteAreaBasisIssue: `parcel.siteAreaSqm (${parcel.siteAreaSqm}) was not used for site-area thresholds because ${problems.join("; ")}; a figure of unestablished basis cannot show a legal site-area threshold is met or unmet.`,
  };
}
