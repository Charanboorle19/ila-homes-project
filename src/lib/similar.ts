import { properties, type PropertyRecord } from "@/data/properties";

export type SimilarCard = {
  property: PropertyRecord;
  score: number;
  reasons: string[];
};

function scoreCandidate(
  current: PropertyRecord,
  candidate: PropertyRecord,
): SimilarCard | null {
  if (candidate.id === current.id) return null;
  if (candidate.status === "sold") return null;

  let score = 0;
  const reasons: string[] = [];

  if (candidate.locationKey === current.locationKey) {
    score += 28;
    reasons.push("Same locality belt");
  } else if (
    candidate.location.toLowerCase().includes("hyderabad") &&
    current.location.toLowerCase().includes("hyderabad")
  ) {
    score += 10;
  }

  const priceDelta =
    Math.abs(candidate.price - current.price) /
    Math.max(current.price, 1);
  if (priceDelta <= 0.25) {
    score += 22;
    reasons.push("Similar price band");
  } else if (priceDelta <= 0.45) {
    score += 12;
  }

  if (candidate.propertyType === current.propertyType) {
    score += 10;
  }

  if (candidate.facing === current.facing) {
    score += 8;
    reasons.push(`${candidate.facing} facing`);
  }

  if (candidate.corner && current.corner) {
    score += 6;
    reasons.push("Corner option");
  }
  if (candidate.parkFacing && current.parkFacing) {
    score += 6;
    reasons.push("Park facing");
  }

  const shared = candidate.features.filter((feature) =>
    current.features.includes(feature),
  );
  if (shared.length > 0) {
    score += Math.min(shared.length * 4, 12);
    reasons.push(shared[0]);
  }

  if (candidate.approval === current.approval) {
    score += 6;
  }

  if (candidate.status === "available") {
    score += 8;
  }

  if (score < 28) return null;

  return {
    property: candidate,
    score,
    reasons: reasons.slice(0, 3),
  };
}

export function getSimilarProperties(
  current: PropertyRecord,
  limit = 6,
): SimilarCard[] {
  return properties
    .map((candidate) => scoreCandidate(current, candidate))
    .filter((item): item is SimilarCard => Boolean(item))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
