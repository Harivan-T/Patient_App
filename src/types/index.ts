export type Locale = 'en' | 'ar' | 'ku';

export interface Patient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phoneNumber: string;
  address?: string;
  bloodType?: string;
  allergies?: string[];
  ehrId?: string;
}

export interface Appointment {
  id: string;
  date: string;
  time: string;
  doctorName: string;
  hospitalName: string;
  department?: string;
  type: 'appointment' | 'operation';
  status: 'upcoming' | 'past' | 'cancelled';
  notes?: string;
}

export interface Diagnosis {
  id: string;
  code: string;
  name: string;
  date: string;
  recordedAt?: string;
  status: 'active' | 'resolved' | 'chronic';
  doctor?: string;
  description?: string;
  bodySite?: string;
}

export interface Vital {
  type: string;
  value: string | number;
  unit: string;
  date: string;
  normalRange?: string;
}

export interface MedicalHistory {
  id: string;
  event: string;
  date: string;
  details?: string;
}

export interface CarePlan {
  id: string;
  title: string;
  description: string;
  reason?: string;
  schedule?: string;
  comment?: string;
  doctor?: string;
  startDate: string;
  endDate?: string;
  goals: string[];
}

export interface MedicationDrug {
  name: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  usage?: string;
  endDate?: string;
}

export interface Medication {
  id: string;
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  prescribingDoctor: string;
  status: 'current' | 'past';
  instructions?: string;
  refillable: boolean;
  drugs?: MedicationDrug[];
}

export interface LabOrder {
  id: string;
  orderDate: string;
  doctorName: string;
  hospitalName?: string;
  status: 'pending' | 'completed' | 'partial';
  tests: LabTest[];
  pendingTests: LabTest[];
  completedTests: LabTest[];
}

export interface LabTest {
  id: string;
  name: string;
  result?: string | number;
  unit?: string;
  normalRange?: string;
  isAbnormal?: boolean;
  status: 'pending' | 'completed';
  date?: string;
  sampleType?: string;
}

export interface LabAnalyte {
  name: string;
  value?: string | number;
  units?: string;
  referenceRange?: string;
  flag?: string;
  isAbnormal: boolean;
}

export interface LabResultPanel {
  id: string;
  panelName: string;
  date: string;
  reportedBy?: string;
  analytes: LabAnalyte[];
}

export interface BodyMapAnnotation {
  id: string;
  patientId: string;
  area: string;
  side: 'front' | 'back';
  x: number;
  y: number;
  severity: 1 | 2 | 3 | 4 | 5;
  description: string;
  createdAt: string;
}

export interface DispensedMed {
  id: string;
  drugName: string;
  quantity: number | null;
  dosage: string;
  dispensedAt: string;
  dispensedBy: string;
  source: 'Pharmacy' | 'Hospital';
  notes: string;
}

export interface JWTPayload {
  patientId: string;
  phone: string;
  iat: number;
  exp: number;
}
