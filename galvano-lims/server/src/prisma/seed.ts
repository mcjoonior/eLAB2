import { PrismaClient, UserRole, ProcessType, SampleType, SampleStatus, AnalysisStatus, Deviation, RecommendationType, Priority } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

function generateSampleCode(index: number, yearMonth = '202501'): string {
  return `PRB-${yearMonth}-${String(index).padStart(4, '0')}`;
}

function generateAnalysisCode(index: number, yearMonth = '202501'): string {
  return `ANL-${yearMonth}-${String(index).padStart(4, '0')}`;
}

function generateReportCode(index: number, yearMonth = '202501'): string {
  return `RPT-${yearMonth}-${String(index).padStart(4, '0')}`;
}

function calculateDeviation(value: number, min?: number | null, max?: number | null, optimal?: number | null): { deviation: Deviation; deviationPercent: number } {
  if (min != null && value < min) {
    const range = (max ?? min) - min;
    const diff = min - value;
    const percent = range > 0 ? (diff / range) * 100 : 0;
    if (percent > 20) return { deviation: 'CRITICAL_LOW', deviationPercent: -percent };
    return { deviation: 'BELOW_MIN', deviationPercent: -percent };
  }
  if (max != null && value > max) {
    const range = max - (min ?? max);
    const diff = value - max;
    const percent = range > 0 ? (diff / range) * 100 : 0;
    if (percent > 20) return { deviation: 'CRITICAL_HIGH', deviationPercent: percent };
    return { deviation: 'ABOVE_MAX', deviationPercent: percent };
  }
  if (optimal != null) {
    const diff = value - optimal;
    const percent = optimal !== 0 ? (diff / optimal) * 100 : 0;
    return { deviation: 'WITHIN_RANGE', deviationPercent: percent };
  }
  return { deviation: 'WITHIN_RANGE', deviationPercent: 0 };
}

