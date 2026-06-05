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
  status: 'active' | 'resolved' | 'chronic';
  doctor?: string;
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
  startDate: string;
  endDate?: string;
  goals: string[];
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
}

export interface LabOrder {
  id: string;
  orderDate: string;
  doctorName: string;
  hospitalName?: string;
  status: 'pending' | 'completed' | 'partial';
  tests: LabTest[];
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

export interface JWTPayload {
  patientId: string;
  phone: string;
  iat: number;
  exp: number;
}
