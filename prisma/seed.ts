// NPIs in this file are fabricated for demo purposes. Format-valid (10 digits) but not registered with NPPES.

import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

type Seed = {
  npi: string;
  firstName: string;
  lastName: string;
  specialty: string;
  subSpecialty: string | null;
  affiliation: string;
  city: string;
  state: string;
  npiRegistrationYear: number;
  acceptingPatients?: boolean;
  boardCertified?: boolean;
};

const physicians: Seed[] = [
  // Oncology — 8
  { npi: "1043820194", firstName: "Aisha",   lastName: "Rahman",    specialty: "Oncology",      subSpecialty: "Medical Oncology",      affiliation: "MD Anderson Cancer Center",       city: "Houston",     state: "TX", npiRegistrationYear: 2004 },
  { npi: "1184902375", firstName: "Daniel",  lastName: "Okafor",    specialty: "Oncology",      subSpecialty: "Hematologic Oncology",  affiliation: "Memorial Sloan Kettering",        city: "New York",    state: "NY", npiRegistrationYear: 2011 },
  { npi: "1239847562", firstName: "Priya",   lastName: "Venkatesh", specialty: "Oncology",      subSpecialty: "Radiation Oncology",    affiliation: "Mayo Clinic",                     city: "Rochester",   state: "MN", npiRegistrationYear: 1998 },
  { npi: "1320498576", firstName: "James",   lastName: "O'Connell", specialty: "Oncology",      subSpecialty: "Medical Oncology",      affiliation: "Massachusetts General Hospital",  city: "Boston",      state: "MA", npiRegistrationYear: 2016 },
  { npi: "1487203945", firstName: "Linh",    lastName: "Nguyen",    specialty: "Oncology",      subSpecialty: "Hematologic Oncology",  affiliation: "UCSF Medical Center",             city: "San Francisco", state: "CA", npiRegistrationYear: 2009, boardCertified: false },
  { npi: "1530948271", firstName: "Marcus",  lastName: "Bennett",   specialty: "Oncology",      subSpecialty: "Radiation Oncology",    affiliation: "Cleveland Clinic",                city: "Cleveland",   state: "OH", npiRegistrationYear: 2001 },
  { npi: "1648372910", firstName: "Sofia",   lastName: "Alvarez",   specialty: "Oncology",      subSpecialty: "Medical Oncology",      affiliation: "Stanford Health Care",            city: "Stanford",    state: "CA", npiRegistrationYear: 2014 },
  { npi: "1730294857", firstName: "Ravi",    lastName: "Krishnan",  specialty: "Oncology",      subSpecialty: "Hematologic Oncology",  affiliation: "Johns Hopkins Medicine",          city: "Baltimore",   state: "PA", npiRegistrationYear: 1996 },

  // Cardiology — 7
  { npi: "1820394756", firstName: "Elena",   lastName: "Petrova",   specialty: "Cardiology",    subSpecialty: "Interventional Cardiology", affiliation: "Cedars-Sinai Medical Center", city: "Los Angeles", state: "CA", npiRegistrationYear: 2002 },
  { npi: "1908273645", firstName: "Thomas",  lastName: "Whitfield", specialty: "Cardiology",    subSpecialty: "Electrophysiology",      affiliation: "Cleveland Clinic",                city: "Cleveland",   state: "OH", npiRegistrationYear: 1995 },
  { npi: "2018473625", firstName: "Hannah",  lastName: "Goldberg",  specialty: "Cardiology",    subSpecialty: "Interventional Cardiology", affiliation: "Mount Sinai Health System",   city: "New York",    state: "NY", npiRegistrationYear: 2013 },
  { npi: "2109384756", firstName: "Kenji",   lastName: "Tanaka",    specialty: "Cardiology",    subSpecialty: "Electrophysiology",      affiliation: "Northwestern Memorial Hospital",  city: "Chicago",     state: "IL", npiRegistrationYear: 2008 },
  { npi: "2230495867", firstName: "Olivia",  lastName: "Carter",    specialty: "Cardiology",    subSpecialty: null,                     affiliation: "Houston Methodist",               city: "Houston",     state: "TX", npiRegistrationYear: 2017, acceptingPatients: false },
  { npi: "2348576920", firstName: "Andre",   lastName: "Dubois",    specialty: "Cardiology",    subSpecialty: "Interventional Cardiology", affiliation: "NewYork-Presbyterian",        city: "New York",    state: "NY", npiRegistrationYear: 2000 },
  { npi: "2419283746", firstName: "Mei",     lastName: "Zhang",     specialty: "Cardiology",    subSpecialty: "Electrophysiology",      affiliation: "UCSF Medical Center",             city: "San Francisco", state: "CA", npiRegistrationYear: 2019 },

  // Neurology — 7
  { npi: "2530948571", firstName: "Robert",  lastName: "Holloway",  specialty: "Neurology",     subSpecialty: "Movement Disorders",     affiliation: "Mayo Clinic",                     city: "Rochester",   state: "MN", npiRegistrationYear: 1997 },
  { npi: "2648372019", firstName: "Yael",    lastName: "Rosenthal", specialty: "Neurology",     subSpecialty: "Epilepsy",               affiliation: "Johns Hopkins Medicine",          city: "Baltimore",   state: "PA", npiRegistrationYear: 2010 },
  { npi: "2730495861", firstName: "Carlos",  lastName: "Mendoza",   specialty: "Neurology",     subSpecialty: "Movement Disorders",     affiliation: "Stanford Health Care",            city: "Stanford",    state: "CA", npiRegistrationYear: 2005 },
  { npi: "2820394758", firstName: "Aiden",   lastName: "Park",      specialty: "Neurology",     subSpecialty: "Epilepsy",               affiliation: "Massachusetts General Hospital",  city: "Boston",      state: "MA", npiRegistrationYear: 2015 },
  { npi: "2918374650", firstName: "Fatima",  lastName: "Hassan",    specialty: "Neurology",     subSpecialty: null,                     affiliation: "Cleveland Clinic",                city: "Cleveland",   state: "OH", npiRegistrationYear: 1999, boardCertified: false },
  { npi: "3028475960", firstName: "Henry",   lastName: "Sullivan",  specialty: "Neurology",     subSpecialty: "Movement Disorders",     affiliation: "Mount Sinai Health System",       city: "New York",    state: "NY", npiRegistrationYear: 2012 },
  { npi: "3120394857", firstName: "Naomi",   lastName: "Cohen",     specialty: "Neurology",     subSpecialty: "Epilepsy",               affiliation: "Northwestern Memorial Hospital",  city: "Chicago",     state: "IL", npiRegistrationYear: 2003 },

  // Endocrinology — 7
  { npi: "3230495876", firstName: "William", lastName: "Garrison",  specialty: "Endocrinology", subSpecialty: "Thyroid Disorders",      affiliation: "Mayo Clinic",                     city: "Rochester",   state: "MN", npiRegistrationYear: 2007 },
  { npi: "3348572940", firstName: "Isabella",lastName: "Romano",    specialty: "Endocrinology", subSpecialty: "Diabetes",               affiliation: "Cedars-Sinai Medical Center",     city: "Los Angeles", state: "CA", npiRegistrationYear: 2018 },
  { npi: "3419283746", firstName: "Samir",   lastName: "Patel",     specialty: "Endocrinology", subSpecialty: "Thyroid Disorders",      affiliation: "Houston Methodist",               city: "Houston",     state: "TX", npiRegistrationYear: 2001 },
  { npi: "3520394857", firstName: "Grace",   lastName: "Whitman",   specialty: "Endocrinology", subSpecialty: "Diabetes",               affiliation: "Johns Hopkins Medicine",          city: "Baltimore",   state: "PA", npiRegistrationYear: 2014 },
  { npi: "3618273645", firstName: "Eitan",   lastName: "Levi",      specialty: "Endocrinology", subSpecialty: "Thyroid Disorders",      affiliation: "NewYork-Presbyterian",            city: "New York",    state: "NY", npiRegistrationYear: 1996 },
  { npi: "3720495876", firstName: "Chloe",   lastName: "Anderson",  specialty: "Endocrinology", subSpecialty: "Diabetes",               affiliation: "Virginia Mason Medical Center",   city: "Seattle",     state: "WA", npiRegistrationYear: 2011 },
  { npi: "3820394756", firstName: "Mateo",   lastName: "Reyes",     specialty: "Endocrinology", subSpecialty: null,                     affiliation: "Jackson Memorial Hospital",       city: "Miami",       state: "FL", npiRegistrationYear: 2020 },

  // Rheumatology — 7
  { npi: "3920483756", firstName: "Margaret",lastName: "Fitzgerald",specialty: "Rheumatology",  subSpecialty: "Inflammatory Arthritis", affiliation: "Massachusetts General Hospital",  city: "Boston",      state: "MA", npiRegistrationYear: 2000 },
  { npi: "4019283746", firstName: "Vikram",  lastName: "Iyer",      specialty: "Rheumatology",  subSpecialty: "Inflammatory Arthritis", affiliation: "Cleveland Clinic",                city: "Cleveland",   state: "OH", npiRegistrationYear: 2013 },
  { npi: "4120394857", firstName: "Beatrice",lastName: "Hollis",    specialty: "Rheumatology",  subSpecialty: null,                     affiliation: "Stanford Health Care",            city: "Stanford",    state: "CA", npiRegistrationYear: 2006 },
  { npi: "4218374650", firstName: "Lukas",   lastName: "Schroeder", specialty: "Rheumatology",  subSpecialty: "Inflammatory Arthritis", affiliation: "Northwestern Memorial Hospital",  city: "Chicago",     state: "IL", npiRegistrationYear: 1998, boardCertified: false },
  { npi: "4320485967", firstName: "Amara",   lastName: "Okeke",     specialty: "Rheumatology",  subSpecialty: "Inflammatory Arthritis", affiliation: "Mount Sinai Health System",       city: "New York",    state: "NY", npiRegistrationYear: 2016 },
  { npi: "4419283745", firstName: "Joseph",  lastName: "Marchetti", specialty: "Rheumatology",  subSpecialty: "Inflammatory Arthritis", affiliation: "Houston Methodist",               city: "Houston",     state: "TX", npiRegistrationYear: 2009, acceptingPatients: false },
  { npi: "4520394857", firstName: "Eleanor", lastName: "Brooks",    specialty: "Rheumatology",  subSpecialty: null,                     affiliation: "Mayo Clinic",                     city: "Rochester",   state: "MN", npiRegistrationYear: 2002 },
];

// Reused for email domains — strip punctuation, collapse to dashed lowercase.
function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  // Idempotent reseed — wipe physicians and dependent records so re-running the script gives a clean state.
  await prisma.sentMessage.deleteMany();
  await prisma.pendingSend.deleteMany();
  await prisma.campaignEnrollment.deleteMany();
  await prisma.sequenceStep.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.physician.deleteMany();

  for (const p of physicians) {
    const email = `${slugify(p.firstName)}.${slugify(p.lastName)}@${slugify(p.affiliation)}.org`;
    await prisma.physician.create({
      data: {
        npi: p.npi,
        firstName: p.firstName,
        lastName: p.lastName,
        specialty: p.specialty,
        subSpecialty: p.subSpecialty,
        affiliation: p.affiliation,
        city: p.city,
        state: p.state,
        email,
        npiRegistrationYear: p.npiRegistrationYear,
        acceptingPatients: p.acceptingPatients ?? true,
        boardCertified: p.boardCertified ?? true,
      },
    });
  }

  console.log(`Seeded ${physicians.length} physicians.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
