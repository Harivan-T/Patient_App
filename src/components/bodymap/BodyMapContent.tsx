'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { BookDoctorOptions } from '@/components/ui/BookDoctorOptions';
import { AREA_SYMPTOM_KEYS, ZONE_TO_GROUP } from '@/data/areaSymptoms';

interface PainRecord {
  id: string;
  zones: string[];
  symptoms: string[];
  areaSymptoms?: Record<string, string[]>;
  painLevel: number;
  duration: string;
  movementPain: boolean;
  nightPain: boolean;
  takingMedication: boolean;
  hasFever: boolean;
  notes: string;
  recordedAt: string;
}

const BRAND = 'var(--color-primary)';

const DURATION_KEYS = ['today', 'fewDays', 'oneToTwoWeeks', 'oneMonth', 'threeMonths', 'overYear'] as const;
const QUESTION_KEYS = ['movementPain', 'nightPain', 'takingMedication', 'hasFever'] as const;

interface ZoneDef {
  id: string;
  side: 'front' | 'back';
  shape: { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
       | { type: 'rect';    x: number;  y: number;  w: number;  h: number; rx?: number };
}

const ZONES: ZoneDef[] = [
  // Front zones - adjusted for PNG image alignment
  { id: 'neck',          side: 'front', shape: { type: 'rect',    x: 85,  y: 55,  w: 30,  h: 20, rx: 5 } },
  { id: 'l-shoulder',    side: 'front', shape: { type: 'ellipse', cx: 67, cy: 70, rx: 15, ry: 8 } },
  { id: 'r-shoulder',    side: 'front', shape: { type: 'ellipse', cx: 133,cy: 70, rx: 15, ry: 8 } },
  { id: 'chest',         side: 'front', shape: { type: 'rect',    x: 70,  y: 70,  w: 60,  h: 45, rx: 5 } },
  { id: 'abdomen',       side: 'front', shape: { type: 'rect',    x: 72,  y: 120, w: 56,  h: 34, rx: 5 } },
  { id: 'l-upper-arm',   side: 'front', shape: { type: 'rect',    x: 54,  y: 75,  w: 16,  h: 55, rx: 8 } },
  { id: 'r-upper-arm',   side: 'front', shape: { type: 'rect',    x: 125, y: 75,  w: 16,  h: 55, rx: 8 } },
  { id: 'l-forearm',     side: 'front', shape: { type: 'rect',    x: 53,  y: 130, w: 12,  h: 50, rx: 7 } },
  { id: 'r-forearm',     side: 'front', shape: { type: 'rect',    x: 131, y: 130, w: 12,  h: 50, rx: 7 } },
  { id: 'l-hand',        side: 'front', shape: { type: 'ellipse', cx: 57, cy: 192, rx: 7, ry: 12 } },
  { id: 'r-hand',        side: 'front', shape: { type: 'ellipse', cx: 143,cy: 192, rx: 7, ry: 12 } },
  { id: 'pelvis',        side: 'front', shape: { type: 'rect',    x: 65,  y: 156, w: 70,  h: 30, rx: 8 } },
  { id: 'l-thigh',       side: 'front', shape: { type: 'rect',    x: 67,  y: 180, w: 30,  h: 60, rx: 8 } },
  { id: 'r-thigh',       side: 'front', shape: { type: 'rect',    x: 103, y: 180, w: 30,  h: 60, rx: 8 } },
  { id: 'l-knee',        side: 'front', shape: { type: 'ellipse', cx: 85, cy: 250, rx: 10, ry: 8 } },
  { id: 'r-knee',        side: 'front', shape: { type: 'ellipse', cx: 115,cy: 250, rx: 10, ry: 8 } },
  { id: 'l-shin',        side: 'front', shape: { type: 'rect',    x: 73,  y: 259, w: 23,  h: 45, rx: 6 } },
  { id: 'r-shin',        side: 'front', shape: { type: 'rect',    x: 102, y: 259, w: 23,  h: 45, rx: 6 } },
  { id: 'l-ankle',       side: 'front', shape: { type: 'ellipse', cx: 75, cy: 310, rx: 10, ry: 7 } },
  { id: 'r-ankle',       side: 'front', shape: { type: 'ellipse', cx: 125,cy: 310, rx: 10, ry: 7 } },
  { id: 'l-foot',        side: 'front', shape: { type: 'ellipse', cx: 81, cy: 338, rx: 9, ry: 14 } },
  { id: 'r-foot',        side: 'front', shape: { type: 'ellipse', cx: 119,cy: 338, rx: 9, ry: 14 } },
  // Back zones - adjusted for PNG image alignment
  { id: 'head-b',        side: 'back',  shape: { type: 'ellipse', cx: 100, cy: 26, rx: 20, ry: 24 } },
  { id: 'neck-b',        side: 'back',  shape: { type: 'rect',    x: 85,  y: 47,  w: 30,  h: 20, rx: 5 } },
  { id: 'l-trap',        side: 'back',  shape: { type: 'ellipse', cx: 68, cy: 75, rx: 16, ry: 8 } },
  { id: 'r-trap',        side: 'back',  shape: { type: 'ellipse', cx: 132,cy: 75, rx: 16, ry: 8 } },
  { id: 'upper-back',    side: 'back',  shape: { type: 'rect',    x: 70,  y: 83,  w: 60,  h: 27, rx: 5 } },
  { id: 'mid-back',      side: 'back',  shape: { type: 'rect',    x: 72,  y: 117, w: 56,  h: 24, rx: 5 } },
  { id: 'lower-back',    side: 'back',  shape: { type: 'rect',    x: 72,  y: 150, w: 56,  h: 21, rx: 5 } },
  { id: 'l-upper-arm-b', side: 'back',  shape: { type: 'rect',    x: 35,  y: 75,  w: 25,  h: 55, rx: 8 } },
  { id: 'r-upper-arm-b', side: 'back',  shape: { type: 'rect',    x: 140, y: 75,  w: 25,  h: 55, rx: 8 } },
  { id: 'l-elbow-b',     side: 'back',  shape: { type: 'ellipse', cx: 62, cy: 131.5, rx: 10, ry: 8 } },
  { id: 'r-elbow-b',     side: 'back',  shape: { type: 'ellipse', cx: 138,cy: 131.5, rx: 10, ry: 8 } },
  { id: 'l-forearm-b',   side: 'back',  shape: { type: 'rect',    x: 40,  y: 135, w: 15,  h: 50, rx: 7 } },
  { id: 'r-forearm-b',   side: 'back',  shape: { type: 'rect',    x: 145, y: 135, w: 15,  h: 50, rx: 7 } },
  { id: 'l-hand-b',      side: 'back',  shape: { type: 'ellipse', cx: 56, cy: 194, rx: 8, ry: 12 } },
  { id: 'r-hand-b',      side: 'back',  shape: { type: 'ellipse', cx: 145,cy: 194, rx: 8, ry: 12 } },
  { id: 'l-buttock',     side: 'back',  shape: { type: 'rect',    x: 65,  y: 175, w: 32,  h: 32, rx: 8 } },
  { id: 'r-buttock',     side: 'back',  shape: { type: 'rect',    x: 103, y: 175, w: 32,  h: 32, rx: 8 } },
  { id: 'l-back-thigh',  side: 'back',  shape: { type: 'rect',    x: 65,  y: 207, w: 30,  h: 60, rx: 8 } },
  { id: 'r-back-thigh',  side: 'back',  shape: { type: 'rect',    x: 105, y: 207, w: 30,  h: 60, rx: 8 } },
  { id: 'l-calf',        side: 'back',  shape: { type: 'rect',    x: 65,  y: 272, w: 25,  h: 45, rx: 6 } },
  { id: 'r-calf',        side: 'back',  shape: { type: 'rect',    x: 110, y: 272, w: 25,  h: 45, rx: 6 } },
];

function zoneKey(id: string): string {
  const backSpecific = ['l-forearm-b', 'r-forearm-b', 'l-hand-b', 'r-hand-b', 'l-elbow-b', 'r-elbow-b'];
  if (backSpecific.includes(id)) return id.replace(/-/g, '_');
  return id.replace(/-b$/, '').replace(/-/g, '_');
}

function painColor(level: number): string {
  if (level <= 3) return '#22c55e';
  if (level <= 6) return '#f59e0b';
  return '#ef4444';
}

// Face zone coordinates in body-SVG space (viewBox 0 0 200 300).
function BodySVG({ side, selectedZones, onToggle, gender }: {
  side: 'front' | 'back';
  selectedZones: string[];
  onToggle: (id: string) => void;
  gender: 'male' | 'female';
}) {
  const isFront  = side === 'front';
  const isFemale = gender === 'female';
  const zones    = ZONES.filter((z) => z.side === side);
  const imgSrc = `/${gender === 'female' ? 'Female' : 'Male'}-${side}.PNG`;

  const headHit = (id: string) => {
    const sel = selectedZones.includes(id);
    return {
      fill: BRAND,
      fillOpacity: sel ? 0.38 : 0.08,
      stroke: BRAND,
      strokeWidth: sel ? 1.5 : 1.2,
      strokeOpacity: sel ? 0.9 : 0.55,
      strokeDasharray: sel ? undefined : ('3 2' as const),
      className: 'cursor-pointer transition-all hover:fill-[var(--color-primary)] hover:fill-opacity-[0.2]',
      onClick: () => onToggle(id),
    };
  };

  function renderShape(z: ZoneDef, selected: boolean) {
    const sharedProps = {
      fill: selected ? BRAND : 'transparent',
      fillOpacity: selected ? 0.45 : 0,
      stroke: selected ? BRAND : '#94a3b8',
      strokeWidth: selected ? 2 : 1,
      className: 'cursor-pointer transition-all hover:fill-[var(--color-primary)] hover:fill-opacity-20',
      onClick: () => onToggle(z.id),
    };
    if (z.shape.type === 'ellipse') {
      let cx = z.shape.cx;
      let cy = z.shape.cy;
      let rx = z.shape.rx;
      let ry = z.shape.ry;
      if (z.id === 'l-shoulder' && gender === 'female') {
        cx += 7;
        cy += 7;
      } else if (z.id === 'r-shoulder' && gender === 'female') {
        cx -= 7;
        cy += 7;
      } else if (z.id === 'l-knee') {
        if (gender === 'female') { cx += 2; cy -= 2; }
        else if (gender === 'male') cx -= 1;
      } else if (z.id === 'r-knee') {
        if (gender === 'female') { cx -= 2; cy -= 2; }
        else if (gender === 'male') cx += 1;
      } else if (z.id === 'l-ankle') {
        if (gender === 'female') { cx += 15; cy += 2; }
        else if (gender === 'male') { cx += 6; cy += 2; }
      } else if (z.id === 'r-ankle') {
        if (gender === 'female') { cx -= 15; cy += 2; }
        else if (gender === 'male') { cx -= 6; cy += 2; }
      } else if (z.id === 'l-foot') {
        if (gender === 'female') { cx += 8; cy -= 4; }
        else if (gender === 'male') { cx += 1; cy -= 2; }
      } else if (z.id === 'r-foot') {
        if (gender === 'female') { cx -= 8; cy -= 4; }
        else if (gender === 'male') { cx -= 1; cy -= 2; }
      } else if ((z.id === 'l-trap' || z.id === 'r-trap') && gender === 'female') {
        cy += 2;
        if (z.id === 'l-trap') cx += 6;
        else if (z.id === 'r-trap') cx -= 6;
      } else if ((z.id === 'l-trap' || z.id === 'r-trap') && gender === 'male') {
        cy -= 5;
        if (z.id === 'l-trap') cx += 2;
        else if (z.id === 'r-trap') cx -= 2;
      }
      if (gender === 'female' && z.side === 'back' && z.id !== 'head-b') {
        rx *= 0.8;
        ry *= 0.8;
      }
      return <ellipse key={z.id} cx={cx} cy={cy} rx={rx} ry={ry} {...sharedProps} />;
    }
    let y =
      (z.id === 'neck' || z.id === 'upper-back') && gender === 'male'
        ? z.shape.y - 5
        : z.id === 'mid-back' && gender === 'male'
          ? z.shape.y - 10
          : z.id === 'lower-back' && gender === 'male'
            ? z.shape.y - 18
            : (z.id === 'l-back-thigh' || z.id === 'r-back-thigh') && gender === 'male'
              ? z.shape.y - 18
              : (z.id === 'l-calf' || z.id === 'r-calf') && gender === 'male'
                ? z.shape.y - 10
                : z.id === 'chest' && gender === 'female'
                  ? z.shape.y + 4
                  : z.shape.y;
    let w =
      (z.id === 'l-thigh' || z.id === 'r-thigh') && gender === 'female'
        ? z.shape.w - 3
        : (z.id === 'l-upper-arm-b' || z.id === 'r-upper-arm-b') && gender === 'male'
          ? z.shape.w - 6
          : (z.id === 'l-back-thigh' || z.id === 'r-back-thigh') && gender === 'male'
            ? z.shape.w - 4
            : (z.id === 'l-calf' || z.id === 'r-calf') && gender === 'male'
              ? z.shape.w - 7
              : z.shape.w;
    let h = z.shape.h;
    if ((z.id === 'l-back-thigh' || z.id === 'r-back-thigh') && gender === 'male') {
      h -= 4;
    } else if ((z.id === 'l-upper-arm-b' || z.id === 'r-upper-arm-b') && gender === 'male') {
      h -= 3;
    }
    let x = z.shape.x;
    if (z.id === 'l-thigh' && gender === 'female') {
      x += 2;
    } else if (z.id === 'l-forearm' && gender === 'male') {
      x -= 1;
    } else if (z.id === 'r-shin' && gender === 'male') {
      x += 2;
    } else if ((z.id === 'r-upper-arm' || z.id === 'r-forearm') && gender === 'male') {
      x += 5;
    } else if (z.id === 'l-back-thigh' && gender === 'male') {
      x += 3;
    } else if (z.id === 'l-calf' && gender === 'male') {
      x += 8;
    } else if (z.id === 'r-calf' && gender === 'male') {
      x -= 2;
    } else if ((z.id === 'l-forearm-b' || z.id === 'r-forearm-b')) {
      if (z.id === 'l-forearm-b') x = z.shape.x + 7;
      else if (z.id === 'r-forearm-b') x = z.shape.x - 7;
    } else if ((z.id === 'l-upper-arm-b' || z.id === 'r-upper-arm-b') && gender === 'male') {
      if (z.id === 'l-upper-arm-b') x += 15;
      else if (z.id === 'r-upper-arm-b') x -= 10;
    } else if ((z.id === 'l-upper-arm-b' || z.id === 'r-upper-arm-b') && gender === 'female') {
      if (z.id === 'l-upper-arm-b') x += 16;
      else if (z.id === 'r-upper-arm-b') x -= 16;
    }
    if ((z.id === 'l-upper-arm-b' || z.id === 'r-upper-arm-b') && gender === 'female') {
      w -= 2;
    }
    if ((z.id === 'l-buttock' || z.id === 'r-buttock') && gender === 'male') {
      y -= 17;
      w -= 4;
      h -= 4;
      x += 2;
      if (z.id === 'l-buttock') x += 3;
      else if (z.id === 'r-buttock') x -= 3;
    }
    if (gender === 'female' && z.side === 'back' && z.id !== 'head-b') {
      const dx = w * 0.1;
      const dy = h * 0.1;
      x += dx;
      y += dy;
      w *= 0.8;
      h *= 0.8;
    }
    if (z.id === 'neck-b' && gender === 'female') {
      y += 5;
    }
    if (z.id === 'mid-back' && gender === 'female') {
      y -= 9;
    }
    if (z.id === 'lower-back' && gender === 'female') {
      w += 6;
      x -= 3;
      y -= 16;
    }
    if ((z.id === 'l-buttock' || z.id === 'r-buttock') && gender === 'female') {
      y -= 17;
      w += 4;
      h += 2;
      x -= 2;
      y -= 1;
    }
    if ((z.id === 'l-back-thigh' || z.id === 'r-back-thigh') && gender === 'female') {
      y -= 21;
      if (z.id === 'l-back-thigh') x += 5;
      else if (z.id === 'r-back-thigh') x -= 5;
    }
    if ((z.id === 'l-calf' || z.id === 'r-calf') && gender === 'female') {
      w -= 3;
      h += 16;
      x += 1.5;
      y -= 21;
      if (z.id === 'l-calf') x += 10;
      else if (z.id === 'r-calf') x -= 10;
    }
    let transform: string | undefined;
    if (z.id === 'l-forearm-b' || z.id === 'r-forearm-b') {
      const angle = z.id === 'l-forearm-b' ? 10 : -10;
      const pivotX = x + w / 2;
      const pivotY = y + h;
      transform = `rotate(${angle}, ${pivotX}, ${pivotY})`;
    }
    return <rect key={z.id} x={x} y={y} width={w} height={h} rx={z.shape.rx ?? 0} transform={transform} {...sharedProps} />;
  }

  return (
    <svg viewBox="0 0 200 350" className="w-full max-w-[320px] mx-auto select-none">
      {/* ── Real body background image ─────────────────────────────── */}
      <image href={imgSrc} x="0" y="0" width="200" height="350" transform={gender === 'male' ? 'translate(0 2)' : undefined} />

      {/* ── Body zones (non-head) ─────────────────────────────────── */}
      {zones.map((z) => renderShape(z, selectedZones.includes(z.id)))}

      {/* ── Front head: 6 flat hit zones directly tappable at normal scale ── */}
      {/* Render order = priority: later elements win clicks on overlap areas */}
      {isFront && (
        <g transform={gender === 'male' ? 'translate(0 -8)' : undefined}>
          {/* Full head ellipse — catches forehead, skull, chin (background layer) */}
          <ellipse cx="100" cy="35" rx="18" ry="26" {...headHit('head-scalp')} />
          {/* Ear zones — cover ear protrusions + side edges of head */}
          <ellipse cx={gender === 'female' ? 82.5 : 82.5} cy={gender === 'female' ? 40 : 39} rx="3.5" ry="5.5" {...headHit('head-ear-l')} />
          <ellipse cx={gender === 'female' ? 117.5 : 117.5} cy={gender === 'female' ? 40 : 39} rx="3.5" ry="5.5" {...headHit('head-ear-r')} />
          {/* Eyes band — upper horizontal strip (both eyes, overrides ear overlap) */}
          <rect x="85" y={gender === 'female' ? 34.5 : 33} width="30" height="5" {...headHit('head-eyes')} />
          {/* Nose zone — center strip */}
          <rect x={gender === 'female' ? 94.5 : 94} y="38" width={gender === 'female' ? 11 : 12} height="9" {...headHit('head-nose')} />
          {/* Teeth/mouth zone — lower strip */}
          <rect x="92" y="48.5" width="16" height="8" {...headHit('head-teeth')} />
        </g>
      )}
    </svg>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 shrink-0">{label}</span>
      <div className="text-end">{children}</div>
    </div>
  );
}

function formatDateTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
}

