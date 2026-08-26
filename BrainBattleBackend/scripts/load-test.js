import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 Options: 100 Virtual Users running for 1 minute
export const options = {
  vus: 100,
  duration: '1m',
  thresholds: {
    // Request failure rate must be under 5%
    http_req_failed: ['rate<0.05'],
    // 95th percentile latency must be under 1.5s (1500ms)
    http_req_duration: ['p(95)<1500'],
  },
};

export default function () {
  // Target URL from the BACKEND_URL environment variable, defaulting to localhost:5000
  const baseUrl = __ENV.BACKEND_URL || 'http://localhost:5000';

  // Perform a GET request to the backend service
  const res = http.get(baseUrl);

  // Validate the response status code is 200
  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  // Short pause to control throughput pacing if desired, but keep it minimal to allow thousands of requests
  sleep(0.1);
}
