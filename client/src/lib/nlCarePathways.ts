import type { RiskLevel } from "./riskReview";

export type CarePathway = {
  id: string;
  label: string;
  description: string;
  href: string;
  kind: "call" | "website" | "email";
  suggestedFor: RiskLevel[];
};

export const nlCarePathways: CarePathway[] = [
  {
    id: "call-911",
    label: "911 Emergency",
    description: "Use for immediate danger, overdose, or urgent medical emergency.",
    href: "tel:911",
    kind: "call",
    suggestedFor: ["Critical"],
  },
  {
    id: "call-811",
    label: "811 HealthLine",
    description:
      "24/7 support for mental health, addictions, crisis concerns, and help finding local services.",
    href: "tel:811",
    kind: "call",
    suggestedFor: ["Critical", "High", "Medium"],
  },
  {
    id: "doorways",
    label: "Doorways Counselling",
    description:
      "Rapid access mental health and addictions counselling with no referral required.",
    href: "https://nl.bridgethegapp.ca/service-directory/doorways-walk-in-clinic-counselling/",
    kind: "website",
    suggestedFor: ["High", "Medium", "Low"],
  },
  {
    id: "navigator-call",
    label: "Systems Navigator",
    description:
      "Provincial navigator for help connecting patients and families with mental health and addictions services.",
    href: "tel:18779997589",
    kind: "call",
    suggestedFor: ["High", "Medium", "Low"],
  },
  {
    id: "navigator-email",
    label: "Navigator Email",
    description:
      "Email the provincial mental health and addictions systems navigator for follow-up help.",
    href: "mailto:barry.hewitt@easternhealth.ca",
    kind: "email",
    suggestedFor: ["High", "Medium", "Low"],
  },
  {
    id: "warmline",
    label: "Lifewise Warmline",
    description:
      "Peer support phone line for mental health concerns when the patient needs support but not emergency care.",
    href: "tel:18557532560",
    kind: "call",
    suggestedFor: ["Medium", "Low"],
  },
  {
    id: "bridge-the-gapp",
    label: "Bridge the gapp",
    description:
      "NL online hub for self-help tools, local supports, and mental health and addictions information.",
    href: "https://nl.bridgethegapp.ca/",
    kind: "website",
    suggestedFor: ["Medium", "Low"],
  },
  {
    id: "patient-connect",
    label: "Patient Connect NL",
    description:
      "For patients who do not have a regular family doctor or nurse practitioner.",
    href: "https://www.gov.nl.ca/hcs/patient-connect-nl/",
    kind: "website",
    suggestedFor: ["Medium", "Low"],
  },
];

export function getRecommendedCarePathways(riskLevel: RiskLevel) {
  return nlCarePathways.filter((pathway) => pathway.suggestedFor.includes(riskLevel));
}
