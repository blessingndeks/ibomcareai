import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Thermometer,
  FileText,
  Trash2,
  Wifi,
  WifiOff,
  ChevronRight,
  ShieldAlert,
  ArrowLeft,
  Copy,
  Check,
  Stethoscope,
  Filter,
  Info,
  Sparkles,
  Loader2,
  AlertCircle,
  Building2,
  LogOut,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  LogIn,
  UserPlus,
  Edit3,
  RefreshCw,
  Database,
  CloudOff,
  X,
  History,
  RotateCcw
} from 'lucide-react';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  deleteDoc,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase.ts';

// Data types
export interface FacilityProfile {
  facilityId: string;
  name: string;
  facilityType: string;
  lga: string;
  address: string;
  phone: string;
  contactEmail: string;
  createdBy: string;
  createdAt: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  role: 'nurse' | 'chew' | 'doctor' | 'officer' | 'admin';
  facilityId: string;
  facilityName: string;
  createdAt: string;
}

export interface PatientRecord {
  id: string;
  facilityId: string;
  patientIdentifier: string;
  age: number;
  ageUnit: 'years' | 'months';
  sex: 'Female' | 'Male' | 'Other';
  language: 'English' | 'Nigerian Pidgin';
  symptoms: string;
  duration: string;
  temperature?: number;
  additionalNotes?: string;
  createdAt: string;
  updatedAt?: string;
  recordedBy: string;
  warningLevel: 'red' | 'yellow' | 'green';
  warningSigns: string[];
  summary: {
    chiefComplaints: string[];
    durationSummary: string;
    temperatureStatus: string;
    suggestedActions: string[];
    missingInformation?: string[];
    clinicalConsiderations?: string[];
    isAiGenerated: boolean;
    modelUsed?: string;
  };
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface OfflineQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  recordId: string;
  facilityId: string;
  record?: PatientRecord;
  baseUpdatedAt?: string;
  queuedAt: string;
  retryCount?: number;
  lastError?: string;
}

export interface ConflictModalInfo {
  queueItem: OfflineQueueItem | null;
  localRecord: PatientRecord;
  serverRecord: PatientRecord;
  facilityId: string;
}

const DEFAULT_FACILITIES: FacilityProfile[] = [
  {
    facilityId: 'fac-itam-itu',
    name: 'Primary Healthcare Centre, Itam',
    facilityType: 'Primary Healthcare Centre (PHC)',
    lga: 'Itu',
    address: 'Itam Market Road, Itu LGA, Akwa Ibom State',
    phone: '+234 802 345 6781',
    contactEmail: 'phc.itam@akwaibom.gov.ng',
    createdBy: 'system',
    createdAt: '2026-01-15T08:00:00.000Z'
  },
  {
    facilityId: 'fac-ikot-ekpene',
    name: 'General Hospital, Ikot Ekpene',
    facilityType: 'General Hospital',
    lga: 'Ikot Ekpene',
    address: 'Hospital Road, Ikot Ekpene, Akwa Ibom State',
    phone: '+234 803 123 4567',
    contactEmail: 'genhosp.ikotekpene@akwaibom.gov.ng',
    createdBy: 'system',
    createdAt: '2026-01-20T09:30:00.000Z'
  },
  {
    facilityId: 'fac-eket-chc',
    name: 'Comprehensive Health Centre, Eket',
    facilityType: 'Comprehensive Health Centre (CHC)',
    lga: 'Eket',
    address: 'Marina Road, Eket LGA, Akwa Ibom State',
    phone: '+234 805 987 6543',
    contactEmail: 'chc.eket@akwaibom.gov.ng',
    createdBy: 'system',
    createdAt: '2026-02-10T11:00:00.000Z'
  }
];

// Multi-facility fictional initial seed records
const INITIAL_RECORDS: PatientRecord[] = [
  // Facility 1: PHC Itam (Itu LGA)
  {
    id: 'rec-001',
    facilityId: 'fac-itam-itu',
    patientIdentifier: 'Kufre E. (PAT-2026-08)',
    age: 4,
    ageUnit: 'years',
    sex: 'Male',
    language: 'Nigerian Pidgin',
    symptoms: 'Body dey hot well well since 2 days, pikin no fit drink water, and he dey vomit small small. Eye dey heavy.',
    duration: '2 days',
    temperature: 39.2,
    additionalNotes: 'Mother states child had chills last night. Mother gave paracetamol syrup this morning with minimal relief.',
    createdAt: '2026-10-23T06:30:00.000Z',
    updatedAt: '2026-10-23T06:30:00.000Z',
    recordedBy: 'system-nurse-kufre',
    warningLevel: 'red',
    warningSigns: [
      'High Fever (39.2°C) in child under 5',
      'Inability to drink fluids / persistent vomiting',
      'Potential Acute Febrile Illness requiring urgent clinical evaluation'
    ],
    summary: {
      chiefComplaints: ['High-grade fever', 'Oral intolerance / vomiting', 'General lethargy'],
      durationSummary: 'Acute onset (2 days)',
      temperatureStatus: '39.2°C — Significant Pyrexia',
      suggestedActions: [
        'Check rapid diagnostic test (RDT) for Malaria per clinic protocol',
        'Assess for severe dehydration signs (skin pinch, fontanelle, lethargy)',
        'If vomiting prevents oral intake, arrange immediate primary doctor referral'
      ],
      missingInformation: [
        'Confirm if child had convulsions at home',
        'Check immunization card (measles vaccine)',
        'Assess respiratory rate for tachypnea / pneumonia screening'
      ],
      clinicalConsiderations: [
        'Oral rehydration challenge should be attempted slowly while preparing referral if vomited.',
        'Child meets IMCI danger sign threshold for urgent evaluation.'
      ],
      isAiGenerated: false
    },
    syncStatus: 'synced'
  },
  {
    id: 'rec-002',
    facilityId: 'fac-itam-itu',
    patientIdentifier: 'Aniekan O. (PAT-2026-12)',
    age: 32,
    ageUnit: 'years',
    sex: 'Female',
    language: 'English',
    symptoms: 'Persistent dry cough for 10 days with chest tightness when breathing deeply, night sweats, fatigue.',
    duration: '10 days',
    temperature: 37.8,
    additionalNotes: 'Non-smoker. No previous history of asthma. Farmer in Ikono LGA.',
    createdAt: '2026-10-22T14:15:00.000Z',
    updatedAt: '2026-10-22T14:15:00.000Z',
    recordedBy: 'system-nurse-kufre',
    warningLevel: 'yellow',
    warningSigns: [
      'Prolonged respiratory symptoms (> 7 days duration)',
      'Subfebrile temperature with night sweats'
    ],
    summary: {
      chiefComplaints: ['Persistent cough (10 days)', 'Chest tightness on inspiration', 'Night sweats'],
      durationSummary: 'Subacute (10 days)',
      temperatureStatus: '37.8°C — Mild Elevation',
      suggestedActions: [
        'Perform chest auscultation (wheeze vs crackles)',
        'Screen for chronic respiratory infections / TB sputum evaluation per national protocol',
        'Check SpO2 saturation if pulse oximeter is available at PHC'
      ],
      missingInformation: [
        'Inquire about household contacts with chronic cough or TB',
        'Check for unintended weight loss and occupational exposures'
      ],
      clinicalConsiderations: [
        'Symptom duration exceeding 1 week requires formal pulmonary screening.',
        'Evaluate cardiovascular baseline.'
      ],
      isAiGenerated: false
    },
    syncStatus: 'synced'
  },
  // Facility 2: General Hospital Ikot Ekpene
  {
    id: 'rec-003',
    facilityId: 'fac-ikot-ekpene',
    patientIdentifier: 'Idara A. (PAT-2026-15)',
    age: 26,
    ageUnit: 'years',
    sex: 'Female',
    language: 'Nigerian Pidgin',
    symptoms: 'Belly dey pain small small, body dey shake with cold and fever high well well. She be pregnant 5 months.',
    duration: '1 day',
    temperature: 39.4,
    additionalNotes: 'Antenatal booking card reviewed. Second trimester pregnancy with sudden acute febrile episode.',
    createdAt: '2026-10-24T01:10:00.000Z',
    updatedAt: '2026-10-24T01:10:00.000Z',
    recordedBy: 'system-chew-aniekan',
    warningLevel: 'red',
    warningSigns: [
      'High Pyrexia (39.4°C) in pregnancy',
      'Acute abdominal pain in second trimester',
      'Rigors and chills requiring rapid maternal-fetal obstetric assessment'
    ],
    summary: {
      chiefComplaints: ['Acute fever in pregnancy', 'Abdominal discomfort', 'Chills/Rigors'],
      durationSummary: 'Acute (1 day)',
      temperatureStatus: '39.4°C — High Pyrexia in Gestation',
      suggestedActions: [
        'Perform urgent Malaria RDT and urinalysis for asymptomatic bacteriuria / UTI',
        'Monitor fetal heart rate via Doppler / Pinard stethoscope',
        'Notify on-call Medical Officer / Obstetric team immediately'
      ],
      missingInformation: [
        'Confirm whether any vaginal bleeding or fluid leaking occurred',
        'Check blood pressure to screen for hypertensive disorders of pregnancy'
      ],
      clinicalConsiderations: [
        'High pyrexia in pregnancy poses maternal and fetal risk; requires rapid antipyresis and cause identification.'
      ],
      isAiGenerated: false
    },
    syncStatus: 'synced'
  },
  {
    id: 'rec-004',
    facilityId: 'fac-ikot-ekpene',
    patientIdentifier: 'Elder Umo E. (PAT-2026-18)',
    age: 58,
    ageUnit: 'years',
    sex: 'Male',
    language: 'English',
    symptoms: 'Bilateral ankle swelling that worsens in the evening, breathlessness when lying flat on back, chronic fatigue.',
    duration: '3 weeks',
    temperature: 36.6,
    additionalNotes: 'Known hypertensive for 8 years, admits erratic medication compliance due to distant pharmacy.',
    createdAt: '2026-10-21T11:45:00.000Z',
    updatedAt: '2026-10-21T11:45:00.000Z',
    recordedBy: 'system-chew-aniekan',
    warningLevel: 'yellow',
    warningSigns: [
      'Orthopnea / shortness of breath when recumbent',
      'Progressive peripheral bilateral pedal edema in older hypertensive patient'
    ],
    summary: {
      chiefComplaints: ['Bilateral ankle swelling', 'Orthopnea', 'Hypertensive medication default'],
      durationSummary: 'Chronic progressive (3 weeks)',
      temperatureStatus: '36.6°C — Apyrexial',
      suggestedActions: [
        'Check sitting and standing blood pressure and pulse',
        'Evaluate jugular venous distension (JVD) and lung bases for bibasilar crackles',
        'Schedule doctor review for cardiovascular decompensation / CHF workup'
      ],
      missingInformation: [
        'Past serum creatinine or renal profile results',
        'Current daily salt intake and exact prior antihypertensive regimen'
      ],
      clinicalConsiderations: [
        'Symptoms strongly suggest fluid retention and cardiovascular insufficiency; counsel on non-recumbent sleeping.'
      ],
      isAiGenerated: false
    },
    syncStatus: 'synced'
  },
  // Facility 3: Comprehensive Health Centre, Eket
  {
    id: 'rec-005',
    facilityId: 'fac-eket-chc',
    patientIdentifier: 'Emem B. (PAT-2026-25)',
    age: 6,
    ageUnit: 'years',
    sex: 'Female',
    language: 'Nigerian Pidgin',
    symptoms: 'Water water stool passed 6 times since daybreak. Child dey weak, tongue dry, eye dey deep inside.',
    duration: '1 day',
    temperature: 37.4,
    additionalNotes: 'Drinking water sourced from open stream in community after heavy rainfall.',
    createdAt: '2026-10-23T16:20:00.000Z',
    updatedAt: '2026-10-23T16:20:00.000Z',
    recordedBy: 'system-dr-bassey',
    warningLevel: 'red',
    warningSigns: [
      'Severe Dehydration signs (sunken eyes, dry mucous membranes, marked lethargy)',
      'Frequent watery diarrhea (> 5 episodes in 12 hours)'
    ],
    summary: {
      chiefComplaints: ['Profuse watery diarrhea', 'Clinical dehydration', 'Lethargy'],
      durationSummary: 'Hyperacute (under 24 hours)',
      temperatureStatus: '37.4°C — Normal / Subfebrile',
      suggestedActions: [
        'Initiate immediate Plan B/C Oral Rehydration Salts (ORS) + Zinc therapy or IV Ringer Lactate if unable to drink',
        'Assess skin pinch turgor (> 2 seconds retraction)',
        'Report potential waterborne diarrheal cluster to LGA Disease Surveillance Officer'
      ],
      missingInformation: [
        'Are other family or school members presenting with similar diarrhea?',
        'Presence of blood in stool (dysentery)'
      ],
      clinicalConsiderations: [
        'Prompt rehydration is vital to prevent hypovolemic collapse in pediatric patients.'
      ],
      isAiGenerated: false
    },
    syncStatus: 'synced'
  },
  {
    id: 'rec-006',
    facilityId: 'fac-eket-chc',
    patientIdentifier: 'Nsikak T. (PAT-2026-30)',
    age: 41,
    ageUnit: 'years',
    sex: 'Male',
    language: 'English',
    symptoms: 'Follow-up for minor palm laceration sustained during palm fruit harvesting 5 days ago. Mild itching around dressing.',
    duration: '5 days',
    temperature: 36.5,
    additionalNotes: 'Clean wound edges, minimal serous exudate, no purulent discharge or foul odor.',
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:00.000Z',
    recordedBy: 'system-dr-bassey',
    warningLevel: 'green',
    warningSigns: [],
    summary: {
      chiefComplaints: ['Wound inspection follow-up', 'Mild local itching'],
      durationSummary: 'Healing phase (5 days)',
      temperatureStatus: '36.5°C — Normothermic',
      suggestedActions: [
        'Clean wound with normal saline and reapply sterile dry dressing',
        'Confirm tetanus toxoid vaccination status',
        'Advise patient to keep wound dry while working'
      ],
      missingInformation: [
        'Date of last tetanus toxoid booster'
      ],
      clinicalConsiderations: [
        'Normal healing trajectory. Discharge with advice to return if redness or swelling spreads.'
      ],
      isAiGenerated: false
    },
    syncStatus: 'synced'
  }
];