export function BodyMapContent() {
  const t             = useTranslations('bodymap');
  const tCommon       = useTranslations('common');
  const tAreaSymptoms = useTranslations('areaSymptoms');
  const tBooking      = useTranslations('booking');

  const [step, setStep] = useState(1);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [zones, setZones]               = useState<string[]>([]);
  const [areaSymptoms, setAreaSymptoms] = useState<Record<string, string[]>>({});
  const [painLevel, setPainLevel] = useState(5);
  const [duration, setDuration] = useState('');
  const [answers, setAnswers] = useState({ movementPain: false, nightPain: false, takingMedication: false, hasFever: false });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [submitted, setSubmitted]         = useState(false);
  const [bookStep5Open, setBookStep5Open]       = useState(false);
  const [historyOpen, setHistoryOpen]           = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [history, setHistory]                   = useState<PainRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  function getZoneLabel(id: string): string {
    return t(`zones.${zoneKey(id)}` as Parameters<typeof t>[0]);
  }

  function painLabel(level: number): string {
    if (level <= 3) return t('pain.mild');
    if (level <= 6) return t('pain.moderate');
    return t('pain.severe');
  }

  function getSymptomLabel(key: string): string {
    if (key.includes('.')) {
      const [area, sym] = key.split('.');
      try { return (tAreaSymptoms as (k: string) => string)(`${area}.${sym}`); } catch { return sym; }
    }
    return t(`symptoms.${key.toLowerCase()}` as Parameters<typeof t>[0]);
  }

  function getDurationLabel(key: string): string {
    return t(`durations.${key}` as Parameters<typeof t>[0]);
  }

  function buildCollapsedSymptomLine(rec: PainRecord): string {
    // Use structured areaSymptoms if available (new records); fall back to parsing flat symptoms array
    const src: Record<string, string[]> = rec.areaSymptoms && Object.keys(rec.areaSymptoms).length > 0
      ? rec.areaSymptoms
      : {};
    if (Object.keys(src).length === 0) {
      for (const s of (rec.symptoms ?? [])) {
        if (s.includes('.')) {
          const [area, key] = s.split('.');
          (src[area] ??= []).push(key);
        }
      }
    }
    return Object.entries(src)
      .filter(([, syms]) => syms.length > 0)
      .map(([group, syms]) => {
        const areaLabel = (tAreaSymptoms as (k: string) => string)(`${group}.label`);
        const symptomLabels = syms
          .map(sym => { try { return (tAreaSymptoms as (k: string) => string)(`${group}.${sym}`); } catch { return sym; } })
          .join(', ');
        return `${areaLabel}: ${symptomLabels}`;
      })
      .join(' · ');
  }

  function toggleZone(id: string) {
    setZones((prev) => prev.includes(id) ? prev.filter((z) => z !== id) : [...prev, id]);
  }

  function toggleAreaSymptom(group: string, symptom: string) {
    setAreaSymptoms(prev => {
      const cur  = prev[group] ?? [];
      const next = cur.includes(symptom) ? cur.filter(s => s !== symptom) : [...cur, symptom];
      return { ...prev, [group]: next };
    });
  }

  // Unique area groups for the selected zones, filtered to those with known symptom lists
  const selectedGroups = Array.from(new Set(zones.map(z => ZONE_TO_GROUP[z] ?? z))).filter(g => g in AREA_SYMPTOM_KEYS);
  const hasAnySymptom  = Object.values(areaSymptoms).some(s => s.length > 0);
  // Compound "area.symptomKey" strings for backward-compat API submission
  const allSymptoms    = Object.entries(areaSymptoms).flatMap(([area, syms]) => syms.map(sym => `${area}.${sym}`));

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/pain-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zones, symptoms: allSymptoms, areaSymptoms, painLevel, duration, ...answers, notes }),
      });
      if (res.ok) { setSubmitted(true); loadHistory(); }
    } finally { setSubmitting(false); }
  }

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/pain-record');
      const data = await res.json();
      setHistory(data.records ?? []);
    } finally { setLoadingHistory(false); }
  }

  useEffect(() => {
    loadHistory();
    fetch('/api/profile').then(r => r.json()).then(data => {
      if (data?.gender?.toLowerCase().startsWith('f')) setGender('female');
    }).catch(() => {});
  }, []);

  function resetForm() {
    setStep(1); setSide('front'); setZones([]); setAreaSymptoms({});
    setPainLevel(5); setDuration(''); setNotes('');
    setAnswers({ movementPain: false, nightPain: false, takingMedication: false, hasFever: false });
    setSubmitted(false); setBookStep5Open(false);
  }

  const STEP_LABELS = [
    t('steps.zones'), t('steps.symptoms'), t('steps.painScale'),
    t('steps.questions'), t('steps.review'),
  ];

  return (
    <div className="max-w-lg mx-auto">
      {submitted ? (
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: '#d1fae5' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" className="w-8 h-8">
              <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">{t('success.title')}</h2>
          <p className="text-sm text-gray-500">{t('success.subtitle')}</p>
          <button onClick={resetForm} className="inline-flex items-center gap-2 h-10 px-5 rounded-full text-white text-sm font-semibold transition-opacity hover:opacity-90" style={{ background: BRAND }}>
            {t('buttons.startNew')}
          </button>
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-6 px-1">
            {STEP_LABELS.map((label, i) => (
              <div key={i} className="flex-1 flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                    style={{ background: i + 1 <= step ? BRAND : '#e5e7eb', color: i + 1 <= step ? 'white' : '#9ca3af' }}
                  >
                    {i + 1 < step ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    ) : i + 1}
                  </div>
                  <span className="text-[10px] text-gray-400 hidden sm:block">{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className="flex-1 h-0.5 mx-1 transition-colors" style={{ background: i + 1 < step ? BRAND : '#e5e7eb' }} />
                )}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">{t('step1.heading')}</h2>
              <p className="text-sm text-gray-500 mb-4">{t('step1.subtitle')}</p>
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                  {(['front', 'back'] as const).map((s) => (
                    <button key={s} onClick={() => setSide(s)}
                      className="py-1.5 px-5 rounded-lg text-sm font-medium transition-colors"
                      style={side === s ? { background: 'white', color: BRAND, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: '#6b7280' }}>
                      {s === 'front' ? t('step1.front') : t('step1.back')}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                  {(['male', 'female'] as const).map((g) => (
                    <button key={g} onClick={() => setGender(g)}
                      className="py-1.5 px-3 rounded-lg text-sm font-medium transition-colors"
                      style={gender === g ? { background: 'white', color: BRAND, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: '#6b7280' }}>
                      {g === 'male' ? '♂' : '♀'}
                    </button>
                  ))}
                </div>
              </div>
              <BodySVG side={side} selectedZones={zones} onToggle={toggleZone} gender={gender} />
              {zones.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                  {zones.map((id) => (
                    <span key={id} className="text-xs px-2.5 py-1 rounded-full text-white flex items-center gap-1" style={{ background: BRAND }}>
                      {getZoneLabel(id)}
                      <button onClick={() => toggleZone(id)} className="opacity-70 hover:opacity-100 leading-none">×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex justify-end mt-5">
                <button onClick={() => setStep(2)} disabled={zones.length === 0} className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full text-white font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: BRAND }}>
                  {t('buttons.next')}
                  <span className="w-6 h-6 rounded-full bg-white/20 inline-flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 rtl:rotate-180"><path d="M2 7h10M8 3l4 4-4 4" /></svg>
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">{t('step2.heading')}</h2>
              <p className="text-sm text-gray-500 mb-4">{t('step2.subtitle')}</p>
              {selectedGroups.map((group, gIdx) => (
                <div key={group} className={gIdx > 0 ? 'mt-5' : ''}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND }}>
                      {(tAreaSymptoms as (k: string) => string)(`${group}.label`)}
                    </span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(AREA_SYMPTOM_KEYS[group] ?? []).map((symptomKey, sIdx) => {
                      const isActive = (areaSymptoms[group] ?? []).includes(symptomKey);
                      return (
                        <button key={symptomKey}
                          onClick={() => toggleAreaSymptom(group, symptomKey)}
                          className="relative py-3 px-4 rounded-xl border-2 text-sm font-medium text-start transition-all"
                          style={{ borderColor: isActive ? BRAND : '#e5e7eb', background: isActive ? 'var(--tibbna-light)' : 'white', color: isActive ? '#0e7490' : '#374151' }}>
                          {(tAreaSymptoms as (k: string) => string)(`${group}.${symptomKey}`)}
                          {sIdx < 3 && !isActive && (
                            <span className="absolute top-1.5 end-1.5 w-1.5 h-1.5 rounded-full" style={{ background: BRAND, opacity: 0.4 }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="flex justify-between mt-5">
                <button onClick={() => setStep(1)} className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 font-medium text-sm transition-colors hover:bg-gray-200 dark:hover:bg-slate-600">
                  <span className="w-6 h-6 rounded-full bg-gray-300/60 dark:bg-slate-600 inline-flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 rtl:rotate-180"><path d="M12 7H2M6 3L2 7l4 4" /></svg>
                  </span>
                  {t('buttons.back')}
                </button>
                <button onClick={() => setStep(3)} disabled={!hasAnySymptom} className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full text-white font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: BRAND }}>
                  {t('buttons.next')}
                  <span className="w-6 h-6 rounded-full bg-white/20 inline-flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 rtl:rotate-180"><path d="M2 7h10M8 3l4 4-4 4" /></svg>
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">{t('step3.heading')}</h2>
              <p className="text-sm text-gray-500 mb-6">{t('step3.subtitle')}</p>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">{t('step3.painLevel')}</span>
                  <span className="text-2xl font-bold" style={{ color: painColor(painLevel) }}>
                    {painLevel} <span className="text-sm font-normal">— {painLabel(painLevel)}</span>
                  </span>
                </div>
                <input type="range" min="1" max="10" value={painLevel}
                  onChange={(e) => setPainLevel(Number(e.target.value))}
                  className="w-full h-3 rounded-full appearance-none cursor-pointer"
                  style={{ background: 'linear-gradient(to right, #22c55e, #f59e0b, #ef4444)', accentColor: painColor(painLevel) }} />
                <div className="flex justify-between text-xs text-gray-400 mt-1 px-0.5">
                  {Array.from({ length: 10 }, (_, i) => <span key={i}>{i + 1}</span>)}
                </div>
              </div>
              <div className="mb-2">
                <p className="text-sm font-medium text-gray-700 mb-2">{t('step3.duration')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {DURATION_KEYS.map((key) => (
                    <button key={key} onClick={() => setDuration(key)}
                      className="py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all"
                      style={{ borderColor: duration === key ? BRAND : '#e5e7eb', background: duration === key ? 'var(--tibbna-light)' : 'white', color: duration === key ? '#0e7490' : '#374151' }}>
                      {t(`durations.${key}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between mt-5">
                <button onClick={() => setStep(2)} className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 font-medium text-sm transition-colors hover:bg-gray-200 dark:hover:bg-slate-600">
                  <span className="w-6 h-6 rounded-full bg-gray-300/60 dark:bg-slate-600 inline-flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 rtl:rotate-180"><path d="M12 7H2M6 3L2 7l4 4" /></svg>
                  </span>
                  {t('buttons.back')}
                </button>
                <button onClick={() => setStep(4)} disabled={!duration} className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full text-white font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: BRAND }}>
                  {t('buttons.next')}
                  <span className="w-6 h-6 rounded-full bg-white/20 inline-flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 rtl:rotate-180"><path d="M2 7h10M8 3l4 4-4 4" /></svg>
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">{t('step4.heading')}</h2>
              <p className="text-sm text-gray-500 mb-4">{t('step4.subtitle')}</p>
              <div className="space-y-3 mb-5">
                {QUESTION_KEYS.map((key) => {
                  const val = answers[key];
                  return (
                    <div key={key} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50">
                      <span className="text-sm text-gray-700 pe-4">{t(`questions.${key}`)}</span>
                      <div className="flex gap-2 shrink-0">
                        {([true, false] as const).map((v) => (
                          <button key={String(v)}
                            onClick={() => setAnswers((a) => ({ ...a, [key]: v }))}
                            className="px-3 py-1 rounded-lg text-sm font-medium border transition-all"
                            style={{
                              borderColor: val === v ? (v ? '#22c55e' : '#ef4444') : '#e5e7eb',
                              background: val === v ? (v ? '#f0fdf4' : '#fef2f2') : 'white',
                              color: val === v ? (v ? '#16a34a' : '#dc2626') : '#6b7280',
                            }}>
                            {v ? tCommon('yes') : tCommon('no')}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('step4.notes')} <span className="text-gray-400 font-normal">({t('step4.notesOptional')})</span>
                </label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('step4.notesPlaceholder')} className="input resize-none" rows={3} maxLength={500} />
              </div>
              <div className="flex justify-between mt-5">
                <button onClick={() => setStep(3)} className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 font-medium text-sm transition-colors hover:bg-gray-200 dark:hover:bg-slate-600">
                  <span className="w-6 h-6 rounded-full bg-gray-300/60 dark:bg-slate-600 inline-flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 rtl:rotate-180"><path d="M12 7H2M6 3L2 7l4 4" /></svg>
                  </span>
                  {t('buttons.back')}
                </button>
                <button onClick={() => setStep(5)} className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full text-white font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80" style={{ background: BRAND }}>
                  {t('steps.review')}
                  <span className="w-6 h-6 rounded-full bg-white/20 inline-flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 rtl:rotate-180"><path d="M2 7h10M8 3l4 4-4 4" /></svg>
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="font-semibold text-gray-900 mb-4">{t('step5.heading')}</h2>
              <div className="space-y-3 text-sm">
                <SummaryRow label={t('step5.affectedAreas')}>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {zones.map((id) => (
                      <span key={id} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: BRAND }}>{getZoneLabel(id)}</span>
                    ))}
                  </div>
                </SummaryRow>
                {Object.entries(areaSymptoms).filter(([, syms]) => syms.length > 0).map(([group, syms]) => (
                  <SummaryRow key={group} label={(tAreaSymptoms as (k: string) => string)(`${group}.label`)}>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {syms.map(sym => (
                        <span key={sym} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {(tAreaSymptoms as (k: string) => string)(`${group}.${sym}`)}
                        </span>
                      ))}
                    </div>
                  </SummaryRow>
                ))}
                <SummaryRow label={t('step5.painLevel')}>
                  <span className="font-bold text-base" style={{ color: painColor(painLevel) }}>{painLevel}/10 — {painLabel(painLevel)}</span>
                </SummaryRow>
                <SummaryRow label={t('step5.duration')}>
                  <span className="text-gray-700">{getDurationLabel(duration)}</span>
                </SummaryRow>
                {QUESTION_KEYS.map((key) => (
                  <SummaryRow key={key} label={t(`questions.${key}`)}>
                    <span style={{ color: answers[key] ? '#16a34a' : '#dc2626' }}>{answers[key] ? tCommon('yes') : tCommon('no')}</span>
                  </SummaryRow>
                ))}
                {notes && (
                  <SummaryRow label={t('step5.notes')}>
                    <span className="text-gray-600 text-xs max-w-[200px] text-end">{notes}</span>
                  </SummaryRow>
                )}
              </div>
              <div className="flex justify-between mt-6">
                <button onClick={() => setStep(4)} className="btn-secondary">{t('buttons.edit')}</button>
                <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
                  {submitting ? t('buttons.submitting') : t('buttons.submit')}
                </button>
              </div>
              {/* Placement 2 — Book a Doctor at end of diagnosis flow */}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setBookStep5Open(o => !o)}
                  className="w-full flex items-center justify-between px-5 py-3 rounded-2xl text-white font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80"
                  style={{ background: 'var(--color-primary)' }}
                >
                  <span className="flex items-center gap-2.5">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0" aria-hidden="true">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H9v-2h3v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z" />
                    </svg>
                    {tBooking('bookDoctor')}
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`w-4 h-4 shrink-0 transition-transform ${bookStep5Open ? 'rotate-180' : ''}`} aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {bookStep5Open && <BookDoctorOptions />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pain History — collapsed by default, open on tap */}
      <div className="mt-0">
        {loadingHistory ? (
          <PageLoader />
        ) : !historyOpen ? (
          /* ── Collapsed: single entry button ─────────────────────── */
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl border bg-white dark:bg-slate-800 transition-all hover:border-[var(--color-primary)] hover:shadow-sm"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--tibbna-light)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              </span>
              <span className="text-start min-w-0">
                <span className="block font-semibold text-sm" style={{ color: 'var(--color-heading)' }}>
                  {t('history.title')}{history.length > 0 ? ` (${history.length})` : ''}
                </span>
                <span className="block text-xs" style={{ color: 'var(--color-muted)' }}>
                  {history.length === 0 ? t('history.noRecords') : formatDateTime(history[0].recordedAt)}
                </span>
              </span>
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="w-4 h-4 shrink-0 text-gray-300 rtl:rotate-180" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ) : (
          /* ── Open: header + records list ─────────────────────────── */
          <div>
            {/* Back header */}
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => { setHistoryOpen(false); setExpandedRecordId(null); }}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 shrink-0 transition-colors"
                aria-label="Close history"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className="w-5 h-5 rtl:rotate-180" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <h3 className="font-semibold flex-1" style={{ color: 'var(--color-heading)' }}>
                {t('history.title')}
              </h3>
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{history.length}</span>
            </div>

            {/* Records list — newest first */}
            {history.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: 'var(--color-muted)' }}>{t('history.noRecords')}</p>
            ) : (
              <div className="space-y-2">
                {history.map((rec) => {
                  const isExpanded = expandedRecordId === rec.id;
                  return (
                    <div key={rec.id} className="card overflow-hidden">
                      {/* Row — always visible */}
                      <button
                        type="button"
                        onClick={() => setExpandedRecordId(id => id === rec.id ? null : rec.id)}
                        className="w-full flex items-start gap-3 p-4 text-start hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                          style={{ background: painColor(rec.painLevel) }}>
                          {rec.painLevel}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: painColor(rec.painLevel) }}>
                              {painLabel(rec.painLevel)}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{formatDateTime(rec.recordedAt)}</span>
                          </div>
                          <p className="text-sm mt-1 truncate" style={{ color: 'var(--color-heading)' }}>
                            {rec.zones.map((id) => getZoneLabel(id)).join(', ')}
                          </p>
                          {!isExpanded && rec.symptoms?.length > 0 && (
                            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-muted)' }}>
                              {buildCollapsedSymptomLine(rec)}
                            </p>
                          )}
                        </div>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          className={`w-4 h-4 shrink-0 mt-1 text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} aria-hidden="true">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="border-t px-4 pb-4 pt-3 space-y-3 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                          {/* Affected areas */}
                          <div>
                            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-muted)' }}>{t('step5.affectedAreas')}</p>
                            <div className="flex flex-wrap gap-1">
                              {rec.zones.map((id) => (
                                <span key={id} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: BRAND }}>{getZoneLabel(id)}</span>
                              ))}
                            </div>
                          </div>
                          {/* Symptoms */}
                          {rec.symptoms?.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-muted)' }}>{t('step5.symptoms')}</p>
                              {rec.areaSymptoms && Object.keys(rec.areaSymptoms).length > 0 ? (
                                <div className="space-y-1">
                                  {Object.entries(rec.areaSymptoms).filter(([, s]) => s.length > 0).map(([group, syms]) => (
                                    <div key={group} className="flex flex-wrap gap-1 items-center">
                                      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: BRAND }}>
                                        {(tAreaSymptoms as (k: string) => string)(`${group}.label`)}
                                      </span>
                                      {syms.map(sym => (
                                        <span key={sym} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200">
                                          {(tAreaSymptoms as (k: string) => string)(`${group}.${sym}`)}
                                        </span>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {rec.symptoms.map((s) => (
                                    <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200">
                                      {getSymptomLabel(s)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {/* Pain level */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>{t('step5.painLevel')}</span>
                            <span className="font-bold" style={{ color: painColor(rec.painLevel) }}>{rec.painLevel}/10 — {painLabel(rec.painLevel)}</span>
                          </div>
                          {/* Duration */}
                          {rec.duration && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>{t('step5.duration')}</span>
                              <span style={{ color: 'var(--color-heading)' }}>{getDurationLabel(rec.duration)}</span>
                            </div>
                          )}
                          {/* Q&A — only show "Yes" answers to save space */}
                          {QUESTION_KEYS.filter(k => rec[k]).map((key) => (
                            <div key={key} className="flex items-center justify-between">
                              <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>{t(`questions.${key}`)}</span>
                              <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>{tCommon('yes')}</span>
                            </div>
                          ))}
                          {/* Notes */}
                          {rec.notes && (
                            <div>
                              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>{t('step5.notes')}</p>
                              <p className="text-xs" style={{ color: 'var(--color-heading)' }}>{rec.notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
