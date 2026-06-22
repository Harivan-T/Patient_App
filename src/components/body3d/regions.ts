export const REGION_KEYS = [
  'head', 'neck', 'chest', 'abdomen', 'pelvis',
  'arm_left', 'arm_right', 'hand_left', 'hand_right',
  'leg_left', 'leg_right', 'foot_left', 'foot_right',
] as const;

export type RegionKey = (typeof REGION_KEYS)[number];
