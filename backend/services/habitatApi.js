const fetch = require('node-fetch');

const HABITAT_API_TIMEOUT = parseInt(process.env.HABITAT_API_TIMEOUT) || 5000;

const makeRequest = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HABITAT_API_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API error: ${response.status} - ${errorText}`
      };
    }

    // Check content type - Habitat API returns CSV for unavailable-commits endpoint
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
      const text = await response.text();
      return { success: true, data: text };
    }

    // Otherwise, try to parse as JSON
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return { success: false, error: 'Request timeout' };
    }
    return { success: false, error: error.message };
  }
};

const claim = async (apiToken, apiUrl, repoId, commitHash) => {
  // Use the correct endpoint: /api/v1/commit-reservations/claim
  const url = `${apiUrl.replace(/\/$/, '')}/api/v1/commit-reservations/claim`;
  
  const result = await makeRequest(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'HabitateWeb/1.0'
    },
    body: JSON.stringify({
      repository_id: repoId, // Use repository_id, not repo_id
      commit_hash: commitHash
    })
  });

  if (!result.success) {
    // Handle 409 (already reserved) as a special case
    if (result.error && result.error.includes('409')) {
      return {
        success: false,
        error: 'Commit already reserved by another user',
        alreadyReserved: true
      };
    }
    return result;
  }

  // Handle response format - check for id or reservation_id
  const reservationId = result.data?.id || result.data?.reservation_id;
  const expiresAt = result.data?.expires_at ? new Date(result.data.expires_at) : null;

  return {
    success: true,
    reservationId: reservationId,
    expiresAt: expiresAt
  };
};

const deleteReservation = async (apiToken, apiUrl, reservationId) => {
  // Use the correct endpoint: /api/v1/commit-reservations/{id}
  const url = `${apiUrl.replace(/\/$/, '')}/api/v1/commit-reservations/${reservationId}`;
  
  const result = await makeRequest(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'HabitateWeb/1.0'
    }
  });

  return result;
};

const getUnavailableCommits = async (apiToken, apiUrl, repoId) => {
  // Use the correct endpoint: /api/v1/code/repos/{id}/unavailable-commits
  const url = `${apiUrl.replace(/\/$/, '')}/api/v1/code/repos/${repoId}/unavailable-commits`;
  
  const result = await makeRequest(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'text/csv, application/json, text/plain, */*',
      'User-Agent': 'HabitateWeb/1.0'
    }
  });

  if (!result.success) {
    return result;
  }

  // Habitat API returns CSV format, not JSON
  // If result.data is a string, it's CSV; if it's an object, try to extract commits
  const csvData = typeof result.data === 'string' ? result.data : (result.data?.commits || result.data || '');

  return {
    success: true,
    commits: csvData
  };
};

const getMyReservations = async (apiToken, apiUrl, includeReleased = false) => {
  // Use the correct endpoint: /api/v1/commit-reservations/my-reservations
  const url = `${apiUrl.replace(/\/$/, '')}/api/v1/commit-reservations/my-reservations?include_released=${includeReleased}`;
  
  const result = await makeRequest(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'HabitateWeb/1.0'
    }
  });

  if (!result.success) {
    return result;
  }

  // Handle different response formats - API might return array directly or wrapped in object
  const reservations = Array.isArray(result.data) ? result.data : (result.data?.reservations || []);

  return {
    success: true,
    reservations: reservations
  };
};

const checkAccountHealth = async (apiToken, apiUrl) => {
  // Use the correct endpoint to get reservations
  const url = `${apiUrl}/api/v1/commit-reservations/my-reservations?include_released=false`;
  
  const result = await makeRequest(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiToken}`
    }
  });
  
  if (!result.success) {
    return {
      success: false,
      health: 'error',
      error: result.error
    };
  }

  // Handle different response formats
  const reservations = result.data?.reservations || result.data || [];
  const activeReservations = reservations.filter(r => {
    // Filter active reservations (not released/expired)
    return r.status === 'reserved' || r.status === 'active' || (!r.released && !r.expired);
  }).length;
  
  return {
    success: true,
    activeReservations,
    totalReservations: reservations.length
  };
};

const getReposStatistics = async (apiToken, apiUrl) => {
  // Use the endpoint: /api/v1/code/repos/statistics?active_only=true
  const url = `${apiUrl.replace(/\/$/, '')}/api/v1/code/repos/statistics?active_only=true`;
  
  const result = await makeRequest(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'application/json',
      'User-Agent': 'HabitateWeb/1.0'
    }
  });

  if (!result.success) {
    return result;
  }

  // Handle response format - should have items array
  const items = result.data?.items || [];
  const total = result.data?.total || items.length;

  return {
    success: true,
    items,
    total
  };
};

module.exports = {
  claim,
  deleteReservation,
  getUnavailableCommits,
  getMyReservations,
  checkAccountHealth,
  getReposStatistics
};
