const target = process.env.LOAD_TEST_TARGET ?? 'http://localhost:3000/messages';
const totalRequests = Number.parseInt(process.env.LOAD_TEST_REQUESTS ?? '20', 10);
const concurrency = Number.parseInt(process.env.LOAD_TEST_CONCURRENCY ?? '5', 10);

if (!Number.isFinite(totalRequests) || totalRequests <= 0) {
  console.error('LOAD_TEST_REQUESTS must be a positive integer');
  process.exit(1);
}

if (!Number.isFinite(concurrency) || concurrency <= 0) {
  console.error('LOAD_TEST_CONCURRENCY must be a positive integer');
  process.exit(1);
}

const payload = {
  userId: 'load-test-user',
  channel: 'load-test',
  content: 'Hello from load testing script'
};

const sendRequest = async () => {
  const response = await fetch(target, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return {
    status: response.status,
    ok: response.ok
  };
};

const run = async () => {
  let completed = 0;
  let failed = 0;

  const worker = async () => {
    while (completed + failed < totalRequests) {
      try {
        const result = await sendRequest();
        if (!result.ok) {
          failed += 1;
        } else {
          completed += 1;
        }
      } catch (error) {
        failed += 1;
      }
    }
  };

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.allSettled(workers);

  console.log(`Load test completed. Successful: ${completed}, Failed: ${failed}`);
};

run().catch((error) => {
  console.error('Load test failed to execute:', error.message);
  process.exitCode = 1;
});
