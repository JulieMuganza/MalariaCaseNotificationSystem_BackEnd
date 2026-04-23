import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_USERS_SEED_PATH = path.join(__dirname, 'local-users.seed.json');

type SeedUserRecord = {
  email: string;
  passwordHash: string | null;
  name: string;
  phone?: string | null;
  role:
    | 'CHW'
    | 'HEALTH_CENTER'
    | 'LOCAL_CLINIC'
    | 'HOSPITAL'
    | 'REFERRAL_HOSPITAL'
    | 'RICH'
    | 'PFTH'
    | 'SFR'
    | 'ADMIN';
  district: string;
  status: 'ACTIVE' | 'INACTIVE';
  staffCode?: string | null;
  emailVerified?: boolean;
  mustChangePassword?: boolean;
};

async function seedLocalUsersFromSnapshot() {
  try {
    const raw = await fs.readFile(LOCAL_USERS_SEED_PATH, 'utf8');
    const parsed = JSON.parse(raw) as SeedUserRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) return 0;

    let count = 0;
    for (const u of parsed) {
      if (!u.email || !u.name || !u.role || !u.district || !u.status) continue;
      await prisma.user.upsert({
        where: { email: u.email },
        update: {
          passwordHash: u.passwordHash,
          name: u.name,
          phone: u.phone ?? null,
          role: u.role,
          district: u.district,
          status: u.status,
          staffCode: u.staffCode ?? null,
          emailVerified: u.emailVerified ?? true,
          mustChangePassword: u.mustChangePassword ?? false,
        },
        create: {
          email: u.email,
          passwordHash: u.passwordHash,
          name: u.name,
          phone: u.phone ?? null,
          role: u.role,
          district: u.district,
          status: u.status,
          staffCode: u.staffCode ?? null,
          emailVerified: u.emailVerified ?? true,
          mustChangePassword: u.mustChangePassword ?? false,
        },
      });
      count += 1;
    }
    return count;
  } catch (error) {
    const e = error as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') return 0;
    throw error;
  }
}

