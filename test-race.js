import http from 'http';

function makeRequest(options, postData) {
  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
      });
    });
    req.on('error', (err) => resolve({ statusCode: 500, error: err.message }));
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

async function runRaceTest() {
  console.log('--- STEP 1: Logging in as Alice ---');
  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'alice', password: 'password123' });

  if (loginRes.statusCode !== 200) {
    console.error('Login failed! Make sure the server is running on port 3000 and seeded.');
    return;
  }

  const token = loginRes.body.token;
  console.log('Login successful! Token received.');

  console.log('\n--- STEP 2: Checking Starting Balance ---');
  const initialBalRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/wallet',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Starting Balance:', initialBalRes.body.balance);

  console.log('\n--- STEP 3: Triggering 2 Concurrent Withdrawal Requests of ₹800 simultaneously ---');
  
  const reqOptions = {
    hostname: 'localhost',
    port: 3000,
    path: '/wallet/withdraw',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };

  const [res1, res2] = await Promise.all([
    makeRequest(reqOptions, { amount: 800 }),
    makeRequest(reqOptions, { amount: 800 })
  ]);

  console.log('\n--- RACE CONDITION TEST RESULTS ---');
  console.log('Request 1 Response:', res1.statusCode, res1.body);
  console.log('Request 2 Response:', res2.statusCode, res2.body);

  console.log('\n--- STEP 4: Checking Final Balance ---');
  const finalBalRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/wallet',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  console.log('Final Balance:', finalBalRes.body.balance);
  if (finalBalRes.body.balance >= 0) {
    console.log('\nSUCCESS: System handled concurrent requests safely! Wallet balance never became negative.');
  } else {
    console.log('\nFAILED: Race condition allowed double withdrawal into negative balance!');
  }
}

runRaceTest();
```[cite: 3]
