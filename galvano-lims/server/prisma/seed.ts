import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEFAULT_PROCESS_TYPES = [
  { code: 'ZINC', name: 'Cynkowanie', sortOrder: 1 },
  { code: 'NICKEL', name: 'Niklowanie', sortOrder: 2 },
  { code: 'CHROME', name: 'Chromowanie', sortOrder: 3 },
  { code: 'COPPER', name: 'Miedziowanie', sortOrder: 4 },
  { code: 'TIN', name: 'Cynowanie', sortOrder: 5 },
  { code: 'GOLD', name: 'Złocenie', sortOrder: 6 },
  { code: 'SILVER', name: 'Srebrzenie', sortOrder: 7 },
  { code: 'ANODIZING', name: 'Anodowanie', sortOrder: 8 },
  { code: 'PASSIVATION', name: 'Pasywacja', sortOrder: 9 },
  { code: 'OTHER', name: 'Inne', sortOrder: 10 },
];

async function main() {
  console.log('🌱 Rozpoczynanie seedowania bazy danych...\n');

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.analysisResult.deleteMany();
  await prisma.analysisAttachment.deleteMany();
  await prisma.analysis.deleteMany();
  await prisma.sample.deleteMany();
  await prisma.processParameter.deleteMany();
  await prisma.process.deleteMany();
  await prisma.processTypeDefinition.deleteMany();
  await prisma.client.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.importTemplate.deleteMany();
  await prisma.companySettings.deleteMany();
  await prisma.user.deleteMany();

  console.log('🗑️  Wyczyszczono istniejące dane.\n');

  // ============================================================
  // 1. ADMIN USER
  // ============================================================
  const passwordHash = await bcrypt.hash('Admin123!', 12);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@galvano-lims.pl',
      passwordHash,
      firstName: 'Jan',
      lastName: 'Kowalski',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  console.log('👥 Utworzono użytkownika:');
  console.log(`   Admin: admin@galvano-lims.pl / Admin123!\n`);

  // ============================================================
  // 2. COMPANY SETTINGS
  // ============================================================
  await prisma.companySettings.create({
    data: {
      companyName: 'GalvanoTech Laboratorium Sp. z o.o.',
      address: 'ul. Chemiczna 15',
      city: 'Wrocław',
      postalCode: '50-100',
      nip: '8991234567',
      phone: '+48 71 123 45 67',
      email: 'laboratorium@galvanotech.pl',
      website: 'https://galvanotech.pl',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpFrom: 'laboratorium@galvanotech.pl',
      reportHeaderText: 'Raport z analizy laboratoryjnej kąpieli galwanicznej',
      reportFooterText: 'Dokument wygenerowany automatycznie przez system GalvanoTech LIMS. Wyniki dotyczą wyłącznie dostarczonej próbki.',
    },
  });

  console.log('🏢 Utworzono ustawienia firmy.\n');

  // ============================================================
  // 3. PROCESS TYPES
  // ============================================================
  await prisma.processTypeDefinition.createMany({
    data: DEFAULT_PROCESS_TYPES.map((type) => ({
      code: type.code,
      name: type.name,
      isActive: true,
      sortOrder: type.sortOrder,
    })),
    skipDuplicates: true,
  });

  console.log(`🏷️  Utworzono ${DEFAULT_PROCESS_TYPES.length} typów procesów.\n`);

  // ============================================================
  // 4. PROCESSES WITH PARAMETERS
  // ============================================================
  const processesData = [
    {
      name: 'Cynkowanie kwaśne',
      description: 'Kąpiel cynkowa na bazie chlorku potasu. Stosowana do pokrywania detali stalowych warstwą cynku w środowisku kwaśnym.',
      processType: 'ZINC',
      parameters: [
        { parameterName: 'Cynk (Zn)', unit: 'g/l', minValue: 25, maxValue: 40, optimalValue: 32, sortOrder: 1 },
        { parameterName: 'Chlorek potasu (KCl)', unit: 'g/l', minValue: 180, maxValue: 240, optimalValue: 210, sortOrder: 2 },
        { parameterName: 'Kwas borowy (H₃BO₃)', unit: 'g/l', minValue: 20, maxValue: 30, optimalValue: 25, sortOrder: 3 },
        { parameterName: 'pH', unit: 'pH', minValue: 4.8, maxValue: 5.6, optimalValue: 5.2, sortOrder: 4 },
        { parameterName: 'Temperatura', unit: '°C', minValue: 20, maxValue: 35, optimalValue: 25, sortOrder: 5 },
        { parameterName: 'Gęstość prądu', unit: 'A/dm²', minValue: 0.5, maxValue: 4.0, optimalValue: 2.0, sortOrder: 6 },
        { parameterName: 'Rozjaśniacz', unit: 'ml/l', minValue: 1.0, maxValue: 4.0, optimalValue: 2.5, sortOrder: 7 },
      ],
    },
    {
      name: 'Cynkowanie alkaliczne',
      description: 'Kąpiel cynkowa na bazie wodorotlenku sodu. Nie zawiera cyjanku. Dobra rozrzutność.',
      processType: 'ZINC',
      parameters: [
        { parameterName: 'Cynk (Zn)', unit: 'g/l', minValue: 8, maxValue: 14, optimalValue: 11, sortOrder: 1 },
        { parameterName: 'Wodorotlenek sodu (NaOH)', unit: 'g/l', minValue: 120, maxValue: 160, optimalValue: 140, sortOrder: 2 },
        { parameterName: 'Temperatura', unit: '°C', minValue: 20, maxValue: 30, optimalValue: 25, sortOrder: 3 },
        { parameterName: 'Gęstość prądu', unit: 'A/dm²', minValue: 1.0, maxValue: 5.0, optimalValue: 3.0, sortOrder: 4 },
        { parameterName: 'Węglany (Na₂CO₃)', unit: 'g/l', minValue: 0, maxValue: 50, optimalValue: 20, sortOrder: 5 },
        { parameterName: 'Dodatek rozjaśniający', unit: 'ml/l', minValue: 0.5, maxValue: 3.0, optimalValue: 1.5, sortOrder: 6 },
      ],
    },
    {
      name: 'Niklowanie Wattsa',
      description: 'Klasyczna kąpiel niklowa Wattsa. Najczęściej stosowana do niklowania dekoracyjnego i technicznego.',
      processType: 'NICKEL',
      parameters: [
        { parameterName: 'Siarczan niklu (NiSO₄·6H₂O)', unit: 'g/l', minValue: 240, maxValue: 300, optimalValue: 270, sortOrder: 1 },
        { parameterName: 'Chlorek niklu (NiCl₂·6H₂O)', unit: 'g/l', minValue: 40, maxValue: 60, optimalValue: 50, sortOrder: 2 },
        { parameterName: 'Kwas borowy (H₃BO₃)', unit: 'g/l', minValue: 30, maxValue: 45, optimalValue: 38, sortOrder: 3 },
        { parameterName: 'pH', unit: 'pH', minValue: 3.8, maxValue: 4.5, optimalValue: 4.2, sortOrder: 4 },
        { parameterName: 'Temperatura', unit: '°C', minValue: 45, maxValue: 60, optimalValue: 55, sortOrder: 5 },
        { parameterName: 'Gęstość prądu', unit: 'A/dm²', minValue: 2.0, maxValue: 8.0, optimalValue: 5.0, sortOrder: 6 },
        { parameterName: 'Nikiel metaliczny (Ni)', unit: 'g/l', minValue: 60, maxValue: 80, optimalValue: 70, sortOrder: 7 },
      ],
    },
    {
      name: 'Chromowanie dekoracyjne',
      description: 'Kąpiel do chromowania dekoracyjnego na bazie kwasu chromowego. Cienka warstwa chromu o charakterystycznym połysku.',
      processType: 'CHROME',
      parameters: [
        { parameterName: 'Kwas chromowy (CrO₃)', unit: 'g/l', minValue: 200, maxValue: 300, optimalValue: 250, sortOrder: 1 },
        { parameterName: 'Kwas siarkowy (H₂SO₄)', unit: 'g/l', minValue: 2.0, maxValue: 3.0, optimalValue: 2.5, sortOrder: 2 },
        { parameterName: 'Stosunek CrO₃/H₂SO₄', unit: '-', minValue: 80, maxValue: 120, optimalValue: 100, sortOrder: 3 },
        { parameterName: 'Temperatura', unit: '°C', minValue: 40, maxValue: 50, optimalValue: 45, sortOrder: 4 },
        { parameterName: 'Gęstość prądu', unit: 'A/dm²', minValue: 10, maxValue: 40, optimalValue: 25, sortOrder: 5 },
        { parameterName: 'Żelazo (Fe)', unit: 'g/l', minValue: 0, maxValue: 8, optimalValue: 2, sortOrder: 6 },
        { parameterName: 'Chrom trójwartościowy (Cr³⁺)', unit: 'g/l', minValue: 2, maxValue: 8, optimalValue: 4, sortOrder: 7 },
      ],
    },
    {
      name: 'Miedziowanie kwaśne',
      description: 'Kąpiel miedziowa na bazie siarczanu miedzi. Stosowana do nakładania grubych warstw miedzi.',
      processType: 'COPPER',
      parameters: [
        { parameterName: 'Siarczan miedzi (CuSO₄·5H₂O)', unit: 'g/l', minValue: 180, maxValue: 240, optimalValue: 210, sortOrder: 1 },
        { parameterName: 'Miedź (Cu²⁺)', unit: 'g/l', minValue: 45, maxValue: 65, optimalValue: 55, sortOrder: 2 },
        { parameterName: 'Kwas siarkowy (H₂SO₄)', unit: 'g/l', minValue: 50, maxValue: 70, optimalValue: 60, sortOrder: 3 },
        { parameterName: 'Chlorki (Cl⁻)', unit: 'mg/l', minValue: 40, maxValue: 80, optimalValue: 60, sortOrder: 4 },
        { parameterName: 'Temperatura', unit: '°C', minValue: 20, maxValue: 30, optimalValue: 25, sortOrder: 5 },
        { parameterName: 'Gęstość prądu', unit: 'A/dm²', minValue: 2.0, maxValue: 6.0, optimalValue: 4.0, sortOrder: 6 },
      ],
    },
    {
      name: 'Cynowanie kwaśne',
      description: 'Kąpiel cynowa na bazie kwasu siarkowego. Stosowana w przemyśle elektronicznym.',
      processType: 'TIN',
      parameters: [
        { parameterName: 'Cyna (Sn²⁺)', unit: 'g/l', minValue: 15, maxValue: 30, optimalValue: 22, sortOrder: 1 },
        { parameterName: 'Kwas siarkowy (H₂SO₄)', unit: 'g/l', minValue: 100, maxValue: 160, optimalValue: 130, sortOrder: 2 },
        { parameterName: 'Temperatura', unit: '°C', minValue: 15, maxValue: 30, optimalValue: 22, sortOrder: 3 },
        { parameterName: 'Gęstość prądu', unit: 'A/dm²', minValue: 1.0, maxValue: 3.0, optimalValue: 2.0, sortOrder: 4 },
        { parameterName: 'Dodatek antyutleniacz', unit: 'ml/l', minValue: 10, maxValue: 30, optimalValue: 20, sortOrder: 5 },
      ],
    },
    {
      name: 'Pasywacja trójwartościowa',
      description: 'Pasywacja chromem trójwartościowym (Cr³⁺). Ekologiczna alternatywa dla pasywacji sześciowartościowej.',
      processType: 'PASSIVATION',
      parameters: [
        { parameterName: 'Chrom trójwartościowy (Cr³⁺)', unit: 'g/l', minValue: 3, maxValue: 8, optimalValue: 5, sortOrder: 1 },
        { parameterName: 'pH', unit: 'pH', minValue: 1.8, maxValue: 2.5, optimalValue: 2.0, sortOrder: 2 },
        { parameterName: 'Temperatura', unit: '°C', minValue: 20, maxValue: 40, optimalValue: 30, sortOrder: 3 },
        { parameterName: 'Czas zanurzenia', unit: 's', minValue: 30, maxValue: 90, optimalValue: 60, sortOrder: 4 },
        { parameterName: 'Fluorki', unit: 'g/l', minValue: 0.5, maxValue: 2.0, optimalValue: 1.0, sortOrder: 5 },
      ],
    },
  ];

  const processes: any[] = [];
  for (const procData of processesData) {
    const process = await prisma.process.create({
      data: {
        name: procData.name,
        description: procData.description,
        processType: procData.processType,
        parameters: {
          create: procData.parameters.map((p) => ({
            parameterName: p.parameterName,
            unit: p.unit,
            minValue: p.minValue,
            maxValue: p.maxValue,
            optimalValue: p.optimalValue,
            sortOrder: p.sortOrder,
          })),
        },
      },
      include: { parameters: true },
    });
    processes.push(process);
  }

  console.log(`⚗️  Utworzono ${processes.length} procesów galwanicznych z parametrami.\n`);

  // ============================================================
  // 5. IMPORT TEMPLATES
  // ============================================================
  await prisma.importTemplate.createMany({
    data: [
      {
        name: 'Arkusz Excel – prosty',
        description: 'Standardowy format Excel z jedną zakładką. Kolumny: Klient, Data, Proces, oraz parametry analizy w osobnych kolumnach.',
        mappingConfig: {
          type: 'simple_excel',
          columns: {
            'Klient': 'client.companyName',
            'NIP': 'client.nip',
            'Data analizy': 'analysis.analysisDate',
            'Proces': 'process.name',
            'Typ próbki': 'sample.sampleType',
            'Opis': 'sample.description',
          },
          parameterColumns: 'auto_detect',
          dateFormat: 'DD.MM.YYYY',
          decimalSeparator: ',',
        },
        sourceSystem: 'Excel',
        createdBy: admin.id,
        isPublic: true,
      },
      {
        name: 'Arkusz Excel – wielozakładkowy',
        description: 'Format z osobnymi arkuszami: "Klienci", "Próbki", "Wyniki". Każdy arkusz mapowany oddzielnie.',
        mappingConfig: {
          type: 'multi_sheet_excel',
          sheets: {
            'Klienci': {
              target: 'clients',
              columns: { 'Nazwa firmy': 'companyName', 'NIP': 'nip', 'Adres': 'address', 'Miasto': 'city', 'Telefon': 'phone', 'Email': 'email' },
            },
            'Próbki': {
              target: 'samples',
              columns: { 'Kod próbki': 'legacyCode', 'Klient': 'client.companyName', 'Data pobrania': 'collectedAt', 'Proces': 'process.name', 'Typ': 'sampleType' },
            },
            'Wyniki': {
              target: 'results',
              columns: { 'Kod próbki': 'sample.legacyCode', 'Data analizy': 'analysisDate', 'Parametr': 'parameterName', 'Wartość': 'value', 'Jednostka': 'unit' },
            },
          },
          dateFormat: 'DD.MM.YYYY',
          decimalSeparator: ',',
        },
        sourceSystem: 'Excel',
        createdBy: admin.id,
        isPublic: true,
      },
      {
        name: 'Eksport CSV z GalvanoSoft',
        description: 'Format CSV generowany przez oprogramowanie GalvanoSoft. Separator średnik, kodowanie Windows-1250.',
        mappingConfig: {
          type: 'csv',
          separator: ';',
          encoding: 'windows-1250',
          columns: {
            'FIRMA': 'client.companyName',
            'NIP_KLIENTA': 'client.nip',
            'DATA': 'analysis.analysisDate',
            'KOD_PROBKI': 'sample.legacyCode',
            'PROCES': 'process.name',
            'TYP_PROCESU': 'process.processType',
            'PARAMETR': 'result.parameterName',
            'WARTOSC': 'result.value',
            'JEDNOSTKA': 'result.unit',
            'MIN': 'result.minReference',
            'MAX': 'result.maxReference',
            'OPTYMALNIE': 'result.optimalReference',
          },
          dateFormat: 'YYYY-MM-DD',
          decimalSeparator: '.',
        },
        sourceSystem: 'GalvanoSoft',
        createdBy: admin.id,
        isPublic: true,
      },
    ],
  });

  console.log('📋 Utworzono szablony importu.\n');

  console.log('✅ Seedowanie zakończone pomyślnie!');
  console.log('====================================');
  console.log('Dane logowania:');
  console.log('  Admin: admin@galvano-lims.pl / Admin123!');
}

main()
  .catch((e) => {
    console.error('❌ Błąd seedowania:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