// Offline & Local Storage Helpers (Strictly partitioned per facility)
const getStorageRecordsKey = (facilityId: string) => `ibomcare_records_${facilityId}`;
const getStorageQueueKey = (facilityId: string) => `ibomcare_offline_queue_${facilityId}`;

const loadRecordsFromStorage = (facilityId: string): PatientRecord[] => {
  try {
    const raw = localStorage.getItem(getStorageRecordsKey(facilityId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse local storage records:', e);
  }
  return INITIAL_RECORDS.filter((r) => r.facilityId === facilityId);
};

const saveRecordsToStorage = (facilityId: string, records: PatientRecord[]) => {
  try {
    localStorage.setItem(getStorageRecordsKey(facilityId), JSON.stringify(records));
  } catch (e) {
    console.warn('Failed to save records to local storage:', e);
  }
};

const loadQueueFromStorage = (facilityId: string): OfflineQueueItem[] => {
  try {
    const raw = localStorage.getItem(getStorageQueueKey(facilityId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse offline queue:', e);
  }
  return [];
};

const saveQueueToStorage = (facilityId: string, queue: OfflineQueueItem[]) => {
  try {
    localStorage.setItem(getStorageQueueKey(facilityId), JSON.stringify(queue));
  } catch (e) {
    console.warn('Failed to save queue to local storage:', e);
  }
};

export default function App() {
  // Navigation: 'dashboard' | 'new_record' | 'detail' | 'facility_profile'
  const [currentView, setCurrentView] = useState<'dashboard' | 'new_record' | 'detail' | 'facility_profile'>('dashboard');

  // Firebase Auth & User Profile State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authRole, setAuthRole] = useState<'nurse' | 'chew' | 'doctor' | 'officer'>('nurse');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Facility Registration & Selection State
  const [facilities, setFacilities] = useState<FacilityProfile[]>(DEFAULT_FACILITIES);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('fac-itam-itu');
  const [isCreatingNewFacility, setIsCreatingNewFacility] = useState(false);
  const [newFacilityName, setNewFacilityName] = useState('');
  const [newFacilityType, setNewFacilityType] = useState('Primary Healthcare Centre (PHC)');
  const [newFacilityLga, setNewFacilityLga] = useState('Itu');
  const [newFacilityAddress, setNewFacilityAddress] = useState('');
  const [newFacilityPhone, setNewFacilityPhone] = useState('');
  const [newFacilityEmail, setNewFacilityEmail] = useState('');

  // Patient Records State - strictly partitioned & loaded from local storage
  const [records, setRecords] = useState<PatientRecord[]>(() => loadRecordsFromStorage('fac-itam-itu'));
  const [selectedRecord, setSelectedRecord] = useState<PatientRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'red' | 'yellow' | 'green'>('all');

  // Connectivity
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(false);
  const effectiveOnline = isOnline && !simulatedOffline;

  // Offline Sync Queue & Conflict Resolution State
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>(() => loadQueueFromStorage('fac-itam-itu'));
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'pending_offline' | 'failed'>(() => {
    const q = loadQueueFromStorage('fac-itam-itu');
    return q.length > 0 ? 'pending_offline' : 'synced';
  });
  const [conflictModalData, setConflictModalData] = useState<ConflictModalInfo | null>(null);
  const [showQueueModal, setShowQueueModal] = useState(false);

  // Edit Patient Record Modal State
  const [isEditingRecord, setIsEditingRecord] = useState(false);
  const [editRecordId, setEditRecordId] = useState('');
  const [editPatientId, setEditPatientId] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editAgeUnit, setEditAgeUnit] = useState<'years' | 'months'>('years');
  const [editSex, setEditSex] = useState<'Female' | 'Male' | 'Other'>('Female');
  const [editLanguage, setEditLanguage] = useState<'English' | 'Nigerian Pidgin'>('English');
  const [editSymptoms, setEditSymptoms] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editTemperature, setEditTemperature] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isUpdatingRecord, setIsUpdatingRecord] = useState(false);
  const [editErrors, setEditErrors] = useState<{ [key: string]: string }>({});

  // New Record Form State
  const [formPatientId, setFormPatientId] = useState('');
  const [formAge, setFormAge] = useState('');
  const [formAgeUnit, setFormAgeUnit] = useState<'years' | 'months'>('years');
  const [formSex, setFormSex] = useState<'Female' | 'Male' | 'Other'>('Female');
  const [formLanguage, setFormLanguage] = useState<'English' | 'Nigerian Pidgin'>('English');
  const [formSymptoms, setFormSymptoms] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formTemperature, setFormTemperature] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Gemini AI Loading and Alert States
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isReanalyzingId, setIsReanalyzingId] = useState<string | null>(null);
  const [aiStatusMessage, setAiStatusMessage] = useState<{
    type: 'success' | 'warning' | 'info';
    text: string;
  } | null>(null);

  // Test Firestore Connection on Boot per SKILL.md
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.warn('Firebase client is offline or initializing.');
        }
      }
    }
    testConnection();
  }, []);

  // Monitor Network
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setAiStatusMessage({
        type: 'info',
        text: 'Network connectivity restored. Syncing offline records...'
      });
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncState('pending_offline');
      setAiStatusMessage({
        type: 'warning',
        text: 'Device is offline. Changes will be saved locally and queued for synchronization.'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        // Load user profile from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            setUserProfile(data);
            setSelectedFacilityId(data.facilityId);
            // Load local records for this facility immediately
            const facRecs = loadRecordsFromStorage(data.facilityId);
            setRecords(facRecs);
            const facQueue = loadQueueFromStorage(data.facilityId);
            setOfflineQueue(facQueue);
            setSyncState(facQueue.length > 0 ? 'pending_offline' : 'synced');
          } else {
            // New user without profile document yet
            setUserProfile(null);
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.GET, `users/${user.uid}`);
        }
      } else {
        setUserProfile(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load facilities from Firestore or seed default if empty
  useEffect(() => {
    if (!firebaseUser) return;

    const fetchFacilities = async () => {
      try {
        const snap = await getDocs(collection(db, 'facilities'));
        if (!snap.empty) {
          const facList: FacilityProfile[] = [];
          snap.forEach((d) => facList.push(d.data() as FacilityProfile));
          setFacilities(facList);
        } else {
          // Seed initial facilities for first run
          for (const f of DEFAULT_FACILITIES) {
            await setDoc(doc(db, 'facilities', f.facilityId), f);
          }
          setFacilities(DEFAULT_FACILITIES);
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'facilities');
      }
    };

    fetchFacilities();
  }, [firebaseUser]);

  // Sync patient records for active facility from Firestore in real-time
  useEffect(() => {
    const activeFacId = userProfile?.facilityId || selectedFacilityId;

    if (!firebaseUser || !userProfile?.facilityId) {
      // If unauthenticated or using demo profile, rely on local storage
      const localRecs = loadRecordsFromStorage(activeFacId);
      setRecords(localRecs);
      const localQueue = loadQueueFromStorage(activeFacId);
      setOfflineQueue(localQueue);
      setSyncState(localQueue.length > 0 ? 'pending_offline' : 'synced');
      return;
    }

    const facilityId = userProfile.facilityId;
    const recordsCol = collection(db, 'facilities', facilityId, 'records');

    const unsubscribe = onSnapshot(
      recordsCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const loaded: PatientRecord[] = [];
          snapshot.forEach((d) => loaded.push(d.data() as PatientRecord));
          // Sort newest first
          loaded.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setRecords(loaded);
          saveRecordsToStorage(facilityId, loaded);
        } else {
          // If no records in this facility yet, load facility seed records
          const seeds = INITIAL_RECORDS.filter((r) => r.facilityId === facilityId);
          setRecords(seeds);
          saveRecordsToStorage(facilityId, seeds);
        }
      },
      (error) => {
        console.warn('Real-time snapshot error (using local cache):', error);
        // Fall back to local storage cache smoothly
        const cached = loadRecordsFromStorage(facilityId);
        setRecords(cached);
      }
    );

    return () => unsubscribe();
  }, [firebaseUser, userProfile?.facilityId, selectedFacilityId]);

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsSubmittingAuth(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const user = cred.user;

      // Check for existing profile in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        setUserProfile(data);
        setSelectedFacilityId(data.facilityId);
        setCurrentView('dashboard');
        setAiStatusMessage({
          type: 'success',
          text: `Signed in as ${data.displayName} (${data.facilityName})`
        });
      } else {
        // Link with selected facility immediately
        const assignedFacility = facilities.find((f) => f.facilityId === selectedFacilityId) || facilities[0];
        const newProfile: UserProfile = {
          userId: user.uid,
          email: user.email || `${user.uid}@ibomcare.org`,
          displayName: user.displayName || 'Healthcare Worker',
          role: authRole,
          facilityId: assignedFacility.facilityId,
          facilityName: assignedFacility.name,
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', user.uid), newProfile);
        setUserProfile(newProfile);
        setCurrentView('dashboard');
        setAiStatusMessage({
          type: 'success',
          text: `Welcome ${newProfile.displayName}! Associated with ${newProfile.facilityName}.`
        });
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setAuthError(err.message || 'Failed to sign in with Google.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Handle Email/Password Auth
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const email = authEmail.trim();
    const password = authPassword.trim();

    if (!email) {
      setAuthError('Please enter your healthcare worker email address.');
      return;
    }
    if (!password) {
      setAuthError('Please enter your password.');
      return;
    }

    if (authMode === 'signup') {
      if (!authName.trim()) {
        setAuthError('Please provide your full clinical name (e.g. Nurse Kufre Ekong).');
        return;
      }
      if (password.length < 6) {
        setAuthError('Password must be at least 6 characters long.');
        return;
      }
    }

    setIsSubmittingAuth(true);
    try {
      if (authMode === 'signin') {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const uid = cred.user.uid;

        // Fetch user profile from Firestore
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          setUserProfile(data);
          setSelectedFacilityId(data.facilityId);
          setCurrentView('dashboard');
          setAiStatusMessage({
            type: 'success',
            text: `Welcome back, ${data.displayName} (${data.facilityName}).`
          });
        } else {
          // If no profile yet, auto-provision profile with selected facility
          const assignedFacility = facilities.find((f) => f.facilityId === selectedFacilityId) || facilities[0];
          const newProfile: UserProfile = {
            userId: uid,
            email,
            displayName: cred.user.displayName || email.split('@')[0],
            role: authRole,
            facilityId: assignedFacility.facilityId,
            facilityName: assignedFacility.name,
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', uid), newProfile);
          setUserProfile(newProfile);
          setCurrentView('dashboard');
        }
      } else {
        // Create user with Firebase Authentication
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = cred.user.uid;

        // Associate with healthcare facility
        const assignedFacility = facilities.find((f) => f.facilityId === selectedFacilityId) || facilities[0];
        const newProfile: UserProfile = {
          userId: uid,
          email,
          displayName: authName.trim(),
          role: authRole,
          facilityId: assignedFacility.facilityId,
          facilityName: assignedFacility.name,
          createdAt: new Date().toISOString()
        };

        // Save profile in Firestore (strictly never storing passwords in Firestore)
        await setDoc(doc(db, 'users', uid), newProfile);
        setUserProfile(newProfile);
        setCurrentView('dashboard');
        setAiStatusMessage({
          type: 'success',
          text: `Account created successfully for ${newProfile.displayName} at ${newProfile.facilityName}.`
        });
      }
    } catch (err: any) {
      console.error('Firebase Auth error:', err);
      let msg = err.message || 'Authentication failed.';

      if (err.code === 'auth/operation-not-allowed') {
        msg = `Email/Password sign-in is disabled in your Firebase console for project "blynkx-pro".\n\nTo enable it:\n1. Open: https://console.firebase.google.com/project/blynkx-pro/authentication/providers\n2. Click "Email/Password" and toggle "Enable"\n3. Click Save.\n\nIn the meantime, you can click "Continue with Google" above (which is active) or use one of the Instant Demo Accounts below!`;
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'This email address is already registered. Please click "Sign In" above to login.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Invalid email address format. Please check your spelling (e.g. nurse@phc.ak.gov.ng).';
      } else if (err.code === 'auth/user-not-found') {
        msg = 'No registered worker found with this email. Please click "Create Account" to register.';
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Incorrect email or password. Please verify your credentials or create a new account.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many failed attempts. Access to this account has been temporarily restricted. Try again later.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network connection failed. Please check your internet connectivity.';
      }

      setAuthError(msg);
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Quick fictional demo login
  const handleQuickDemoLogin = (role: 'nurse' | 'chew' | 'doctor', facId: string, facName: string) => {
    const syntheticId = `demo-${role}-${Date.now().toString().slice(-4)}`;
    const syntheticProfile: UserProfile = {
      userId: syntheticId,
      email: `${role}.${syntheticId}@phc.akwaibom.gov.ng`,
      displayName: role === 'nurse' ? 'Nurse Kufre Ekong' : role === 'chew' ? 'CHEW Aniekan Okon' : 'Dr. Bassey Etim',
      role,
      facilityId: facId,
      facilityName: facName,
      createdAt: new Date().toISOString()
    };
    setUserProfile(syntheticProfile);
    setSelectedFacilityId(facId);

    // Load partitioned records & queue for this facility
    const facRecords = loadRecordsFromStorage(facId);
    setRecords(facRecords);
    const facQueue = loadQueueFromStorage(facId);
    setOfflineQueue(facQueue);
    setSyncState(facQueue.length > 0 ? 'pending_offline' : 'synced');
    setCurrentView('dashboard');

    setAiStatusMessage({
      type: 'info',
      text: `Logged in as fictional test user: ${syntheticProfile.displayName} (${facName})`
    });
  };

  // Complete Worker Profile / Facility Association
  const handleSaveFacilityProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;

    setIsSubmittingAuth(true);
    setAuthError(null);

    try {
      let assignedFacilityId = selectedFacilityId;
      let assignedFacilityName = facilities.find((f) => f.facilityId === selectedFacilityId)?.name || 'Primary Healthcare Centre';

      // If creating a brand new facility profile
      if (isCreatingNewFacility) {
        if (!newFacilityName.trim() || !newFacilityAddress.trim()) {
          setAuthError('Please fill in the facility name and address.');
          setIsSubmittingAuth(false);
          return;
        }

        const newFacId = `fac-${Date.now()}`;
        const newFacData: FacilityProfile = {
          facilityId: newFacId,
          name: newFacilityName.trim(),
          facilityType: newFacilityType,
          lga: newFacilityLga,
          address: newFacilityAddress.trim(),
          phone: newFacilityPhone.trim() || 'N/A',
          contactEmail: newFacilityEmail.trim() || firebaseUser.email || 'N/A',
          createdBy: firebaseUser.uid,
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'facilities', newFacId), newFacData);
        setFacilities((prev) => [newFacData, ...prev]);
        assignedFacilityId = newFacId;
        assignedFacilityName = newFacData.name;
      }

      // Save User Profile in Firestore (NEVER storing passwords)
      const userProfileData: UserProfile = {
        userId: firebaseUser.uid,
        email: firebaseUser.email || `${firebaseUser.uid}@ibomcare.local`,
        displayName: authName.trim() || firebaseUser.displayName || 'Healthcare Worker',
        role: authRole,
        facilityId: assignedFacilityId,
        facilityName: assignedFacilityName,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), userProfileData);
      setUserProfile(userProfileData);
      setSelectedFacilityId(assignedFacilityId);

      setAiStatusMessage({
        type: 'success',
        text: `Facility verified. Connected to ${assignedFacilityName}.`
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
      setAuthError(err.message || 'Failed to complete profile.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setFirebaseUser(null);
      setUserProfile(null);
      setRecords(INITIAL_RECORDS);
      setCurrentView('dashboard');
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  // Evaluate clinical warning signs & structured summary (Deterministic Local Fallback)
  const evaluateSymptomInput = (
    symptoms: string,
    age: number,
    ageUnit: 'years' | 'months',
    temp?: number,
    duration?: string,
    notes?: string
  ): {
    warningLevel: 'red' | 'yellow' | 'green';
    warningSigns: string[];
    summary: PatientRecord['summary'];
  } => {
    const text = `${symptoms} ${notes || ''}`.toLowerCase();
    const warningSigns: string[] = [];

    // Red flag criteria
    const hasBreathingIssues =
      text.includes('breath') ||
      text.includes('fast breath') ||
      text.includes('gasp') ||
      text.includes('chest tight') ||
      text.includes('no fit breath') ||
      text.includes('short of breath');

    const hasSevereVomiting =
      text.includes('vomit everything') ||
      text.includes('no fit drink') ||
      text.includes('cannot drink') ||
      text.includes('dehydration') ||
      text.includes('vomit small small');

    const hasConvulsions =
      text.includes('convuls') ||
      text.includes('shake body') ||
      text.includes('seizure') ||
      text.includes('stiff');

    const isChildUnder5 = ageUnit === 'months' || (ageUnit === 'years' && age < 5);

    // Temperature checks
    if (temp !== undefined && !isNaN(temp)) {
      if (temp >= 39.0) {
        warningSigns.push(`High Grade Pyrexia (${temp}°C) — Elevated risk of febrile complication`);
      } else if (temp >= 38.0 && isChildUnder5) {
        warningSigns.push(`Fever in child under 5 years (${temp}°C)`);
      } else if (temp < 35.5) {
        warningSigns.push(`Hypothermia (${temp}°C) — Warning sign for severe neonatal/pediatric sepsis`);
      }
    }

    if (hasBreathingIssues) warningSigns.push('Reported respiratory distress / breathing difficulties');
    if (hasSevereVomiting) warningSigns.push('Reported inability to retain fluids / persistent vomiting');
    if (hasConvulsions) warningSigns.push('Reported convulsion or abnormal stiffness (Urgent danger sign)');

    const durationLower = (duration || '').toLowerCase();
    const isProlonged =
      durationLower.includes('week') ||
      durationLower.includes('month') ||
      parseInt(durationLower, 10) > 7;

    if (isProlonged) warningSigns.push(`Prolonged symptom duration (${duration})`);

    let warningLevel: 'red' | 'yellow' | 'green' = 'green';
    if (warningSigns.length >= 2 || hasConvulsions || (isChildUnder5 && hasSevereVomiting) || (temp && temp >= 39.5)) {
      warningLevel = 'red';
    } else if (warningSigns.length > 0 || (temp && temp >= 37.8)) {
      warningLevel = 'yellow';
    }

    const complaints: string[] = [];
    if (text.includes('hot') || text.includes('fever')) complaints.push('Fever / Elevated body temperature');
    if (text.includes('cough')) complaints.push('Cough');
    if (text.includes('vomit')) complaints.push('Vomiting / Nausea');
    if (text.includes('headache') || text.includes('head pain')) complaints.push('Headache');
    if (text.includes('stomach') || text.includes('belly') || text.includes('diarrhea')) complaints.push('Abdominal pain / GI symptoms');
    if (text.includes('chill') || text.includes('cold')) complaints.push('Chills / Rigors');
    if (complaints.length === 0) complaints.push('Reported generalized malaise and discomfort');

    const suggestedActions: string[] = [];
    if (warningLevel === 'red') {
      suggestedActions.push('URGENT: Alert on-duty medical officer or initiate referral to General Hospital');
      suggestedActions.push('Prioritize immediate airway, breathing, circulation & hydration assessment');
      suggestedActions.push('Do not delay emergency transfer if condition is unstable');
    } else if (warningLevel === 'yellow') {
      suggestedActions.push('Perform primary health clinic diagnostic screening (Malaria RDT, vitals check)');
      suggestedActions.push('Provide supportive care guidance per primary healthcare standard operating guidelines');
      suggestedActions.push('Schedule 24-48 hour follow-up evaluation or earlier if danger signs develop');
    } else {
      suggestedActions.push('Record baseline vital signs and continue observation');
      suggestedActions.push('Counsel on hygiene, adequate hydration, and home monitoring');
    }

    const missingInformation = [
      'Assess hydration status (mucous membranes, skin pinch test)',
      'Confirm immunization card history and recent medications taken',
      'Check vital signs (heart rate, respiratory rate, SpO2 if available)'
    ];

    const clinicalConsiderations = [
      'Organized using verified primary healthcare decision-support rules.',
      'Always prioritize clinical judgment over automated summary output.'
    ];

    let tempStatus = 'Not measured';
    if (temp !== undefined && !isNaN(temp)) {
      tempStatus = `${temp}°C — ${temp >= 38.0 ? 'Fever / Pyrexia' : temp <= 35.8 ? 'Low Temperature' : 'Normal Range'}`;
    }

    return {
      warningLevel,
      warningSigns,
      summary: {
        chiefComplaints: complaints,
        durationSummary: duration ? `Reported: ${duration}` : 'Duration not specified',
        temperatureStatus: tempStatus,
        suggestedActions,
        missingInformation,
        clinicalConsiderations,
        isAiGenerated: false
      }
    };
  };

  // Pre-fill quick sample helper
  const handlePreFillSample = (sampleType: 'fever_child' | 'respiratory_adult') => {
    if (sampleType === 'fever_child') {
      setFormPatientId('Edidiong U. (PAT-2026-21)');
      setFormAge('3');
      setFormAgeUnit('years');
      setFormSex('Female');
      setFormLanguage('Nigerian Pidgin');
      setFormSymptoms('Body dey hot since yesterday night. Pikin refuse to suck breast and dey cry when touch belly.');
      setFormDuration('1 day');
      setFormTemperature('39.0');
      setFormNotes('Mother brought child to primary health post from farm settlement.');
    } else {
      setFormPatientId('Bassey E. (PAT-2026-22)');
      setFormAge('54');
      setFormAgeUnit('years');
      setFormSex('Male');
      setFormLanguage('English');
      setFormSymptoms('Severe shortness of breath when walking short distances. Swelling around both ankles for 2 weeks.');
      setFormDuration('2 weeks');
      setFormTemperature('36.8');
      setFormNotes('History of hypertension. Ran out of blood pressure medications last month.');
    }
  };

  // Call Gemini Backend API for symptom summary
  const fetchGeminiSummary = async (payload: {
    patientIdentifier: string;
    age: number;
    ageUnit: 'years' | 'months';
    sex: string;
    language: string;
    symptoms: string;
    duration: string;
    temperature?: number;
    notes?: string;
  }) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch('/api/symptom-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${res.status}`);
      }

      const data = await res.json();
      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  // Handle form submission and save to Firestore
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (!formPatientId.trim()) errors.patientId = 'Please enter a Patient ID or Nickname.';
    if (!formAge.trim() || isNaN(Number(formAge)) || Number(formAge) < 0) {
      errors.age = 'Please enter a valid age.';
    }
    if (!formSymptoms.trim()) errors.symptoms = 'Please describe the symptoms observed or reported.';
    if (!formDuration.trim()) errors.duration = 'Please specify duration (e.g., 2 days, 1 week).';

    let parsedTemp: number | undefined;
    if (formTemperature.trim()) {
      const val = parseFloat(formTemperature);
      if (isNaN(val) || val < 30 || val > 45) {
        errors.temperature = 'Temperature must be a valid number between 30°C and 45°C.';
      } else {
        parsedTemp = val;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setIsGeneratingAi(true);
    setAiStatusMessage(null);

    const ageNum = parseInt(formAge, 10);
    const localEval = evaluateSymptomInput(
      formSymptoms,
      ageNum,
      formAgeUnit,
      parsedTemp,
      formDuration,
      formNotes
    );

    let finalWarningLevel = localEval.warningLevel;
    let finalWarningSigns = localEval.warningSigns;
    let finalSummary: PatientRecord['summary'] = localEval.summary;
    let isAi = false;
    let modelName: string | undefined = undefined;

    if (effectiveOnline) {
      try {
        const aiResponse = await fetchGeminiSummary({
          patientIdentifier: formPatientId.trim(),
          age: ageNum,
          ageUnit: formAgeUnit,
          sex: formSex,
          language: formLanguage,
          symptoms: formSymptoms.trim(),
          duration: formDuration.trim(),
          temperature: parsedTemp,
          notes: formNotes.trim()
        });

        if (aiResponse?.success && aiResponse.data) {
          const aiData = aiResponse.data;
          isAi = true;
          modelName = aiResponse.modelUsed || 'gemini-3.8-flash';
          finalWarningLevel = aiData.warningLevel || localEval.warningLevel;
          finalWarningSigns = Array.isArray(aiData.warningSigns) && aiData.warningSigns.length > 0
            ? aiData.warningSigns
            : localEval.warningSigns;

          finalSummary = {
            chiefComplaints: Array.isArray(aiData.chiefComplaints) ? aiData.chiefComplaints : localEval.summary.chiefComplaints,
            durationSummary: aiData.durationSummary || localEval.summary.durationSummary,
            temperatureStatus: aiData.temperatureStatus || localEval.summary.temperatureStatus,
            suggestedActions: Array.isArray(aiData.suggestedActions) ? aiData.suggestedActions : localEval.summary.suggestedActions,
            missingInformation: Array.isArray(aiData.missingInformation) ? aiData.missingInformation : localEval.summary.missingInformation,
            clinicalConsiderations: Array.isArray(aiData.clinicalConsiderations) ? aiData.clinicalConsiderations : localEval.summary.clinicalConsiderations,
            isAiGenerated: true,
            modelUsed: modelName
          };

          setAiStatusMessage({
            type: 'success',
            text: 'Clinical summary successfully generated with Gemini 3.8 Flash.'
          });
        }
      } catch (err: any) {
        console.warn('AI request failed, using local rule fallback:', err);
        setAiStatusMessage({
          type: 'warning',
          text: 'Gemini service unreachable. Generated verified local rule-based summary as fallback.'
        });
      }
    } else {
      setAiStatusMessage({
        type: 'info',
        text: 'Operating in offline mode. Saved locally using verified rule-based summary.'
      });
    }

    setIsGeneratingAi(false);

    const recordId = `rec-${Date.now()}`;
    const facilityId = userProfile?.facilityId || selectedFacilityId;
    const nowIso = new Date().toISOString();

    const isDirectOnlineSync = effectiveOnline && !!firebaseUser && userProfile?.facilityId === facilityId;

    const newRecord: PatientRecord = {
      id: recordId,
      facilityId,
      patientIdentifier: formPatientId.trim(),
      age: ageNum,
      ageUnit: formAgeUnit,
      sex: formSex,
      language: formLanguage,
      symptoms: formSymptoms.trim(),
      duration: formDuration.trim(),
      temperature: parsedTemp,
      additionalNotes: formNotes.trim() || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
      recordedBy: firebaseUser?.uid || userProfile?.userId || 'local-worker',
      warningLevel: finalWarningLevel,
      warningSigns: finalWarningSigns,
      summary: {
        ...finalSummary,
        isAiGenerated: isAi,
        modelUsed: modelName
      },
      syncStatus: isDirectOnlineSync ? 'synced' : 'pending'
    };

    if (isDirectOnlineSync) {
      try {
        await setDoc(doc(db, 'facilities', facilityId, 'records', recordId), newRecord);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `facilities/${facilityId}/records/${recordId}`);
      }
    } else {
      // Offline mode or local worker: add to queue
      const queueItem: OfflineQueueItem = {
        id: `q-${Date.now()}`,
        operation: 'create',
        recordId,
        facilityId,
        record: newRecord,
        queuedAt: nowIso
      };
      const existingQueue = loadQueueFromStorage(facilityId);
      const updatedQueue = [queueItem, ...existingQueue];
      saveQueueToStorage(facilityId, updatedQueue);
      setOfflineQueue(updatedQueue);
      setSyncState('pending_offline');
    }

    // Always update local state & local storage cache immediately
    setRecords((prev) => {
      const updated = [newRecord, ...prev.filter((r) => r.id !== recordId)];
      saveRecordsToStorage(facilityId, updated);
      return updated;
    });

    setSelectedRecord(newRecord);
    setCurrentView('detail');

    // Reset form
    setFormPatientId('');
    setFormAge('');
    setFormSymptoms('');
    setFormDuration('');
    setFormTemperature('');
    setFormNotes('');
  };

  // Start editing an existing patient record
  const startEditingRecord = (record: PatientRecord) => {
    setEditRecordId(record.id);
    setEditPatientId(record.patientIdentifier);
    setEditAge(record.age.toString());
    setEditAgeUnit(record.ageUnit);
    setEditSex(record.sex);
    setEditLanguage(record.language);
    setEditSymptoms(record.symptoms);
    setEditDuration(record.duration);
    setEditTemperature(record.temperature !== undefined ? record.temperature.toString() : '');
    setEditNotes(record.additionalNotes || '');
    setEditErrors({});
    setIsEditingRecord(true);
  };

  // Handle saving an edited record
  const handleSaveEditedRecord = async (e: React.FormEvent, reevaluateWithAi: boolean) => {
    e.preventDefault();
    if (!selectedRecord) return;

    const errors: { [key: string]: string } = {};
    if (!editPatientId.trim()) errors.patientId = 'Patient ID or nickname is required.';
    if (!editAge.trim() || isNaN(Number(editAge)) || Number(editAge) < 0) {
      errors.age = 'Valid age is required.';
    }
    if (!editSymptoms.trim()) errors.symptoms = 'Symptoms description is required.';
    if (!editDuration.trim()) errors.duration = 'Symptom duration is required.';

    let parsedTemp: number | undefined;
    if (editTemperature.trim()) {
      const val = parseFloat(editTemperature);
      if (isNaN(val) || val < 30 || val > 45) {
        errors.temperature = 'Valid temperature between 30°C and 45°C required.';
      } else {
        parsedTemp = val;
      }
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setEditErrors({});
    setIsUpdatingRecord(true);

    const ageNum = parseInt(editAge, 10);
    const facilityId = selectedRecord.facilityId || userProfile?.facilityId || selectedFacilityId;
    const nowIso = new Date().toISOString();

    let newWarningLevel = selectedRecord.warningLevel;
    let newWarningSigns = selectedRecord.warningSigns;
    let newSummary = selectedRecord.summary;

    if (reevaluateWithAi) {
      const localEval = evaluateSymptomInput(
        editSymptoms,
        ageNum,
        editAgeUnit,
        parsedTemp,
        editDuration,
        editNotes
      );
      newWarningLevel = localEval.warningLevel;
      newWarningSigns = localEval.warningSigns;
      newSummary = localEval.summary;

      if (effectiveOnline) {
        try {
          const aiResponse = await fetchGeminiSummary({
            patientIdentifier: editPatientId.trim(),
            age: ageNum,
            ageUnit: editAgeUnit,
            sex: editSex,
            language: editLanguage,
            symptoms: editSymptoms.trim(),
            duration: editDuration.trim(),
            temperature: parsedTemp,
            notes: editNotes.trim()
          });

          if (aiResponse?.success && aiResponse.data) {
            const aiData = aiResponse.data;
            newWarningLevel = aiData.warningLevel || localEval.warningLevel;
            newWarningSigns = Array.isArray(aiData.warningSigns) && aiData.warningSigns.length > 0
              ? aiData.warningSigns
              : localEval.warningSigns;
            newSummary = {
              chiefComplaints: Array.isArray(aiData.chiefComplaints) ? aiData.chiefComplaints : localEval.summary.chiefComplaints,
              durationSummary: aiData.durationSummary || localEval.summary.durationSummary,
              temperatureStatus: aiData.temperatureStatus || localEval.summary.temperatureStatus,
              suggestedActions: Array.isArray(aiData.suggestedActions) ? aiData.suggestedActions : localEval.summary.suggestedActions,
              missingInformation: Array.isArray(aiData.missingInformation) ? aiData.missingInformation : localEval.summary.missingInformation,
              clinicalConsiderations: Array.isArray(aiData.clinicalConsiderations) ? aiData.clinicalConsiderations : localEval.summary.clinicalConsiderations,
              isAiGenerated: true,
              modelUsed: aiResponse.modelUsed || 'gemini-3.8-flash'
            };
          }
        } catch (err: any) {
          console.warn('AI update failed, keeping verified rule summary:', err);
        }
      }
    }

    const updatedRecord: PatientRecord = {
      ...selectedRecord,
      patientIdentifier: editPatientId.trim(),
      age: ageNum,
      ageUnit: editAgeUnit,
      sex: editSex,
      language: editLanguage,
      symptoms: editSymptoms.trim(),
      duration: editDuration.trim(),
      temperature: parsedTemp,
      additionalNotes: editNotes.trim() || undefined,
      updatedAt: nowIso,
      warningLevel: newWarningLevel,
      warningSigns: newWarningSigns,
      summary: newSummary,
      syncStatus: effectiveOnline && !!firebaseUser ? 'synced' : 'pending'
    };

    // Check for conflict if online and connected to Firestore
    if (effectiveOnline && firebaseUser && userProfile?.facilityId === facilityId) {
      try {
        const docRef = doc(db, 'facilities', facilityId, 'records', selectedRecord.id);
        const serverDoc = await getDoc(docRef);

        if (serverDoc.exists()) {
          const serverData = serverDoc.data() as PatientRecord;
          const serverTime = serverData.updatedAt ? new Date(serverData.updatedAt).getTime() : 0;
          const localBaseTime = selectedRecord.updatedAt ? new Date(selectedRecord.updatedAt).getTime() : 0;

          // If server was updated remotely after our local base version
          if (serverTime > localBaseTime) {
            setConflictModalData({
              queueItem: null,
              localRecord: updatedRecord,
              serverRecord: serverData,
              facilityId
            });
            setIsUpdatingRecord(false);
            setIsEditingRecord(false);
            return;
          }
        }

        await setDoc(docRef, updatedRecord);
      } catch (err) {
        console.warn('Firestore write error during update:', err);
      }
    } else {
      // Offline: Enqueue update operation
      const queueItem: OfflineQueueItem = {
        id: `q-${Date.now()}`,
        operation: 'update',
        recordId: selectedRecord.id,
        facilityId,
        record: updatedRecord,
        baseUpdatedAt: selectedRecord.updatedAt || selectedRecord.createdAt,
        queuedAt: nowIso
      };
      const existingQueue = loadQueueFromStorage(facilityId);
      const filtered = existingQueue.filter((q) => !(q.recordId === selectedRecord.id && q.operation === 'update'));
      const nextQueue = [queueItem, ...filtered];
      saveQueueToStorage(facilityId, nextQueue);
      setOfflineQueue(nextQueue);
      setSyncState('pending_offline');
    }

    // Update local state and local storage
    setRecords((prev) => {
      const updated = prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r));
      saveRecordsToStorage(facilityId, updated);
      return updated;
    });

    setSelectedRecord(updatedRecord);
    setIsUpdatingRecord(false);
    setIsEditingRecord(false);

    setAiStatusMessage({
      type: 'success',
      text: effectiveOnline && firebaseUser
        ? `Patient record ${updatedRecord.patientIdentifier} updated and synced with Firestore.`
        : `Patient record ${updatedRecord.patientIdentifier} updated locally (queued for offline sync).`
    });
  };

  // Re-analyze existing record with Gemini AI
  const handleReanalyzeWithGemini = async (record: PatientRecord) => {
    if (!effectiveOnline) {
      alert('Cannot connect to Gemini AI while in offline mode. Please reconnect or turn off simulated offline.');
      return;
    }

    setIsReanalyzingId(record.id);
    const facilityId = record.facilityId || userProfile?.facilityId || selectedFacilityId;
    try {
      const aiResponse = await fetchGeminiSummary({
        patientIdentifier: record.patientIdentifier,
        age: record.age,
        ageUnit: record.ageUnit,
        sex: record.sex,
        language: record.language,
        symptoms: record.symptoms,
        duration: record.duration,
        temperature: record.temperature,
        notes: record.additionalNotes
      });

      if (aiResponse?.success && aiResponse.data) {
        const aiData = aiResponse.data;
        const updatedRecord: PatientRecord = {
          ...record,
          updatedAt: new Date().toISOString(),
          warningLevel: aiData.warningLevel || record.warningLevel,
          warningSigns: Array.isArray(aiData.warningSigns) && aiData.warningSigns.length > 0
            ? aiData.warningSigns
            : record.warningSigns,
          summary: {
            chiefComplaints: Array.isArray(aiData.chiefComplaints) ? aiData.chiefComplaints : record.summary.chiefComplaints,
            durationSummary: aiData.durationSummary || record.summary.durationSummary,
            temperatureStatus: aiData.temperatureStatus || record.summary.temperatureStatus,
            suggestedActions: Array.isArray(aiData.suggestedActions) ? aiData.suggestedActions : record.summary.suggestedActions,
            missingInformation: Array.isArray(aiData.missingInformation) ? aiData.missingInformation : record.summary.missingInformation,
            clinicalConsiderations: Array.isArray(aiData.clinicalConsiderations) ? aiData.clinicalConsiderations : record.summary.clinicalConsiderations,
            isAiGenerated: true,
            modelUsed: aiResponse.modelUsed || 'gemini-3.8-flash'
          },
          syncStatus: 'synced'
        };

        if (firebaseUser && userProfile?.facilityId === facilityId) {
          await setDoc(doc(db, 'facilities', facilityId, 'records', record.id), updatedRecord);
        }

        setRecords((prev) => {
          const updated = prev.map((r) => (r.id === record.id ? updatedRecord : r));
          saveRecordsToStorage(facilityId, updated);
          return updated;
        });

        setSelectedRecord(updatedRecord);
        setAiStatusMessage({
          type: 'success',
          text: `Record updated with Gemini 3.8 Flash summary.`
        });
      }
    } catch (err: any) {
      alert(`Could not generate AI summary: ${err.message || 'Network error'}. Retaining existing summary.`);
    } finally {
      setIsReanalyzingId(null);
    }
  };

  // Synchronize Offline Queue with Firestore & Safe Conflict Detection
  const syncOfflineQueue = async (targetFacilityId?: string) => {
    const facId = targetFacilityId || userProfile?.facilityId || selectedFacilityId;
    const currentQueue = loadQueueFromStorage(facId);

    if (currentQueue.length === 0) {
      setSyncState('synced');
      return;
    }

    if (!effectiveOnline) {
      setAiStatusMessage({
        type: 'warning',
        text: 'Cannot synchronize while in offline mode.'
      });
      return;
    }

    setSyncState('syncing');
    let successCount = 0;
    const remainingQueue: OfflineQueueItem[] = [];

    for (let i = 0; i < currentQueue.length; i++) {
      const item = currentQueue[i];
      try {
        if (item.operation === 'create' && item.record) {
          if (firebaseUser && userProfile?.facilityId === facId) {
            const docRef = doc(db, 'facilities', facId, 'records', item.recordId);
            await setDoc(docRef, { ...item.record, syncStatus: 'synced' });
          }
          successCount++;
        } else if (item.operation === 'update' && item.record) {
          if (firebaseUser && userProfile?.facilityId === facId) {
            const docRef = doc(db, 'facilities', facId, 'records', item.recordId);
            const serverDoc = await getDoc(docRef);

            if (serverDoc.exists()) {
              const serverData = serverDoc.data() as PatientRecord;
              const serverTime = serverData.updatedAt ? new Date(serverData.updatedAt).getTime() : 0;
              const baseTime = item.baseUpdatedAt ? new Date(item.baseUpdatedAt).getTime() : 0;

              // Safe Conflict Detection: Remote version is newer than offline base
              if (serverTime > baseTime) {
                setConflictModalData({
                  queueItem: item,
                  localRecord: item.record,
                  serverRecord: serverData,
                  facilityId: facId
                });
                // Pause queue processing so user can resolve conflict
                remainingQueue.push(...currentQueue.slice(i));
                setSyncState('pending_offline');
                return;
              }
            }

            await setDoc(docRef, { ...item.record, syncStatus: 'synced' });
          }
          successCount++;
        } else if (item.operation === 'delete') {
          if (firebaseUser && userProfile?.facilityId === facId) {
            const docRef = doc(db, 'facilities', facId, 'records', item.recordId);
            await deleteDoc(docRef);
          }
          successCount++;
        }
      } catch (err: any) {
        console.error('Failed to sync queue item:', item, err);
        remainingQueue.push({
          ...item,
          retryCount: (item.retryCount || 0) + 1,
          lastError: err.message || 'Firestore write failed'
        });
      }
    }

    saveQueueToStorage(facId, remainingQueue);
    setOfflineQueue(remainingQueue);

    // Update records state to reflect synced status
    setRecords((prev) => {
      const updated = prev.map((r) => {
        if (currentQueue.some((q) => q.recordId === r.id)) {
          return { ...r, syncStatus: 'synced' as const };
        }
        return r;
      });
      saveRecordsToStorage(facId, updated);
      return updated;
    });

    if (remainingQueue.length === 0) {
      setSyncState('synced');
      setAiStatusMessage({
        type: 'success',
        text: `Successfully synchronized ${successCount} offline record change(s) with Firestore.`
      });
    } else {
      setSyncState('failed');
      setAiStatusMessage({
        type: 'warning',
        text: `${remainingQueue.length} record change(s) encountered errors. Will retry when connection stabilizes.`
      });
    }
  };

  // Resolve Synchronization Conflict Safely
  const handleResolveConflict = async (resolution: 'keep_local' | 'keep_server' | 'merge') => {
    if (!conflictModalData) return;
    const { queueItem, localRecord, serverRecord, facilityId } = conflictModalData;

    try {
      let resolvedRecord: PatientRecord;
      const nowIso = new Date().toISOString();

      if (resolution === 'keep_local') {
        resolvedRecord = {
          ...localRecord,
          updatedAt: nowIso,
          syncStatus: 'synced'
        };
      } else if (resolution === 'keep_server') {
        resolvedRecord = {
          ...serverRecord,
          syncStatus: 'synced'
        };
      } else {
        // Safe Merge: preserve highest severity and merge notes
        const severityRank = { red: 3, yellow: 2, green: 1 };
        const highestSeverity = severityRank[localRecord.warningLevel] >= severityRank[serverRecord.warningLevel]
          ? localRecord.warningLevel
          : serverRecord.warningLevel;

        const mergedSigns = Array.from(new Set([...serverRecord.warningSigns, ...localRecord.warningSigns]));
        const mergedNotes = [
          serverRecord.additionalNotes ? `[Remote notes]: ${serverRecord.additionalNotes}` : '',
          localRecord.additionalNotes ? `[Offline Addendum by ${userProfile?.displayName || 'Worker'}]: ${localRecord.additionalNotes}` : ''
        ].filter(Boolean).join('\n');

        resolvedRecord = {
          ...localRecord,
          additionalNotes: mergedNotes,
          warningLevel: highestSeverity,
          warningSigns: mergedSigns,
          updatedAt: nowIso,
          syncStatus: 'synced'
        };
      }

      // Save to Firestore if online
      if (firebaseUser && userProfile?.facilityId === facilityId) {
        const docRef = doc(db, 'facilities', facilityId, 'records', resolvedRecord.id);
        await setDoc(docRef, resolvedRecord);
      }

      // Update local storage and records
      setRecords((prev) => {
        const next = prev.map((r) => (r.id === resolvedRecord.id ? resolvedRecord : r));
        saveRecordsToStorage(facilityId, next);
        return next;
      });

      if (selectedRecord?.id === resolvedRecord.id) {
        setSelectedRecord(resolvedRecord);
      }

      // Remove the conflict item from the queue
      if (queueItem) {
        const remainingQueue = loadQueueFromStorage(facilityId).filter((q) => q.id !== queueItem.id);
        saveQueueToStorage(facilityId, remainingQueue);
        setOfflineQueue(remainingQueue);
      }

      setConflictModalData(null);
      setAiStatusMessage({
        type: 'success',
        text: `Conflict resolved for ${resolvedRecord.patientIdentifier} using "${resolution.replace('_', ' ')}".`
      });

      // Resume syncing remaining items
      setTimeout(() => {
        syncOfflineQueue(facilityId);
      }, 500);
    } catch (err: any) {
      console.error('Error resolving conflict:', err);
      alert(`Could not resolve conflict: ${err.message}`);
    }
  };

  // Delete Record with Offline Queue Support
  const handleDeleteRecord = async (id: string) => {
    if (confirm('Are you sure you want to remove this patient record from the facility registry?')) {
      const facilityId = selectedRecord?.facilityId || userProfile?.facilityId || selectedFacilityId;

      if (effectiveOnline && firebaseUser && userProfile?.facilityId === facilityId) {
        try {
          await deleteDoc(doc(db, 'facilities', facilityId, 'records', id));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `facilities/${facilityId}/records/${id}`);
        }
      } else {
        // Enqueue offline deletion
        const queueItem: OfflineQueueItem = {
          id: `q-${Date.now()}`,
          operation: 'delete',
          recordId: id,
          facilityId,
          queuedAt: new Date().toISOString()
        };
        const existingQueue = loadQueueFromStorage(facilityId);
        // Remove any prior pending create/update for this same record from the queue
        const filtered = existingQueue.filter((q) => q.recordId !== id);
        const nextQueue = [queueItem, ...filtered];
        saveQueueToStorage(facilityId, nextQueue);
        setOfflineQueue(nextQueue);
        setSyncState('pending_offline');
      }

      setRecords((prev) => {
        const filtered = prev.filter((r) => r.id !== id);
        saveRecordsToStorage(facilityId, filtered);
        return filtered;
      });

      if (selectedRecord?.id === id) {
        setSelectedRecord(null);
        setCurrentView('dashboard');
      }

      setAiStatusMessage({
        type: 'info',
        text: 'Patient record removed from facility registry.'
      });
    }
  };

  // Auto-sync when returning online
  useEffect(() => {
    if (effectiveOnline && offlineQueue.length > 0 && syncState !== 'syncing' && !conflictModalData) {
      syncOfflineQueue();
    }
  }, [effectiveOnline]);

  // Filtered Records
  const filteredRecords = records.filter((rec) => {
    const matchesSearch =
      rec.patientIdentifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.symptoms.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rec.additionalNotes && rec.additionalNotes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSeverity = filterSeverity === 'all' || rec.warningLevel === filterSeverity;
    return matchesSearch && matchesSeverity;
  });

  const redCount = records.filter((r) => r.warningLevel === 'red').length;
  const yellowCount = records.filter((r) => r.warningLevel === 'yellow').length;
  const greenCount = records.filter((r) => r.warningLevel === 'green').length;

  const handleCopySummary = (record: PatientRecord) => {
    const text = `IBOMCARE AI - PATIENT CLINICAL SUMMARY
Facility: ${userProfile?.facilityName || 'Primary Healthcare Centre'}
Patient: ${record.patientIdentifier} (${record.age} ${record.ageUnit}, ${record.sex})
Intake Time: ${new Date(record.createdAt).toLocaleString()}
Language Used: ${record.language}
Warning Status: ${record.warningLevel.toUpperCase()}
Temperature: ${record.temperature ? `${record.temperature}°C` : 'Not measured'}
Reported Duration: ${record.duration}
Summary Mode: ${record.summary.isAiGenerated ? `Gemini 3.8 Flash AI` : 'Rule-Based Local Demo'}

REPORTED SYMPTOMS (ORIGINAL WORDS):
"${record.symptoms}"

WARNING SIGNS NOTED:
${record.warningSigns.length > 0 ? record.warningSigns.map((w) => `• ${w}`).join('\n') : '• No acute high-risk warning flags detected'}

IDENTIFIED CHIEF COMPLAINTS:
${record.summary.chiefComplaints.map((c) => `• ${c}`).join('\n')}

MISSING INFORMATION TO COLLECT:
${(record.summary.missingInformation || []).map((m) => `• ${m}`).join('\n') || '• Standard baseline'}

SUGGESTED CLINICAL ACTIONS:
${record.summary.suggestedActions.map((a) => `• ${a}`).join('\n')}

NOTES:
${record.additionalNotes || 'None'}

DISCLAIMER: Decision-support summary for healthcare workers. Not a confirmed diagnosis.`;

    navigator.clipboard.writeText(text);
    setCopiedId(record.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const currentFacilityObj = facilities.find((f) => f.facilityId === (userProfile?.facilityId || selectedFacilityId));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500/30 selection:text-teal-200">
      {/* Top Header */}
      <header className="h-16 px-4 sm:px-6 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 group-hover:bg-teal-500/20 transition-colors">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white tracking-tight">IbomCare AI</span>
                <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20">
                  {userProfile ? userProfile.role.toUpperCase() : 'AUTH PORTAL'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:block truncate max-w-[200px]">
                {userProfile?.facilityName || 'Akwa Ibom Healthcare Network'}
              </span>
            </div>
          </button>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Dynamic Sync Status & Rural Simulation Toggle */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
            {syncState === 'syncing' ? (
              <div className="flex items-center gap-1.5 text-cyan-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline font-medium text-[11px]">Syncing ({offlineQueue.length})...</span>
              </div>
            ) : syncState === 'failed' ? (
              <button
                onClick={() => syncOfflineQueue()}
                className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300"
                title="Click to retry sync"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-medium text-[11px]">Sync Failed (Retry)</span>
              </button>
            ) : effectiveOnline ? (
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-medium text-[11px]">Online (Synced)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-400">
                <WifiOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-medium text-[11px]">
                  Offline {offlineQueue.length > 0 ? `(${offlineQueue.length} queued)` : '(Local Storage Active)'}
                </span>
              </div>
            )}

            {/* Offline Queue Badge Button */}
            {offlineQueue.length > 0 && (
              <button
                onClick={() => setShowQueueModal(true)}
                title="View queued changes waiting to sync"
                className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors ml-1"
              >
                <Clock className="w-2.5 h-2.5" />
                <span>{offlineQueue.length} Queued</span>
              </button>
            )}

            {/* Manual Sync Trigger if online and items exist */}
            {effectiveOnline && offlineQueue.length > 0 && syncState !== 'syncing' && (
              <button
                onClick={() => syncOfflineQueue()}
                title="Sync offline records to Cloud Firestore now"
                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 hover:bg-teal-500/30 transition-colors"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>Sync Now</span>
              </button>
            )}

            <button
              onClick={() => {
                const nextState = !simulatedOffline;
                setSimulatedOffline(nextState);
                if (!nextState && isOnline) {
                  // Re-connected! Auto-sync
                  setTimeout(() => syncOfflineQueue(), 200);
                }
              }}
              title="Toggle simulated rural connectivity to test offline field support"
              className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ml-1 ${
                simulatedOffline
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {simulatedOffline ? 'Simulating Offline' : 'Simulate Offline'}
            </button>
          </div>

          {/* User Profile / Facility View Trigger or Sign In Button */}
          {userProfile ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentView('facility_profile')}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs transition-colors text-left"
              >
                <Building2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <div className="truncate max-w-[140px]">
                  <span className="block font-medium text-slate-200 truncate">{userProfile.displayName}</span>
                  <span className="block text-[10px] text-slate-500 truncate">{userProfile.facilityName}</span>
                </div>
              </button>

              <button
                onClick={handleSignOut}
                title="Sign out of healthcare worker session"
                className="p-2 bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCurrentView('facility_profile')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold rounded-xl transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Facility</span>
            </button>
          )}

          {/* New Patient CTA */}
          {currentView !== 'new_record' && (
            <button
              onClick={() => setCurrentView('new_record')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs sm:text-sm rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Patient</span>
            </button>
          )}
        </div>
      </header>

      {/* Global Status Banner */}
      {aiStatusMessage && (
        <div
          className={`px-4 py-2.5 text-xs border-b flex items-center justify-between transition-colors ${
            aiStatusMessage.type === 'success'
              ? 'bg-teal-950/40 border-teal-800/60 text-teal-200'
              : aiStatusMessage.type === 'warning'
              ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
              : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
            {aiStatusMessage.type === 'success' ? (
              <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
            ) : aiStatusMessage.type === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            <span>{aiStatusMessage.text}</span>
            <button
              onClick={() => setAiStatusMessage(null)}
              className="ml-auto text-[11px] underline opacity-80 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* VIEW 0: AUTH & FACILITY PROFILE MANAGEMENT */}
        {currentView === 'facility_profile' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <button
                onClick={() => setCurrentView('dashboard')}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Patient Registry</span>
              </button>

              {userProfile && (
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out Session</span>
                </button>
              )}
            </div>

            {/* If Authenticated: Active Profile & Facility Overview */}
            {userProfile ? (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                        <User className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-white">{userProfile.displayName}</h2>
                          <span className="text-xs uppercase px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-mono">
                            {userProfile.role}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{userProfile.email}</p>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 font-mono">
                      <span>Firebase Auth Verified ✓</span>
                    </div>
                  </div>

                  {/* Associated Facility Details */}
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                      <Building2 className="w-4 h-4 text-teal-400" />
                      Associated Healthcare Facility
                    </h3>

                    {currentFacilityObj ? (
                      <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-base font-bold text-white">{currentFacilityObj.name}</span>
                          <span className="text-xs font-mono text-teal-300 bg-teal-500/10 border border-teal-500/20 px-2.5 py-0.5 rounded-md">
                            {currentFacilityObj.facilityType}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            <span>LGA: {currentFacilityObj.lga}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                            <span>Contact: {currentFacilityObj.phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-slate-500" />
                            <span>Email: {currentFacilityObj.contactEmail}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                            <span>Security Partition: {currentFacilityObj.facilityId}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Connected to {userProfile.facilityName}.</p>
                    )}
                  </div>

                  {/* Security Isolation Notice */}
                  <div className="p-4 bg-teal-950/20 border border-teal-800/40 rounded-xl text-xs text-slate-300 space-y-1">
                    <div className="text-teal-300 font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-teal-400" />
                      Cross-Facility Security Rules Active
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      Your Firestore rules strictly enforce that records in <code>/facilities/{userProfile.facilityId}/records</code> are only accessible by verified workers registered to this facility. No passwords are ever stored in Firestore.
                    </p>
                  </div>
                </div>
              </div>
            ) : firebaseUser ? (
              /* Authenticated via Firebase, but needs Facility Association */
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-teal-400 mb-1">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Step 2: Facility Association</span>
                  </div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Complete Healthcare Worker Profile</h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Associate your account ({firebaseUser.email}) with an existing healthcare facility in Akwa Ibom, or register a new primary health centre.
                  </p>
                </div>

                {authError && (
                  <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handleSaveFacilityProfile} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">
                        Full Name / Clinical Title <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        placeholder="e.g. Nurse Kufre Ekong"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500/50"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">Clinical Role</label>
                      <select
                        value={authRole}
                        onChange={(e) => setAuthRole(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500/50"
                      >
                        <option value="nurse">Registered Nurse (RN)</option>
                        <option value="chew">Community Health Extension Worker (CHEW)</option>
                        <option value="doctor">Medical Officer / Doctor</option>
                        <option value="officer">Health Records Officer</option>
                      </select>
                    </div>
                  </div>

                  {/* Mode: Join existing vs Register new */}
                  <div className="pt-2">
                    <div className="flex items-center gap-4 border-b border-slate-800 pb-2 mb-4 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setIsCreatingNewFacility(false)}
                        className={`transition-colors pb-1 ${
                          !isCreatingNewFacility
                            ? 'text-teal-400 border-b-2 border-teal-400 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Join Existing Facility in Akwa Ibom
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCreatingNewFacility(true)}
                        className={`transition-colors pb-1 ${
                          isCreatingNewFacility
                            ? 'text-teal-400 border-b-2 border-teal-400 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        + Register New Healthcare Facility
                      </button>
                    </div>

                    {!isCreatingNewFacility ? (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300">Select Healthcare Facility</label>
                        <select
                          value={selectedFacilityId}
                          onChange={(e) => setSelectedFacilityId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500/50"
                        >
                          {facilities.map((f) => (
                            <option key={f.facilityId} value={f.facilityId}>
                              {f.name} — ({f.lga} LGA, {f.facilityType})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-300">
                              Facility Official Name <span className="text-rose-400">*</span>
                            </label>
                            <input
                              type="text"
                              value={newFacilityName}
                              onChange={(e) => setNewFacilityName(e.target.value)}
                              placeholder="e.g. Primary Health Centre, Oron"
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500/50"
                              required
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-300">Facility Type</label>
                            <select
                              value={newFacilityType}
                              onChange={(e) => setNewFacilityType(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500/50"
                            >
                              <option value="Primary Healthcare Centre (PHC)">Primary Healthcare Centre (PHC)</option>
                              <option value="Comprehensive Health Centre (CHC)">Comprehensive Health Centre (CHC)</option>
                              <option value="General Hospital">General Hospital</option>
                              <option value="Health Post">Health Post</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-300">LGA (Akwa Ibom)</label>
                            <input
                              type="text"
                              value={newFacilityLga}
                              onChange={(e) => setNewFacilityLga(e.target.value)}
                              placeholder="e.g. Oron, Uyo, Eket, Abak"
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500/50"
                              required
                            />
                          </div>

                          <div className="sm:col-span-2 space-y-1.5">
                            <label className="text-xs font-medium text-slate-300">Address / Location</label>
                            <input
                              type="text"
                              value={newFacilityAddress}
                              onChange={(e) => setNewFacilityAddress(e.target.value)}
                              placeholder="e.g. Ward 3, Hospital Road"
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500/50"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-300">Contact Phone</label>
                            <input
                              type="text"
                              value={newFacilityPhone}
                              onChange={(e) => setNewFacilityPhone(e.target.value)}
                              placeholder="e.g. +234 802 000 1234"
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500/50"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-300">Facility Email</label>
                            <input
                              type="email"
                              value={newFacilityEmail}
                              onChange={(e) => setNewFacilityEmail(e.target.value)}
                              placeholder="e.g. info@phc-oron.ak.gov.ng"
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500/50"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                    <button
                      type="submit"
                      disabled={isSubmittingAuth}
                      className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-semibold text-xs sm:text-sm rounded-xl transition-colors shadow-sm flex items-center gap-2"
                    >
                      {isSubmittingAuth ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving Profile...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Save & Enter Facility Dashboard</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Not Signed In: Login & Sign Up Portal */
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-teal-400 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Authorized Healthcare Worker Access</span>
                  </div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Sign In to IbomCare AI</h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Sign in to access your facility's patient registry, record symptoms, and generate Gemini-assisted clinical summaries.
                  </p>
                </div>

                {authError && (
                  <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start gap-2.5 whitespace-pre-line leading-relaxed">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <div className="flex-1">{authError}</div>
                  </div>
                )}

                {/* Google Sign-in */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmittingAuth}
                  className="w-full py-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs sm:text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2.5"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google (Instant Verification)</span>
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-800"></div>
                  <span className="flex-shrink mx-4 text-[11px] text-slate-500 font-mono">OR EMAIL LOGIN</span>
                  <div className="flex-grow border-t border-slate-800"></div>
                </div>

                {/* Email Form */}
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <div className="flex items-center gap-4 border-b border-slate-800 pb-2 mb-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setAuthError(null);
                      }}
                      className={`transition-colors pb-1 ${
                        authMode === 'signin'
                          ? 'text-teal-400 border-b-2 border-teal-400 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                        setAuthError(null);
                      }}
                      className={`transition-colors pb-1 ${
                        authMode === 'signup'
                          ? 'text-teal-400 border-b-2 border-teal-400 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Create Account
                    </button>
                  </div>

                  {authMode === 'signup' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300">
                            Full Clinical Name <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={authName}
                            onChange={(e) => setAuthName(e.target.value)}
                            placeholder="e.g. Nurse Kufre Ekong"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500/50"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300">Clinical Role</label>
                          <select
                            value={authRole}
                            onChange={(e) => setAuthRole(e.target.value as any)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500/50"
                          >
                            <option value="nurse">Registered Nurse (RN)</option>
                            <option value="chew">Community Health Extension Worker (CHEW)</option>
                            <option value="doctor">Medical Officer / Doctor</option>
                            <option value="officer">Health Records Officer</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300">
                          Healthcare Facility in Akwa Ibom <span className="text-rose-400">*</span>
                        </label>
                        <select
                          value={selectedFacilityId}
                          onChange={(e) => setSelectedFacilityId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500/50"
                        >
                          {facilities.map((f) => (
                            <option key={f.facilityId} value={f.facilityId}>
                              {f.name} ({f.lga} LGA)
                            </option>
                          ))}
                        </select>
                        <span className="text-[10px] text-slate-500 block">
                          Patient records will be securely isolated to this facility.
                        </span>
                      </div>
                    </>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Healthcare Worker Email <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="e.g. kufre@phc-itam.ak.gov.ng"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500/50"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-300">
                        Password <span className="text-rose-400">*</span>
                      </label>
                      {authMode === 'signup' && (
                        <span className="text-[10px] text-slate-500">Min. 6 characters</span>
                      )}
                    </div>
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500/50"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingAuth}
                    className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-semibold text-xs sm:text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    {isSubmittingAuth ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processing {authMode === 'signin' ? 'Sign In' : 'Registration'}...</span>
                      </>
                    ) : (
                      <>
                        {authMode === 'signin' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                        <span>{authMode === 'signin' ? 'Sign In with Email' : 'Register & Join Facility'}</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Quick Fictional Demo Accounts for Rapid Hackathon Testing */}
                <div className="pt-4 border-t border-slate-800/80 space-y-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Demo Logins
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickDemoLogin('nurse', 'fac-itam-itu', 'Primary Healthcare Centre, Itam')}
                      className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-colors group"
                    >
                      <span className="font-semibold text-xs text-teal-300 block group-hover:text-teal-200">
                        Nurse Kufre
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">PHC Itam (Itu LGA)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickDemoLogin('chew', 'fac-ikot-ekpene', 'General Hospital, Ikot Ekpene')}
                      className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-colors group"
                    >
                      <span className="font-semibold text-xs text-amber-300 block group-hover:text-amber-200">
                        CHEW Aniekan
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">GH Ikot Ekpene</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickDemoLogin('doctor', 'fac-eket-chc', 'Comprehensive Health Centre, Eket')}
                      className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-colors group"
                    >
                      <span className="font-semibold text-xs text-cyan-300 block group-hover:text-cyan-200">
                        Dr. Bassey
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">CHC Eket</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 1: DASHBOARD */}
        {currentView === 'dashboard' && (
          <div className="space-y-6">
            {/* Clinical Banner & Active Facility */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950/40 border border-slate-800 rounded-2xl p-5 sm:p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-teal-400 mb-1.5">
                    <Building2 className="w-4 h-4" />
                    <span>{userProfile?.facilityName || 'Primary Healthcare Centre, Itam (Itu LGA)'}</span>
                    <span>·</span>
                    <span className="text-slate-400">
                      Logged in: {userProfile ? `${userProfile.displayName} (${userProfile.role.toUpperCase()})` : 'Guest Session'}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Facility Patient Registry & Triage
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    Designed for nurses and CHEWs in rural facilities. Records are partition-secured in Cloud Firestore for your facility and preserved locally on this device.
                  </p>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => setCurrentView('new_record')}
                    className="w-full sm:w-auto px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Intake New Patient</span>
                  </button>
                </div>
              </div>

              {/* Status Bar */}
              <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                  <span>
                    Facility Records: {records.length} patients active in{' '}
                    {userProfile?.facilityName || 'PHC Itam'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                  <span className="flex items-center gap-1 text-teal-400">
                    <Sparkles className="w-3 h-3" />
                    Gemini 3.8 Flash Active
                  </span>
                  <span>·</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Firestore ABAC Partitioned
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                <span className="text-xs text-slate-400 font-medium block">Total Facility Records</span>
                <span className="text-2xl font-bold text-white mt-1 block font-mono">{records.length}</span>
                <span className="text-[11px] text-teal-400 mt-0.5 block">Isolated to this facility</span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                <span className="text-xs text-rose-300 font-medium block flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  High Warning Cases
                </span>
                <span className="text-2xl font-bold text-rose-400 mt-1 block font-mono">{redCount}</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Requires urgent review</span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                <span className="text-xs text-amber-300 font-medium block">Moderate Signs</span>
                <span className="text-2xl font-bold text-amber-400 mt-1 block font-mono">{yellowCount}</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Close monitoring</span>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                <span className="text-xs text-emerald-300 font-medium block">Routine Observation</span>
                <span className="text-2xl font-bold text-emerald-400 mt-1 block font-mono">{greenCount}</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">No acute red flags</span>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Patient ID, nickname, symptoms..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-xs text-slate-500 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3" />
                  Filter:
                </span>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'red', label: 'Red (High)' },
                  { id: 'yellow', label: 'Yellow' },
                  { id: 'green', label: 'Green' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterSeverity(f.id as any)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      filterSeverity === f.id
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Records List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-slate-300">
                  Facility Records ({filteredRecords.length})
                </h2>
                <span className="text-[11px] text-slate-500">Tap any record to inspect full clinical summary</span>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
                  <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm text-slate-400 font-medium">No patient records found in this facility.</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {searchQuery || filterSeverity !== 'all'
                      ? 'Try adjusting your search query or severity filter.'
                      : 'Get started by creating your first patient intake record for this facility.'}
                  </p>
                  <button
                    onClick={() => setCurrentView('new_record')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-500 text-slate-950 text-xs font-semibold rounded-xl mt-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Record</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredRecords.map((record) => (
                    <div
                      key={record.id}
                      onClick={() => {
                        setSelectedRecord(record);
                        setCurrentView('detail');
                      }}
                      className="bg-slate-900 border border-slate-800/90 hover:border-teal-500/40 rounded-xl p-4 sm:p-5 transition-all cursor-pointer group space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2.5 h-10 rounded-full shrink-0 ${
                              record.warningLevel === 'red'
                                ? 'bg-rose-500 shadow-sm shadow-rose-500/50'
                                : record.warningLevel === 'yellow'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white group-hover:text-teal-300 transition-colors">
                                {record.patientIdentifier}
                              </span>
                              <span className="text-xs text-slate-400">
                                {record.age} {record.ageUnit} · {record.sex}
                              </span>
                              {record.summary.isAiGenerated && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Gemini AI
                                </span>
                              )}
                              {record.syncStatus === 'pending' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  <Clock className="w-2.5 h-2.5" />
                                  Queued Offline
                                </span>
                              )}
                              {record.syncStatus === 'conflict' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  Sync Conflict
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                              <span>Recorded: {new Date(record.createdAt).toLocaleDateString()}</span>
                              {record.updatedAt && record.updatedAt !== record.createdAt && (
                                <span className="text-slate-500 text-[11px]">
                                  (Edited {new Date(record.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                </span>
                              )}
                              <span>·</span>
                              <span className="text-slate-400 font-mono text-[11px]">{record.language}</span>
                              {record.temperature && (
                                <>
                                  <span>·</span>
                                  <span className="text-teal-300 font-mono text-[11px] flex items-center gap-1">
                                    <Thermometer className="w-3 h-3" />
                                    {record.temperature}°C
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRecord(record);
                              startEditingRecord(record);
                            }}
                            title="Edit patient record"
                            className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-teal-300 border border-slate-800 rounded-lg transition-colors flex items-center gap-1 text-xs"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span className="hidden md:inline text-[11px]">Edit</span>
                          </button>

                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                              record.warningLevel === 'red'
                                ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                                : record.warningLevel === 'yellow'
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {record.warningLevel === 'red'
                              ? 'High Warning'
                              : record.warningLevel === 'yellow'
                              ? 'Moderate Signs'
                              : 'Standard Review'}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-teal-400 transition-colors" />
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 line-clamp-2 pl-5 italic">
                        "{record.symptoms}"
                      </p>

                      {record.warningSigns.length > 0 && (
                        <div className="pl-5 flex flex-wrap gap-1.5 pt-1">
                          {record.warningSigns.slice(0, 2).map((sign, idx) => (
                            <span
                              key={idx}
                              className="text-[11px] bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded"
                            >
                              • {sign}
                            </span>
                          ))}
                          {record.warningSigns.length > 2 && (
                            <span className="text-[11px] text-slate-500 self-center">
                              +{record.warningSigns.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: NEW PATIENT RECORD FORM */}
        {currentView === 'new_record' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <button
                onClick={() => setCurrentView('dashboard')}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Dashboard</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Quick Test Cases:</span>
                <button
                  type="button"
                  onClick={() => handlePreFillSample('fever_child')}
                  className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-lg transition-colors border border-slate-700"
                >
                  Fill Child Fever Case
                </button>
                <button
                  type="button"
                  onClick={() => handlePreFillSample('respiratory_adult')}
                  className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-lg transition-colors border border-slate-700"
                >
                  Fill Adult Case
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
              {isGeneratingAi && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 animate-pulse">
                    <Sparkles className="w-6 h-6 animate-spin text-teal-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Generating Gemini AI Clinical Summary</h3>
                    <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
                      Securely organizing symptoms, identifying possible warning signs, and cross-checking primary care considerations...
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-teal-300 bg-teal-950/60 border border-teal-800/50 px-3 py-1 rounded-full">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Gemini 3.8 Flash Server Proxy</span>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-teal-400 mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Gemini AI-Powered Intake</span>
                  <span>·</span>
                  <span className="text-slate-400">{userProfile?.facilityName || 'Active Facility'}</span>
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">New Patient Intake Form</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Enter reported observations and symptoms. When submitted, the information is processed via our secure backend with Gemini AI and stored under your facility's partition.
                </p>
              </div>

              <form onSubmit={handleSaveRecord} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Patient ID / Nickname <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formPatientId}
                      onChange={(e) => setFormPatientId(e.target.value)}
                      placeholder="e.g. PAT-2026-44 or 'Uko E.'"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50"
                    />
                    {formErrors.patientId && (
                      <span className="text-[11px] text-rose-400 block">{formErrors.patientId}</span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Sex <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={formSex}
                      onChange={(e) => setFormSex(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-teal-500/50"
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Age <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      value={formAge}
                      onChange={(e) => setFormAge(e.target.value)}
                      placeholder="e.g. 4"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50"
                    />
                    {formErrors.age && (
                      <span className="text-[11px] text-rose-400 block">{formErrors.age}</span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Age Unit</label>
                    <select
                      value={formAgeUnit}
                      onChange={(e) => setFormAgeUnit(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-teal-500/50"
                    >
                      <option value="years">Years</option>
                      <option value="months">Months (Infants)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Reported Language <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={formLanguage}
                      onChange={(e) => setFormLanguage(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-teal-500/50"
                    >
                      <option value="English">English</option>
                      <option value="Nigerian Pidgin">Nigerian Pidgin</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Symptom Duration <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formDuration}
                      onChange={(e) => setFormDuration(e.target.value)}
                      placeholder="e.g. 2 days, 1 week, since morning"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50"
                    />
                    {formErrors.duration && (
                      <span className="text-[11px] text-rose-400 block">{formErrors.duration}</span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Measured Temperature (°C) <span className="text-slate-500">(Optional)</span>
                    </label>
                    <div className="relative">
                      <Thermometer className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={formTemperature}
                        onChange={(e) => setFormTemperature(e.target.value)}
                        placeholder="e.g. 38.5"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50"
                      />
                    </div>
                    {formErrors.temperature && (
                      <span className="text-[11px] text-rose-400 block">{formErrors.temperature}</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300">
                      Symptoms Narrative / Description <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Enter verbatim in {formLanguage}
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={formSymptoms}
                    onChange={(e) => setFormSymptoms(e.target.value)}
                    placeholder={
                      formLanguage === 'Nigerian Pidgin'
                        ? 'e.g. "Body dey hot well well since yesterday night, pikin no fit swallow food, eye dey red..."'
                        : 'e.g. "Patient reports persistent dry cough, chest tightness, fever for 3 days, difficulty sleeping..."'
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs sm:text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50"
                  />
                  {formErrors.symptoms && (
                    <span className="text-[11px] text-rose-400 block">{formErrors.symptoms}</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Additional Nurse / Field Worker Observations <span className="text-slate-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="e.g. Alert, skin turgor normal, given paracetamol at home with no improvement..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50"
                  />
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl text-xs text-slate-400 space-y-1">
                  <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-teal-400" />
                    Facility Security & Privacy
                  </div>
                  <p>
                    Record will be synced to {userProfile?.facilityName || 'your facility'} under Cloud Firestore security rules.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCurrentView('dashboard')}
                    className="px-4 py-2.5 text-xs sm:text-sm text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isGeneratingAi}
                    className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-semibold text-xs sm:text-sm rounded-xl transition-colors shadow-sm flex items-center gap-2"
                  >
                    {isGeneratingAi ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processing with Gemini...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Save to Facility & Generate Summary</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* VIEW 3: PATIENT RECORD DETAIL & SUMMARY */}
        {currentView === 'detail' && selectedRecord && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
              <button
                onClick={() => setCurrentView('dashboard')}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Patient Registry</span>
              </button>

              <div className="flex items-center gap-2">
                {!selectedRecord.summary.isAiGenerated && (
                  <button
                    onClick={() => handleReanalyzeWithGemini(selectedRecord)}
                    disabled={isReanalyzingId === selectedRecord.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg transition-colors font-medium"
                  >
                    {isReanalyzingId === selectedRecord.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Analyzing with Gemini...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Analyze with Gemini AI</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={() => handleCopySummary(selectedRecord)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg transition-colors"
                >
                  {copiedId === selectedRecord.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-teal-400" />
                      <span className="text-teal-400">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Referral Note</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => startEditingRecord(selectedRecord)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg transition-colors font-medium"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Record</span>
                </button>

                <button
                  onClick={() => handleDeleteRecord(selectedRecord.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* Patient Header Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      {selectedRecord.patientIdentifier}
                    </h1>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium ${
                        selectedRecord.warningLevel === 'red'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : selectedRecord.warningLevel === 'yellow'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {selectedRecord.warningLevel.toUpperCase()} PRIORITY
                    </span>
                    {selectedRecord.summary.isAiGenerated && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Gemini 3.8 Flash
                      </span>
                    )}
                    {selectedRecord.syncStatus === 'pending' ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Queued Offline
                      </span>
                    ) : selectedRecord.syncStatus === 'conflict' ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Sync Conflict
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        Firestore Synced
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5 flex flex-wrap items-center gap-3">
                    <span>{selectedRecord.age} {selectedRecord.ageUnit} old</span>
                    <span>·</span>
                    <span>Sex: {selectedRecord.sex}</span>
                    <span>·</span>
                    <span>Language: {selectedRecord.language}</span>
                    <span>·</span>
                    <span>Intake: {new Date(selectedRecord.createdAt).toLocaleString()}</span>
                    {selectedRecord.updatedAt && selectedRecord.updatedAt !== selectedRecord.createdAt && (
                      <>
                        <span>·</span>
                        <span className="text-teal-300 font-mono">
                          Updated: {new Date(selectedRecord.updatedAt).toLocaleTimeString()}
                        </span>
                      </>
                    )}
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center sm:text-right shrink-0">
                  <span className="text-[11px] text-slate-400 block">Temperature Status</span>
                  <span className="text-base font-bold text-teal-300 font-mono">
                    {selectedRecord.temperature ? `${selectedRecord.temperature}°C` : 'Not Measured'}
                  </span>
                </div>
              </div>

              {selectedRecord.warningSigns.length > 0 ? (
                <div
                  className={`p-4 rounded-xl border space-y-2 ${
                    selectedRecord.warningLevel === 'red'
                      ? 'bg-rose-950/30 border-rose-800/60 text-rose-200'
                      : 'bg-amber-950/30 border-amber-800/60 text-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs sm:text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Clinical Warning Flags Highlighted for Review:</span>
                  </div>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    {selectedRecord.warningSigns.map((w, idx) => (
                      <li key={idx} className="leading-relaxed">{w}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] pt-1 opacity-80 italic">
                    Follow facility protocol for acute danger sign management or arrange immediate doctor consultation.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>No acute red-flag danger signs detected based on recorded parameters. Continue regular nursing care and observation.</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Raw Patient Narrative */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-teal-400" />
                    Reported Patient Words
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">
                    Verbatim ({selectedRecord.language})
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">Original Symptoms:</span>
                    <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 italic leading-relaxed">
                      "{selectedRecord.symptoms}"
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <span className="text-slate-400 block text-[11px]">Symptom Duration:</span>
                      <span className="font-semibold text-slate-200">{selectedRecord.duration}</span>
                    </div>

                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <span className="text-slate-400 block text-[11px]">Recorded Temp:</span>
                      <span className="font-semibold text-slate-200">
                        {selectedRecord.temperature ? `${selectedRecord.temperature}°C` : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {selectedRecord.additionalNotes && (
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">Health Worker Observations:</span>
                      <p className="text-xs text-slate-300 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                        {selectedRecord.additionalNotes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Organized Clinical Summary */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-teal-400" />
                    Structured Clinical Summary
                  </h3>
                  {selectedRecord.summary.isAiGenerated ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      Gemini 3.8 Flash AI
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      Rule-Based Demo Summary
                    </span>
                  )}
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Identified Chief Complaints
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedRecord.summary.chiefComplaints.map((c, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-teal-300 rounded-lg font-medium"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Timeline & Progression
                    </span>
                    <p className="text-slate-300">{selectedRecord.summary.durationSummary}</p>
                  </div>

                  {selectedRecord.summary.missingInformation && selectedRecord.summary.missingInformation.length > 0 && (
                    <div>
                      <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider block mb-1.5">
                        Missing Clinical Information to Collect
                      </span>
                      <div className="space-y-1.5">
                        {selectedRecord.summary.missingInformation.map((infoItem, i) => (
                          <div
                            key={i}
                            className="p-2 bg-slate-950 border border-slate-800 rounded-lg flex items-start gap-2 text-slate-300"
                          >
                            <span className="text-amber-400 font-bold">•</span>
                            <span>{infoItem}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Recommended Nursing & Triage Steps
                    </span>
                    <div className="space-y-2">
                      {selectedRecord.summary.suggestedActions.map((act, i) => (
                        <div
                          key={i}
                          className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl flex items-start gap-2 text-slate-300"
                        >
                          <ChevronRight className="w-3.5 h-3.5 text-teal-400 mt-0.5 shrink-0" />
                          <span>{act}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-800 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {selectedRecord.summary.isAiGenerated
                        ? 'Generated via server-side Gemini 3.8 Flash. Validated for decision support only. Follow facility protocols and consult a medical officer.'
                        : 'Demo Mode: Summary organized deterministically from inputs. Connect online to analyze with Gemini AI.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: EDIT PATIENT RECORD */}
      {isEditingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-teal-400" />
                <h2 className="text-lg font-bold text-white tracking-tight">Edit Patient Record</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingRecord(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Patient ID or Nickname <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={editPatientId}
                  onChange={(e) => setEditPatientId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-teal-500/50"
                  required
                />
                {editErrors.patientId && (
                  <span className="text-[11px] text-rose-400 block">{editErrors.patientId}</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Age</label>
                  <input
                    type="number"
                    value={editAge}
                    onChange={(e) => setEditAge(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-teal-500/50"
                  />
                  {editErrors.age && (
                    <span className="text-[11px] text-rose-400 block">{editErrors.age}</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Age Unit</label>
                  <select
                    value={editAgeUnit}
                    onChange={(e) => setEditAgeUnit(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-teal-500/50"
                  >
                    <option value="years">Years</option>
                    <option value="months">Months</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Sex</label>
                  <select
                    value={editSex}
                    onChange={(e) => setEditSex(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-teal-500/50"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Symptom Duration</label>
                  <input
                    type="text"
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-teal-500/50"
                  />
                  {editErrors.duration && (
                    <span className="text-[11px] text-rose-400 block">{editErrors.duration}</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Measured Temperature (°C)</label>
                  <input
                    type="text"
                    value={editTemperature}
                    onChange={(e) => setEditTemperature(e.target.value)}
                    placeholder="e.g. 38.2"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-teal-500/50"
                  />
                  {editErrors.temperature && (
                    <span className="text-[11px] text-rose-400 block">{editErrors.temperature}</span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Language Used</label>
                <select
                  value={editLanguage}
                  onChange={(e) => setEditLanguage(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-teal-500/50"
                >
                  <option value="English">English</option>
                  <option value="Nigerian Pidgin">Nigerian Pidgin</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Symptoms Description</label>
                <textarea
                  rows={3}
                  value={editSymptoms}
                  onChange={(e) => setEditSymptoms(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-teal-500/50"
                />
                {editErrors.symptoms && (
                  <span className="text-[11px] text-rose-400 block">{editErrors.symptoms}</span>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Additional Nurse / Field Worker Observations
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Patient returned for check, vitals stable, oral rehydration begun..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-teal-500/50"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditingRecord(false)}
                  className="w-full sm:w-auto px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isUpdatingRecord}
                  onClick={(e) => handleSaveEditedRecord(e, false)}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
                >
                  Save Notes Only
                </button>
                <button
                  type="button"
                  disabled={isUpdatingRecord}
                  onClick={(e) => handleSaveEditedRecord(e, true)}
                  className="w-full sm:w-auto px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {isUpdatingRecord ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving & Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Save & Re-evaluate Triage</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SAFE SYNCHRONIZATION CONFLICT RESOLUTION */}
      {conflictModalData && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-rose-800/80 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800 text-rose-300">
              <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Clinical Record Conflict Detected
                </h2>
                <p className="text-xs text-slate-400">
                  Patient: <span className="font-semibold text-slate-200">{conflictModalData.localRecord.patientIdentifier}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              While your device was offline, another authorized healthcare worker updated this patient's record in Cloud Firestore.
              To ensure patient safety and prevent clinical data loss, choose how to reconcile the modifications:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Local Offline Version */}
              <div className="p-4 bg-slate-950/80 border border-amber-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <CloudOff className="w-3.5 h-3.5" />
                    Your Local Offline Edits
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {conflictModalData.localRecord.updatedAt ? new Date(conflictModalData.localRecord.updatedAt).toLocaleTimeString() : 'Recent'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Symptoms</span>
                  <p className="text-slate-200 italic">"{conflictModalData.localRecord.symptoms}"</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Vitals & Duration</span>
                  <p className="text-slate-300">
                    {conflictModalData.localRecord.temperature ? `${conflictModalData.localRecord.temperature}°C` : 'No temp'} · {conflictModalData.localRecord.duration}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Observations</span>
                  <p className="text-slate-300">{conflictModalData.localRecord.additionalNotes || 'None'}</p>
                </div>
              </div>

              {/* Remote Server Version */}
              <div className="p-4 bg-slate-950/80 border border-teal-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <span className="font-semibold text-teal-300 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" />
                    Firestore Cloud Version
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {conflictModalData.serverRecord.updatedAt ? new Date(conflictModalData.serverRecord.updatedAt).toLocaleTimeString() : 'Cloud Record'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Symptoms</span>
                  <p className="text-slate-200 italic">"{conflictModalData.serverRecord.symptoms}"</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Vitals & Duration</span>
                  <p className="text-slate-300">
                    {conflictModalData.serverRecord.temperature ? `${conflictModalData.serverRecord.temperature}°C` : 'No temp'} · {conflictModalData.serverRecord.duration}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Observations</span>
                  <p className="text-slate-300">{conflictModalData.serverRecord.additionalNotes || 'None'}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleResolveConflict('keep_server')}
                className="w-full sm:w-auto px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Keep Server Version
              </button>
              <button
                type="button"
                onClick={() => handleResolveConflict('keep_local')}
                className="w-full sm:w-auto px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 text-xs font-semibold rounded-xl transition-colors"
              >
                Overwrite with My Edits
              </button>
              <button
                type="button"
                onClick={() => handleResolveConflict('merge')}
                className="w-full sm:w-auto px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Merge Both (Safest Clinical Option)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: OFFLINE SYNC QUEUE DRAWER */}
      {showQueueModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white tracking-tight">Offline Sync Queue</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowQueueModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Facility: <span className="font-semibold text-slate-200">{userProfile?.facilityName || 'Active Facility'}</span>
            </p>

            {offlineQueue.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-sm text-slate-300 font-medium">All records are synchronized</p>
                <p className="text-xs text-slate-500">There are no pending offline mutations in the queue.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {offlineQueue.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                          item.operation === 'create'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : item.operation === 'update'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {item.operation}
                      </span>
                      <div>
                        <span className="font-semibold text-slate-200 block">
                          {item.record?.patientIdentifier || `Record ${item.recordId}`}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Queued at {new Date(item.queuedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    <span className="text-[11px] text-amber-400 font-mono">Pending Sync</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const facId = userProfile?.facilityId || selectedFacilityId;
                  saveQueueToStorage(facId, []);
                  setOfflineQueue([]);
                  setSyncState('synced');
                  setAiStatusMessage({ type: 'info', text: 'Offline queue cleared for test mode.' });
                }}
                className="text-xs text-slate-500 hover:text-rose-400 transition-colors"
              >
                Clear Queue
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowQueueModal(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
                {offlineQueue.length > 0 && effectiveOnline && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowQueueModal(false);
                      syncOfflineQueue();
                    }}
                    className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync Now</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-4 px-6 text-xs text-slate-500 flex items-center">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-400">IbomCare AI</span>
          <span>·</span>
          <span>Rural Healthcare Support System</span>
          <span>·</span>
          <span>Akwa Ibom State</span>
        </div>
      </footer>
    </div>
  );
}
