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
 */

/** Symptom keys per area group.  First 3 = top symptoms. */
export const AREA_SYMPTOM_KEYS: Record<string, string[]> = {
  head:     ['headache', 'dizziness', 'pressure'],
  neck:     ['pain', 'stiffness', 'limited_movement'],
  chest:    ['chest_pain', 'shortness_of_breath', 'palpitations'],
  abdomen:  ['abdominal_pain', 'nausea', 'bloating'],
  pelvis:   ['pain', 'cramping', 'discomfort'],
  arm:      ['pain', 'numbness', 'weakness'],
  hand:     ['pain', 'tingling', 'swelling'],
  leg:      ['pain', 'swelling', 'cramping'],
  foot:     ['pain', 'swelling', 'numbness'],
  shoulder: ['pain', 'stiffness', 'limited_movement'],
  back:     ['pain', 'stiffness', 'limited_movement'],
};

/**
 * Maps every SVG zone ID to its symptom-group key.
 * Left/right variants of the same body part share one group.
 */
export const ZONE_TO_GROUP: Record<string, string> = {
  // ── Front ──────────────────────────────────────────────
  head:             'head',
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
