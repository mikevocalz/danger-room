/**
 * Measured geometry of assets/models/wolverine_cowl.png (370x468) — centroids of
 * the two white eye slits, extracted from the pixels (scripts in session log).
 * Replaces the hand-tuned MASK_SCALE / anchor-fraction fudge constants with a
 * solved similarity-transform template (Margelo face-pipeline article pattern).
 * ANCHOR = eye-mid nudged 22% toward the nose (0.5715·IOD below the eye line —
 * canonical ArcFace template geometry), matching faceAnchor.ts exactly.
 */
export const COWL = {
  w: 370,
  h: 468,
  iod: 136.5,       // px between slit centroids
  anchorX: 184.54,  // px, template anchor x
  anchorY: 302.45,  // px, template anchor y
} as const;
