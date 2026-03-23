#!/usr/bin/env node
/**
 * Stress Test for Typing Speed Tool
 * Simulates 100-200+ concurrent users completing full test flows.
 *
 * Usage:
 *   node stress-test.js                  # 200 users (default)
 *   node stress-test.js --users=100      # 100 users
 *   node stress-test.js --users=500      # 500 users
 *   node stress-test.js --host=http://192.168.1.10  # custom host
 */

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace('--', '').split('=');
  acc[k] = v;
  return acc;
}, {});

const TOTAL_USERS = parseInt(args.users || '200');
const BASE_URL = args.host || 'http://localhost';
const API = `${BASE_URL}/api/typing`;
const CONCURRENCY_BATCH = 50; // Launch in batches to avoid fd exhaustion

// Stats tracking
const stats = {
  started: 0,
  completed: 0,
  failed: 0,
  errors: [],
  responseTimes: [],
  trialSaveTimes: [],
};

async function apiCall(path, options = {}) {
  const start = Date.now();
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const elapsed = Date.now() - start;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${path}: ${body.slice(0, 200)}`);
  }
  const data = res.headers.get('content-type')?.includes('json')
    ? await res.json()
    : await res.text();
  return { data, elapsed };
}

function randomName() {
  const first = ['Ahmed', 'Sara', 'Mohamed', 'Fatma', 'Ali', 'Nour', 'Omar', 'Hana', 'Youssef', 'Mona'];
  const last = ['Hassan', 'Ibrahim', 'Mahmoud', 'Khalil', 'Saleh', 'Nabil', 'Farid', 'Adel', 'Sami', 'Karim'];
  return `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * last.length)]}`;
}

function randomPhone() {
  return '01' + Math.floor(Math.random() * 10) + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
}

function randomNatId() {
  return String(Math.floor(Math.random() * 10000000000000)).padStart(14, '0');
}

/**
 * Simulate one complete user flow:
 * 1. Register candidate
 * 2. Create session
 * 3. Fetch passages
 * 4. Save 6 trials (3 EN + 3 AR)
 * 5. Complete session
 */
async function simulateUser(userId) {
  stats.started++;
  const timings = [];

  try {
    // 1. Register
    const { data: candidate, elapsed: t1 } = await apiCall('/candidates', {
      method: 'POST',
      body: JSON.stringify({
        fullName: randomName(),
        phoneNumber: randomPhone(),
        nationalId: randomNatId(),
      }),
    });
    timings.push(t1);

    // 2. Create session
    const { data: session, elapsed: t2 } = await apiCall('/sessions', {
      method: 'POST',
      body: JSON.stringify({ candidateId: candidate.id }),
    });
    timings.push(t2);

    // 3. Fetch passages
    const { data: enPassages, elapsed: t3 } = await apiCall('/passages/random?lang=en&count=3');
    timings.push(t3);
    const { data: arPassages, elapsed: t4 } = await apiCall('/passages/random?lang=ar&count=3');
    timings.push(t4);

    // 4. Save 6 trials (simulate typing results)
    const languages = [
      ...enPassages.map((p, i) => ({ lang: 'en', trialNum: i + 1, passage: p })),
      ...arPassages.map((p, i) => ({ lang: 'ar', trialNum: i + 1, passage: p })),
    ];

    for (const trial of languages) {
      const words = trial.passage.content.split(/\s+/);
      const wordsTyped = Math.max(5, Math.floor(words.length * (0.4 + Math.random() * 0.5)));
      const correctWords = Math.floor(wordsTyped * (0.7 + Math.random() * 0.3));

      const { elapsed: tTrial } = await apiCall(`/sessions/${session.id}/trials`, {
        method: 'POST',
        body: JSON.stringify({
          trialNumber: trial.trialNum,
          language: trial.lang,
          passageId: trial.passage.id,
          testDuration: 60,
          grossWpm: Math.floor(20 + Math.random() * 40),
          netWpm: Math.floor(15 + Math.random() * 35),
          accuracy: Math.floor(60 + Math.random() * 40),
          correctWords: correctWords,
          totalWordsAttempted: wordsTyped,
          errorCount: wordsTyped - correctWords,
          tabSwitches: Math.floor(Math.random() * 2),
          wasVoided: false,
        }),
      });
      stats.trialSaveTimes.push(tTrial);
      timings.push(tTrial);
    }

    // 5. Complete session
    const { elapsed: t5 } = await apiCall(`/sessions/${session.id}/complete`, {
      method: 'PATCH',
    });
    timings.push(t5);

    stats.completed++;
    stats.responseTimes.push(...timings);
  } catch (e) {
    stats.failed++;
    stats.errors.push(`User ${userId}: ${e.message}`);
  }
}

function percentile(arr, p) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, idx)];
}

function printReport() {
  const rt = stats.responseTimes;
  const tt = stats.trialSaveTimes;

  console.log('\n' + '═'.repeat(60));
  console.log('  STRESS TEST REPORT');
  console.log('═'.repeat(60));
  console.log(`  Users:          ${TOTAL_USERS}`);
  console.log(`  Completed:      ${stats.completed} ✅`);
  console.log(`  Failed:         ${stats.failed} ❌`);
  console.log(`  Success Rate:   ${((stats.completed / TOTAL_USERS) * 100).toFixed(1)}%`);
  console.log('');

  if (rt.length > 0) {
    console.log('  --- All API Calls ---');
    console.log(`  Total calls:    ${rt.length}`);
    console.log(`  p50 latency:    ${percentile(rt, 50)}ms`);
    console.log(`  p95 latency:    ${percentile(rt, 95)}ms`);
    console.log(`  p99 latency:    ${percentile(rt, 99)}ms`);
    console.log(`  Max latency:    ${Math.max(...rt)}ms`);
    console.log(`  Avg latency:    ${Math.round(rt.reduce((a, b) => a + b, 0) / rt.length)}ms`);
  }

  if (tt.length > 0) {
    console.log('');
    console.log('  --- Trial Save Calls ---');
    console.log(`  Total saves:    ${tt.length}`);
    console.log(`  p50 latency:    ${percentile(tt, 50)}ms`);
    console.log(`  p95 latency:    ${percentile(tt, 95)}ms`);
    console.log(`  p99 latency:    ${percentile(tt, 99)}ms`);
  }

  if (stats.errors.length > 0) {
    console.log('');
    console.log('  --- Errors (first 10) ---');
    stats.errors.slice(0, 10).forEach(e => console.log(`  • ${e}`));
  }

  console.log('═'.repeat(60));

  // Pass/fail criteria
  const successRate = (stats.completed / TOTAL_USERS) * 100;
  const p95 = rt.length > 0 ? percentile(rt, 95) : 0;
  console.log('');
  if (successRate >= 95 && p95 < 2000) {
    console.log('  ✅ PASS: Success rate ≥95% and p95 < 2000ms');
  } else {
    console.log('  ❌ FAIL:');
    if (successRate < 95) console.log(`     Success rate ${successRate.toFixed(1)}% < 95%`);
    if (p95 >= 2000) console.log(`     p95 latency ${p95}ms ≥ 2000ms`);
  }
  console.log('');
}

async function run() {
  console.log(`\n🚀 Starting stress test: ${TOTAL_USERS} concurrent users → ${API}`);
  console.log(`   Batch size: ${CONCURRENCY_BATCH}\n`);

  const startTime = Date.now();

  // Launch in batches
  const users = Array.from({ length: TOTAL_USERS }, (_, i) => i + 1);
  for (let i = 0; i < users.length; i += CONCURRENCY_BATCH) {
    const batch = users.slice(i, i + CONCURRENCY_BATCH);
    const progress = Math.min(i + CONCURRENCY_BATCH, TOTAL_USERS);
    process.stdout.write(`   Launching users ${i + 1}-${progress}/${TOTAL_USERS}...`);
    await Promise.all(batch.map(id => simulateUser(id)));
    console.log(` done (${stats.completed} ok, ${stats.failed} err)`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️  Total time: ${elapsed}s`);

  printReport();
}

run().catch(console.error);
