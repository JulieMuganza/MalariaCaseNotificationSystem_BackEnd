/**
 * Creates or resets all requested demo users in one run.
 * Safe to re-run: upserts by email.
 *
 * Usage:
 *   npm run db:create-all-demo-users
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, type UserRole } from '@prisma/client';

const prisma = new PrismaClient();

type DemoUser = {
  email: string;
  name: string;
  role: UserRole;
  district: string;
  staffCode: string;
  password: string;
};

const USERS: DemoUser[] = [
  {
    email: 'admin@malaria-demo.local',
    name: 'Admin Mugisha',
    role: 'ADMIN',
    district: 'Huye',
    staffCode: 'ADM-001',
    password: 'ChangeMe123!',
  },
  {
    email: 'district.clinical@malaria-demo.local',
    name: 'Dr. District Clinical Demo',
    role: 'HOSPITAL',
    district: 'Huye',
    staffCode: 'DH-DEMO-01',
    password: 'SmcnHospital2026!',
  },
  {
    email: 'referral.clinical@malaria-demo.local',
    name: 'Dr. Referral Clinical Demo',
    role: 'REFERRAL_HOSPITAL',
    district: 'Huye',
    staffCode: 'RH-DEMO-01',
    password: 'SmcnHospital2026!',
  },
  {
    email: 'chw.demo@malaria-demo.local',
    name: 'Demo CHW Field Worker',
    role: 'CHW',
    district: 'Huye',
    staffCode: 'CHW-DEMO-01',
    password: 'ChwDemo2026!',
  },
  {
    email: 'hc.demo@malaria-demo.local',
    name: 'Demo Health Center Clinician',
    role: 'HEALTH_CENTER',
    district: 'Huye',
    staffCode: 'HC-DEMO-01',
    password: 'HcDemo2026!',
  },
  {
    email: 'localclinic@malaria-demo.local',
    name: 'Demo Local Clinic Clinician',
    role: 'LOCAL_CLINIC',
    district: 'Huye',
    staffCode: 'LC-DEMO-01',
    password: 'LocalClinic2026!',
  },
  {
    email: 'rich.demo@malaria-demo.local',
    name: 'Demo RICH Surveillance',
    role: 'RICH',
    district: 'Huye',
    staffCode: 'RICH-DEMO-01',
    password: 'RichDemo2026!',
  },
  {
    email: 'pfth.demo@malaria-demo.local',
    name: 'Demo PFTH Surveillance',
    role: 'PFTH',
    district: 'Musanze',
    staffCode: 'PFTH-DEMO-01',
    password: 'PfthDemo2026!',
  },
  {
    email: 'sfr.demo@malaria-demo.local',
    name: 'Demo SFR Surveillance',
    role: 'SFR',
    district: 'Gasabo',
    staffCode: 'SFR-DEMO-01',
    password: 'SfrDemo2026!',
  },
  {
    email: 'hc.ruhango@malaria-demo.local',
    name: 'Ruhango Health Center',
    role: 'HEALTH_CENTER',
    district: 'Ruhango',
    staffCode: 'HC-RUHANGO-01',
    password: 'HcRuhango2026!',
  },
  {
    email: 'district.ruhango@malaria-demo.local',
    name: 'Ruhango District Hospital',
    role: 'HOSPITAL',
    district: 'Ruhango',
    staffCode: 'DH-RUHANGO-01',
    password: 'DhRuhango2026!',
  },
  {
    email: 'chw.musanze@malaria-demo.local',
    name: 'CHW Musanze (Northern demo)',
    role: 'CHW',
    district: 'Musanze',
    staffCode: 'CHW-MUS-01',
    password: 'NorthDemo2026!',
  },
  {
    email: 'hc.musanze@malaria-demo.local',
    name: 'Health Center Musanze (Northern demo)',
    role: 'HEALTH_CENTER',
    district: 'Musanze',
    staffCode: 'HC-MUS-01',
    password: 'NorthDemo2026!',
  },
  {
    email: 'localclinic.musanze@malaria-demo.local',
    name: 'Local Clinic Musanze (Northern demo)',
    role: 'LOCAL_CLINIC',
    district: 'Musanze',
    staffCode: 'LC-MUS-01',
    password: 'NorthDemo2026!',
  },
  {
    email: 'hospital.musanze@malaria-demo.local',
    name: 'District Hospital Musanze (Northern demo)',
    role: 'HOSPITAL',
    district: 'Musanze',
    staffCode: 'DH-MUS-01',
    password: 'NorthDemo2026!',
  },
  {
    email: 'referral.musanze@malaria-demo.local',
    name: 'Referral Hospital Musanze (Northern demo)',
    role: 'REFERRAL_HOSPITAL',
    district: 'Musanze',
    staffCode: 'RH-MUS-01',
    password: 'NorthDemo2026!',
  },
  {
    email: 'chw.gasabo@malaria-demo.local',
    name: 'CHW Gasabo (Kigali City demo)',
    role: 'CHW',
    district: 'Gasabo',
    staffCode: 'CHW-KGL-01',
    password: 'KigaliDemo2026!',
  },
  {
    email: 'hc.gasabo@malaria-demo.local',
    name: 'Health Center Gasabo (Kigali City demo)',
    role: 'HEALTH_CENTER',
    district: 'Gasabo',
    staffCode: 'HC-KGL-01',
    password: 'KigaliDemo2026!',
  },
  {
    email: 'localclinic.gasabo@malaria-demo.local',
    name: 'Local Clinic Gasabo (Kigali City demo)',
    role: 'LOCAL_CLINIC',
    district: 'Gasabo',
    staffCode: 'LC-KGL-01',
    password: 'KigaliDemo2026!',
  },
  {
    email: 'hospital.gasabo@malaria-demo.local',
    name: 'District Hospital Gasabo (Kigali City demo)',
    role: 'HOSPITAL',
    district: 'Gasabo',
    staffCode: 'DH-KGL-01',
    password: 'KigaliDemo2026!',
  },
  {
    email: 'referral.gasabo@malaria-demo.local',
    name: 'Referral Hospital Gasabo (Kigali City demo)',
    role: 'REFERRAL_HOSPITAL',
    district: 'Gasabo',
    staffCode: 'RH-KGL-01',
    password: 'KigaliDemo2026!',
  },
];

async function main() {
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);

  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, rounds);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash,
        name: u.name,
        role: u.role,
        district: u.district,
        staffCode: u.staffCode,
        status: 'ACTIVE',
        emailVerified: true,
        mustChangePassword: false,
      },
      create: {
        email: u.email,
        passwordHash,
        name: u.name,
        role: u.role,
        district: u.district,
        staffCode: u.staffCode,
        status: 'ACTIVE',
        emailVerified: true,
        mustChangePassword: false,
      },
    });
    // eslint-disable-next-line no-console
    console.log(`OK: ${u.email} (${u.role})`);
  }

  // eslint-disable-next-line no-console
  console.log('\nDone. All requested demo users were created/updated.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