async function main() {
  console.log('🌱 Rozpoczynanie seedowania bazy danych...\n');

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.analysisResult.deleteMany();
  await prisma.analysis.deleteMany();
  await prisma.sample.deleteMany();
  await prisma.processParameter.deleteMany();
  await prisma.process.deleteMany();
  await prisma.client.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.importTemplate.deleteMany();
  await prisma.companySettings.deleteMany();
  await prisma.user.deleteMany();

  console.log('🗑️  Wyczyszczono istniejące dane.\n');

  // ============================================================
  // 1. USERS
  // ============================================================
  const passwordHash = await bcrypt.hash('Admin123!', 12);
  const laborantHash = await bcrypt.hash('Laborant1!', 12);

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

  const laborant1 = await prisma.user.create({
    data: {
      email: 'anna.nowak@galvano-lims.pl',
      passwordHash: laborantHash,
      firstName: 'Anna',
      lastName: 'Nowak',
      role: UserRole.LABORANT,
      isActive: true,
    },
  });

  const laborant2 = await prisma.user.create({
    data: {
      email: 'piotr.wisniewski@galvano-lims.pl',
      passwordHash: laborantHash,
      firstName: 'Piotr',
      lastName: 'Wiśniewski',
      role: UserRole.LABORANT,
      isActive: true,
    },
  });

  const viewer = await prisma.user.create({
    data: {
      email: 'viewer@galvano-lims.pl',
      passwordHash: await bcrypt.hash('Viewer123!', 12),
      firstName: 'Maria',
      lastName: 'Zielińska',
      role: UserRole.VIEWER,
      isActive: true,
    },
  });

  console.log('👥 Utworzono użytkowników:');
  console.log(`   Admin: admin@galvano-lims.pl / Admin123!`);
  console.log(`   Laborant: anna.nowak@galvano-lims.pl / Laborant1!`);
  console.log(`   Laborant: piotr.wisniewski@galvano-lims.pl / Laborant1!`);
  console.log(`   Viewer: viewer@galvano-lims.pl / Viewer123!\n`);

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
  // 3. CLIENTS
  // ============================================================
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        companyName: 'MetalPol Sp. z o.o.',
        nip: '6781234567',
        address: 'ul. Stalowa 22',
        city: 'Kraków',
        postalCode: '30-100',
        contactPerson: 'Tomasz Metalski',
        email: 'tomasz@metalpol.pl',
        phone: '+48 12 345 67 89',
        notes: 'Klient od 2019 roku. Głównie cynkowanie i niklowanie.',
      },
    }),
    prisma.client.create({
      data: {
        companyName: 'AutoParts Galwanizacja S.A.',
        nip: '5211234567',
        address: 'ul. Motoryzacyjna 8',
        city: 'Warszawa',
        postalCode: '02-200',
        contactPerson: 'Marek Autowski',
        email: 'marek@autoparts.pl',
        phone: '+48 22 987 65 43',
        notes: 'Duży klient – części samochodowe. Chromowanie i miedziowanie.',
      },
    }),
    prisma.client.create({
      data: {
        companyName: 'ElektroGalw Sp.j.',
        nip: '7891234567',
        address: 'ul. Elektroniczna 3',
        city: 'Poznań',
        postalCode: '60-300',
        contactPerson: 'Katarzyna Łutowska',
        email: 'k.lutowska@elektrogalw.pl',
        phone: '+48 61 222 33 44',
        notes: 'Specjalizacja w cynowaniu i złoceniu PCB.',
      },
    }),
    prisma.client.create({
      data: {
        companyName: 'PrecyzjaMet Zakład Galwaniczny',
        nip: '9511234567',
        address: 'ul. Precyzyjna 11',
        city: 'Gdańsk',
        postalCode: '80-400',
        contactPerson: 'Robert Gdański',
        email: 'robert@precyzjamet.pl',
        phone: '+48 58 111 22 33',
      },
    }),
    prisma.client.create({
      data: {
        companyName: 'Cynkownia Śląska Sp. z o.o.',
        nip: '6341234567',
        address: 'ul. Hutnicza 45',
        city: 'Katowice',
        postalCode: '40-500',
        contactPerson: 'Andrzej Śląski',
        email: 'biuro@cynkownia-slaska.pl',
        phone: '+48 32 444 55 66',
        notes: 'Wyłącznie cynkowanie kwaśne i alkaliczne.',
      },
    }),
  ]);

  console.log(`🏭 Utworzono ${clients.length} klientów.\n`);

  // ============================================================
  // 4. PROCESSES WITH PARAMETERS
  // ============================================================
  const processesData = [
    {
      name: 'Cynkowanie kwaśne',
      description: 'Kąpiel cynkowa na bazie chlorku potasu. Stosowana do pokrywania detali stalowych warstwą cynku w środowisku kwaśnym.',
      processType: ProcessType.ZINC,
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
      processType: ProcessType.ZINC,
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
      processType: ProcessType.NICKEL,
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
      processType: ProcessType.CHROME,
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
      processType: ProcessType.COPPER,
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
      processType: ProcessType.TIN,
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
      processType: ProcessType.PASSIVATION,
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
  // 5. SAMPLES
  // ============================================================
  const samplesData = [
    { clientIdx: 0, processIdx: 0, sampleType: SampleType.BATH, description: 'Próbka kąpieli cynkowej kwaśnej - wanna nr 1', collectedBy: laborant1.id, status: SampleStatus.COMPLETED },
    { clientIdx: 0, processIdx: 2, sampleType: SampleType.BATH, description: 'Próbka kąpieli niklowej Wattsa - wanna nr 3', collectedBy: laborant1.id, status: SampleStatus.COMPLETED },
    { clientIdx: 1, processIdx: 3, sampleType: SampleType.BATH, description: 'Kąpiel chromowa dekoracyjna - linia A', collectedBy: laborant2.id, status: SampleStatus.COMPLETED },
    { clientIdx: 1, processIdx: 4, sampleType: SampleType.BATH, description: 'Kąpiel miedziowa kwaśna - linia B', collectedBy: laborant2.id, status: SampleStatus.IN_PROGRESS },
    { clientIdx: 2, processIdx: 5, sampleType: SampleType.BATH, description: 'Kąpiel cynowa kwaśna - PCB', collectedBy: laborant1.id, status: SampleStatus.COMPLETED },
    { clientIdx: 3, processIdx: 0, sampleType: SampleType.BATH, description: 'Cynkowanie kwaśne - wanna główna', collectedBy: laborant1.id, status: SampleStatus.COMPLETED },
    { clientIdx: 4, processIdx: 0, sampleType: SampleType.BATH, description: 'Cynkowanie kwaśne - linia 1', collectedBy: laborant2.id, status: SampleStatus.IN_PROGRESS },
    { clientIdx: 4, processIdx: 1, sampleType: SampleType.BATH, description: 'Cynkowanie alkaliczne - linia 2', collectedBy: laborant2.id, status: SampleStatus.REGISTERED },
    { clientIdx: 0, processIdx: 6, sampleType: SampleType.BATH, description: 'Pasywacja po cynkowaniu - wanna 5', collectedBy: laborant1.id, status: SampleStatus.COMPLETED },
    { clientIdx: 2, processIdx: 2, sampleType: SampleType.BATH, description: 'Niklowanie podkładowe PCB', collectedBy: laborant1.id, status: SampleStatus.COMPLETED },
  ];

  const samples: any[] = [];
  for (let i = 0; i < samplesData.length; i++) {
    const sd = samplesData[i];
    const daysAgo = (samplesData.length - i) * 3;
    const collectedAt = new Date();
    collectedAt.setDate(collectedAt.getDate() - daysAgo);

    const sample = await prisma.sample.create({
      data: {
        sampleCode: generateSampleCode(i + 1),
        clientId: clients[sd.clientIdx].id,
        processId: processes[sd.processIdx].id,
        collectedBy: sd.collectedBy,
        collectedAt,
        sampleType: sd.sampleType,
        description: sd.description,
        status: sd.status,
      },
    });
    samples.push(sample);
  }

  console.log(`🧪 Utworzono ${samples.length} próbek.\n`);

  // ============================================================
  // 6. ANALYSES WITH RESULTS AND RECOMMENDATIONS
  // ============================================================
  const completedSamples = samples.filter((_, i) => samplesData[i].status === SampleStatus.COMPLETED);

  let analysisIdx = 0;
  for (const sample of completedSamples) {
    analysisIdx++;
    const processWithParams = processes.find((p: any) => p.id === sample.processId);
    if (!processWithParams) continue;

    const daysAgo = Math.max(1, 30 - analysisIdx * 3);
    const analysisDate = new Date();
    analysisDate.setDate(analysisDate.getDate() - daysAgo);

    const performer = analysisIdx % 2 === 0 ? laborant1 : laborant2;
    const isApproved = analysisIdx <= 4;

    const analysis = await prisma.analysis.create({
      data: {
        analysisCode: generateAnalysisCode(analysisIdx),
        sampleId: sample.id,
        performedBy: performer.id,
        analysisDate,
        status: isApproved ? AnalysisStatus.APPROVED : AnalysisStatus.COMPLETED,
        approvedBy: isApproved ? admin.id : null,
        approvedAt: isApproved ? new Date(analysisDate.getTime() + 86400000) : null,
        notes: `Analiza rutynowa kąpieli galwanicznej.`,
      },
    });

    // Generate realistic results with some deviations
    const results: any[] = [];
    for (const param of processWithParams.parameters) {
      const min = param.minValue ? Number(param.minValue) : null;
      const max = param.maxValue ? Number(param.maxValue) : null;
      const optimal = param.optimalValue ? Number(param.optimalValue) : null;

      // Generate a value - mostly within range but some with deviations
      let value: number;
      const random = Math.random();
      if (random < 0.6 && optimal != null) {
        // 60%: near optimal
        const range = (max ?? optimal) - (min ?? optimal);
        value = optimal + (Math.random() - 0.5) * range * 0.3;
      } else if (random < 0.8 && min != null && max != null) {
        // 20%: slightly out of range
        const range = max - min;
        if (Math.random() < 0.5) {
          value = min - range * 0.1 * Math.random();
        } else {
          value = max + range * 0.1 * Math.random();
        }
      } else if (min != null && max != null) {
        // 20%: significantly out of range (for some drama)
        const range = max - min;
        if (Math.random() < 0.5) {
          value = min - range * 0.3 * Math.random();
        } else {
          value = max + range * 0.3 * Math.random();
        }
      } else {
        value = optimal ?? 0;
      }

      value = Math.round(value * 100) / 100;
      if (value < 0) value = 0;

      const { deviation, deviationPercent } = calculateDeviation(value, min, max, optimal);

      results.push({
        analysisId: analysis.id,
        parameterName: param.parameterName,
        unit: param.unit,
        value,
        minReference: min,
        maxReference: max,
        optimalReference: optimal,
        deviation,
        deviationPercent: Math.round(deviationPercent * 100) / 100,
      });
    }

    await prisma.analysisResult.createMany({ data: results });

    // Add recommendations for out-of-range results
    const outOfRange = results.filter(
      (r) => r.deviation !== 'WITHIN_RANGE'
    );

    for (const result of outOfRange) {
      let recType: RecommendationType;
      let priority: Priority;
      let description: string;

      if (result.deviation === 'BELOW_MIN' || result.deviation === 'CRITICAL_LOW') {
        recType = RecommendationType.INCREASE;
        priority = result.deviation === 'CRITICAL_LOW' ? Priority.CRITICAL : Priority.HIGH;
        const diff = (result.minReference ?? result.optimalReference ?? 0) - Number(result.value);
        description = `Zwiększyć stężenie ${result.parameterName} o ok. ${Math.round(diff * 10) / 10} ${result.unit}. Aktualna wartość ${result.value} ${result.unit} jest ${result.deviation === 'CRITICAL_LOW' ? 'krytycznie' : ''} poniżej minimum (${result.minReference} ${result.unit}).`;
      } else {
        recType = RecommendationType.DECREASE;
        priority = result.deviation === 'CRITICAL_HIGH' ? Priority.CRITICAL : Priority.MEDIUM;
        const diff = Number(result.value) - (result.maxReference ?? result.optimalReference ?? 0);
        description = `Zmniejszyć stężenie ${result.parameterName} o ok. ${Math.round(diff * 10) / 10} ${result.unit}. Aktualna wartość ${result.value} ${result.unit} jest ${result.deviation === 'CRITICAL_HIGH' ? 'krytycznie' : ''} powyżej maximum (${result.maxReference} ${result.unit}).`;
      }

      await prisma.recommendation.create({
        data: {
          analysisId: analysis.id,
          parameterName: result.parameterName,
          currentValue: result.value,
          targetValue: result.optimalReference,
          recommendationType: recType,
          description,
          priority,
          createdBy: performer.id,
        },
      });
    }

    // Create report for approved analyses
    if (isApproved) {
      await prisma.report.create({
        data: {
          reportCode: generateReportCode(analysisIdx),
          analysisId: analysis.id,
          generatedBy: admin.id,
          generatedAt: new Date(analysisDate.getTime() + 172800000), // 2 days after analysis
        },
      });
    }
  }

  console.log(`📊 Utworzono ${analysisIdx} analiz z wynikami i rekomendacjami.\n`);

  // ============================================================
  // 7. IMPORT TEMPLATES
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

  // ============================================================
  // 8. SAMPLE AUDIT LOGS
  // ============================================================
  await prisma.auditLog.createMany({
    data: [
      { userId: admin.id, action: 'LOGIN', entityType: 'USER', entityId: admin.id, details: { method: 'password' } },
      { userId: admin.id, action: 'CREATE', entityType: 'CLIENT', entityId: clients[0].id, details: { companyName: clients[0].companyName } },
      { userId: laborant1.id, action: 'CREATE', entityType: 'SAMPLE', entityId: samples[0].id, details: { sampleCode: samples[0].sampleCode } },
      { userId: laborant1.id, action: 'CREATE', entityType: 'ANALYSIS', details: { note: 'Seed data' } },
      { userId: admin.id, action: 'APPROVE', entityType: 'ANALYSIS', details: { note: 'Zatwierdzona analiza' } },
    ],
  });

  console.log('📝 Utworzono przykładowe logi audytu.\n');

  // ============================================================
  // 9. NOTIFICATIONS
  // ============================================================
  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        title: 'Krytyczne odchylenie parametru',
        message: 'Parametr pH w analizie ANL-202501-0001 jest krytycznie poniżej normy.',
        type: 'error',
        link: '/analyses',
      },
      {
        userId: laborant1.id,
        title: 'Nowa próbka zarejestrowana',
        message: `Próbka ${samples[samples.length - 1].sampleCode} została zarejestrowana i czeka na analizę.`,
        type: 'info',
        link: '/samples',
      },
      {
        userId: laborant2.id,
        title: 'Analiza zatwierdzona',
        message: 'Analiza ANL-202501-0002 została zatwierdzona przez administratora.',
        type: 'success',
        link: '/analyses',
      },
    ],
  });

  console.log('🔔 Utworzono przykładowe powiadomienia.\n');

  console.log('✅ Seedowanie zakończone pomyślnie!');
  console.log('====================================');
  console.log('Dane logowania:');
  console.log('  Admin:    admin@galvano-lims.pl / Admin123!');
  console.log('  Laborant: anna.nowak@galvano-lims.pl / Laborant1!');
  console.log('  Laborant: piotr.wisniewski@galvano-lims.pl / Laborant1!');
  console.log('  Viewer:   viewer@galvano-lims.pl / Viewer123!');
}

main()
  .catch((e) => {
    console.error('❌ Błąd seedowania:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
