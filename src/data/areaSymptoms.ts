/**
 * Area → symptom mapping used by the self-diagnosis wizard.
 *
 * Rules for clinicians editing this file:
 *  - Add/remove symptom keys inside each area's `symptoms` array.
 *  - The FIRST 3 keys in the array are treated as "top / most-common" and
 *    receive a subtle visual indicator in the UI.
 *  - Every new key must also be added to all three locale files
 *    (en/ar/ku) under the matching  areaSymptoms → <area> → <key>  path.
 *  - Left/right body-zone IDs (e.g. l-upper-arm / r-upper-arm) are
 *    automatically folded into their group key via ZONE_TO_GROUP below.
 *  - Head sub-zones (head-eyes, head-nose, head-ears, head-mouth) are
 *    selected directly on the face diagram in step 1 — not via a popup.
 */

/** Symptom keys per area group.  First 3 = top symptoms. */
export const AREA_SYMPTOM_KEYS: Record<string, string[]> = {
  // ⚠️ CLINICIAN REVIEW REQUIRED before any clinical use
  head:          ['headache', 'dizziness', 'pressure'],
  'head-eyes':   ['eye_pain'],
  'head-nose':   ['nose_problem'],
  'head-ears':   ['ear_pain'],
  'head-teeth':  ['mouth_throat_pain'],
  neck:          ['pain', 'stiffness', 'limited_movement'],
  chest:         ['chest_pain', 'shortness_of_breath', 'palpitations'],
  abdomen:       ['abdominal_pain', 'nausea', 'bloating'],
  pelvis:        ['pain', 'cramping', 'discomfort'],
  arm:           ['pain', 'numbness', 'weakness'],
  hand:          ['pain', 'tingling', 'swelling'],
  leg:           ['pain', 'swelling', 'cramping'],
  foot:          ['pain', 'swelling', 'numbness'],
  shoulder:      ['pain', 'stiffness', 'limited_movement'],
  back:          ['pain', 'stiffness', 'limited_movement'],
};

/**
 * Maps every SVG zone ID to its symptom-group key.
 * Left/right variants of the same body part share one group.
 * Head sub-zones come from the HeadDetailSVG face diagram (step 1).
 */
export const ZONE_TO_GROUP: Record<string, string> = {
  // ── Front ──────────────────────────────────────────────
  // Head sub-zones (flat hit zones on the body figure)
  'head-scalp':  'head',
  'head-eyes':   'head-eyes',   // single combined eyes zone
  'head-eye-l':  'head-eyes',   // kept for backward-compat with saved records
  'head-eye-r':  'head-eyes',
  'head-nose':   'head-nose',
  'head-ear-l':  'head-ears',
  'head-ear-r':  'head-ears',
  'head-teeth':  'head-teeth',
  'head-mouth':  'head-teeth',  // kept for backward-compat with saved records
  // Body zones
  neck:             'neck',
  'l-shoulder':     'shoulder',
  'r-shoulder':     'shoulder',
  chest:            'chest',
  abdomen:          'abdomen',
  'l-upper-arm':    'arm',
  'r-upper-arm':    'arm',
  'l-forearm':      'arm',
  'r-forearm':      'arm',
  pelvis:           'pelvis',
  'l-thigh':        'leg',
  'r-thigh':        'leg',
  'l-knee':         'leg',
  'r-knee':         'leg',
  'l-shin':         'leg',
  'r-shin':         'leg',
  'l-foot':         'foot',
  'r-foot':         'foot',
  // ── Back ───────────────────────────────────────────────
  'head-b':         'head',
  'neck-b':         'neck',
  'l-trap':         'shoulder',
  'r-trap':         'shoulder',
  'upper-back':     'back',
  'mid-back':       'back',
  'lower-back':     'back',
  'l-upper-arm-b':  'arm',
  'r-upper-arm-b':  'arm',
  'l-buttock':      'pelvis',
  'r-buttock':      'pelvis',
  'l-back-thigh':   'leg',
  'r-back-thigh':   'leg',
  'l-calf':         'leg',
  'r-calf':         'leg',
};