async function main() {
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  const password = await bcrypt.hash('ChangeMe123!', rounds);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@malaria-demo.local' },
    update: {
      passwordHash: password,
      name: 'Admin Mugisha',
      role: 'ADMIN',
      district: 'Huye',
      staffCode: 'ADM-001',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
    create: {
      email: 'admin@malaria-demo.local',
      passwordHash: password,
      name: 'Admin Mugisha',
      role: 'ADMIN',
      district: 'Huye',
      staffCode: 'ADM-001',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });

  const chw = await prisma.user.upsert({
    where: { email: 'chw@malaria-demo.local' },
    update: {},
    create: {
      email: 'chw@malaria-demo.local',
      passwordHash: password,
      name: 'Anastase Nkurunziza',
      role: 'CHW',
      district: 'Huye',
      staffCode: 'CHW-101',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });

  const hc = await prisma.user.upsert({
    where: { email: 'hc@malaria-demo.local' },
    update: {},
    create: {
      email: 'hc@malaria-demo.local',
      passwordHash: password,
      name: 'Nurse Alice Mukamusoni',
      role: 'HEALTH_CENTER',
      district: 'Huye',
      staffCode: 'HC-201',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });

  const lcPassword = await bcrypt.hash('LocalClinic2026!', rounds);
  const localClinic = await prisma.user.upsert({
    where: { email: 'localclinic@malaria-demo.local' },
    update: { passwordHash: lcPassword },
    create: {
      email: 'localclinic@malaria-demo.local',
      passwordHash: lcPassword,
      name: 'Demo Local Clinic Clinician',
      role: 'LOCAL_CLINIC',
      district: 'Huye',
      staffCode: 'LC-205',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });

  const hospital = await prisma.user.upsert({
    where: { email: 'hospital@malaria-demo.local' },
    update: {},
    create: {
      email: 'hospital@malaria-demo.local',
      passwordHash: password,
      name: 'Dr. Jean-Pierre Kamanzi',
      role: 'HOSPITAL',
      district: 'Huye',
      staffCode: 'DH-301',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });

  const referralHospital = await prisma.user.upsert({
    where: { email: 'referral@malaria-demo.local' },
    update: {},
    create: {
      email: 'referral@malaria-demo.local',
      passwordHash: password,
      name: 'Dr. Marie Uwimana',
      role: 'REFERRAL_HOSPITAL',
      district: 'Huye',
      staffCode: 'RH-501',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });

  const rich = await prisma.user.upsert({
    where: { email: 'rich@malaria-demo.local' },
    update: {},
    create: {
      email: 'rich@malaria-demo.local',
      passwordHash: password,
      name: 'RICH Surveillance Desk',
      role: 'RICH',
      district: 'Huye',
      staffCode: 'RICH-401',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });

  const pfth = await prisma.user.upsert({
    where: { email: 'pfth@malaria-demo.local' },
    update: { passwordHash: password },
    create: {
      email: 'pfth@malaria-demo.local',
      passwordHash: password,
      name: 'PFTH Surveillance Desk (Northern Province)',
      role: 'PFTH',
      district: 'Musanze',
      staffCode: 'PFTH-402',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });

  const sfr = await prisma.user.upsert({
    where: { email: 'sfr@malaria-demo.local' },
    update: { passwordHash: password },
    create: {
      email: 'sfr@malaria-demo.local',
      passwordHash: password,
      name: 'SFR Surveillance Desk (Kigali City)',
      role: 'SFR',
      district: 'Gasabo',
      staffCode: 'SFR-403',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });

  /** Northern Province (Musanze) — full facility ladder for demos alongside PFTH. */
  const northDemoPw = await bcrypt.hash('NorthDemo2026!', rounds);
  await prisma.user.upsert({
    where: { email: 'chw.musanze@malaria-demo.local' },
    update: { passwordHash: northDemoPw },
    create: {
      email: 'chw.musanze@malaria-demo.local',
      passwordHash: northDemoPw,
      name: 'CHW Musanze (Northern demo)',
      role: 'CHW',
      district: 'Musanze',
      staffCode: 'CHW-MUS-01',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });
  await prisma.user.upsert({
    where: { email: 'hc.musanze@malaria-demo.local' },
    update: { passwordHash: northDemoPw },
    create: {
      email: 'hc.musanze@malaria-demo.local',
      passwordHash: northDemoPw,
      name: 'Health Center Musanze (Northern demo)',
      role: 'HEALTH_CENTER',
      district: 'Musanze',
      staffCode: 'HC-MUS-01',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });
  await prisma.user.upsert({
    where: { email: 'localclinic.musanze@malaria-demo.local' },
    update: { passwordHash: northDemoPw },
    create: {
      email: 'localclinic.musanze@malaria-demo.local',
      passwordHash: northDemoPw,
      name: 'Local Clinic Musanze (Northern demo)',
      role: 'LOCAL_CLINIC',
      district: 'Musanze',
      staffCode: 'LC-MUS-01',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });
  await prisma.user.upsert({
    where: { email: 'hospital.musanze@malaria-demo.local' },
    update: { passwordHash: northDemoPw },
    create: {
      email: 'hospital.musanze@malaria-demo.local',
      passwordHash: northDemoPw,
      name: 'District Hospital Musanze (Northern demo)',
      role: 'HOSPITAL',
      district: 'Musanze',
      staffCode: 'DH-MUS-01',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });
  await prisma.user.upsert({
    where: { email: 'referral.musanze@malaria-demo.local' },
    update: { passwordHash: northDemoPw },
    create: {
      email: 'referral.musanze@malaria-demo.local',
      passwordHash: northDemoPw,
      name: 'Referral Hospital Musanze (Northern demo)',
      role: 'REFERRAL_HOSPITAL',
      district: 'Musanze',
      staffCode: 'RH-MUS-01',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });

  /** Kigali City (Gasabo) — facility ladder; SFR is the city surveillance partner (see `sfr` above). */
  const kigaliDemoPw = await bcrypt.hash('KigaliDemo2026!', rounds);
  await prisma.user.upsert({
    where: { email: 'chw.gasabo@malaria-demo.local' },
    update: { passwordHash: kigaliDemoPw },
    create: {
      email: 'chw.gasabo@malaria-demo.local',
      passwordHash: kigaliDemoPw,
      name: 'CHW Gasabo (Kigali City demo)',
      role: 'CHW',
      district: 'Gasabo',
      staffCode: 'CHW-KGL-01',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });
  await prisma.user.upsert({
    where: { email: 'hc.gasabo@malaria-demo.local' },
    update: { passwordHash: kigaliDemoPw },
    create: {
      email: 'hc.gasabo@malaria-demo.local',
      passwordHash: kigaliDemoPw,
      name: 'Health Center Gasabo (Kigali City demo)',
      role: 'HEALTH_CENTER',
      district: 'Gasabo',
      staffCode: 'HC-KGL-01',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });
  await prisma.user.upsert({
    where: { email: 'localclinic.gasabo@malaria-demo.local' },
    update: { passwordHash: kigaliDemoPw },
    create: {
      email: 'localclinic.gasabo@malaria-demo.local',
      passwordHash: kigaliDemoPw,
      name: 'Local Clinic Gasabo (Kigali City demo)',
      role: 'LOCAL_CLINIC',
      district: 'Gasabo',
      staffCode: 'LC-KGL-01',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });
  await prisma.user.upsert({
    where: { email: 'hospital.gasabo@malaria-demo.local' },
    update: { passwordHash: kigaliDemoPw },
    create: {
      email: 'hospital.gasabo@malaria-demo.local',
      passwordHash: kigaliDemoPw,
      name: 'District Hospital Gasabo (Kigali City demo)',
      role: 'HOSPITAL',
      district: 'Gasabo',
      staffCode: 'DH-KGL-01',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });
  await prisma.user.upsert({
    where: { email: 'referral.gasabo@malaria-demo.local' },
    update: { passwordHash: kigaliDemoPw },
    create: {
      email: 'referral.gasabo@malaria-demo.local',
      passwordHash: kigaliDemoPw,
      name: 'Referral Hospital Gasabo (Kigali City demo)',
      role: 'REFERRAL_HOSPITAL',
      district: 'Gasabo',
      staffCode: 'RH-KGL-01',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });

  const existing = await prisma.case.count();
  if (existing === 0) {
    const year = new Date().getFullYear();
    const caseRef = `SM-${year}-0001`;
    const dob = new Date('2018-05-10T00:00:00.000Z');
    const dfs = new Date('2026-03-20T00:00:00.000Z');
    await prisma.case.create({
      data: {
        caseRef,
        patientName: 'Jean Mugabo',
        patientCode: 'NID-1000000001',
        patientId: 'NID-1000000001',
        sex: 'Male',
        dateOfBirth: dob,
        age: 7,
        ageGroup: '5 and above',
        district: 'Huye',
        sector: 'Huye',
        cell: 'Cell-1',
        village: 'Village-1',
        maritalStatus: 'Single',
        familySize: 4,
        educationLevel: 'Primary',
        occupation: 'Student',
        economicStatus: 'Low',
        distanceToHC: '< 1hr',
        transportMode: 'Walk',
        hasInsurance: true,
        insuranceType: 'CBHI',
        nightOutings: false,
        dateFirstSymptom: dfs,
        timeToSeekCare: 'In 24hrs',
        usedTraditionalMedicine: false,
        consultedCHW: true,
        rdtsAvailable: true,
        consultedHealthPost: false,
        consultedHealthCenter: false,
        consultedHospital: false,
        symptoms: ['Fever', 'Multiple convulsions'],
        symptomCount: 2,
        chwSymptoms: ['Fever', 'Multiple convulsions'],
        chwRapidTestResult: 'Positive',
        houseWallStatus: 'Trees+cemented',
        mosquitoEntry: false,
        breedingSites: ['Rice field'],
        preventionMeasures: ['LLINs'],
        sleepsUnderLLIN: true,
        status: 'Pending',
        chwName: chw.name,
        chwId: chw.staffCode ?? 'CHW-101',
        reportedByUserId: chw.id,
        chwTransferDateTime: new Date('2026-03-28T08:00:00.000Z'),
        chwReferralTransport: 'Walk',
        vulnerabilities: [],
        hcPreTreatment: [],
        timeline: {
          create: {
            event: 'Case reported by CHW',
            actorName: chw.name,
            actorRole: 'CHW',
          },
        },
      },
    });
    const row = await prisma.case.findUniqueOrThrow({
      where: { caseRef },
    });
    await prisma.notification.createMany({
      data: [
        {
          type: 'alert',
          title: 'CHW → Centre de santé (partial — no symptoms)',
          message: 'Seeded notification for Health Center',
          caseRef,
          targetRole: 'HEALTH_CENTER',
          phase: 'aller',
          contentLevel: 'partial',
          recipientRoles: 'CHEO, Head Health Center (Titulaire)',
          malariaCaseId: row.id,
        },
        {
          type: 'alert',
          title: 'CHW → RICH (full notification)',
          message: 'Seeded notification for RICH',
          caseRef,
          targetRole: 'RICH',
          phase: 'aller',
          contentLevel: 'full',
          malariaCaseId: row.id,
        },
      ],
    });

    const caseRefNorth = `SM-${year}-0002`;
    await prisma.case.create({
      data: {
        caseRef: caseRefNorth,
        patientName: 'Demo North Patient',
        patientCode: 'NID-1000000002',
        patientId: 'NID-1000000002',
        sex: 'Female',
        dateOfBirth: new Date('2019-01-15T00:00:00.000Z'),
        age: 5,
        ageGroup: '5 and above',
        province: 'Northern Province',
        district: 'Musanze',
        sector: 'Muhoza',
        cell: 'Cell-N1',
        village: 'Village-N1',
        maritalStatus: 'Single',
        familySize: 5,
        educationLevel: 'Primary',
        occupation: 'Student',
        economicStatus: 'Low',
        distanceToHC: '< 1hr',
        transportMode: 'Walk',
        hasInsurance: true,
        insuranceType: 'CBHI',
        nightOutings: false,
        dateFirstSymptom: dfs,
        timeToSeekCare: 'In 24hrs',
        usedTraditionalMedicine: false,
        consultedCHW: true,
        rdtsAvailable: true,
        consultedHealthPost: false,
        consultedHealthCenter: false,
        consultedHospital: false,
        symptoms: ['Fever', 'Convulsions'],
        symptomCount: 2,
        chwSymptoms: ['Fever', 'Convulsions'],
        chwRapidTestResult: 'Positive',
        houseWallStatus: 'Trees+cemented',
        mosquitoEntry: false,
        breedingSites: ['Stagnant water/lake'],
        preventionMeasures: ['LLINs'],
        sleepsUnderLLIN: true,
        status: 'Pending',
        chwName: chw.name,
        chwId: chw.staffCode ?? 'CHW-101',
        reportedByUserId: chw.id,
        chwTransferDateTime: new Date('2026-03-29T09:00:00.000Z'),
        chwReferralTransport: 'Walk',
        vulnerabilities: [],
        hcPreTreatment: [],
        timeline: {
          create: {
            event: 'Demo case — Northern Province (Musanze)',
            actorName: chw.name,
            actorRole: 'CHW',
          },
        },
      },
    });
    const rowNorth = await prisma.case.findUniqueOrThrow({
      where: { caseRef: caseRefNorth },
    });
    await prisma.notification.create({
      data: {
        type: 'alert',
        title: 'CHW → PFTH (full notification)',
        message: 'Seeded notification for PFTH — Northern Province sample (Musanze)',
        caseRef: caseRefNorth,
        targetRole: 'PFTH',
        phase: 'aller',
        contentLevel: 'full',
        recipientRoles: 'PFTH surveillance',
        malariaCaseId: rowNorth.id,
      },
    });

    const caseRefKgl = `SM-${year}-0003`;
    await prisma.case.create({
      data: {
        caseRef: caseRefKgl,
        patientName: 'Demo Kigali Patient',
        patientCode: 'NID-1000000003',
        patientId: 'NID-1000000003',
        sex: 'Male',
        dateOfBirth: new Date('2020-06-01T00:00:00.000Z'),
        age: 4,
        ageGroup: 'Under 5',
        province: 'Kigali City',
        district: 'Gasabo',
        sector: 'Kacyiru',
        cell: 'Cell-K1',
        village: 'Village-K1',
        maritalStatus: 'Single',
        familySize: 3,
        educationLevel: 'None',
        occupation: 'Student',
        economicStatus: 'Low',
        distanceToHC: '< 1hr',
        transportMode: 'Walk',
        hasInsurance: true,
        insuranceType: 'CBHI',
        nightOutings: false,
        dateFirstSymptom: dfs,
        timeToSeekCare: 'In 24hrs',
        usedTraditionalMedicine: false,
        consultedCHW: true,
        rdtsAvailable: true,
        consultedHealthPost: false,
        consultedHealthCenter: false,
        consultedHospital: false,
        symptoms: ['Fever', 'Vomiting'],
        symptomCount: 2,
        chwSymptoms: ['Fever', 'Vomiting'],
        chwRapidTestResult: 'Positive',
        houseWallStatus: 'Trees+cemented',
        mosquitoEntry: false,
        breedingSites: ['Uncovered water tanks'],
        preventionMeasures: ['LLINs'],
        sleepsUnderLLIN: true,
        status: 'Pending',
        chwName: chw.name,
        chwId: chw.staffCode ?? 'CHW-101',
        reportedByUserId: chw.id,
        chwTransferDateTime: new Date('2026-03-30T10:00:00.000Z'),
        chwReferralTransport: 'Walk',
        vulnerabilities: [],
        hcPreTreatment: [],
        timeline: {
          create: {
            event: 'Demo case — Kigali City (Gasabo)',
            actorName: chw.name,
            actorRole: 'CHW',
          },
        },
      },
    });
    const rowKgl = await prisma.case.findUniqueOrThrow({
      where: { caseRef: caseRefKgl },
    });
    await prisma.notification.create({
      data: {
        type: 'alert',
        title: 'CHW → SFR (full notification)',
        message: 'Seeded notification for SFR — Kigali City sample (Gasabo)',
        caseRef: caseRefKgl,
        targetRole: 'SFR',
        phase: 'aller',
        contentLevel: 'full',
        recipientRoles: 'SFR surveillance',
        malariaCaseId: rowKgl.id,
      },
    });
  }

  const importedLocalUsers = await seedLocalUsersFromSnapshot();

  console.log('Seed complete:', {
    admin: admin.email,
    chw: chw.email,
    hc: hc.email,
    localClinic: localClinic.email,
    localClinicPassword: 'LocalClinic2026!',
    districtHospital: hospital.email,
    referralHospital: referralHospital.email,
    rich: rich.email,
    pfth: pfth.email,
    pfthPassword: 'ChangeMe123!',
    sfr: sfr.email,
    northernProvinceMusanze: {
      password: 'NorthDemo2026!',
      chw: 'chw.musanze@malaria-demo.local',
      healthCenter: 'hc.musanze@malaria-demo.local',
      localClinic: 'localclinic.musanze@malaria-demo.local',
      districtHospital: 'hospital.musanze@malaria-demo.local',
      referralHospital: 'referral.musanze@malaria-demo.local',
    },
    kigaliCityGasabo: {
      password: 'KigaliDemo2026!',
      chw: 'chw.gasabo@malaria-demo.local',
      healthCenter: 'hc.gasabo@malaria-demo.local',
      localClinic: 'localclinic.gasabo@malaria-demo.local',
      districtHospital: 'hospital.gasabo@malaria-demo.local',
      referralHospital: 'referral.gasabo@malaria-demo.local',
      sfrSurveillancePartner: {
        email: 'sfr@malaria-demo.local',
        password: 'ChangeMe123!',
        demoAlso: 'sfr.demo@malaria-demo.local / SfrDemo2026!',
      },
    },
    demoPassword: 'ChangeMe123!',
    importedLocalUsers,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
